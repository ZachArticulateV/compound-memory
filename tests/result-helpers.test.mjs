// The helpers behind the shared result format and the readiness checks:
// run-record.mjs, changes.mjs, pr-state.mjs, plan-check.mjs, rewrite-check.mjs,
// and lesson drift in lessons.mjs. Each test pins one fact the helper decides
// and, where it matters, the neighbouring case that must stay quiet.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { cleanupAfter, commitAll, git, gitAvailable, initRepo, makeTempRoot, writeTree } from './fixtures/build.mjs'
import { addCheck, addNote, gateRun, latestRunId, readRecord, startRun } from '../scripts/run-record.mjs'
import { codeFingerprint } from '../scripts/lib/changes.mjs'
import { reviewScope, checkStaged } from '../scripts/changes.mjs'
import { classifyCheck, prState } from '../scripts/pr-state.mjs'
import { checkPlan } from '../scripts/plan-check.mjs'
import { compareRewrite } from '../scripts/rewrite-check.mjs'
import { lessonDrift, lessonsWithDrift } from '../scripts/lessons.mjs'
import { parseLesson } from '../scripts/lib/lessons.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = (name) => join(repoRoot, 'scripts', name)
const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' })

function repo(t, files = { 'lib/a.mjs': 'export const a = 1\n', 'docs/x.md': '# x\n', '.gitignore': '.verify/\n' }) {
  if (!gitAvailable()) t.skip('git is not installed')
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, files)
  initRepo(root)
  commitAll(root, 'initial')
  return root
}

function saved(root, record, name, text = 'ok\n') {
  const file = join(root, '.verify', 'evidence', record.runId, `${name}.log`)
  writeFileSync(file, text)
  return file
}

// ---------------------------------------------------------------------------
// run-record
// ---------------------------------------------------------------------------

test('run record: a required check never recorded keeps the run incomplete', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't', require: ['tests', 'lint'] })
  addCheck(root, record, { name: 'tests', exit: 0, output: saved(root, record, 'tests') })
  const g = gateRun(root, record)
  assert.equal(g.verdict, 'incomplete')
  assert.deepEqual(g.unchecked, ['lint'])
})

test('run record: an optional check that could not run does not block; a required one does', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't' })
  addCheck(root, record, { name: 'tests', exit: 0, output: saved(root, record, 'tests') })
  addCheck(root, record, { name: 'browser', status: 'unchecked', reason: 'no Playwright', optional: true })
  assert.equal(gateRun(root, record).verdict, 'passed')
  addCheck(root, record, { name: 'migration', status: 'unchecked', reason: 'no database' })
  assert.equal(gateRun(root, record).mayClaimSuccess, false)
})

test('run record: a failed required check blocks even after other checks pass', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't' })
  addCheck(root, record, { name: 'tests', exit: 1, output: saved(root, record, 'tests', 'FAIL\n') })
  addCheck(root, record, { name: 'lint', exit: 0, output: saved(root, record, 'lint') })
  const g = gateRun(root, record)
  assert.equal(g.verdict, 'failed')
  assert.deepEqual(g.failed, ['tests'])
})

test('run record: the latest result of a check is the one that counts, and three failures say stop', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't' })
  for (let i = 0; i < 2; i += 1) addCheck(root, record, { name: 'tests', exit: 1, output: saved(root, record, `tests-${i}`) })
  assert.deepEqual(gateRun(root, record).stopAndReport, [])
  addCheck(root, record, { name: 'tests', exit: 1, output: saved(root, record, 'tests-2') })
  assert.deepEqual(gateRun(root, record).stopAndReport, ['tests'])
  addCheck(root, record, { name: 'tests', exit: 0, output: saved(root, record, 'tests-3') })
  const g = gateRun(root, record)
  assert.equal(g.verdict, 'passed')
  assert.deepEqual(g.stopAndReport, [], 'a pass after failures is not over the limit')
})

test('run record: deleted or overwritten output is not evidence', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't' })
  const out = saved(root, record, 'tests')
  addCheck(root, record, { name: 'tests', exit: 0, output: out })
  writeFileSync(out, 'something else\n')
  const g = gateRun(root, record)
  assert.equal(g.checks[0].state, 'missing-output')
  assert.equal(g.mayClaimSuccess, false)
})

test('run record: a changed environment pair makes a passed check stale', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't', env: { app: 'http://localhost:5173@build-1' } })
  addCheck(root, record, { name: 'verify', exit: 0, output: saved(root, record, 'verify') })
  assert.equal(gateRun(root, record).verdict, 'passed')
  assert.equal(gateRun(root, record, { env: { app: 'http://localhost:5173@build-2' } }).verdict, 'stale')
})

test('run record: a path-scoped run ignores commits outside its paths and sees edits inside them', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 't', paths: ['lib/'] })
  addCheck(root, record, { name: 'tests', exit: 0, output: saved(root, record, 'tests') })
  writeTree(root, { 'docs/x.md': '# changed\n' })
  commitAll(root, 'docs only')
  assert.equal(gateRun(root, record).verdict, 'passed', 'a docs commit does not stale a lib check')
  writeTree(root, { 'lib/a.mjs': 'export const a = 9\n' })
  assert.equal(gateRun(root, record).verdict, 'stale')
})

test('run record: a new untracked file changes the fingerprint; output under .verify does not', (t) => {
  const root = repo(t)
  const before = codeFingerprint(root).fingerprint
  writeTree(root, { '.verify/evidence/x/out.log': 'noise\n' })
  assert.equal(codeFingerprint(root).fingerprint, before)
  writeTree(root, { 'lib/new.mjs': 'export {}\n' })
  assert.notEqual(codeFingerprint(root).fingerprint, before)
})

test('run record: works outside Git by hashing the files', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'a.txt': '1\n' })
  const { record } = startRun(root, { task: 'no git' })
  addCheck(root, record, { name: 'check', exit: 0, output: saved(root, record, 'check') })
  assert.equal(gateRun(root, record).verdict, 'passed')
  writeTree(root, { 'a.txt': '2\n' })
  assert.equal(gateRun(root, record).verdict, 'stale')
})

test('run record: the CLI refuses a result without saved output, and exits by the gate', (t) => {
  const root = repo(t)
  const start = node([script('run-record.mjs'), 'start', '--task', 'cli run', '--run', 'r1', '--cwd', root], root)
  assert.equal(start.status, 0, start.stderr)
  const noOutput = node([script('run-record.mjs'), 'add', '--run', 'r1', '--check', 'tests', '--exit', '0', '--cwd', root], root)
  assert.equal(noOutput.status, 2)
  assert.match(noOutput.stderr, /--output is required/)
  writeTree(root, { '.verify/evidence/r1/tests.log': 'ok\n' })
  assert.equal(node([script('run-record.mjs'), 'add', '--run', 'latest', '--check', 'tests', '--exit', '0', '--output', '.verify/evidence/r1/tests.log', '--cwd', root], root).status, 0)
  assert.equal(node([script('run-record.mjs'), 'gate', '--run', 'r1', '--cwd', root], root).status, 0)
  writeTree(root, { 'lib/a.mjs': 'changed\n' })
  const stale = node([script('run-record.mjs'), 'gate', '--cwd', root], root)
  assert.equal(stale.status, 1)
  assert.match(stale.stdout, /Do not report success/)
  assert.equal(node([script('run-record.mjs'), 'start', '--task', 'x', '--run', '../escape', '--cwd', root], root).status, 2)
})

test('run record: notes keep open items until resolved, and latest finds the newest run', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 'first', runId: 'a' })
  addNote(root, record, { open: ['thread 1: rename'], next: 'reply on thread 1' })
  const read = readRecord(root, 'a').record
  assert.deepEqual(read.open, ['thread 1: rename'])
  addNote(root, read, { resolve: ['thread 1: rename'] })
  assert.deepEqual(readRecord(root, 'a').record.open, [])
  assert.equal(latestRunId(root), 'a')
})

// ---------------------------------------------------------------------------
// changes
// ---------------------------------------------------------------------------

test('changes: a repository with no commits reviews every file as new', (t) => {
  if (!gitAvailable()) t.skip('git is not installed')
  const root = makeTempRoot()
  cleanupAfter(t, root)
  initRepo(root)
  writeTree(root, { 'a.mjs': 'export {}\n' })
  const scope = reviewScope(root)
  assert.equal(scope.empty, false)
  assert.deepEqual(scope.files, ['a.mjs'])
})

test('changes: --base and --paths narrow the scope, and committed work is listed', (t) => {
  const root = repo(t)
  git(root, ['checkout', '-b', 'feature'])
  writeTree(root, { 'lib/a.mjs': 'export const a = 2\n', 'docs/x.md': '# y\n' })
  commitAll(root, 'both')
  const all = reviewScope(root)
  assert.deepEqual(all.committed.map((c) => c.path).sort(), ['docs/x.md', 'lib/a.mjs'])
  assert.equal(all.commits.length, 1)
  assert.deepEqual(reviewScope(root, { paths: ['lib/'] }).files, ['lib/a.mjs'])
  assert.equal(reviewScope(root, { base: 'no-such-ref' }).error !== undefined, true)
})

test('changes: an empty index is a problem, and an intended path with nothing staged is named', (t) => {
  const root = repo(t)
  writeTree(root, { 'lib/a.mjs': 'export const a = 2\n' })
  const res = checkStaged(root, { intended: ['lib/'] })
  assert.deepEqual(res.problems.map((p) => p.id), ['nothing-staged'])
  assert.ok(res.notes.some((n) => n.id === 'intended-not-staged'))
})

test('changes: the CLI exits 1 on unintended staged work and 0 on a clean index', (t) => {
  const root = repo(t)
  assert.equal(node([script('changes.mjs'), 'snapshot', '--cwd', root], root).status, 0)
  writeTree(root, { 'lib/a.mjs': 'export const a = 2\n', 'docs/x.md': '# other\n' })
  git(root, ['add', 'lib/a.mjs', 'docs/x.md'])
  const dirty = node([script('changes.mjs'), 'staged', '--intended', 'lib/', '--baseline', '.verify/staged-before.json', '--cwd', root], root)
  assert.equal(dirty.status, 1, dirty.stdout)
  git(root, ['reset', '-q', '--', 'docs/x.md'])
  const clean = node([script('changes.mjs'), 'staged', '--intended', 'lib/', '--baseline', '.verify/staged-before.json', '--cwd', root], root)
  assert.equal(clean.status, 0, clean.stdout)
  assert.equal(node([script('changes.mjs'), 'bogus'], root).status, 2)
})

// ---------------------------------------------------------------------------
// pr-state
// ---------------------------------------------------------------------------

const HEAD = 'c'.repeat(40)
const pr = (over = {}) => ({ number: 3, state: 'OPEN', isDraft: false, headRefOid: HEAD, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', reviewDecision: 'APPROVED', statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }], ...over })

test('pr-state: check shapes from gh and from status contexts classify the same way', () => {
  assert.equal(classifyCheck({ name: 'a', status: 'IN_PROGRESS', conclusion: '' }).result, 'pending')
  assert.equal(classifyCheck({ name: 'a', status: 'COMPLETED', conclusion: 'SKIPPED' }).result, 'passed')
  assert.equal(classifyCheck({ context: 'ci/x', state: 'PENDING' }).result, 'pending')
  assert.equal(classifyCheck({ context: 'ci/x', state: 'ERROR' }).result, 'failed')
  assert.equal(classifyCheck({ name: 'a', status: 'COMPLETED', conclusion: 'TIMED_OUT' }).result, 'failed')
})

test('pr-state: pending, draft, conflict, and requested changes each keep it from ready', () => {
  assert.equal(prState(pr({ statusCheckRollup: [{ name: 't', status: 'QUEUED' }] })).stage, 'checks-pending')
  for (const over of [{ isDraft: true }, { mergeable: 'CONFLICTING' }, { mergeable: 'UNKNOWN' }, { reviewDecision: 'CHANGES_REQUESTED' }, { mergeStateStatus: 'BEHIND' }]) {
    const r = prState(pr(over), { threads: [] })
    assert.equal(r.checksPassed, true, JSON.stringify(over))
    assert.equal(r.readyToMerge, false, JSON.stringify(over))
  }
  assert.equal(prState(pr(), { threads: [] }).readyToMerge, true)
  assert.equal(prState(pr()).readyToMerge, false, 'threads not checked is not ready')
})

test('pr-state: a check result for another commit is ignored, not counted as green', () => {
  const r = prState(pr({ statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', headSha: 'd'.repeat(40) }] }))
  assert.equal(r.checksPassed, false)
  assert.match(r.notes.join(' '), /another commit/)
})

test('pr-state: GraphQL review threads and a merged PR are read', () => {
  const threads = { data: { repository: { pullRequest: { reviewThreads: { nodes: [{ isResolved: true }, { isResolved: false }] } } } } }
  assert.equal(prState(pr(), { threads }).unresolvedThreads, 1)
  assert.equal(prState(pr({ state: 'MERGED' })).stage, 'closed')
})

test('pr-state: the CLI exit code follows --want', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeFileSync(join(root, 'pr.json'), JSON.stringify(pr()))
  const args = [script('pr-state.mjs'), '--input', join(root, 'pr.json'), '--no-local']
  assert.equal(node(args, root).status, 0)
  assert.equal(node([...args, '--want', 'ready'], root).status, 1, 'threads not supplied')
  writeFileSync(join(root, 'threads.json'), '[]')
  assert.equal(node([...args, '--want', 'ready', '--threads', join(root, 'threads.json')], root).status, 0)
})

// ---------------------------------------------------------------------------
// plan-check
// ---------------------------------------------------------------------------

const PLAN = `# Plan

## Goal
Case managers see due reviews.

## Requirements

- R1. A case manager sees every client whose review is due this week.
- R2. Marking a review done removes it for everyone.

## Out of scope

- Email reminders.

## Decisions

- D1. Use the existing reviews table (user).

## Units

### U1. Query due reviews
- **Verify:** \`npm test -- due\`
- **Covers:** R1

### U2. Mark done
- **Verify:** \`npm test -- done\`
- **Covers:** R2

## Verification

- \`npm test\`

## Open questions

- Week starts Monday: answered by the user.
`

test('plan-check: a complete plan in heading form passes', () => {
  const r = checkPlan(PLAN)
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.units.map((u) => u.covers), [['R1'], ['R2']])
})

test('plan-check: an uncovered requirement, a missing Verify, a TBD, and an unknown ID are each reported', () => {
  const broken = PLAN
    .replace('- **Covers:** R2', '- **Covers:** R3')
    .replace('- **Verify:** `npm test -- due`', '- **Verify:** TBD')
    .replace('- Week starts Monday: answered by the user.', '- Does the week start on Monday?')
  const ids = checkPlan(broken).problems.map((p) => p.id).sort()
  assert.deepEqual(ids, ['no-verify', 'open-question', 'uncovered', 'unknown-requirement'])
})

test('plan-check: a units table is read, and brainstorm stage skips units', () => {
  const table = PLAN.replace(/## Units[\s\S]*?## Verification/, '## Units\n\n| Unit | Goal | Verify | Covers |\n| --- | --- | --- | --- |\n| U1 | query | `npm test -- due` | R1 |\n| U2 | done | `npm test -- done` | R2 |\n\n## Verification')
  assert.deepEqual(checkPlan(table).problems, [])
  const early = PLAN.replace(/## Units[\s\S]*?## Open questions/, '## Open questions')
  assert.deepEqual(checkPlan(early, { stage: 'brainstorm' }).problems, [])
  assert.ok(checkPlan(early).problems.some((p) => p.id === 'no-units'))
})

test('plan-check: this repository\'s own work plan passes', () => {
  const text = readFileSync(join(repoRoot, 'docs', 'plans', '2026-10-21-audit-hardening.md'), 'utf8')
  assert.deepEqual(checkPlan(text).problems, [])
})

// ---------------------------------------------------------------------------
// rewrite-check
// ---------------------------------------------------------------------------

test('rewrite-check: a rewrite that keeps commands, numbers, paths, and doubt passes', () => {
  const before = 'Run `npm test` first. The fix may not cover jobs over 30s, and was not verified on Windows. See lib/queue.ts.\n'
  const after = 'First run `npm test`. On Windows the fix was not verified, and it may miss jobs that take over 30s (lib/queue.ts).\n'
  assert.equal(compareRewrite(before, after).ok, true, JSON.stringify(compareRewrite(before, after)))
})

test('rewrite-check: a surer rewrite with an invented number fails', () => {
  const r = compareRewrite('Tests were not run; the cause is unknown.\n', 'Tests pass on 3 platforms and the cause is fixed.\n')
  assert.equal(r.ok, false)
  assert.ok(r.doubtDropped.some((d) => d.kind === 'unknown'))
  assert.ok(r.added.some((a) => a.token === '3'))
})

// ---------------------------------------------------------------------------
// lesson drift
// ---------------------------------------------------------------------------

const lesson = (paths) => `---\ntitle: Jobs are idempotent\ntags: [jobs]\napplies_when: Changing a job\npaths: ${paths}\nstatus: active\n---\n\n# Jobs are idempotent\n\n## Do this\n\nMake the job safe twice.\n`

test('lesson drift: commits to a lesson\'s paths after it was written are reported', (t) => {
  const root = repo(t, { 'app/jobs/charge.mjs': 'x\n', 'memory/lessons/jobs.md': lesson('[app/jobs/]'), 'web/a.css': 'a\n' })
  assert.deepEqual(lessonsWithDrift(root), [])
  writeTree(root, { 'web/a.css': 'b\n' })
  commitAll(root, 'unrelated')
  assert.deepEqual(lessonsWithDrift(root), [], 'a commit elsewhere is not drift')
  writeTree(root, { 'app/jobs/charge.mjs': 'y\n' })
  commitAll(root, 'jobs changed')
  const drifted = lessonsWithDrift(root)
  assert.equal(drifted.length, 1)
  assert.equal(drifted[0].drift.changed[0].path, 'app/jobs/')
})

test('lesson drift: a path that no longer exists is reported, and an uncommitted lesson is unchecked', (t) => {
  const root = repo(t, { 'memory/lessons/old.md': lesson('[app/gone/]') })
  const parsed = parseLesson('memory/lessons/old.md', lesson('[app/gone/]'))
  assert.deepEqual(lessonDrift(root, parsed).missing, ['app/gone/'])
  const fresh = parseLesson('memory/lessons/new.md', lesson('[app/]'))
  assert.equal(lessonDrift(root, fresh).checked, false)
})
