#!/usr/bin/env node
// Deliberate command execution entry point. Do not add this to a helper's
// blanket tool grant. Host permissions must cover the actual command.
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { codeFingerprint } from '../lib/changes.mjs'
import { assertProofScope, proofContextValid, proofEnvironment, proofHash, proofPaths, proofStoragePath } from '../lib/proof.mjs'

export function captureProof(root, { checkId, command, args = [], context = null, paths = [], env = {}, timeoutMs = 60000, maxOutputBytes = 1048576, processEnv = process.env } = {}) {
  let scope, before, environment, cwd, dir, proofPath
  try {
    cwd = realpathSync(root)
    if (typeof checkId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(checkId) || typeof command !== 'string' || !command || command.includes('\0') || !Array.isArray(args) || args.some(a => typeof a !== 'string' || a.includes('\0'))) throw new Error('check ID, executable and string argv are required')
    if (!proofContextValid(context)) throw new Error('invalid assignment context')
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000 || !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 16777216) throw new Error('timeout must be 1..3600000 ms and output cap 1..16777216 bytes per stream')
    scope = proofPaths(paths); environment = proofEnvironment(env)
    assertProofScope(cwd, scope)
    before = codeFingerprint(cwd, { paths: scope })
    if (!before.ok) throw new Error(before.error)
    dir = `.verify/proofs/${randomUUID()}`
    proofPath = `${dir}/proof.json`
    const target = proofStoragePath(cwd, proofPath, { createParents: true })
    if (dirname(target) !== resolve(cwd, dir)) throw new Error('capture directory mismatch')
  } catch (error) { return { error: error.message } }
  const startedAt = new Date().toISOString()
  const cleanEnv = { ...processEnv }
  delete cleanEnv.NODE_TEST_CONTEXT
  let result
  try {
    result = spawnSync(command, args, { cwd, shell: false, windowsHide: true, env: cleanEnv, encoding: null, timeout: timeoutMs, maxBuffer: maxOutputBytes, killSignal: 'SIGKILL' })
  } catch (error) { result = { status: null, signal: null, error, stdout: null, stderr: null } }
  const finishedAt = new Date().toISOString()
  const after = codeFingerprint(cwd, { paths: scope })
  let scopeError = null
  try { assertProofScope(cwd, scope) } catch (error) { scopeError = { code: 'IGNORED_SCOPE', message: error.message } }
  const error = result.error ? { code: result.error.code ?? 'SPAWN_FAILED', message: result.error.message } : !after.ok ? { code: 'FINGERPRINT_FAILED', message: after.error } : scopeError
  const outputTooLarge = [result.stdout, result.stderr].some(data => data && data.length > maxOutputBytes)
  const captureError = error ?? (outputTooLarge ? { code: 'OUTPUT_LIMIT', message: 'output exceeded the capture limit' } : null)
  const outcome = captureError ? 'capture-failed' : before.fingerprint !== after.fingerprint ? 'stale' : result.status === 0 && result.signal === null ? 'passed' : 'failed'
  try {
    const outputs = ['stdout', 'stderr'].map(stream => {
      const bytes = (result[stream] ?? Buffer.alloc(0)).subarray(0, maxOutputBytes)
      const path = `${dir}/${stream}.log`
      writeFileSync(proofStoragePath(cwd, path), bytes, { flag: 'wx' })
      return { stream, path, bytes: bytes.length, sha256: proofHash(bytes) }
    })
    const proof = {
      schemaVersion: 2, kind: 'proof', basis: 'captured', context, checkId,
      command: { executable: command, args, shell: false }, cwd: cwd.replace(/\\/g, '/'), paths: scope,
      startedAt, finishedAt, limits: { timeoutMs, maxOutputBytes },
      code: { before: before.fingerprint, after: after.ok ? after.fingerprint : null, head: before.head },
      environment, exitCode: result.status, signal: result.signal, captureError, outcome, outputs,
    }
    writeFileSync(proofStoragePath(cwd, proofPath), `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx' })
    return { proof, proofPath }
  } catch (writeError) { return { error: `capture output could not be saved: ${writeError.message}`, outcome: 'capture-failed' } }
}

const USAGE = `Usage: capture.mjs --check <id> [--cwd <root>] [--context <json-file>] [--paths a,b] [--env <json-file>] [--timeout-ms <n>] [--max-output-bytes <n>] -- <executable> <argv...>

This command executes the named program with shell:false. Host permission is
required for that program. This is not a pre-approved inspection helper.
Output and the captured proof are written below .verify/proofs/.
Timeout limits the direct child; this is not a process-tree isolation service.
Environment JSON holds non-secret descriptive labels, never credentials.
Exit 0: successful unchanged capture; 1: failed/stale capture; 2: invalid input.
`
export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) { process.stdout.write(USAGE); return 0 }
  try {
    const split = argv.indexOf('--')
    if (split === -1) throw new Error('separate the executable with --')
    const { values } = parseArgs({ args: argv.slice(0, split), options: { check: { type: 'string' }, cwd: { type: 'string' }, context: { type: 'string' }, paths: { type: 'string' }, env: { type: 'string' }, 'timeout-ms': { type: 'string' }, 'max-output-bytes': { type: 'string' } }, strict: true })
    const root = resolve(values.cwd ?? process.cwd())
    const result = captureProof(root, { checkId: values.check, command: argv[split + 1], args: argv.slice(split + 2), context: values.context ? JSON.parse(readFileSync(resolve(root, values.context), 'utf8')) : null, paths: values.paths ? values.paths.split(',') : [], env: values.env ? JSON.parse(readFileSync(resolve(root, values.env), 'utf8')) : {}, timeoutMs: values['timeout-ms'] === undefined ? 60000 : Number(values['timeout-ms']), maxOutputBytes: values['max-output-bytes'] === undefined ? 1048576 : Number(values['max-output-bytes']) })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result.error ? (result.outcome === 'capture-failed' ? 1 : 2) : result.proof.outcome === 'passed' ? 0 : 1
  } catch (error) { process.stderr.write(`capture: ${error.message}\n${USAGE}`); return 2 }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main()
