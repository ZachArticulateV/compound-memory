import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validatePlan, planFingerprint, tasksConflict, readyTasks } from '../scripts/lib/plan-contract.mjs'
import { checkPlan } from '../scripts/plan-check.mjs'
import { analyzeTickets, parseTicket } from '../scripts/tickets-check.mjs'
import { childEnv, cleanupAfter, makeFixture } from './fixtures/build.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
function plan() {
  return {
    schemaVersion: 2, kind: 'plan', planId: 'sample', revision: 1, title: 'Sample',
    requirements: [{ id: 'R1', description: 'Return the result.' }], decisions: [], exclusions: [], risks: [],
    phases: [{ id: 'P1', title: 'Core' }, { id: 'P2', title: 'Extra' }],
    checks: [{ id: 'C1', description: 'Test expected output.' }], finalChecks: ['C1'],
    gates: [{ id: 'G1', phaseId: 'P1', dependsOn: ['U1'], requiredChecks: ['C1'] }],
    tasks: [
      { id: 'U1', title: 'Core', phaseId: 'P1', covers: ['R1'], dependsOn: [], requiresGates: [], paths: ['src/a'], resources: [], requiredChecks: ['C1'] },
      { id: 'U2', title: 'Extra', phaseId: 'P2', covers: ['R1'], dependsOn: [], requiresGates: [], paths: ['src/b'], resources: [], requiredChecks: ['C1'] },
    ],
  }
}

test('v2 plan: independent phases have no implicit barrier', () => {
  const p = plan()
  assert.equal(validatePlan(p).ok, true)
  assert.deepEqual(readyTasks(p).ready, ['U1', 'U2'])
  p.tasks[1].requiresGates = ['G1']
  assert.deepEqual(readyTasks(p).ready, ['U1'])
  assert.deepEqual(readyTasks(p, { acceptedTasks: ['U1'], passedGates: ['G1'] }).ready, ['U2'])
})

test('v2 plan: task/gate cycles and unknown blockers expose no ready tasks', () => {
  const p = plan()
  p.tasks[0].requiresGates = ['G1']
  assert.ok(validatePlan(p).problems.some(x => x.kind === 'cycle'))
  assert.deepEqual(readyTasks(p).ready, [])
  p.tasks[0].requiresGates = []
  p.tasks[1].dependsOn = ['missing']
  assert.equal(validatePlan(p).ok, false)
  assert.deepEqual(readyTasks(p).ready, [])
})

test('v2 plan: paths and shared resources wait in stable task order', () => {
  const p = plan()
  p.tasks[1].paths = ['SRC/A/child.mjs']
  assert.equal(validatePlan(p).ok, true)
  assert.deepEqual(readyTasks(p), { ok: true, problems: [], ready: ['U1'], waiting: ['U2'] })
  assert.deepEqual(readyTasks(p, { activeTasks: ['U2'] }).ready, [])
  assert.equal(readyTasks(p, { activeTasks: ['U1', 'U2'] }).ok, false)
  p.tasks[1].paths = ['src/b']
  p.tasks[0].resources = ['port:3000']
  p.tasks[1].resources = ['PORT:3000']
  assert.deepEqual(readyTasks(p).ready, ['U1'])
  assert.equal(tasksConflict({ paths: ['.'], resources: [] }, p.tasks[1]), true)
  assert.equal(tasksConflict({ paths: ['src/a'], resources: [] }, { paths: ['src/ab'], resources: [] }), false)
})

test('v2 plan: invalid versions, types, IDs, paths and required checks fail closed', () => {
  const mutations = [
    p => { p.schemaVersion = 3 }, p => { p.revision = 0 }, p => { p.tasks[0].status = 'accepted' },
    p => { p.tasks[0].phaseId = 'missing' }, p => { p.tasks[0].requiredChecks = [] },
    p => { p.tasks[0].requiredChecks = ['unknown'] }, p => { p.tasks[1].id = 'U1' },
    p => { p.gates[0].id = 'U1' }, p => { p.requirements.push({ id: 'R2', description: 'Uncovered' }) },
    p => { p.tasks[0].paths = ['../private'] }, p => { p.tasks[0].paths = ['C:/private'] },
    p => { p.tasks[0].paths = ['src/*'] }, p => { p.tasks[0].paths = ['src/../private'] },
    p => { p.tasks[0].paths = ['src\\a'] }, p => { p.tasks[0].resources = [''] },
    p => { p.finalChecks = [] }, p => { p.phases = null },
  ]
  for (const mutate of mutations) {
    const p = plan(); mutate(p)
    assert.equal(validatePlan(p).ok, false, JSON.stringify(p))
    assert.deepEqual(readyTasks(p).ready, [])
  }
  for (const p of [null, [], 'plan', 2]) assert.equal(validatePlan(p).ok, false)
})

test('v2 plan: unknown and contradictory run inputs cannot bypass checks', () => {
  const p = plan()
  assert.equal(readyTasks(p, null).ok, false)
  assert.equal(readyTasks(p, { acceptedTasks: ['missing'] }).ok, false)
  assert.equal(readyTasks(p, { activeTasks: ['U1'], acceptedTasks: ['U1'] }).ok, false)
  assert.equal(readyTasks(p, { passedGates: ['G1'] }).ok, false)
  p.tasks[1].dependsOn = ['U1']
  assert.equal(readyTasks(p, { acceptedTasks: ['U2'] }).ok, false)
})

test('v2 plan: ineligible tasks do not claim a resource or satisfy a dependency', () => {
  const p = plan()
  p.tasks[1].paths = ['src/a/child.mjs']
  assert.deepEqual(readyTasks(p, { eligibleTasks: ['U2'] }).ready, ['U2'])
  p.tasks[1].dependsOn = ['U1']
  assert.deepEqual(readyTasks(p, { eligibleTasks: ['U2'] }).ready, [])
  assert.equal(readyTasks(p, { eligibleTasks: ['missing'] }).ok, false)
})

test('v2 plan: fingerprint ignores object key order but changes with scope or revision', () => {
  const p = plan()
  const copy = Object.fromEntries(Object.entries(p).reverse())
  assert.equal(planFingerprint(p), planFingerprint(copy))
  copy.revision = 2
  assert.notEqual(planFingerprint(p), planFingerprint(copy))
})

test('v2 plan: CLI reads JSON and rejects an unknown version', t => {
  const p = plan()
  const dir = makeFixture({ 'plan.json': JSON.stringify(p), 'bad.json': JSON.stringify({ ...p, schemaVersion: 99 }) })
  cleanupAfter(t, dir)
  const run = name => spawnSync(process.execPath, [join(root, 'scripts/plan-check.mjs'), join(dir, name), '--json'], { encoding: 'utf8', env: childEnv() })
  assert.equal(run('plan.json').status, 0)
  assert.equal(run('bad.json').status, 1)
})

const legacy = `# Plan\n## Requirements\n- R1: works\n## Out of scope\n- Other work\n## Units\n### U1: one\n- Covers: R1\n- Verify: node test.mjs\n- Depends on: U2\n### U2: two\n- Covers: R1\n- Verify: node test.mjs\n- Depends on: U1\n## Verification\nnode test.mjs\n`
test('legacy plans: cycles and unknown explicit versions fail', () => {
  assert.equal(checkPlan(legacy).ready, false)
  const good = legacy.replace('- Depends on: U1', '- Depends on: None')
  assert.equal(checkPlan(good).ready, true)
  assert.equal(checkPlan('Schema version: 1\n' + good).ready, true)
  assert.equal(checkPlan('Schema version: 9\n' + good).ready, false)
})

test('legacy tickets: unsafe graphs expose no frontier or waves', () => {
  const ticket = parseTicket('01-test.md', '# 1: test\n**Blocked by:** 99\n**Touches:** src/a\n**Verify with:** node test.mjs\n')
  const result = analyzeTickets([ticket])
  assert.deepEqual(result.frontier, [])
  assert.deepEqual(result.waves, [])
  ticket.blockedBy = []
  ticket.touches = ['../private']
  assert.deepEqual(analyzeTickets([ticket]).frontier, [])
})

test('legacy tickets: waves serialize path conflicts and unknown scopes', () => {
  const one = parseTicket('01-test.md', '# 1: test\n**Touches:** src/a\n**Verify with:** node test.mjs\n')
  const two = parseTicket('02-test.md', '# 2: test\n**Touches:** SRC/a/x\n**Verify with:** node test.mjs\n')
  const three = parseTicket('03-test.md', '# 3: test\n**Verify with:** node test.mjs\n')
  assert.deepEqual(analyzeTickets([one, two, three]).waves, [['1'], ['2'], ['3']])
})
