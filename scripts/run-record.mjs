#!/usr/bin/env node
// run-record.mjs — one small record of what a run checked, against which code.
//
// WHAT THIS IS: the shared result format the engineering skills hand to each
// other (`references/artifacts.md`, Run record). A run keeps one record at
// `.verify/evidence/<run-id>/record.json`, beside the output its checks saved:
//
//   start  the task, its scope, the checks it requires, and the code version
//          (HEAD plus every uncommitted change) and environment it began on.
//   add    one check result: the command, its exit code or "unchecked" with a
//          reason, the saved output, and the code version it ran against.
//   note   unresolved work and the next action.
//   gate   may this run claim success? Only when every required check passed
//          on the code as it is now, in the same environment, with its output
//          still on disk. Exits 0 when it may, 1 when it may not.
//
// A check that passed before a later edit is stale, not passed: a review fix
// after `verify` makes verify's checks stale until they run again. A failed
// required check, a required check never run, or one whose output is gone
// blocks the claim. An optional check that could not run (a tool not
// installed) is listed as unchecked and does not block.
//
// This script never runs a command. The agent runs the check and reports the
// exit code; a pre-approved helper that executed arbitrary commands would be a
// shell grant in disguise. What the record makes checkable is that the claim,
// the output, and the code still agree.
//
// The record is temporary run state, kept in `.verify/` (ignored by Git), not
// project memory. Lasting facts go to memory through their owners.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { SCRATCH_DIR, codeFingerprint, scratchIgnored } from './lib/changes.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'
import { proofHash, validateProof } from './lib/proof.mjs'

export const RECORD_SCHEMA_VERSION = 1
export const EVIDENCE_DIR = `${SCRATCH_DIR}/evidence`
export const RECORD_FILE = 'record.json'
/** Failed attempts at one check before the run should stop and report. */
export const ATTEMPT_LIMIT = 3
const STATUSES = ['passed', 'failed', 'unchecked']
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

const list = (raw) => (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const posix = (p) => p.split('\\').join('/')
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16)

function parsePairs(raw) {
  const out = {}
  for (const pair of list(raw)) {
    const at = pair.indexOf('=')
    if (at <= 0) return { error: `--env takes key=value pairs, not "${pair}"` }
    out[pair.slice(0, at).trim()] = pair.slice(at + 1).trim()
  }
  return { pairs: out }
}

/** The environment a check depends on that this script can see, plus pairs the caller names. */
export function environment(extra = {}) {
  const env = { node: process.version, platform: process.platform, arch: process.arch, ...extra }
  const keys = Object.keys(env).sort()
  return { ...Object.fromEntries(keys.map((k) => [k, env[k]])), fingerprint: sha(JSON.stringify(keys.map((k) => [k, env[k]]))) }
}

const slug = (text) =>
  String(text ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'run'

export function newRunId(task, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-')
  return `${stamp}-${slug(task)}`
}

export const runDir = (root, id) => join(root, ...EVIDENCE_DIR.split('/'), id)

/** The most recently written record, for resuming without remembering an id. */
export function latestRunId(root) {
  const dir = join(root, ...EVIDENCE_DIR.split('/'))
  if (!existsSync(dir)) return null
  let best = null
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const file = join(dir, e.name, RECORD_FILE)
    if (!existsSync(file)) continue
    const mtime = statSync(file).mtimeMs
    if (best === null || mtime > best.mtime) best = { id: e.name, mtime }
  }
  return best?.id ?? null
}

export function readRecord(root, id) {
  if (!RUN_ID.test(id ?? '')) return { error: `not a run id: ${id}` }
  const file = join(runDir(root, id), RECORD_FILE)
  if (!existsSync(file)) return { error: `no run record at ${posix(relative(root, file))}` }
  try {
    const record = JSON.parse(readFileSync(file, 'utf8'))
    if (record.schemaVersion !== RECORD_SCHEMA_VERSION || !Array.isArray(record.checks)) return { error: `${posix(relative(root, file))} is not a run record this version reads` }
    return { record }
  } catch (err) {
    return { error: `cannot read ${posix(relative(root, file))}: ${err.message}` }
  }
}

function writeRecord(root, record) {
  const dir = runDir(root, record.runId)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, RECORD_FILE)
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
  return file
}

export function startRun(root, { task, scope = null, paths = [], require = [], skill = null, runId = null, env = {}, now = new Date() }) {
  if (!task) return { error: '--task is required' }
  const id = runId ?? newRunId(task, now)
  if (!RUN_ID.test(id)) return { error: `not a run id: ${id} (letters, digits, dot, dash, underscore)` }
  if (existsSync(join(runDir(root, id), RECORD_FILE))) return { error: `run ${id} already has a record; pick another id or resume it` }
  const code = codeFingerprint(root, { paths })
  if (!code.ok) return { error: code.error }
  const record = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    runId: id,
    task,
    scope: scope ?? (paths.length > 0 ? paths.join(', ') : 'the whole repository'),
    paths,
    skill,
    created: now.toISOString(),
    code: { head: code.head, branch: code.branch, dirty: code.dirty, fingerprint: code.fingerprint },
    environment: environment(env),
    required: require,
    checks: [],
    open: [],
    next: null,
  }
  writeRecord(root, record)
  return { record, dir: posix(relative(root, runDir(root, id))), scratchIgnored: scratchIgnored(root) }
}

export function addCheck(root, record, { name, command = null, exit = null, status = null, output = null, optional = false, reason = null, now = new Date() }) {
  if (!name) return { error: '--check is required' }
  let resolved = status
  if (resolved === null) {
    if (exit === null) return { error: 'give --exit <code> for a check that ran, or --status unchecked --reason "<why>"' }
    resolved = exit === 0 ? 'passed' : 'failed'
  }
  if (!STATUSES.includes(resolved)) return { error: `--status must be one of ${STATUSES.join(', ')}` }
  if (resolved === 'passed' && exit !== null && exit !== 0) return { error: `exit ${exit} is not a pass` }
  if (resolved === 'unchecked' && !reason) return { error: 'an unchecked result needs --reason' }
  if (resolved !== 'unchecked' && output === null) return { error: '--output is required: save the check\'s output to a file and name it' }
  let out = null
  if (output !== null) {
    const abs = isAbsolute(output) ? output : join(root, ...output.split('/'))
    if (!existsSync(abs)) return { error: `the output file ${output} does not exist` }
    out = { path: posix(relative(root, abs)), sha: sha(readFileSync(abs)), bytes: statSync(abs).size }
  }
  const code = codeFingerprint(root, { paths: record.paths })
  if (!code.ok) return { error: code.error }
  const attempt = record.checks.filter((c) => c.name === name).length + 1
  const entry = {
    basis: 'reported',
    name,
    command,
    required: !optional,
    status: resolved,
    exit,
    output: out,
    reason,
    code: code.fingerprint,
    environment: environment(Object.fromEntries(Object.entries(record.environment).filter(([k]) => !['node', 'platform', 'arch', 'fingerprint'].includes(k)))).fingerprint,
    attempt,
    at: now.toISOString(),
  }
  record.checks.push(entry)
  writeRecord(root, record)
  return { record, entry }
}

/** Link an already captured proof. This helper never executes its command. */
export function addProof(root, record, { name, proofPath, optional = false, now = new Date() }) {
  const reportedEnvironment = Object.fromEntries(Object.entries(record.environment).filter(([key]) => !['node', 'platform', 'arch', 'fingerprint'].includes(key)))
  const checked = validateProof(root, proofPath, { checkId: name, paths: record.paths, env: reportedEnvironment })
  if (!checked.ok) return { error: checked.problems.map(p => p.message).join('; ') }
  const proof = checked.proof
  const result = addCheck(root, record, { name, command: [proof.command.executable, ...proof.command.args].join(' '), exit: 0, output: proof.outputs[0].path, optional, now })
  if (result.error) return result
  result.entry.basis = 'captured'
  result.entry.proof = { path: proofPath, sha256: proofHash(readFileSync(resolve(root, proofPath))) }
  writeRecord(root, record)
  return result
}

export function addNote(root, record, { open = [], next = null, resolve: done = [] }) {
  for (const item of open) if (!record.open.includes(item)) record.open.push(item)
  record.open = record.open.filter((item) => !done.includes(item))
  if (next !== null) record.next = next
  writeRecord(root, record)
  return { record }
}

/**
 * May this run claim success? Each check is judged by its latest result.
 * `env` is the caller's current view of the extra environment pairs; with none
 * given, the recorded pairs are assumed unchanged.
 */
export function gateRun(root, record, { env = null, attemptLimit = ATTEMPT_LIMIT, requireCaptured = false } = {}) {
  const code = codeFingerprint(root, { paths: record.paths })
  if (!code.ok) return { error: code.error }
  const recordedExtra = Object.fromEntries(Object.entries(record.environment).filter(([k]) => !['node', 'platform', 'arch', 'fingerprint'].includes(k)))
  const now = environment(env ?? recordedExtra)
  const latest = new Map()
  for (const c of record.checks) latest.set(c.name, c)

  const rows = []
  for (const [name, c] of latest) {
    const failures = record.checks.filter((x) => x.name === name && x.status === 'failed').length
    let state = c.status
    const why = []
    const basis = c.basis === 'captured' ? 'captured' : 'reported'
    if (basis === 'captured') {
      const proof = validateProof(root, c.proof?.path, { checkId: name, paths: record.paths, env: env ?? recordedExtra })
      let unchanged = false
      try { unchanged = c.proof.sha256 === proofHash(readFileSync(resolve(root, c.proof.path))) } catch { /* missing proof */ }
      if (!proof.ok || !unchanged) {
        state = 'invalid-proof'
        why.push(...proof.problems.map(p => p.message), ...(!unchanged ? ['the captured proof record changed or is missing'] : []))
      }
    } else if (requireCaptured && c.status !== 'unchecked') {
      state = 'reported-only'
      why.push('this exit code was supplied by the caller, not captured')
    }
    if (c.status !== 'unchecked') {
      if (c.code !== code.fingerprint) {
        state = 'stale'
        why.push('the code changed after this check ran')
      } else if (c.environment !== now.fingerprint) {
        state = 'stale'
        why.push('the environment changed after this check ran')
      }
      const abs = c.output ? join(root, ...c.output.path.split('/')) : null
      if (abs === null || !existsSync(abs)) {
        state = state === 'passed' ? 'missing-output' : state
        why.push('its saved output is gone')
      } else if (sha(readFileSync(abs)) !== c.output.sha) {
        state = state === 'passed' ? 'missing-output' : state
        why.push('its saved output was overwritten after it was recorded')
      }
    } else if (c.reason) why.push(c.reason)
    rows.push({
      name,
      basis,
      // A check named at start stays required however it was recorded later.
      required: c.required || record.required.includes(name),
      state,
      exit: c.exit,
      output: c.output?.path ?? null,
      attempts: record.checks.filter((x) => x.name === name).length,
      failures,
      overLimit: c.status === 'failed' && failures >= attemptLimit,
      why,
    })
  }
  for (const name of record.required) {
    if (!latest.has(name)) rows.push({ name, required: true, state: 'not-run', exit: null, output: null, attempts: 0, failures: 0, overLimit: false, why: ['required at the start of the run and never recorded'] })
  }

  // Optional means "may be unable to run": an optional check that ran and
  // failed still failed, and blocks like any other.
  const blocking = rows.filter((r) => r.state !== 'passed' && (r.required || r.state === 'failed'))
  const verdict = blocking.some((r) => r.state === 'failed')
    ? 'failed'
    : blocking.some((r) => r.state === 'stale')
      ? 'stale'
      : blocking.length > 0 || !rows.some((r) => r.state === 'passed')
        ? 'incomplete'
        : 'passed'
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    runId: record.runId,
    task: record.task,
    scope: record.scope,
    code: { now: code.fingerprint, atStart: record.code.fingerprint, head: code.head, dirty: code.dirty },
    verdict,
    mayClaimSuccess: verdict === 'passed',
    requireCaptured,
    basis: rows.some(r => r.basis !== 'captured' && r.state !== 'not-run') ? 'reported-or-mixed' : 'captured',
    checks: rows,
    passed: rows.filter((r) => r.state === 'passed').map((r) => r.name),
    failed: rows.filter((r) => r.state === 'failed').map((r) => r.name),
    unchecked: rows.filter((r) => !['passed', 'failed'].includes(r.state)).map((r) => r.name),
    stopAndReport: rows.filter((r) => r.overLimit).map((r) => r.name),
    open: record.open,
    next: record.next,
  }
}

function renderGate(g) {
  const out = [`Run ${g.runId}: ${g.task}`, `Scope: ${g.scope}`, `Code now ${g.code.now}${g.code.dirty ? ' (uncommitted changes)' : ''}`, '']
  out.push(g.basis === 'captured' ? 'Basis: captured proof receipts were checked.' : 'Basis: reported receipts are included. This gate does not prove those commands ran.')
  if (g.checks.length === 0) out.push('No checks recorded.')
  else if (g.passed.length === 0) out.push('No check has passed.')
  for (const c of g.checks) {
    const tag = c.required ? '' : ' (optional)'
    out.push(`  ${c.state.toUpperCase().padEnd(14)} ${c.name}${tag}${c.output ? `  → ${c.output}` : ''}`)
    for (const w of c.why) out.push(`                 ${w}`)
  }
  if (g.stopAndReport.length > 0) out.push('', `Failed ${ATTEMPT_LIMIT} or more times: ${g.stopAndReport.join(', ')}. Stop trying and report what was tried.`)
  if (g.open.length > 0) {
    out.push('', 'Open:')
    for (const o of g.open) out.push(`  - ${o}`)
  }
  if (g.next) out.push('', `Next: ${g.next}`)
  out.push('', g.mayClaimSuccess
    ? 'Every required check passed on the current code. Report the open items with the result.'
    : `Do not report success: ${g.verdict === 'stale' ? 'a required check ran on older code; run it again' : g.verdict === 'failed' ? 'a required check failed' : 'a required check has no current passing result'}.`)
  return out.join('\n')
}

const USAGE = `Usage:
  run-record.mjs start --task "<what>" [--scope "<text>"] [--paths a,b] [--require a,b] [--skill <name>] [--run <id>] [--env k=v,...]
  run-record.mjs add   --run <id|latest> --check <name> --exit <code> --output <file> [--command "<cmd>"] [--optional]
  run-record.mjs add   --run <id|latest> --check <name> --status unchecked --reason "<why>" [--optional]
  run-record.mjs note  --run <id|latest> [--open "<item>"] [--resolve "<item>"] [--next "<action>"]
  run-record.mjs gate  --run <id|latest> [--env k=v,...] [--json]
  run-record.mjs add-proof --run <id|latest> --check <name> --proof <file> [--optional]
  run-record.mjs gate --run <id|latest> --require-captured [--json]

A stage inside a larger run (verify inside autopilot) records into that run
with --run <id>; it starts its own record only when there is none.
  run-record.mjs show  --run <id|latest>

Records live at ${EVIDENCE_DIR}/<run-id>/${RECORD_FILE}. Save each check's output in
that directory and name it with --output. gate exits 0 only when every required
check passed on the current code and environment; 1 otherwise; 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const [mode, ...rest] = argv
  if (mode === '--help' || mode === '-h') {
    process.stdout.write(USAGE)
    return 0
  }
  if (!['start', 'add', 'add-proof', 'note', 'gate', 'show'].includes(mode)) {
    process.stderr.write(`run-record: the first argument must be start, add, note, gate, or show\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  const { values, root, error } = parseCliArgs(rest, {
    extraOptions: {
      task: { type: 'string' },
      scope: { type: 'string' },
      paths: { type: 'string' },
      require: { type: 'string' },
      skill: { type: 'string' },
      run: { type: 'string' },
      env: { type: 'string' },
      check: { type: 'string' },
      exit: { type: 'string' },
      status: { type: 'string' },
      output: { type: 'string' },
      command: { type: 'string' },
      reason: { type: 'string' },
      optional: { type: 'boolean', default: false },
      proof: { type: 'string' },
      'require-captured': { type: 'boolean', default: false },
      open: { type: 'string', multiple: true },
      resolve: { type: 'string', multiple: true },
      next: { type: 'string' },
    },
  })
  const fail = (message) => {
    process.stderr.write(`run-record: ${message}\n`)
    return USAGE_EXIT_CODE
  }
  if (error !== null) return fail(`${error}\n\n${USAGE}`)
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const absRoot = resolve(root)
  const pairs = parsePairs(values.env)
  if (pairs.error) return fail(pairs.error)

  if (mode === 'start') {
    if (values.run !== undefined && RUN_ID.test(values.run) && existsSync(join(runDir(absRoot, values.run), RECORD_FILE))) {
      return fail(`run ${values.run} already exists: record into it with add --run ${values.run}`)
    }
    const r = startRun(absRoot, {
      task: values.task, scope: values.scope ?? null, paths: list(values.paths), require: list(values.require),
      skill: values.skill ?? null, runId: values.run ?? null, env: pairs.pairs,
    })
    if (r.error) return fail(r.error)
    emit({ runId: r.record.runId, dir: r.dir, record: r.record }, [
      `Run ${r.record.runId} started on code ${r.record.code.fingerprint}${r.record.code.dirty ? ' (uncommitted changes)' : ''}.`,
      `Save check output under ${r.dir}/ and record each with: run-record.mjs add --run ${r.record.runId} ...`,
      ...(r.scratchIgnored === false ? [`Note: ${SCRATCH_DIR}/ is not ignored by Git; add it to .gitignore.`] : []),
    ].join('\n'), { json: values.json })
    return 0
  }

  // Name the run, or say `latest` on purpose: a stage that silently picked up
  // another stage's newer record could pass a gate it never had to meet.
  if (values.run === undefined) return fail('--run <id> is required (or --run latest for the newest record)')
  const id = values.run === 'latest' ? latestRunId(absRoot) : values.run
  if (id === null) return fail('no run record found; start one first')
  const read = readRecord(absRoot, id)
  if (read.error) return fail(read.error)
  const record = read.record

  if (mode === 'add-proof') {
    const result = addProof(absRoot, record, { name: values.check, proofPath: values.proof, optional: values.optional })
    if (result.error) return fail(result.error)
    emit(result.entry, `Linked captured proof for ${values.check}.`, { json: values.json })
    return 0
  }

  if (mode === 'add') {
    let exit = null
    if (values.exit !== undefined) {
      exit = Number(values.exit)
      if (!Number.isInteger(exit)) return fail(`--exit must be an integer, not ${values.exit}`)
    }
    const r = addCheck(absRoot, record, {
      name: values.check, command: values.command ?? null, exit, status: values.status ?? null,
      output: values.output ?? null, optional: values.optional, reason: values.reason ?? null,
    })
    if (r.error) return fail(r.error)
    const e = r.entry
    emit(e, `Recorded ${e.name}: ${e.status}${e.required ? '' : ' (optional)'}${e.attempt > 1 ? `, attempt ${e.attempt}` : ''}, on code ${e.code}.`, { json: values.json })
    return 0
  }
  if (mode === 'note') {
    const r = addNote(absRoot, record, { open: values.open ?? [], resolve: values.resolve ?? [], next: values.next ?? null })
    emit(r.record, `Run ${record.runId}: ${r.record.open.length} open item(s)${r.record.next ? `; next: ${r.record.next}` : ''}.`, { json: values.json })
    return 0
  }
  if (mode === 'show') {
    emit(record, JSON.stringify(record, null, 2), { json: values.json })
    return 0
  }
  const g = gateRun(absRoot, record, { env: values.env === undefined ? null : pairs.pairs, requireCaptured: values['require-captured'] })
  if (g.error) return fail(g.error)
  emit(g, renderGate(g), { json: values.json })
  return g.mayClaimSuccess ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
