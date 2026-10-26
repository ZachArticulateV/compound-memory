// The public CLIs must agree on the files they exchange. This walks a real
// failing check through a corrected task and final combined acceptance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { childEnv, cleanupAfter, commitAll, gitAvailable, initRepo, makeTempRoot, writeTree } from './fixtures/build.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

test('shared work CLI: failed proof blocks acceptance; fixed task and combined proof pass; lost proof revokes success', t => {
  if (!gitAvailable()) { t.skip('Git is required for the public workflow test'); return }
  const parent = makeTempRoot()
  cleanupAfter(t, parent)
  const root = join(parent, 'project with spaces')
  const plan = JSON.parse(readFileSync(join(repo, 'examples/contracts/small.plan.json'), 'utf8'))
  writeTree(root, {
    'plan.json': JSON.stringify(plan),
    'src/calculation.mjs': 'export const calc = (a, b) => a - b\n',
    'tests/calculation.test.mjs': "import { test } from 'node:test'; import assert from 'node:assert/strict'; import { calc } from '../src/calculation.mjs'; test('sum', () => assert.equal(calc(2, 3), 5));\n",
    '.gitignore': '.verify/\n',
    '.verify/request.json': '{}',
  })
  initRepo(root)
  commitAll(root, 'fixture')
  const cli = (script, args, expected = 0) => {
    const out = spawnSync(process.execPath, [join(repo, 'scripts', script), ...args], { cwd: root, env: childEnv(), encoding: 'utf8', timeout: 30000 })
    assert.equal(out.status, expected, `${script}: ${out.stderr}\n${out.stdout}`)
    return JSON.parse(out.stdout)
  }
  let ledger
  const state = (operation, input = {}, expected = 0, extra = []) => {
    writeFileSync(join(root, '.verify/request.json'), JSON.stringify(input))
    const result = cli('run-state.mjs', [operation, '--run', 'example', '--plan', 'plan.json', '--input', '.verify/request.json', ...extra], expected)
    if (result.ledger) ledger = result.ledger
    return result
  }
  const owner = () => ({ ownerId: 'lead', ownerVersion: ledger.owner.version, expectedRevision: ledger.revision })
  assert.equal(cli('plan-check.mjs', ['plan.json', '--json']).problems.length, 0)
  state('init', { ownerId: 'lead', leaseMs: 600000 })
  state('claim', { ...owner(), taskId: 'U1', workerId: 'coder', role: 'code', workspace: '.', leaseMs: 300000, timeLimitMs: 300000, outputLimitBytes: 100000 })
  const context = state('context', {}, 0, ['--task', 'U1']).context
  writeFileSync(join(root, '.verify/context.json'), JSON.stringify(context))
  const capture = (whole = false, expected = 0) => cli('verify/capture.mjs', [
    '--check', 'C1', '--context', '.verify/context.json',
    ...(whole ? [] : ['--paths', 'src/calculation.mjs,tests/calculation.test.mjs']),
    '--', process.execPath, '--test', 'tests/calculation.test.mjs',
  ], expected)
  const result = (id, proof) => ({ schemaVersion: 2, kind: 'result', resultId: id, context, status: 'completed', changedPaths: ['src/calculation.mjs'], proofs: [proof.proofPath], blockers: [], findings: [], summary: 'Calculation checked.' })
  const failed = capture(false, 1)
  assert.equal(failed.proof.outcome, 'failed')
  state('submit', result('bad', failed))
  assert.equal(state('accept', { ...owner(), resultId: 'bad' }, 1).ok, false)
  assert.notEqual(ledger.tasks.U1.state, 'accepted')

  writeFileSync(join(root, 'src/calculation.mjs'), 'export const calc = (a, b) => a + b\n')
  const passed = capture()
  state('submit', result('good', passed))
  state('accept', { ...owner(), resultId: 'good' })
  assert.equal(ledger.tasks.U1.state, 'accepted')
  assert.equal(state('inspect', {}, 1).mayClaimSuccess, false, 'worker proof is not combined proof')

  const finalContext = state('context', {}, 0, ['--task', 'integration']).context
  writeFileSync(join(root, '.verify/context.json'), JSON.stringify(finalContext))
  const combined = capture(true)
  state('integrate', { ...owner(), proofs: [combined.proofPath] })
  assert.equal(state('inspect').mayClaimSuccess, true)
  writeFileSync(join(root, combined.proof.outputs[0].path), 'changed output\n')
  assert.equal(state('inspect', {}, 1).mayClaimSuccess, false)
})
