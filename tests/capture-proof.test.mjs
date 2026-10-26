import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { cleanupAfter, commitAll, initRepo, makeTempRoot, writeTree, childEnv } from './fixtures/build.mjs'
import { captureProof } from '../scripts/verify/capture.mjs'
import { validateProof } from '../scripts/lib/proof.mjs'
import { startRun, addCheck, addProof, gateRun } from '../scripts/run-record.mjs'

const context = { runId: 'run-1', planId: 'plan-1', planRevision: 1, taskId: 'U1', attempt: 1, ownerVersion: 1, workerId: 'worker-1', assignmentId: 'assignment-1' }
function repo(t) {
  const root = makeTempRoot(); cleanupAfter(t, root)
  writeTree(root, { '.gitignore': '.verify/\n', 'src/a.txt': 'original\n' }); initRepo(root); commitAll(root, 'start')
  return root
}
function capture(root, js = 'console.log("proof ok")', extra = {}) {
  return captureProof(root, { command: process.execPath, args: ['-e', js], checkId: 'C1', context, paths: ['src'], processEnv: childEnv(), ...extra })
}
test('proof: actual successful output is current; identity, scope and environment must match', t => {
  const root = repo(t); const r = capture(root, undefined, { env: { fixture: 'one' } })
  assert.equal(r.error, undefined)
  assert.equal(r.proof.outcome, 'passed')
  assert.equal(validateProof(root, r.proofPath, { context, checkId: 'C1', paths: ['src'], env: { fixture: 'one' } }).ok, true)
  assert.equal(validateProof(root, r.proofPath, { context: { ...context, attempt: 2 } }).ok, false)
  assert.equal(validateProof(root, r.proofPath, { paths: ['other'] }).ok, false)
  assert.equal(validateProof(root, r.proofPath, { env: { fixture: 'two' } }).ok, false)
})
test('proof: failed child stays failed; reported pass cannot become captured proof', t => {
  const root = repo(t); const r = capture(root, 'console.error("FAIL");process.exit(7)')
  assert.equal(r.proof.exitCode, 7); assert.equal(r.proof.outcome, 'failed')
  assert.equal(validateProof(root, r.proofPath).ok, false)
  const good = capture(root); const doc = JSON.parse(readFileSync(join(root, good.proofPath), 'utf8'))
  doc.basis = 'reported'; writeFileSync(join(root, good.proofPath), JSON.stringify(doc))
  assert.equal(validateProof(root, good.proofPath).ok, false)
})
test('proof: changed source during capture and later edits make proof stale', t => {
  const root = repo(t)
  const changing = capture(root, 'require("fs").writeFileSync("src/a.txt","changed")')
  assert.equal(changing.proof.outcome, 'stale'); assert.equal(validateProof(root, changing.proofPath).ok, false)
  const good = capture(root); writeFileSync(join(root, 'src/a.txt'), 'later')
  assert.equal(validateProof(root, good.proofPath).ok, false)
})
test('proof: missing and changed output cannot pass', t => {
  const root = repo(t); const r = capture(root)
  writeFileSync(join(root, r.proof.outputs[0].path), 'replacement')
  assert.equal(validateProof(root, r.proofPath).ok, false)
  const next = capture(root); rmSync(join(root, next.proof.outputs[0].path))
  assert.equal(validateProof(root, next.proofPath).ok, false)
})
test('proof: spawn failure, timeout and output cap are capture errors', t => {
  const root = repo(t)
  const missing = capture(root, '', { command: join(root, 'not-a-command') })
  assert.equal(missing.proof.outcome, 'capture-failed')
  const slow = capture(root, 'setTimeout(()=>{},5000)', { timeoutMs: 50 })
  assert.equal(slow.proof.outcome, 'capture-failed')
  const noisy = capture(root, 'process.stdout.write("x".repeat(100000))', { maxOutputBytes: 1024 })
  assert.equal(noisy.proof.outcome, 'capture-failed')
})
test('proof: failing nested node test retains a nonzero exit', t => {
  const root = repo(t)
  writeTree(root, { 'src/fail.test.cjs': 'require("node:test")("fails",()=>{throw Error("seeded failure")})\n' })
  const r = capture(root, '', { args: ['--test', 'src/fail.test.cjs'], processEnv: childEnv() })
  assert.notEqual(r.proof.exitCode, 0); assert.equal(r.proof.outcome, 'failed')
})
test('proof: path traversal and linked evidence roots are refused', t => {
  const root = repo(t); const outside = makeTempRoot(); cleanupAfter(t, outside)
  assert.equal(validateProof(root, '../proof.json').ok, false)
  assert.ok(capture(root, '', { paths: ['../outside'] }).error)
  assert.ok(capture(root, '', { paths: ['.VERIFY/output'] }).error)
  assert.ok(capture(root, '', { paths: ['.GIT/config'] }).error)
  mkdirSync(join(root, '.verify'), { recursive: true })
  symlinkSync(outside, join(root, '.verify/proofs'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.ok(capture(root).error)
})
test('proof: legacy receipt is reported; strict gate needs captured proof', t => {
  const root = repo(t); const { record } = startRun(root, { task: 'proof', require: ['C1'], paths: ['src'] })
  const output = join(root, '.verify/evidence', record.runId, 'manual.txt'); writeFileSync(output, 'claimed pass')
  addCheck(root, record, { name: 'C1', exit: 0, output })
  assert.equal(record.checks[0].basis, 'reported')
  assert.equal(gateRun(root, record).mayClaimSuccess, true)
  assert.equal(gateRun(root, record, { requireCaptured: true }).mayClaimSuccess, false)
  const r = capture(root, undefined, { context: null })
  assert.equal(addProof(root, record, { name: 'C1', proofPath: r.proofPath }).error, undefined)
  assert.equal(gateRun(root, record, { requireCaptured: true }).mayClaimSuccess, true)
  const proofFile = join(root, r.proofPath)
  const changed = JSON.parse(readFileSync(proofFile, 'utf8')); changed.command.args = ['-e', 'different command']
  writeFileSync(proofFile, JSON.stringify(changed))
  assert.equal(gateRun(root, record, { requireCaptured: true }).mayClaimSuccess, false)
})
test('proof: CLI captures actual failure and never treats its result as a usage pass', t => {
  const root = repo(t)
  const cli = fileURLToPath(new URL('../scripts/verify/capture.mjs', import.meta.url))
  const run = spawnSync(process.execPath, [cli, '--check', 'C1', '--cwd', root, '--paths', 'src', '--', process.execPath, '-e', 'process.exit(9)'], { cwd: root, env: childEnv(), encoding: 'utf8', windowsHide: true })
  assert.equal(run.status, 1, run.stderr)
  const captured = JSON.parse(run.stdout)
  assert.equal(captured.proof.exitCode, 9)
  assert.equal(captured.proof.outcome, 'failed')
})
test('proof: malformed records and secret environment labels cannot pass', t => {
  const root = repo(t); const r = capture(root)
  const doc = JSON.parse(readFileSync(join(root, r.proofPath), 'utf8'))
  delete doc.paths; writeFileSync(join(root, r.proofPath), JSON.stringify(doc))
  assert.equal(validateProof(root, r.proofPath).ok, false)
  assert.ok(capture(root, '', { env: { apiKey: 'must not be written' } }).error)
})
test('proof: explicit ignored inputs cannot produce a constant passing fingerprint', t => {
  const root = repo(t)
  writeTree(root, { '.gitignore': '.verify/\nsrc/ignored.txt\n', 'src/ignored.txt': 'input one' })
  assert.match(capture(root, '', { paths: ['src/ignored.txt'] }).error, /ignored/)
  assert.match(capture(root).error, /ignored/)
  rmSync(join(root, 'src/ignored.txt'))
  const good = capture(root)
  assert.equal(good.proof.outcome, 'passed')
  writeFileSync(join(root, 'src/ignored.txt'), 'input two')
  assert.equal(validateProof(root, good.proofPath, { paths: ['src'] }).ok, false)
})
test('proof: the acceptance reader rejects malformed nested contract fields', t => {
  const root = repo(t); const r = capture(root)
  const file = join(root, r.proofPath)
  const original = JSON.parse(readFileSync(file, 'utf8'))
  const mutations = [
    ['missing code head', p => { delete p.code.head }],
    ['wrong code head type', p => { p.code.head = 42 }],
    ['extra command field', p => { p.command.unexpected = true }],
    ['extra limit field', p => { p.limits.unexpected = true }],
    ['extra code field', p => { p.code.unexpected = true }],
    ['extra environment field', p => { p.environment.unexpected = true }],
    ['extra observed field', p => { p.environment.observed.unexpected = true }],
    ['extra output field', p => { p.outputs[0].unexpected = true }],
    ['duplicate path', p => { p.paths = ['src', 'src'] }],
    ['noncanonical path', p => { p.paths = ['src/'] }],
    ['dot path segment', p => { p.paths = ['src/./a.txt'] }],
    ['empty path segment', p => { p.paths = ['src//a.txt'] }],
    ['unsafe context integer', p => { p.context.attempt = Number.MAX_SAFE_INTEGER + 1 }],
    ['wrong context ID type', p => { p.context.runId = 123 }],
  ]
  for (const [name, mutate] of mutations) {
    const invalid = structuredClone(original); mutate(invalid)
    writeFileSync(file, JSON.stringify(invalid))
    assert.equal(validateProof(root, r.proofPath).ok, false, name)
  }
  writeFileSync(file, JSON.stringify(original))
  assert.equal(validateProof(root, r.proofPath).ok, true)
})
test('proof: multiple Git-backed scopes pass while any ignored scope still fails', t => {
  const root = repo(t)
  writeTree(root, { 'tests/check.txt': 'tracked input' }); commitAll(root, 'second scope')
  const good = capture(root, undefined, { paths: ['src', 'tests'] })
  assert.equal(good.error, undefined)
  assert.equal(good.proof.outcome, 'passed')
  assert.equal(validateProof(root, good.proofPath, { paths: ['src', 'tests'] }).ok, true)
  writeTree(root, { '.gitignore': '.verify/\ntests/hidden.txt\n', 'tests/hidden.txt': 'ignored input' })
  assert.match(capture(root, '', { paths: ['src', 'tests/hidden.txt'] }).error, /ignored/)
  assert.match(capture(root, '', { paths: ['src', 'tests'] }).error, /ignored/)
})
