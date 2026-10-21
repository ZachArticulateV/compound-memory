// The agent-task graders, tested without an agent.
//
// evals/run.mjs grades what an agent leaves behind. A grader that accepts
// anything would turn every run into a pass, so each task here is graded
// twice before any model runs: on its fixture as set up (nothing done), or on
// a known-wrong reply, it must fail; on the reference solution or a right
// reply, it must pass.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TASKS } from '../evals/tasks.mjs'
import { git, gitAvailable, removeTempRoot } from './fixtures/build.mjs'

for (const task of TASKS) {
  test(`eval ${task.id}: the grader fails the untouched fixture or wrong reply, and passes the right outcome`, (t) => {
    if (!gitAvailable()) t.skip('git is not installed')
    const root = task.setup()
    t.after(() => removeTempRoot(root))
    const start = git(root, ['rev-parse', 'HEAD']).trim()
    const wrong = task.grade(root, task.wrongReply ?? '', start)
    assert.equal(wrong.correct, false, `accepted the untouched fixture: ${JSON.stringify(wrong)}`)
    if (task.solve) task.solve(root)
    const right = task.grade(root, task.rightReply ?? '', start)
    assert.equal(right.correct, true, `rejected the reference outcome: ${JSON.stringify(right)}`)
  })
}

test('every eval task names its size, and the set includes small tasks', () => {
  for (const task of TASKS) assert.ok(['small', 'medium'].includes(task.size), task.id)
  assert.ok(TASKS.filter((t) => t.size === 'small').length >= 2)
  assert.equal(new Set(TASKS.map((t) => t.id)).size, TASKS.length)
})
