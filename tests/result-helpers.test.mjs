// The helpers behind the shared result format and the readiness checks:
// run-record.mjs, changes.mjs, pr-state.mjs, plan-check.mjs, rewrite-check.mjs,
// and lesson drift in lessons.mjs. Each test pins one fact the helper decides
// and, where it matters, the neighbouring case that must stay quiet.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { cleanupAfter, commitAll, git, gitAvailable, initRepo, makeTempRoot, writeTree } from './fixtures/build.mjs'
import { addCheck, addNote, gateRun, latestRunId, readRecord, startRun } from '../scripts/run-record.mjs'
import { codeFingerprint, stagedSnapshot } from '../scripts/lib/changes.mjs'
import { reviewScope, checkStaged } from '../scripts/changes.mjs'
import { classifyCheck, prState } from '../scripts/pr-state.mjs'
import { checkPlan } from '../scripts/plan-check.mjs'
import { compareRewrite } from '../scripts/rewrite-check.mjs'
import { checkFindings } from '../scripts/findings-check.mjs'
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

test('run record: a same-size edit in the same second as the commit is still seen a second later', async (t) => {
  // Git trusts a file's stat data only when the file is older than the index.
  // A copied index stamped "now" made this edit invisible, so a stale check
  // read as passed. The copy now keeps the original index's times.
  const root = repo(t)
  const before = codeFingerprint(root).fingerprint
  const index = join(root, '.git', 'index')
  writeFileSync(join(root, 'lib', 'a.mjs'), 'export const a = 9\n')
  const { mtime } = statSync(index)
  utimesSync(join(root, 'lib', 'a.mjs'), mtime, mtime)
  await new Promise((r) => setTimeout(r, 1100))
  assert.notEqual(codeFingerprint(root).fingerprint, before)
})

test('run record: committing unchanged work does not make its checks stale', (t) => {
  const root = repo(t)
  writeTree(root, { 'lib/a.mjs': 'export const a = 2\n' })
  const { record } = startRun(root, { task: 't', require: ['tests'] })
  addCheck(root, record, { name: 'tests', exit: 0, output: saved(root, record, 'tests') })
  commitAll(root, 'the same work, committed')
  assert.equal(gateRun(root, record).verdict, 'passed')
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
  const stale = node([script('run-record.mjs'), 'gate', '--run', 'latest', '--cwd', root], root)
  assert.equal(node([script('run-record.mjs'), 'gate', '--cwd', root], root).status, 2, 'gate names its run')
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

// ---------------------------------------------------------------------------
// Regressions from the independent review of this work (2026-10-21). Each
// input is the one the reviewer used to make the earlier code give a wrong
// answer.
// ---------------------------------------------------------------------------

test('review 1: a stage cannot silently gate a different run, or restart an existing one', (t) => {
  const root = repo(t)
  assert.equal(node([script('run-record.mjs'), 'start', '--task', 'autopilot', '--run', 'auto', '--require', 'tests,verify', '--cwd', root], root).status, 0)
  assert.equal(node([script('run-record.mjs'), 'start', '--task', 'verify', '--run', 'auto', '--cwd', root], root).status, 2, 'restarting the run would drop its required checks')
  writeTree(root, { '.verify/evidence/auto/v.log': 'ok\n' })
  node([script('run-record.mjs'), 'add', '--run', 'auto', '--check', 'verify', '--exit', '0', '--output', '.verify/evidence/auto/v.log', '--cwd', root], root)
  assert.equal(node([script('run-record.mjs'), 'gate', '--run', 'auto', '--cwd', root], root).status, 1, 'tests never ran')
  assert.equal(node([script('run-record.mjs'), 'gate', '--cwd', root], root).status, 2, 'no implicit run')
})

test('review 2: a required check recorded as optional, an optional failure, and nothing passed all block', (t) => {
  const root = repo(t)
  const demoted = startRun(root, { task: 't', require: ['tests'] }).record
  addCheck(root, demoted, { name: 'tests', status: 'unchecked', reason: 'skip', optional: true })
  assert.equal(gateRun(root, demoted).mayClaimSuccess, false)

  const onlyOptional = startRun(root, { task: 't2', runId: 'only-optional' }).record
  addCheck(root, onlyOptional, { name: 'browser', status: 'unchecked', reason: 'no Playwright', optional: true })
  assert.equal(gateRun(root, onlyOptional).verdict, 'incomplete')

  const optionalFail = startRun(root, { task: 't3', runId: 'optional-fail' }).record
  addCheck(root, optionalFail, { name: 'tests', exit: 0, output: saved(root, optionalFail, 'tests') })
  addCheck(root, optionalFail, { name: 'layout', exit: 1, optional: true, output: saved(root, optionalFail, 'layout', 'clipped\n') })
  assert.equal(gateRun(root, optionalFail).verdict, 'failed')
})

test('review 3: work staged before the snapshot with no changed lines is still caught', (t) => {
  const root = repo(t, { 'src/logo.png': Buffer.from([0, 1, 2, 3]).toString('latin1'), 'src/old.js': 'x\n', 'src/app.js': 'a\n' })
  writeFileSync(join(root, 'src', 'logo.png'), Buffer.from([0, 9, 9, 9]))
  git(root, ['add', 'src/logo.png'])
  git(root, ['mv', 'src/old.js', 'src/moved.js'])
  writeTree(root, { 'src/empty.txt': '' })
  git(root, ['add', 'src/empty.txt'])
  const before = JSON.parse(JSON.stringify(stagedSnapshot(root)))
  writeTree(root, { 'src/app.js': 'mine\n' })
  git(root, ['add', 'src/app.js'])
  const res = checkStaged(root, { intended: ['src'], baseline: before })
  assert.deepEqual(res.problems.filter((p) => p.id === 'staged-before').map((p) => p.file).sort(), ['src/empty.txt', 'src/logo.png', 'src/moved.js', 'src/old.js'])
})

test('review 4: changes.mjs refuses to write outside .verify/', (t) => {
  const root = repo(t)
  writeTree(root, { 'lib/a.mjs': 'changed\n' })
  const outside = `outside-${process.pid}-${Date.now()}`
  t.after(() => rmSync(join(root, '..', `${outside}.patch`), { force: true }))
  for (const args of [['review', '--write', `../${outside}.patch`], ['review', '--write', join(root, 'lib', 'x.patch')], ['snapshot', '--out', `../${outside}.json`]]) {
    const res = node([script('changes.mjs'), ...args, '--cwd', root], root)
    assert.equal(res.status, 2, `${args.join(' ')}: ${res.stdout}${res.stderr}`)
  }
  assert.equal(existsSync(join(root, '..', `${outside}.patch`)), false)
  assert.equal(existsSync(join(root, '..', `${outside}.json`)), false)
  assert.equal(existsSync(join(root, 'lib', 'x.patch')), false)
})

test('review 7: a common line in the agent\'s own hunk is not mistaken for the user\'s', (t) => {
  const root = repo(t, { 'f.js': 'function a() {\n}\n' })
  writeTree(root, { 'f.js': 'function a() {\n}\nfunction b() {\n}\n' })
  git(root, ['add', 'f.js'])
  const before = stagedSnapshot(root)
  // The agent sets the user's change aside and stages its own instead.
  git(root, ['reset', '-q', '--', 'f.js'])
  writeTree(root, { 'f.js': 'function c() {\n}\nfunction a() {\n}\n' })
  git(root, ['add', 'f.js'])
  const res = checkStaged(root, { intended: ['f.js'], baseline: before })
  assert.equal(res.ok, true, JSON.stringify(res.problems))
})

test('review 8: a diff prefix setting in the user\'s config does not blind the staged check', (t) => {
  const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
  const root = repo(t, { 'a.txt': `${lines.join('\n')}\n` })
  git(root, ['config', 'diff.noprefix', 'true'])
  git(root, ['config', 'diff.mnemonicPrefix', 'true'])
  lines[0] = 'user'
  writeTree(root, { 'a.txt': `${lines.join('\n')}\n` })
  git(root, ['add', 'a.txt'])
  const before = stagedSnapshot(root)
  lines[19] = 'agent'
  writeTree(root, { 'a.txt': `${lines.join('\n')}\n` })
  git(root, ['add', 'a.txt'])
  const res = checkStaged(root, { intended: ['a.txt'], baseline: before })
  assert.deepEqual(res.problems.map((p) => p.id), ['staged-before'])
})

test('review 9: duplicate findings that disagree on the verdict are not safe to fix', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'q.mjs': 'export const retry = (job) => job()\n' })
  const f = { lens: 'correctness', severity: 'P1', confidence: 100, file: 'q.mjs', line: 1, quote: 'job()', title: 'Retry runs twice' }
  for (const pair of [['confirmed', 'unresolved'], ['unresolved', 'confirmed'], ['confirmed', 'disproved'], ['confirmed', undefined]]) {
    const r = checkFindings(root, { findings: pair.map((verdict) => ({ ...f, verdict })) }, { final: true })
    assert.equal(r.counts.fixable, 0, `${pair} was listed as safe to fix`)
  }
  assert.equal(checkFindings(root, { findings: [{ ...f, verdict: 'confirmed' }, { ...f, verdict: 'confirmed' }] }, { final: true }).counts.fixable, 1)
})

test('review 10a: a directory ending in " b" keeps its path', (t) => {
  const root = repo(t)
  writeTree(root, { 'dir b/c.txt': 'x\n' })
  git(root, ['add', 'dir b/c.txt'])
  assert.equal(checkStaged(root, { intended: ['dir b'] }).ok, true)
})

test('review 10c: plan-check accepts numbered requirements, a Verify on the next line, and the word TODO in prose', () => {
  const plan = PLAN
    .replace('- R1. A case manager', '1. R1. A case manager')
    .replace('- R2. Marking', '2. R2. Marking')
    .replace('### U1. Query due reviews\n- **Verify:** `npm test -- due`', '### U1. Query due reviews\nReplace the TODO stub in the query.\n- **Verify:**\n  `npm test -- due`')
  assert.deepEqual(checkPlan(plan).problems, [])
})

test('pr-state: a re-run check counts by its newest run, and a partial thread page is not ready', () => {
  const rerun = [
    { name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: '2026-10-21T10:00:00Z' },
    { name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-10-21T10:05:00Z' },
  ]
  assert.equal(prState(pr({ statusCheckRollup: rerun })).checksPassed, true)
  const undated = rerun.map(({ completedAt, ...c }) => c)
  assert.equal(prState(pr({ statusCheckRollup: undated })).checksPassed, false, 'without times, the failure is not hidden')
  const partial = { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: true } } } } } }
  assert.equal(prState(pr(), { threads: partial }).readyToMerge, false)
})
