// Captured receipts are local evidence, not signatures. A host must authorize
// the separate capture CLI. Neither a JSON field nor this reader grants access.
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { codeFingerprint, isGitCheckout } from './changes.mjs'
import { runGit } from './git.mjs'

export const PROOF_SCHEMA_VERSION = 2
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const HASH = /^[a-f0-9]{64}$/
const CONTEXT_STRINGS = ['runId', 'planId', 'taskId', 'workerId', 'assignmentId']
const CONTEXT_NUMBERS = ['planRevision', 'attempt', 'ownerVersion']
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasFields = (value, fields) => plain(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key))
const commandString = value => typeof value === 'string' && !value.includes('\0')
const codeHash = value => typeof value === 'string' && /^[a-f0-9]{16}$/.test(value)
const longHash = value => typeof value === 'string' && HASH.test(value)
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
export const proofHash = bytes => createHash('sha256').update(bytes).digest('hex')
const stable = value => JSON.stringify(value, Object.keys(value).sort())
const posix = value => value.replace(/\\/g, '/')

export function proofPaths(paths = []) {
  if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string' || !p || /[:*?\[\]\0]/.test(p) || isAbsolute(p) || p.startsWith('/') || p.startsWith('\\') || posix(p).split('/').includes('..'))) throw new Error('paths must be literal repository-relative paths')
  const normalized = [...new Set(paths.map(p => posix(p).replace(/^\.\//, '').replace(/\/+$/, '')))].sort()
  if (normalized.some(p => !p || /^(?:\.verify|\.git)(?:\/|$)/i.test(p))) throw new Error('proof scope must not contain runtime evidence or Git metadata paths')
  if (normalized.some(p => p !== '.' && p.split('/').some(part => !part || part === '.' || part === '..'))) throw new Error('scope paths must use plain path segments')
  return normalized.includes('.') ? [] : normalized
}

export function proofContextValid(context) {
  return context === null || (plain(context) && Object.keys(context).length === 8 && CONTEXT_STRINGS.every(k => typeof context[k] === 'string' && TOKEN.test(context[k])) && CONTEXT_NUMBERS.every(k => Number.isSafeInteger(context[k]) && context[k] > 0))
}

/** Explicit scopes must not hide named input files behind Git ignore rules. */
export function assertProofScope(root, paths) {
  if (paths.length === 0 || !isGitCheckout(root)) return
  // --quiet accepts only one pathname. Capture output privately so a scope
  // with several paths gets the same ignore check as a single-path scope.
  const direct = runGit(['check-ignore', '--', ...paths], { cwd: root })
  if (direct.status === 0) throw new Error('explicit proof scope includes a Git-ignored path; use tracked inputs or a separate checked input source')
  if (direct.status !== 1) throw new Error('could not check scope ignore rules')
  const nested = runGit(['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', ...paths], { cwd: root })
  if (!nested.ok) throw new Error('could not check ignored files under proof scope')
  if (nested.stdout.length > 0) throw new Error('explicit proof scope contains Git-ignored files; their contents are not in the code fingerprint')
}

export function proofEnvironment(reported = {}) {
  if (!plain(reported) || Object.entries(reported).some(([key,value]) => !TOKEN.test(key) || /secret|token|password|credential|cookie|authorization|api.?key/i.test(key) || typeof value !== 'string' || value.length > 2048)) throw new Error('env takes non-secret descriptive string labels only')
  const observed = { node: process.version, platform: process.platform, arch: process.arch }
  const sorted = Object.fromEntries(Object.entries(reported).sort(([a],[b]) => a.localeCompare(b)))
  return { observed, reported: sorted, fingerprint: proofHash(JSON.stringify([observed, sorted])) }
}

/** Refuse links in every existing component, even links back into the root. */
export function proofStoragePath(root, rel, { createParents = false } = {}) {
  if (typeof rel !== 'string' || !/^\.verify\/(?:proofs|evidence)\//.test(rel) || rel.includes('\\') || rel.split('/').some(p => !p || p === '..' || p === '.') || /[:\0]/.test(rel)) throw new Error('proof files must be under .verify/proofs/ or .verify/evidence/')
  const base = realpathSync(root)
  const target = resolve(base, rel)
  const inside = relative(base, target)
  if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) throw new Error('proof path leaves repository')
  const parts = rel.split('/')
  let cursor = base
  for (let i = 0; i < parts.length; i++) {
    cursor = join(cursor, parts[i])
    if (existsSync(cursor)) {
      const stat = lstatSync(cursor)
      if (stat.isSymbolicLink()) throw new Error('linked evidence paths are not allowed')
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('evidence parent is not a directory')
    } else if (createParents && i < parts.length - 1) mkdirSync(cursor)
  }
  return target
}

export function validateProof(root, proofPath, { context, checkId, paths, env } = {}) {
  const problems = []
  const add = (kind, message) => problems.push({ kind, message })
  let proof
  try {
    const file = proofStoragePath(root, proofPath)
    if (!lstatSync(file).isFile()) throw new Error('proof is not a regular file')
    if (lstatSync(file).size > 2 * 1024 * 1024) throw new Error('proof record is too large')
    proof = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) { return { ok: false, problems: [{ kind: 'proof-read', message: error.message }] } }
  if (!plain(proof) || proof.schemaVersion !== 2 || proof.kind !== 'proof' || proof.basis !== 'captured') return { ok: false, problems: [{ kind: 'proof-schema', message: 'only v2 captured proof can satisfy this check' }], proof }
  const fields = ['schemaVersion', 'kind', 'basis', 'context', 'checkId', 'command', 'cwd', 'paths', 'startedAt', 'finishedAt', 'limits', 'code', 'environment', 'exitCode', 'signal', 'captureError', 'outcome', 'outputs']
  if (!hasFields(proof, fields)) add('proof-schema', 'proof fields do not match version 2')
  try {
    if (!Array.isArray(proof.paths) || JSON.stringify(proof.paths) !== JSON.stringify(proofPaths(proof.paths))) throw new Error('stored scope paths must be unique, sorted, and canonical')
  } catch (error) { add('proof-schema', error.message) }
  if (!hasFields(proof.command, ['executable', 'args', 'shell']) || !commandString(proof.command.executable) || !proof.command.executable || !Array.isArray(proof.command.args) || !proof.command.args.every(commandString) || proof.command.shell !== false) add('proof-schema', 'invalid command fields')
  if (!hasFields(proof.limits, ['timeoutMs', 'maxOutputBytes'])) add('proof-schema', 'invalid limit fields')
  if (!hasFields(proof.code, ['before', 'after', 'head']) || !codeHash(proof.code.before) || !(proof.code.after === null || codeHash(proof.code.after)) || !(proof.code.head === null || typeof proof.code.head === 'string')) add('proof-schema', 'invalid code fields')
  if (!hasFields(proof.environment, ['observed', 'reported', 'fingerprint']) || !hasFields(proof.environment.observed, ['node', 'platform', 'arch']) || !Object.values(proof.environment.observed).every(v => typeof v === 'string') || !plain(proof.environment.reported) || !longHash(proof.environment.fingerprint)) add('proof-schema', 'invalid environment fields')
  else {
    try { proofEnvironment(proof.environment.reported) } catch (error) { add('proof-schema', error.message) }
  }
  if (typeof proof.cwd !== 'string' || !proof.cwd || !isoDate(proof.startedAt) || !isoDate(proof.finishedAt)) add('proof-schema', 'invalid capture location or dates')
  if (!(proof.exitCode === null || Number.isSafeInteger(proof.exitCode)) || !(proof.signal === null || typeof proof.signal === 'string')) add('proof-schema', 'invalid exit or signal fields')
  if (proof.captureError !== null && (!hasFields(proof.captureError, ['code', 'message']) || typeof proof.captureError.code !== 'string' || typeof proof.captureError.message !== 'string')) add('proof-schema', 'invalid capture error fields')
  if (!['passed', 'failed', 'stale', 'capture-failed'].includes(proof.outcome)) add('proof-schema', 'invalid capture outcome')
  if (!Array.isArray(proof.outputs) || proof.outputs.length !== 2 || proof.outputs.some(output => !hasFields(output, ['stream', 'path', 'bytes', 'sha256']) || !['stdout', 'stderr'].includes(output.stream) || typeof output.path !== 'string' || !Number.isSafeInteger(output.bytes) || output.bytes < 0 || output.bytes > 16777216 || !longHash(output.sha256))) add('proof-schema', 'invalid output fields')
  if (problems.length) return { ok: false, problems, proof }
  if (!proofContextValid(proof.context)) add('proof-context', 'invalid assignment context')
  if (context !== undefined && (!proofContextValid(context) || stable(context ?? {}) !== stable(proof.context ?? {}))) add('proof-context', 'proof belongs to a different assignment')
  if (typeof proof.checkId !== 'string' || !TOKEN.test(proof.checkId) || (checkId !== undefined && proof.checkId !== checkId)) add('proof-check', 'wrong or missing check ID')
  if (!plain(proof.command) || typeof proof.command.executable !== 'string' || !proof.command.executable || !Array.isArray(proof.command.args) || proof.command.args.some(a => typeof a !== 'string') || proof.command.shell !== false) add('proof-command', 'missing explicit executable and argv')
  if (proof.cwd !== posix(realpathSync(root))) add('proof-cwd', 'proof was captured in a different checkout')
  if (typeof proof.startedAt !== 'string' || typeof proof.finishedAt !== 'string' || !Number.isFinite(Date.parse(proof.startedAt)) || !Number.isFinite(Date.parse(proof.finishedAt)) || Date.parse(proof.finishedAt) < Date.parse(proof.startedAt)) add('proof-time', 'invalid capture times')
  if (proof.outcome !== 'passed' || proof.exitCode !== 0 || proof.signal !== null || proof.captureError !== null) add('proof-outcome', `capture is not a successful check: ${proof.outcome}`)
  if (!plain(proof.limits) || !Number.isInteger(proof.limits.timeoutMs) || proof.limits.timeoutMs < 1 || proof.limits.timeoutMs > 3600000 || !Number.isInteger(proof.limits.maxOutputBytes) || proof.limits.maxOutputBytes < 1 || proof.limits.maxOutputBytes > 16777216) add('proof-limits', 'invalid capture limits')
  try {
    const scope = proofPaths(proof.paths)
    assertProofScope(root, scope)
    if (paths !== undefined && JSON.stringify(scope) !== JSON.stringify(proofPaths(paths))) add('proof-scope', 'capture scope does not match the required scope')
    const current = codeFingerprint(root, { paths: scope })
    if (!plain(proof.code) || !current.ok || !proof.code.before || proof.code.before !== proof.code.after || proof.code.after !== current.fingerprint) add('proof-stale', 'source changed during or after capture, or cannot be read')
    if (!plain(proof.environment) || !plain(proof.environment.reported)) throw new Error('missing environment record')
    const now = proofEnvironment(env ?? proof.environment.reported)
    if (proof.environment.fingerprint !== now.fingerprint || stable(proof.environment.observed) !== stable(now.observed)) add('proof-environment', 'capture environment no longer matches')
  } catch (error) { add('proof-scope', error.message) }
  if (!Array.isArray(proof.outputs) || proof.outputs.length !== 2 || proof.outputs[0]?.stream !== 'stdout' || proof.outputs[1]?.stream !== 'stderr') add('proof-output', 'stdout and stderr records are required')
  else for (const output of proof.outputs) {
    try {
      if (!HASH.test(output.sha256 ?? '') || !Number.isSafeInteger(output.bytes) || output.bytes < 0 || output.bytes > proof.limits?.maxOutputBytes) throw new Error('invalid output hash or length')
      if (output.path !== `${proofPath.slice(0, proofPath.lastIndexOf('/'))}/${output.stream}.log`) throw new Error('output belongs to another capture directory')
      const file = proofStoragePath(root, output.path)
      if (!lstatSync(file).isFile() || lstatSync(file).size !== output.bytes) throw new Error('output is missing or its size changed')
      if (proofHash(readFileSync(file)) !== output.sha256) throw new Error('output changed')
    } catch (error) { add('proof-output', error.message) }
  }
  return { ok: problems.length === 0, problems, proof }
}
