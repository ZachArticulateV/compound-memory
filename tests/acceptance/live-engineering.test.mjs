// Acceptance: the engineering skills, run by a model.
//
// The structural suite pins what each skill says. Only running a skill shows
// what a model does with it, so this file runs them headlessly against a temp
// fixture (an invoice project with a seeded bug) and checks the files they
// leave behind with the plugin's own scripts. It asserts artifacts, never the
// model's description of what it did: a reply can claim a test passed; only
// re-running the test shows it.
//
// OFF by default, armed by the same variable as live-scenarios.test.mjs:
//
//   PROJECT_MEMORY_LIVE_ACCEPTANCE=1 node --test tests/acceptance/live-engineering.test.mjs
//
// Each scenario spends model tokens (about $0.10 to $0.40 each in the
// 2026-10-18 run). Knobs: PROJECT_MEMORY_LIVE_MODEL, PROJECT_MEMORY_LIVE_TIMEOUT_MS,
// PROJECT_MEMORY_LIVE_MAX_BUDGET_USD.
//
// Re-run this after changing a skill's wording: a green structural suite says
// nothing broke, not that behavior held.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, sep } from 'node:path'

import { childEnv, cleanupAfter, commitAll, git, gitAvailable, writeTree } from '../fixtures/build.mjs'
import { FAKE_REVIEW_COMMENT_IDS, bareRemote, fakeGhEnv, invoiceRepo } from '../fixtures/engineering.mjs'
import { LIVE_ENV_VAR } from '../fixtures/scenarios.mjs'
import { findExecutable } from '../../scripts/auditor-bridge.mjs'
import { checkTickets } from '../../scripts/tickets-check.mjs'
import { checkFindings } from '../../scripts/findings-check.mjs'
import { findLessons, loadLessons } from '../../scripts/lessons.mjs'
import { lessonProblems } from '../../scripts/lib/lessons.mjs'

const PLUGIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ARMED = process.env[LIVE_ENV_VAR] === '1'
const SKIP_REASON = `${LIVE_ENV_VAR} is not set. Set ${LIVE_ENV_VAR}=1 to run the engineering skills live (spends model tokens).`
const TIMEOUT_MS = Number(process.env.PROJECT_MEMORY_LIVE_TIMEOUT_MS || 1_500_000)
const MODEL = process.env.PROJECT_MEMORY_LIVE_MODEL || null
const MAX_BUDGET_USD = process.env.PROJECT_MEMORY_LIVE_MAX_BUDGET_USD || null

const live = () => (ARMED ? { timeout: TIMEOUT_MS * 3 } : { skip: SKIP_REASON })

/** Refuse to run anywhere but a temp fixture: these runs edit with permissions granted. */
function assertTempFixture(root) {
  const resolved = resolve(root)
  const temp = resolve(tmpdir())
  const inTemp = process.platform === 'win32'
    ? resolved.toLowerCase().startsWith(temp.toLowerCase() + sep)
    : resolved.startsWith(temp + sep)
  assert.ok(inTemp, `refused to run outside a temp fixture: ${resolved}`)
}

/**
 * Run one prompt with the plugin loaded. `stream` returns every event so a test
 * can see which skills were invoked; otherwise the final JSON envelope.
 */
function runSkill(root, prompt, { env = childEnv(), resume = null, stream = false } = {}) {
  assertTempFixture(root)
  const binary = findExecutable('claude')
  assert.ok(binary, 'claude is not on PATH')
  const args = [
    '-p', prompt,
    '--plugin-dir', PLUGIN_DIR,
    '--permission-mode', 'bypassPermissions',
    '--max-turns', '150',
    '--output-format', stream ? 'stream-json' : 'json',
  ]
  if (stream) args.push('--verbose')
  if (MODEL) args.push('--model', MODEL)
  if (MAX_BUDGET_USD) args.push('--max-budget-usd', MAX_BUDGET_USD)
  if (resume) args.push('--resume', resume)
  const isShim = /\.(cmd|bat)$/i.test(binary)
  const run = spawnSync(isShim ? 'cmd.exe' : binary, isShim ? ['/d', '/s', '/c', binary, ...args] : args, {
    cwd: root, env, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
  })
  assert.equal(run.status, 0, `claude exited ${run.status}: ${String(run.stderr).slice(0, 1500)}`)
  if (stream) return run.stdout.trim().split('\n').map((line) => JSON.parse(line))
  const envelope = JSON.parse(run.stdout)
  assert.notEqual(envelope.is_error, true, String(envelope.result).slice(0, 1500))
  return envelope
}

const npmTest = (root) => spawnSync(process.execPath, ['--test'], { cwd: root, encoding: 'utf8', env: childEnv() })
const commitCount = (root) => Number(git(root, ['rev-list', '--count', 'HEAD']).trim())
const exists = (root, rel) => existsSync(join(root, ...rel.split('/')))

function fixture(t) {
  if (!gitAvailable()) t.skip('git is not installed')
  const root = invoiceRepo()
  cleanupAfter(t, root)
  return root
}

// ---------------------------------------------------------------------------

test('debug: the seeded bug is fixed, committed, and behind a new test', live(), (t) => {
  const root = fixture(t)
  assert.notEqual(npmTest(root).status, 0, 'the fixture must start red')
  const before = commitCount(root)
  runSkill(root, '/compound-memory:debug Customers report invoice totals are too low on invoices with more than one line. Commit the fix.')
  assert.equal(npmTest(root).status, 0, 'the suite is not green after debug')
  assert.ok(commitCount(root) > before, 'debug did not commit')
  const tests = readFileSync(join(root, 'test', 'invoice.test.mjs'), 'utf8')
  assert.ok((tests.match(/\btest\(/g) ?? []).length >= 2, 'no regression test was added')
})

test('plan tickets then build: a checked graph, built ticket by ticket on a branch', live(), (t) => {
  const root = fixture(t)
  writeTree(root, { 'lib/invoice.mjs': readFileSync(join(root, 'lib', 'invoice.mjs'), 'utf8').replace('let i = 1', 'let i = 0') })
  commitAll(root, 'fix subtotal')
  runSkill(root, "/compound-memory:plan tickets Add per-line tax rates (each line may carry a taxPct) and a CLI 'node bin/invoice.mjs <file.json>' that prints the total. No human is available; proceed with your breakdown.")
  const dirs = readdirSync(join(root, 'docs', 'plans'), { withFileTypes: true }).filter((d) => d.isDirectory())
  assert.equal(dirs.length, 1, 'expected one tickets directory under docs/plans/')
  const ticketsDir = `docs/plans/${dirs[0].name}/tickets`
  const graph = checkTickets(root, ticketsDir)
  assert.ok(graph.tickets.length >= 2, 'fewer than two tickets')
  assert.deepEqual(graph.problems.filter((p) => ['cycle', 'unknown-blocker', 'missing-verify'].includes(p.kind)), [])

  runSkill(root, `/compound-memory:build ${ticketsDir}`)
  const after = checkTickets(root, ticketsDir)
  assert.ok(after.tickets.every((ticket) => ticket.done), 'not every ticket is marked done')
  assert.notEqual(git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(), 'main', 'build committed on the default branch')
  assert.equal(npmTest(root).status, 0)
  assert.ok(exists(root, 'bin/invoice.mjs'))
})

test('review: findings land in .verify/ and pass the findings gate', live(), (t) => {
  const root = fixture(t)
  git(root, ['checkout', '-q', '-b', 'feature'])
  writeTree(root, { 'lib/invoice.mjs': readFileSync(join(root, 'lib', 'invoice.mjs'), 'utf8').replace('let i = 1', 'let i = 0') + '\nexport const parse = (s) => eval(s)\n' })
  commitAll(root, 'fix subtotal and add a parser')
  const reply = runSkill(root, '/compound-memory:review code main')
  assert.ok(exists(root, '.verify/review-findings.json'), `review wrote no findings file. Its reply:\n${String(reply.result).slice(0, 2000)}`)
  const result = checkFindings(root, JSON.parse(readFileSync(join(root, '.verify', 'review-findings.json'), 'utf8')))
  assert.equal(result.error, undefined)
  assert.ok(result.kept.some((f) => /eval/i.test(`${f.title} ${f.quote}`)), 'the planted eval() was not kept as a finding')
  assert.equal(result.counts.quoteNotFound, 0, 'a finding quoted code that is not in the file')
})

test('learn capture and refresh: a lesson lookup finds, then a false one retired', live(), (t) => {
  const root = fixture(t)
  runSkill(root, '/compound-memory:learn capture Lesson: Math.round rounds half-cent ties toward positive infinity, so a negative amount rounds differently from its positive counterpart; round the absolute value and restore the sign.')
  const lessons = loadLessons(root)
  assert.equal(lessons.length, 1, 'expected exactly one lesson')
  assert.deepEqual(lessonProblems(lessons[0]), [])
  assert.equal(findLessons(root, { query: 'rounding negative refund' }).results.length, 1)

  writeTree(root, {
    'memory/lessons/total-uses-subtotal.md': '---\ntitle: total() never calls subtotal()\ntags: [totals]\napplies_when: Changing totals\npaths: [lib/invoice.mjs]\nstatus: active\n---\n\n# total() never calls subtotal()\n\n## Do this\n\nChange subtotal freely; total does not use it.\n',
  })
  commitAll(root, 'seed a false lesson')
  runSkill(root, '/compound-memory:learn refresh')
  const seeded = loadLessons(root).find((l) => l.path.endsWith('total-uses-subtotal.md'))
  assert.ok(seeded, 'refresh deleted the false lesson instead of retiring it')
  assert.ok(['stale', 'retired'].includes(seeded.status), `the false lesson is still ${seeded.status}`)
})

test('ship watch and feedback: CI fixed at the cause, every review thread answered', live(), (t) => {
  const root = fixture(t)
  writeTree(root, { 'lib/invoice.mjs': readFileSync(join(root, 'lib', 'invoice.mjs'), 'utf8').replace('let i = 1', 'let i = 0') })
  commitAll(root, 'fix subtotal')
  const remote = bareRemote(root)
  cleanupAfter(t, remote)
  git(root, ['checkout', '-q', '-b', 'feature'])
  writeTree(root, { 'lib/invoice.mjs': readFileSync(join(root, 'lib', 'invoice.mjs'), 'utf8').replace('(1 - discountPct / 100)', '(1 + discountPct / 100)') })
  commitAll(root, 'apply the discount')
  git(root, ['push', '-q', '-u', 'origin', 'feature'])
  assert.notEqual(npmTest(root).status, 0, 'CI must start red')

  const watchLog = join(root, '..', `gh-watch-${Date.now()}.log`)
  const watchEnv = fakeGhEnv(watchLog)
  cleanupAfter(t, watchEnv.bin)
  runSkill(root, '/compound-memory:ship watch PR #7', { env: watchEnv })
  assert.equal(npmTest(root).status, 0, 'CI is still red after ship watch')
  assert.equal(git(root, ['rev-parse', 'HEAD']).trim(), git(remote, ['rev-parse', 'feature']).trim(), 'the fix was not pushed')

  const feedbackLog = join(root, '..', `gh-feedback-${Date.now()}.log`)
  const feedbackEnv = fakeGhEnv(feedbackLog)
  cleanupAfter(t, feedbackEnv.bin)
  runSkill(root, '/compound-memory:ship feedback PR #7', { env: feedbackEnv })
  const calls = readFileSync(feedbackLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l).args.join(' '))
  for (const id of FAKE_REVIEW_COMMENT_IDS) {
    assert.ok(calls.some((c) => c.includes(`comments/${id}/replies`) || (c.includes('graphql') && c.includes(String(id)))), `no reply to review comment ${id}`)
  }
  assert.equal(npmTest(root).status, 0)
})

test('routing: an ordinary coding request in a repo with memory does not run a memory mode', live(), (t) => {
  const root = fixture(t)
  writeTree(root, {
    'memory/INDEX.md': '# Project Memory Index\n\nRead `current-state.md` first.\n',
    'memory/current-state.md': '# Current State\n\nThe invoice total is computed in `lib/invoice.mjs`.\n',
  })
  commitAll(root, 'add memory')
  const events = runSkill(root, 'Rename the `subtotal` function to `linesTotal` everywhere.', { stream: true })
  const skills = events
    .filter((e) => e.type === 'assistant')
    .flatMap((e) => e.message.content ?? [])
    .filter((c) => c.type === 'tool_use' && c.name === 'Skill')
    .map((c) => c.input.skill)
  assert.ok(!skills.some((s) => /(^|:)project-memory$/.test(s)), `the memory skill ran: ${skills}`)
  assert.match(readFileSync(join(root, 'lib', 'invoice.mjs'), 'utf8'), /linesTotal/)
})
