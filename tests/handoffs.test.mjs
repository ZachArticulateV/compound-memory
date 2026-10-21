// Hand-offs between skills, run through the scripts the skills call.
//
// Each test plays one stretch of the workflow the way the playbooks describe
// it, in separate processes where a real run would cross a session, and checks
// what the next stage would read. No model runs here: these pin what the code
// decides at each seam (tests/acceptance/ covers what a model does).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { cleanupAfter, commitAll, git, gitAvailable, initRepo, makeTempRoot, writeTree } from './fixtures/build.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = (name) => join(repoRoot, 'scripts', name)
const GIT_ID = ['-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', '-c', 'commit.gpgsign=false']

/** Run one plugin script as its own process, as a skill would. */
function cli(root, name, ...args) {
  const res = spawnSync(process.execPath, [script(name), ...args, '--cwd', root], { cwd: root, encoding: 'utf8' })
  return { status: res.status, out: res.stdout, err: res.stderr }
}

/** Run a project check and save its output where the run record expects it. */
function check(root, runId, name, passes) {
  const rel = `.verify/evidence/${runId}/${name}.log`
  writeTree(root, { [rel]: passes ? `${name}: ok\n` : `${name}: FAILED\n` })
  return cli(root, 'run-record.mjs', 'add', '--run', runId, '--check', name, '--exit', passes ? '0' : '1', '--output', rel, '--command', `npm run ${name}`)
}

function project(t) {
  if (!gitAvailable()) t.skip('git is not installed')
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    '.gitignore': '.verify/\n',
    'lib/invoice.mjs': 'export const total = (lines) => lines.reduce((s, l) => s + l.qty * l.price, 0)\n',
    'notes/todo.md': '- tidy\n',
  })
  initRepo(root)
  commitAll(root, 'initial')
  git(root, ['checkout', '-b', 'feature/discount'])
  return root
}

test('build → verify → review fix → fresh verify: a fix after verify blocks the claim until verify runs again', (t) => {
  const root = project(t)
  assert.equal(cli(root, 'run-record.mjs', 'start', '--task', 'add a discount', '--run', 'r', '--require', 'tests,verify').status, 0)
  writeTree(root, { 'lib/invoice.mjs': 'export const total = (lines, pct = 0) => lines.reduce((s, l) => s + l.qty * l.price, 0) * (1 - pct / 100)\n' })
  assert.equal(check(root, 'r', 'tests', true).status, 0)
  assert.equal(check(root, 'r', 'verify', true).status, 0)
  assert.equal(cli(root, 'run-record.mjs', 'gate', '--run', 'r').status, 0, 'build and verify passed on this code')

  // Review finds a rounding bug and the fix lands after verify ran.
  writeTree(root, { 'lib/invoice.mjs': 'export const total = (lines, pct = 0) => Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0) * (100 - pct)) / 100\n' })
  const stale = cli(root, 'run-record.mjs', 'gate', '--run', 'r', '--json')
  assert.equal(stale.status, 1)
  const g = JSON.parse(stale.out)
  assert.equal(g.verdict, 'stale')
  assert.deepEqual(g.checks.filter((c) => c.state === 'stale').map((c) => c.name).sort(), ['tests', 'verify'])

  // Only fresh runs on the fixed code clear it.
  check(root, 'r', 'tests', true)
  assert.equal(cli(root, 'run-record.mjs', 'gate', '--run', 'r').status, 1, 'verify is still stale')
  check(root, 'r', 'verify', true)
  assert.equal(cli(root, 'run-record.mjs', 'gate', '--run', 'r').status, 0)
})

test('interrupted work: a new session resumes from the record, keeping what still holds', (t) => {
  const root = project(t)
  cli(root, 'run-record.mjs', 'start', '--task', 'discount', '--run', 'r', '--require', 'tests,verify,ci')
  check(root, 'r', 'tests', true)
  cli(root, 'run-record.mjs', 'note', '--run', 'r', '--open', 'P2: name the magic 100', '--next', 'run verify on the invoice page')
  // The session ends here. A new one knows nothing but the files.
  const resumed = JSON.parse(cli(root, 'run-record.mjs', 'gate', '--json').out)
  assert.equal(resumed.runId, 'r')
  assert.deepEqual(resumed.passed, ['tests'], 'the passing test still holds: the code did not change')
  assert.deepEqual(resumed.unchecked.sort(), ['ci', 'verify'])
  assert.equal(resumed.next, 'run verify on the invoice page')
  assert.deepEqual(resumed.open, ['P2: name the magic 100'])
})

test('a failed required check blocks the claim; a missing optional tool does not', (t) => {
  const root = project(t)
  cli(root, 'run-record.mjs', 'start', '--task', 'discount', '--run', 'r', '--require', 'tests')
  check(root, 'r', 'tests', true)
  assert.equal(cli(root, 'run-record.mjs', 'add', '--run', 'r', '--check', 'layout', '--status', 'unchecked', '--reason', 'NOT CHECKED: Playwright is not installed', '--optional').status, 0)
  const ok = cli(root, 'run-record.mjs', 'gate', '--run', 'r')
  assert.equal(ok.status, 0, ok.out)
  assert.match(ok.out, /UNCHECKED\s+layout \(optional\)/)
  check(root, 'r', 'lint', false)
  const blocked = cli(root, 'run-record.mjs', 'gate', '--run', 'r')
  assert.equal(blocked.status, 1)
  assert.match(blocked.out, /a required check failed/)
})

test('ship commit with someone else\'s staged work: set aside, commit only ours, restore theirs', (t) => {
  const root = project(t)
  // The user had staged a note before the agent started.
  writeTree(root, { 'notes/todo.md': '- tidy\n- call the clinic\n' })
  git(root, ['add', 'notes/todo.md'])
  assert.equal(cli(root, 'changes.mjs', 'snapshot').status, 0)

  // The agent's work.
  writeTree(root, { 'lib/invoice.mjs': 'export const total = () => 0 // agent\n' })
  git(root, ['add', 'lib/invoice.mjs'])
  const guard = cli(root, 'changes.mjs', 'staged', '--intended', 'lib/', '--baseline', '.verify/staged-before.json')
  assert.equal(guard.status, 1, 'the guard must catch the user\'s staged note')

  // The playbook: save their staged work, unstage it, commit ours, restore theirs.
  const theirs = git(root, ['diff', '--cached', '--binary', '--', 'notes/todo.md'])
  writeFileSync(join(root, '.verify', 'their-staged.patch'), theirs)
  git(root, ['restore', '--staged', 'notes/todo.md'])
  assert.equal(cli(root, 'changes.mjs', 'staged', '--intended', 'lib/', '--baseline', '.verify/staged-before.json').status, 0)
  git(root, [...GIT_ID, 'commit', '-q', '-m', 'feat: agent change'])
  git(root, ['apply', '--cached', '--3way', join(root, '.verify', 'their-staged.patch')])

  assert.deepEqual(git(root, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), ['lib/invoice.mjs'])
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), 'notes/todo.md', 'their note is staged again')
  assert.match(readFileSync(join(root, 'notes', 'todo.md'), 'utf8'), /call the clinic/)
})

test('review scope → findings → final pass: only challenged findings with real quotes reach build', (t) => {
  const root = project(t)
  writeTree(root, { 'lib/invoice.mjs': 'export const total = (lines) => lines.slice(1).reduce((s, l) => s + l.qty * l.price, 0)\n' })
  const scope = cli(root, 'changes.mjs', 'review', '--write', '.verify/review.patch', '--json')
  assert.equal(scope.status, 0)
  assert.deepEqual(JSON.parse(scope.out).unstaged.map((c) => c.path), ['lib/invoice.mjs'])
  const findings = { findings: [
    { lens: 'correctness', severity: 'P1', confidence: 100, file: 'lib/invoice.mjs', line: 1, quote: 'lines.slice(1)', title: 'First line dropped from the total', verdict: 'confirmed' },
    { lens: 'correctness', severity: 'P0', confidence: 100, file: 'lib/tax.mjs', line: 4, quote: 'applyTax(', title: 'Tax applied twice' },
  ] }
  writeTree(root, { '.verify/review-findings.json': JSON.stringify(findings) })
  const first = cli(root, 'findings-check.mjs', '--input', join(root, '.verify', 'review-findings.json'), '--final', '--json')
  assert.equal(first.status, 1, 'the P0 has no verdict yet')
  findings.findings[1].verdict = 'unresolved'
  writeTree(root, { '.verify/review-findings.json': JSON.stringify(findings) })
  const final = JSON.parse(cli(root, 'findings-check.mjs', '--input', join(root, '.verify', 'review-findings.json'), '--final', '--json').out)
  assert.deepEqual(final.fixable.map((f) => f.title), ['First line dropped from the total'])
  assert.equal(final.kept.find((f) => f.title === 'Tax applied twice').unproved, true, 'stays in the report as unproved')
})

test('ship watch: a green result for the previous head does not carry over to the pushed fix', (t) => {
  const root = project(t)
  const head = git(root, ['rev-parse', 'HEAD']).trim()
  const green = { number: 9, state: 'OPEN', headRefOid: head, isDraft: false, mergeable: 'MERGEABLE', statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }] }
  writeTree(root, { '.verify/pr.json': JSON.stringify(green) })
  assert.equal(cli(root, 'pr-state.mjs', '--input', join(root, '.verify', 'pr.json')).status, 0)
  // A review fix is committed locally; GitHub still reports the old head.
  writeTree(root, { 'lib/invoice.mjs': 'export const total = () => 1\n' })
  commitAll(root, 'fix(review): rounding')
  const after = cli(root, 'pr-state.mjs', '--input', join(root, '.verify', 'pr.json'))
  assert.equal(after.status, 1)
  assert.match(after.out, /local HEAD .* is not the PR head/)
})
