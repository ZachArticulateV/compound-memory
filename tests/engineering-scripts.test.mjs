// The deterministic scripts under the engineering skills.
//
// Each script exists because an upstream skill left the same fact to prose and
// it went wrong there: Compound Engineering's tag grep missed block-list tags,
// its quote gate never checked the quote, and mattpocock's ticket edges were
// never checked at all. The tests pin the case that motivated each one, and the
// neighbouring case that must stay quiet.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { findLessons } from '../scripts/lessons.mjs'
import { lessonProblems, parseLesson, pathMatches, readLessonFrontmatter } from '../scripts/lib/lessons.mjs'
import { checkFindings, floorConfidence, locateQuote } from '../scripts/findings-check.mjs'
import { analyzeTickets, checkTickets, parseBlockers, parseTicket, touchesOverlap } from '../scripts/tickets-check.mjs'
import { decide, median } from '../scripts/measure.mjs'
import { cleanupAfter, makeTempRoot, writeTree } from './fixtures/build.mjs'

const scripts = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts')
const run = (script, args) => spawnSync(process.execPath, [join(scripts, script), ...args], { encoding: 'utf8' })

const lesson = ({ title = 'Retried jobs must be idempotent', tags = '[jobs, retries]', status = 'active', paths = '[app/jobs/]', applies = 'Changing a background job the queue can retry', body = '## Do this\n\nMake the job safe to run twice.\n' } = {}) =>
  `---\ntitle: ${title}\ntags: ${tags}\napplies_when: ${applies}\npaths: ${paths}\nstatus: ${status}\n---\n\n# ${title}\n\n${body}`

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

test('a block-list tag is found the same as a bracket-list tag', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    'memory/lessons/inline.md': lesson({ title: 'Inline tags', tags: '[subagent, context]' }),
    'memory/lessons/block.md': lesson({ title: 'Block tags', tags: '\n  - subagent\n  - context' }),
  })
  const found = findLessons(root, { query: 'subagent' })
  assert.deepEqual(found.results.map((r) => r.title).sort(), ['Block tags', 'Inline tags'])
})

test('the validator view asks for bracket lists without hiding the lesson', () => {
  const block = parseLesson('memory/lessons/b.md', lesson({ tags: '\n  - jobs' }))
  assert.deepEqual(block.tags, ['jobs'])
  assert.ok(lessonProblems(block).some((p) => p.includes('block list')))
  assert.deepEqual(lessonProblems(parseLesson('memory/lessons/a.md', lesson())), [])
})

test('stale and retired lessons are left out unless asked for, and the count says so', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    'memory/lessons/live.md': lesson({ title: 'Live retry lesson' }),
    'memory/lessons/old.md': lesson({ title: 'Old retry lesson', status: 'stale' }),
    'memory/lessons/gone.md': lesson({ title: 'Gone retry lesson', status: 'retired' }),
  })
  const normal = findLessons(root, { query: 'retry' })
  assert.deepEqual(normal.results.map((r) => r.title), ['Live retry lesson'])
  assert.equal(normal.excludedInactive, 2)
  assert.equal(findLessons(root, { query: 'retry', includeInactive: true }).results.length, 3)
})

test('a changed path finds the lesson about it with no query words', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'memory/lessons/jobs.md': lesson(), 'memory/lessons/other.md': lesson({ title: 'Other', paths: '[web/]', tags: '[css]' }) })
  const found = findLessons(root, { paths: ['app/jobs/charge.rb'] })
  assert.deepEqual(found.results.map((r) => r.path), ['memory/lessons/jobs.md'])
  assert.ok(pathMatches('app/jobs/', 'app/jobs/charge.rb'))
  assert.ok(!pathMatches('app/job', 'app/jobs/charge.rb'))
})

test('a query that matches nothing returns nothing, not every lesson', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'memory/lessons/jobs.md': lesson() })
  assert.equal(findLessons(root, { query: 'typography kerning' }).results.length, 0)
  assert.equal(findLessons(root, {}).results.length, 1, 'no query lists the active lessons')
})

test('a lesson missing required fields or the Do this section is reported', () => {
  const problems = lessonProblems(parseLesson('memory/lessons/x.md', '---\ntitle: X\nstatus: maybe\n---\n\n# X\n'))
  for (const expected of ['missing tags', 'missing applies_when', 'status "maybe"', '## Do this']) {
    assert.ok(problems.some((p) => p.includes(expected)), `expected a problem mentioning ${expected}: ${problems}`)
  }
  assert.equal(readLessonFrontmatter('no frontmatter').present, false)
})

test('the lessons CLI runs, and a bad limit is a usage error', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'memory/lessons/jobs.md': lesson() })
  const ok = run('lessons.mjs', ['--cwd', root, '--query', 'retry', '--json'])
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal(JSON.parse(ok.stdout).results.length, 1)
  assert.equal(run('lessons.mjs', ['--cwd', root, '--limit', 'x']).status, 2)
})

test('a second path is a path, not the project root', (t) => {
  // `--paths app/jobs tests` once read "tests" as the root, found no lessons
  // there, and exited 0: a silent miss in every skill that passed two paths.
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'memory/lessons/jobs.md': lesson(), 'tests/x.test.mjs': '', 'app/jobs/charge.rb': '' })
  for (const args of [['--paths', 'web', 'app/jobs/charge.rb'], ['--paths', 'web app/jobs/charge.rb'], ['--paths', 'web,app/jobs/charge.rb']]) {
    const out = run('lessons.mjs', ['--cwd', root, '--json', ...args])
    assert.equal(out.status, 0, out.stderr)
    const parsed = JSON.parse(out.stdout)
    assert.equal(parsed.root, root.split('\\').join('/'), `${args.join(' ')} changed the root`)
    assert.equal(parsed.results.length, 1, `${args.join(' ')} missed the lesson`)
  }
})

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const QUEUE = 'export function retry(job) {\n  return run(job)\n}\n\nexport const other = 1\n'

test('a quote is located at, near, away from, or absent from the cited line', () => {
  assert.equal(locateQuote(QUEUE, 'return run(job)', 2).status, 'at-line')
  assert.equal(locateQuote(QUEUE, 'return    run(job)', 4).status, 'at-line', 'whitespace and a nearby line still match')
  const moved = locateQuote(QUEUE, 'export const other = 1', 1)
  assert.equal(moved.status, 'moved', 'line 5 is four lines from line 1, past the tolerance of three')
  assert.equal(moved.line, 5)
})

test('a quote far from its cited line is moved to where it really is', () => {
  const text = `${'// filler\n'.repeat(20)}target()\n`
  const where = locateQuote(text, 'target()', 2)
  assert.equal(where.status, 'moved')
  assert.equal(where.line, 21)
  assert.equal(locateQuote(text, 'absent()', 2).status, 'not-found')
})

test('a finding that quotes code which is not there loses its confidence', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.ts': QUEUE })
  const result = checkFindings(root, {
    findings: [{ lens: 'standards', severity: 'P2', confidence: 100, file: 'lib/queue.ts', line: 1, quote: 'function invented()', title: 'Bad name' }],
  })
  assert.equal(result.kept.length, 0)
  assert.equal(result.suppressed[0].confidence, 25)
  assert.equal(result.counts.quoteNotFound, 1)
})

test('agreement raises confidence only across different models', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.ts': QUEUE })
  const finding = (model, lens) => ({ lens, model, severity: 'P1', confidence: 75, file: 'lib/queue.ts', line: 2, quote: 'return run(job)', title: 'Retry runs the job twice' })
  const sameModel = checkFindings(root, [finding('claude', 'spec'), finding('claude', 'correctness')])
  assert.equal(sameModel.merged, 1)
  assert.equal(sameModel.kept[0].confidence, 75)
  assert.equal(sameModel.kept[0].promoted, false)
  const crossModel = checkFindings(root, [finding('claude', 'spec'), finding('codex', 'correctness')])
  assert.equal(crossModel.kept[0].confidence, 100)
  assert.deepEqual(crossModel.kept[0].lenses, ['spec', 'correctness'])
})

test('a P0 survives low confidence; anything else needs 75', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.ts': QUEUE })
  const result = checkFindings(root, [
    { severity: 'P0', confidence: 50, file: 'lib/queue.ts', line: 2, quote: 'return run(job)', title: 'Data loss' },
    { severity: 'P1', confidence: 50, file: 'lib/queue.ts', line: 2, quote: 'return run(job)', title: 'Maybe slow' },
  ])
  assert.deepEqual(result.kept.map((f) => f.title), ['Data loss'])
  assert.equal(floorConfidence(80), 75)
  assert.equal(floorConfidence('x'), 0)
})

test('a finding with no quote cannot keep high confidence', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.ts': QUEUE })
  const result = checkFindings(root, [{ severity: 'P1', confidence: 100, file: 'lib/queue.ts', line: 2, title: 'Unquoted' }])
  assert.equal(result.suppressed[0].confidence, 50)
})

test('the findings CLI reads a file and rejects a malformed one', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    'lib/queue.ts': QUEUE,
    'f.json': JSON.stringify({ findings: [{ severity: 'P1', confidence: 75, file: 'lib/queue.ts', line: 2, quote: 'return run(job)', title: 'T' }] }),
    'bad.json': '{"nope": 1}',
  })
  const ok = run('findings-check.mjs', ['--cwd', root, '--input', join(root, 'f.json'), '--json'])
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal(JSON.parse(ok.stdout).counts.kept, 1)
  assert.equal(run('findings-check.mjs', ['--cwd', root, '--input', join(root, 'bad.json')]).status, 2)
  assert.equal(run('findings-check.mjs', ['--cwd', root]).status, 2)
})

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

const ticket = (n, { blocked = 'None', touches = '`src/`', verify = 'npm test', status = 'ready' } = {}) =>
  `# ${n}: Ticket ${n}\n\n**What to build:** something.\n**Blocked by:** ${blocked}\n**Touches:** ${touches}\n**Verify with:** ${verify}\n**Status:** ${status}\n`

test('blockers and touched paths parse from the ticket lines', () => {
  assert.deepEqual(parseBlockers('None (can start immediately)'), [])
  assert.deepEqual(parseBlockers('01, #3 and 03'), ['1', '3'])
  const t = parseTicket('t/02-api.md', ticket('02', { blocked: '01', touches: '`app/api/`, lib/queue.ts' }))
  assert.equal(t.id, '2')
  assert.equal(t.title, 'Ticket 02')
  assert.deepEqual(t.touches, ['app/api', 'lib/queue.ts'])
  assert.ok(touchesOverlap('lib', 'lib/queue.ts'))
  assert.ok(!touchesOverlap('lib', 'library'))
})

test('the frontier, waves, and collisions follow the blocking edges', () => {
  const tickets = [
    parseTicket('t/01-a.md', ticket('01', { status: 'done', touches: '`db/`' })),
    parseTicket('t/02-b.md', ticket('02', { blocked: '01', touches: '`lib/`' })),
    parseTicket('t/03-c.md', ticket('03', { blocked: '01', touches: '`lib/queue.ts`' })),
    parseTicket('t/04-d.md', ticket('04', { blocked: '01', touches: '`web/`' })),
    parseTicket('t/05-e.md', ticket('05', { blocked: '02, 03' })),
  ]
  const result = analyzeTickets(tickets)
  assert.deepEqual(result.frontier, ['2', '3', '4'])
  assert.deepEqual(result.waves, [['2', '3', '4'], ['5']])
  assert.deepEqual(result.collisions, [{ tickets: ['2', '3'], paths: ['lib'] }])
  assert.deepEqual(result.problems, [])
})

test('cycles, unknown blockers, and missing verify commands are problems', () => {
  const result = analyzeTickets([
    parseTicket('t/01-a.md', ticket('01', { blocked: '02' })),
    parseTicket('t/02-b.md', ticket('02', { blocked: '01' })),
    parseTicket('t/03-c.md', ticket('03', { blocked: '09', verify: '' })),
  ])
  const kinds = result.problems.map((p) => p.kind).sort()
  assert.deepEqual(kinds, ['cycle', 'missing-verify', 'unknown-blocker'])
  assert.ok(!result.frontier.includes('1') && !result.frontier.includes('2'))
})

test('the tickets CLI exits 1 on a broken graph and 0 on a sound one', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    'good/01-a.md': ticket('01'),
    'good/02-b.md': ticket('02', { blocked: '01' }),
    'good/README.md': '# not a ticket\n',
    'bad/01-a.md': ticket('01', { blocked: '07' }),
  })
  const good = run('tickets-check.mjs', ['--cwd', root, '--dir', 'good', '--json'])
  assert.equal(good.status, 0, good.stderr)
  assert.equal(JSON.parse(good.stdout).tickets.length, 2, 'README.md is not a ticket')
  assert.equal(run('tickets-check.mjs', ['--cwd', root, '--dir', 'bad']).status, 1)
  assert.equal(run('tickets-check.mjs', ['--cwd', root, '--dir', 'missing']).status, 2)
  assert.equal(checkTickets(root, 'good').frontier.length, 1)
})

// ---------------------------------------------------------------------------
// Measure
// ---------------------------------------------------------------------------

test('a change is kept only when it clears the noise floor', () => {
  assert.equal(decide({ baseline: [100, 102, 101], candidate: [90, 91, 92] }).verdict, 'keep')
  assert.equal(decide({ baseline: [100, 110], candidate: [101, 104] }).verdict, 'inconclusive')
  assert.equal(decide({ baseline: [90, 91], candidate: [100, 101] }).verdict, 'revert')
  assert.equal(decide({ baseline: [10, 10.1], candidate: [12, 12.1], direction: 'higher' }).verdict, 'keep')
})

test('one sample per side is inconclusive unless a noise floor is given', () => {
  assert.equal(decide({ baseline: [100], candidate: [90] }).verdict, 'inconclusive')
  assert.equal(decide({ baseline: [100], candidate: [90], noise: 0.02 }).verdict, 'keep')
  assert.equal(decide({ baseline: [0, 0], candidate: [1, 1] }).verdict, 'inconclusive')
  assert.equal(median([3, 1, 2, 4]), 2.5)
})

test('the measure CLI requires both sides', () => {
  assert.equal(run('measure.mjs', ['--baseline', '1,2']).status, 2)
  const ok = run('measure.mjs', ['--baseline', '100,101', '--candidate', '80,81', '--json'])
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal(JSON.parse(ok.stdout).verdict, 'keep')
})

// ---------------------------------------------------------------------------
// Regressions from the script review (each input below failed before its fix)
// ---------------------------------------------------------------------------

test('a second model with a fabricated quote does not count as agreement', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.ts': QUEUE })
  const result = checkFindings(root, [
    { model: 'claude', severity: 'P1', confidence: 75, file: 'lib/queue.ts', line: 2, quote: 'return run(job)', title: 'Retry twice' },
    { model: 'gpt', severity: 'P1', confidence: 75, file: 'lib/queue.ts', line: 3, quote: 'retryForever(job)', title: 'Retry twice' },
  ])
  assert.equal(result.kept[0].promoted, false)
  assert.equal(result.kept[0].confidence, 75)
})

test('a quote that spans a blank line is found', () => {
  const where = locateQuote('function a() {}\n\nfunction b() {\n}\n', 'function a() {} function b() {', 1)
  assert.equal(where.status, 'at-line')
  assert.equal(where.line, 1)
  assert.equal(locateQuote('\n\nfoo()\n', 'foo()', 3).line, 3, 'leading blank lines keep the line numbers')
})

test('an absolute file path inside the repository is accepted', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'lib/queue.ts': QUEUE })
  const result = checkFindings(root, [{ severity: 'P1', confidence: 75, file: join(root, 'lib', 'queue.ts'), line: 2, quote: 'return run(job)', title: 'T' }])
  assert.equal(result.kept.length, 1)
  assert.equal(result.kept[0].file, 'lib/queue.ts')
})

test('numbers in notes, dates, and PR references are not blockers', () => {
  assert.deepEqual(parseBlockers('03 (needs Node 18)'), ['3'])
  assert.deepEqual(parseBlockers('02, see PR #45'), ['2'])
  assert.deepEqual(parseBlockers('None (was 03)'), [])
  assert.deepEqual(parseBlockers('04, after the 2026-10-20 release'), ['4'])
  assert.deepEqual(parseBlockers('01 (the schema, v2)'), ['1'])
})

test('"not done" and an unfilled status template are open, not done', () => {
  for (const status of ['not done', 'not complete', 'ready | in-progress | done']) {
    assert.equal(parseTicket('t/01-a.md', ticket('01', { status })).done, false, status)
  }
  assert.equal(parseTicket('t/01-a.md', ticket('01', { status: 'done' })).done, true)
  assert.equal(parseTicket('t/01-a.md', ticket('01', { status: '**Done** (merged #12)' })).done, true)
})

test('two tickets with one number are a problem, and the number is not done until both are', () => {
  const result = analyzeTickets([
    parseTicket('t/01-a.md', ticket('01')),
    parseTicket('t/01-b.md', ticket('01', { status: 'done' })),
    parseTicket('t/02-c.md', ticket('02', { blocked: '01' })),
  ])
  assert.ok(result.problems.some((p) => p.kind === 'duplicate-id'))
  assert.ok(!result.frontier.includes('2'), 'ticket 02 is still blocked by the open 01')
})

test('plural, -ing, and -ed forms match, and short unrelated words do not', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    'memory/lessons/retry.md': lesson({ title: 'Retried jobs must be idempotent', tags: '[jobs, retries, files, parsing, cached]' }),
    'memory/lessons/ring.md': lesson({ title: 'Ring buffer sizing', tags: '[buffers]', applies: 'Sizing a buffer', paths: '[lib/buffer/]', body: '## Do this\n\nSize it to a power of two.\n' }),
  })
  for (const query of ['retry', 'file', 'parse', 'cache']) {
    assert.deepEqual(findLessons(root, { query }).results.map((r) => r.title), ['Retried jobs must be idempotent'], query)
  }
  assert.equal(findLessons(root, { query: 'red' }).results.length, 0, '"red" must not match "Ring" or "retried"')
})

test('two-letter tags match, and a stopword-only query matches nothing', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, {
    'memory/lessons/ci.md': lesson({ title: 'Pin the runner image', tags: '[ci, docker]' }),
    'memory/lessons/other.md': lesson({ title: 'Other', tags: '[css]', paths: '[web/]' }),
  })
  assert.deepEqual(findLessons(root, { query: 'ci' }).results.map((r) => r.title), ['Pin the runner image'])
  assert.equal(findLessons(root, { query: 'the of' }).results.length, 0)
})

test('an unindented block list is read, and later fields survive it', () => {
  const fm = readLessonFrontmatter('---\ntitle: T\ntags:\n- jobs\n- retries\nstatus: stale\napplies_when: X\n---\n')
  assert.equal(fm.error, null)
  assert.deepEqual(fm.data.tags, ['jobs', 'retries'])
  assert.equal(fm.data.status, 'stale')
  assert.equal(fm.listStyle.tags, 'block')
})

test('a noise or minimum effect that is not a ratio is a usage error', () => {
  assert.equal(run('measure.mjs', ['--baseline', '1,2', '--candidate', '1,2', '--noise', '5%']).status, 2)
  assert.equal(run('measure.mjs', ['--baseline', '1,2', '--candidate', '1,2', '--min-effect', 'abc']).status, 2)
  assert.equal(run('measure.mjs', ['--baseline', '1,2', '--candidate', '1,2', '--noise', '0.05']).status, 0)
})

// ---------------------------------------------------------------------------
// The live harnesses must not leak the test runner's context
// ---------------------------------------------------------------------------

test('every live harness spawns with NODE_TEST_CONTEXT removed', async () => {
  // An inherited NODE_TEST_CONTEXT makes a nested `node --test` exit 0 on a
  // failing suite. The first armed run of live-engineering.test.mjs saw its red
  // fixtures as green because of it.
  const { readFileSync } = await import('node:fs')
  const { childEnv } = await import('./fixtures/build.mjs')
  assert.equal('NODE_TEST_CONTEXT' in childEnv({ NODE_TEST_CONTEXT: 'child-v8', A: '1' }), false)
  const here = dirname(fileURLToPath(import.meta.url))
  for (const file of ['acceptance/live-scenarios.test.mjs', 'acceptance/live-engineering.test.mjs']) {
    const source = readFileSync(join(here, file), 'utf8')
    assert.match(source, /childEnv\(\)/, `${file} spawns without childEnv()`)
  }
  assert.match(readFileSync(join(here, 'fixtures', 'fake-gh.cjs'), 'utf8'), /delete env\.NODE_TEST_CONTEXT/)
})

test('a nested test run inside node --test reports failure once the context is removed', (t) => {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, { 'a.test.mjs': "import { test } from 'node:test'\nimport assert from 'node:assert'\ntest('x', () => assert.equal(1, 2))\n" })
  return import('./fixtures/build.mjs').then(({ childEnv }) => {
    const nested = spawnSync(process.execPath, ['--test'], { cwd: root, encoding: 'utf8', env: childEnv() })
    assert.notEqual(nested.status, 0)
  })
})
