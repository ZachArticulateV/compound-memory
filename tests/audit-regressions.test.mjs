// Regressions for the faults the 2026-10-21 audit found and this checkout
// confirmed. Each test reproduces the original failure's input and asserts the
// behavior the fix gives; each would fail on the code the audit read
// (`6d2b5f8`). Where the fixture's point is subtle, the test first shows the
// fixture really poses the problem.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { cleanupAfter, commitAll, git, gitAvailable, initRepo, makeTempRoot, writeTree } from './fixtures/build.mjs'
import { reviewScope, checkStaged } from '../scripts/changes.mjs'
import { stagedSnapshot } from '../scripts/lib/changes.mjs'
import { decide } from '../scripts/measure.mjs'
import { checkFindings } from '../scripts/findings-check.mjs'
import { addCheck, gateRun, readRecord, startRun } from '../scripts/run-record.mjs'
import { prState } from '../scripts/pr-state.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const scripts = join(repoRoot, 'scripts')
const run = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' })

function repo(t, files = { 'lib/a.mjs': 'export const a = 1\n', '.gitignore': '.verify/\n' }) {
  if (!gitAvailable()) t.skip('git is not installed')
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, files)
  initRepo(root)
  commitAll(root, 'initial')
  return root
}

// ---------------------------------------------------------------------------
// Review scope: staged, unstaged, and new files with no new commit.
// ---------------------------------------------------------------------------

test('review covers staged, unstaged, and new files when nothing is committed', (t) => {
  const root = repo(t)
  git(root, ['checkout', '-b', 'feature'])
  writeTree(root, { 'lib/a.mjs': 'export const a = 2\n', 'lib/b.mjs': 'export const b = 1\n' })
  git(root, ['add', 'lib/b.mjs'])
  writeTree(root, { 'lib/a.mjs': 'export const a = 3\n', 'lib/new.mjs': 'export const fresh = true\n' })

  // The command the old playbook prescribed sees none of it.
  assert.equal(git(root, ['diff', 'main...HEAD']).trim(), '', 'fixture: the three-dot diff must be empty')

  const scope = reviewScope(root, { write: '.verify/review.patch' })
  assert.equal(scope.empty, false)
  assert.deepEqual(scope.files, ['lib/a.mjs', 'lib/b.mjs', 'lib/new.mjs'])
  assert.deepEqual(scope.untracked, ['lib/new.mjs'])
  const patch = readFileSync(join(root, '.verify', 'review.patch'), 'utf8')
  for (const line of ['+export const a = 3', '+export const b = 1', '+export const fresh = true']) assert.ok(patch.includes(line), `patch lacks ${line}`)
  assert.ok(!patch.includes('.verify'), 'run output must not review itself')
})

test('review of nothing exits 1 instead of reviewing an empty diff', (t) => {
  const root = repo(t)
  const res = run([join(scripts, 'changes.mjs'), 'review'], root)
  assert.equal(res.status, 1, res.stdout + res.stderr)
  assert.match(res.stdout, /Nothing to review/)
})

// ---------------------------------------------------------------------------
// Commit scope: staged work that is not the agent's.
// ---------------------------------------------------------------------------

test('a commit guard flags a file someone else staged', (t) => {
  const root = repo(t, { 'lib/a.mjs': 'a\n', 'notes.md': 'n\n' })
  writeTree(root, { 'notes.md': 'their draft\n' })
  git(root, ['add', 'notes.md'])
  const before = stagedSnapshot(root)
  writeTree(root, { 'lib/a.mjs': 'mine\n' })
  git(root, ['add', 'lib/a.mjs'])

  const res = checkStaged(root, { intended: ['lib/'], baseline: before })
  assert.equal(res.ok, false)
  assert.ok(res.problems.some((p) => p.id === 'unintended-file' && p.file === 'notes.md'))
  assert.ok(res.problems.some((p) => p.id === 'staged-before' && p.file === 'notes.md'))
})

test('a commit guard flags another hunk staged earlier in a file the agent changed', (t) => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`)
  const root = repo(t, { 'lib/a.mjs': `${lines.join('\n')}\n` })
  // The user staged a change at the top before the agent began.
  lines[0] = 'line 1 (user)'
  writeTree(root, { 'lib/a.mjs': `${lines.join('\n')}\n` })
  git(root, ['add', 'lib/a.mjs'])
  const before = stagedSnapshot(root)
  // The agent changes the bottom of the same file and stages the whole file.
  lines[29] = 'line 30 (agent)'
  writeTree(root, { 'lib/a.mjs': `${lines.join('\n')}\n` })
  git(root, ['add', 'lib/a.mjs'])

  const mixed = checkStaged(root, { intended: ['lib/a.mjs'], baseline: before })
  assert.equal(mixed.ok, false, 'the path is intended, but the user\'s hunk is not')
  assert.deepEqual(mixed.problems.map((p) => p.id), ['staged-before'])

  // Staging only the agent's hunk (the user's line left unstaged) passes, and
  // the partial file is named so the split is deliberate.
  git(root, ['reset', '-q', '--', 'lib/a.mjs'])
  const userOnly = [...lines]
  userOnly[0] = 'line 1'
  const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: `${userOnly.join('\n')}\n`, encoding: 'utf8' }).stdout.trim()
  git(root, ['update-index', '--cacheinfo', `100644,${blob},lib/a.mjs`])
  const clean = checkStaged(root, { intended: ['lib/a.mjs'], baseline: before })
  assert.equal(clean.ok, true, JSON.stringify(clean.problems))
  assert.ok(clean.notes.some((n) => n.id === 'partial-file' && n.file === 'lib/a.mjs'))
})

// ---------------------------------------------------------------------------
// Measurement noise: a supplied value cannot hide the samples' spread.
// ---------------------------------------------------------------------------

test('a supplied noise of 0 does not turn widely spread samples into a keep', () => {
  const samples = { baseline: [10, 100, 190], candidate: [9, 90, 171], direction: 'lower' }
  assert.equal(decide(samples).verdict, 'inconclusive')
  const forced = decide({ ...samples, noise: 0 })
  assert.equal(forced.verdict, 'inconclusive')
  assert.ok(forced.noiseFloor >= 1.8 - 1e-9, `floor ${forced.noiseFloor} hides a 180% spread`)
  assert.match(forced.notes.join(' '), /below the samples' own spread/)
  // A supplied value above the spread still raises the floor.
  assert.equal(decide({ baseline: [100, 101], candidate: [90, 91], noise: 0.2 }).verdict, 'inconclusive')
})

// ---------------------------------------------------------------------------
// Review findings: severity is not evidence.
// ---------------------------------------------------------------------------

test('a P0 citing a file that does not exist is kept, but labelled unproved and not safe to fix', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.mjs': 'export function retry(job) {\n  return job()\n}\n' })
  const input = { findings: [
    { lens: 'correctness', severity: 'P0', confidence: 100, file: 'lib/missing.mjs', line: 3, quote: 'invented()', title: 'Fabricated outage' },
    { lens: 'correctness', severity: 'P1', confidence: 100, file: 'lib/queue.mjs', line: 2, quote: 'return job()', title: 'Retry runs twice' },
  ] }
  const result = checkFindings(root, input)
  const fabricated = result.kept.find((f) => f.title === 'Fabricated outage')
  assert.ok(fabricated, 'P0 is still kept so a person reads it')
  assert.equal(fabricated.unproved, true)
  assert.equal(result.counts.unproved, 1)
  assert.equal(result.kept.find((f) => f.title === 'Retry runs twice').unproved, false)
})

test('the final pass refuses fixes for serious findings nobody tried to disprove', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.mjs': 'export function retry(job) {\n  return job()\n}\n' })
  const finding = { lens: 'correctness', severity: 'P1', confidence: 100, file: 'lib/queue.mjs', line: 2, quote: 'return job()', title: 'Retry runs twice' }
  const unchallenged = checkFindings(root, { findings: [finding] }, { final: true })
  assert.equal(unchallenged.counts.missingVerdict, 1)
  assert.equal(unchallenged.counts.fixable, 0)
  const confirmed = checkFindings(root, { findings: [{ ...finding, verdict: 'confirmed' }] }, { final: true })
  assert.equal(confirmed.counts.fixable, 1)
  const disproved = checkFindings(root, { findings: [{ ...finding, verdict: 'disproved' }] }, { final: true })
  assert.equal(disproved.counts.kept, 0)
  // A "confirmed" verdict cannot rescue a quote that is not in the file.
  const bad = checkFindings(root, { findings: [{ ...finding, quote: 'nowhere()', confidence: 100, severity: 'P0', verdict: 'confirmed' }] }, { final: true })
  assert.equal(bad.kept[0].verdict, 'unresolved')
  assert.equal(bad.counts.fixable, 0)
})

// ---------------------------------------------------------------------------
// Fresh verification after review changes the code.
// ---------------------------------------------------------------------------

test('a review fix after verification makes the verification stale until it runs again', (t) => {
  const root = repo(t)
  const { record } = startRun(root, { task: 'invoice totals', require: ['verify'] })
  const out = join(root, '.verify', 'evidence', record.runId, 'verify.log')
  writeFileSync(out, 'drove the invoice page: total 135\n')
  addCheck(root, record, { name: 'verify', exit: 0, output: out })
  assert.equal(gateRun(root, record).verdict, 'passed')

  writeTree(root, { 'lib/a.mjs': 'export const a = 2 // review fix\n' })
  const after = gateRun(root, readRecord(root, record.runId).record)
  assert.equal(after.verdict, 'stale')
  assert.equal(after.mayClaimSuccess, false)
})

// ---------------------------------------------------------------------------
// Shipping states.
// ---------------------------------------------------------------------------

test('PR created, checks passed, and ready to merge are three different answers', () => {
  const head = 'a'.repeat(40)
  const base = { number: 7, url: 'https://example.invalid/pr/7', state: 'OPEN', isDraft: false, headRefOid: head, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', reviewDecision: '' }
  assert.equal(prState({ ...base, statusCheckRollup: [] }).checksPassed, false, 'no checks is not green')
  const red = prState({ ...base, statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' }] })
  assert.equal(red.stage, 'checks-failed', 'an explained red check is still red')
  const green = [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }]
  const passed = prState({ ...base, statusCheckRollup: green }, { threads: [{ isResolved: false }] })
  assert.equal(passed.checksPassed, true)
  assert.equal(passed.readyToMerge, false)
  assert.equal(prState({ ...base, statusCheckRollup: green }, { threads: [] }).stage, 'ready-to-merge')
  assert.equal(prState({ ...base, statusCheckRollup: green }, { localHead: 'b'.repeat(40), threads: [] }).checksPassed, false, 'checks on a head other than the local commit')
})

// ---------------------------------------------------------------------------
// Claims the plugin cannot support.
// ---------------------------------------------------------------------------

test('no shipped file calls the Codex tier a different model or cites an unsourced Codex size limit', () => {
  const shipped = ['README.md', 'agents', 'docs/advanced.md', 'docs/architecture.md', 'docs/limitations.md', 'docs/quickstart.md', 'skills', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']
  const files = []
  const walk = (rel) => {
    const abs = join(repoRoot, ...rel.split('/'))
    if (!existsSync(abs)) return
    if (statSync(abs).isDirectory()) for (const e of readdirSync(abs)) walk(`${rel}/${e}`)
    else files.push(rel)
  }
  for (const s of shipped) walk(s)
  const banned = [/different model architecture/i, /Codex's limit/i, /different model, run in a read-only/i, /on an external model/i]
  for (const rel of files.filter((f) => /\.(md|json|ya?ml)$/.test(f))) {
    const text = readFileSync(join(repoRoot, ...rel.split('/')), 'utf8')
    for (const re of banned) assert.doesNotMatch(text, re, `${rel} still says ${re}`)
  }
})
