// Rot signals: the deterministic half of the cleanup mode.
//
// Each signal is a candidate the cleanup playbook judges, so the tests pin two
// things per signal: it fires on the shape it names, and it stays quiet on the
// neighbouring shape that is legitimate. A rot detector that cries wolf on
// every tree teaches its reader to skip it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  SIGNALS,
  STARTUP_LINE_BUDGET,
  collectHygiene,
  declaredHead,
  normalizeSentence,
  sentencesOf,
  testCounts,
} from '../scripts/memory-hygiene.mjs'
import { listFiles } from '../scripts/lib/fs-utils.mjs'
import {
  cleanupAfter,
  commitAll,
  completeMemoryTree,
  git,
  gitAvailable,
  initRepo,
  makeFixture,
  writeTree,
} from './fixtures/build.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(repoRoot, 'scripts', 'memory-hygiene.mjs')
const needsGit = { skip: !gitAvailable() }

const signalsOf = (root, id) => collectHygiene(root).signals.filter((s) => s.signal === id)

function fixtureWith(overrides = {}) {
  return makeFixture({ ...completeMemoryTree(), ...overrides })
}

test('a complete, healthy tree raises no rot signal', () => {
  const root = makeFixture(completeMemoryTree())
  cleanupAfter(test, root)
  const result = collectHygiene(root)
  assert.deepEqual(result.signals, [])
  assert.deepEqual(result.checked, SIGNALS)
  assert.match(result.disclaimer, /candidates, not findings/)
})

test('no memory tree is reported as such, not as a clean one', () => {
  const root = makeFixture({ 'README.md': '# x\n' })
  cleanupAfter(test, root)
  const result = collectHygiene(root)
  assert.equal(result.memoryExists, false)
  assert.deepEqual(result.signals, [])
})

// --- completed-task ---------------------------------------------------------

test('a checked item on the punch list is a completed-task signal; an open one is not', () => {
  const tree = completeMemoryTree()
  const root = fixtureWith({
    'memory/next-actions.md': `${tree['memory/next-actions.md']}\n- [x] Ship the eviction policy\n- [ ] Measure hit rate\n`,
  })
  cleanupAfter(test, root)
  const found = signalsOf(root, 'completed-task')
  assert.equal(found.length, 1)
  assert.match(found[0].message, /Ship the eviction policy/)
  assert.equal(found[0].artifact, 'memory/next-actions.md')
  assert.equal(typeof found[0].line, 'number')
})

// --- resolved-bug -----------------------------------------------------------

test('a bug marked resolved but still live is a resolved-bug signal; an open bug is not', () => {
  const root = fixtureWith({
    'memory/bugs-and-risks.md':
      '# Bugs and Risks\n\n## Restart loses cache\n\nStatus: open\n\n## Timeout on cold start\n\nStatus: resolved\n',
  })
  cleanupAfter(test, root)
  const found = signalsOf(root, 'resolved-bug')
  assert.equal(found.length, 1)
  assert.match(found[0].message, /Timeout on cold start/)
  assert.equal(found[0].line, 7)
})

// --- duplicated-text --------------------------------------------------------

test('the same sentence in two files is duplicated-text, even re-wrapped and re-formatted', () => {
  const tree = completeMemoryTree()
  const claim = 'The cache evicts the least recently used entry once it holds more than five hundred items.'
  const root = fixtureWith({
    'memory/current-state.md': `${tree['memory/current-state.md']}\n${claim}\n`,
    'memory/handoff.md': tree['memory/handoff.md'].replace(
      '## Do not assume',
      `- The cache evicts the **least recently used** entry once it\n  holds more than five hundred items.\n\n## Do not assume`
    ),
  })
  cleanupAfter(test, root)
  const found = signalsOf(root, 'duplicated-text')
  assert.equal(found.length, 1, JSON.stringify(found))
  assert.deepEqual(found[0].occurrences.map((o) => o.artifact).sort(), ['memory/current-state.md', 'memory/handoff.md'])
})

test('short sentences, template boilerplate, fences, and the archive never count as duplicates', () => {
  // A long sentence straight from the shipped handoff template.
  const template = readFileSync(join(repoRoot, 'skills', 'project-memory', 'templates', 'handoff.md'), 'utf8')
  const templateSentence = template
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .find((p) => !p.startsWith('#') && !p.includes('{{') && p.length > 80)
  assert.ok(templateSentence, 'the handoff template has no long guidance paragraph left to test with')
  const tree = completeMemoryTree()
  const long = 'This long sentence about the eviction policy appears in exactly two separate places here.'
  const root = fixtureWith({
    'memory/current-state.md': `${tree['memory/current-state.md']}\nTests pass.\n\n\`\`\`\n${long}\n\`\`\`\n`,
    'memory/next-actions.md': `${tree['memory/next-actions.md']}\nTests pass.\n\n${long}\n`,
    'memory/archive/old.md': `# Old\n\n${long}\n`,
    // Two handoffs rendered from the same template share its guidance text.
    'memory/handoffs/a.md': `# Active Handoff\n\n${templateSentence}\n`,
    'memory/handoffs/b.md': `# Active Handoff\n\n${templateSentence}\n`,
    'memory/INDEX.md': `${tree['memory/INDEX.md']}\n- \`handoffs/a.md\`\n- \`handoffs/b.md\`\n`,
  })
  cleanupAfter(test, root)
  assert.deepEqual(signalsOf(root, 'duplicated-text'), [])
})

test('sentence normalization ignores list markers, emphasis, case, and wrapping', () => {
  assert.equal(normalizeSentence('- [x] The **Cache**  `evicts`.'), 'the cache evicts.')
  const [sentence] = sentencesOf('# H\n\nOne sentence that is long enough to count as a real claim\nwrapped across two lines.\n')
  assert.equal(sentence.line, 3)
  assert.match(sentence.key, /^one sentence .* two lines\.$/)
})

// --- diverging-test-counts --------------------------------------------------

test('two different suite results across startup files are diverging-test-counts', () => {
  const tree = completeMemoryTree()
  const root = fixtureWith({
    'memory/current-state.md': `${tree['memory/current-state.md']}\nnode --test: 459 passed, 0 failed, 15 skipped.\n`,
    'memory/handoff.md': tree['memory/handoff.md'].replace('## Do not assume', 'Suite: 470 passed, 0 failed, 15 skipped.\n\n## Do not assume'),
  })
  cleanupAfter(test, root)
  const found = signalsOf(root, 'diverging-test-counts')
  assert.equal(found.length, 1)
  assert.match(found[0].message, /459 passed, 0 failed, 15 skipped \| 470 passed, 0 failed, 15 skipped/)
  assert.equal(found[0].occurrences.length, 2)
})

test('the same result stated twice, or a count in a decision record, does not diverge', () => {
  const tree = completeMemoryTree()
  const root = fixtureWith({
    'memory/current-state.md': `${tree['memory/current-state.md']}\n12 passed, 0 failed.\n`,
    'memory/next-actions.md': `${tree['memory/next-actions.md']}\nLast run: 12 passed, 0 failed.\n`,
    'memory/decisions/001-in-memory-cache.md': `${tree['memory/decisions/001-in-memory-cache.md']}\nAt the time: 3 passed.\n`,
  })
  cleanupAfter(test, root)
  assert.deepEqual(signalsOf(root, 'diverging-test-counts'), [])
  assert.deepEqual(testCounts('Ran: 5 passed, 1 failed, 2 skipped and later 6 passed').map((c) => c.value), [
    '5 passed, 1 failed, 2 skipped',
    '6 passed',
  ])
})

// --- stale-handoff ----------------------------------------------------------

test('a handoff HEAD with commits after it is a stale-handoff signal', needsGit, (t) => {
  const root = makeFixture(completeMemoryTree())
  cleanupAfter(t, root)
  initRepo(root)
  const first = commitAll(root, 'first')
  const handoff = `# Active Handoff\n\nBranch: main\nHEAD: ${first.slice(0, 7)}\n\n## Objective\n\nX.\n\n## Continue here\n\n1. Y.\n\n## Do not assume\n\n- Z.\n`
  writeHandoff(root, handoff)
  // Saving the handoff, and any other memory-only commit, does not age it.
  commitAll(root, 'save the handoff')
  assert.deepEqual(signalsOf(root, 'stale-handoff'), [])

  writeTree(root, { 'src/cache.mjs': 'export const cache = new Map() // v2\n' })
  commitAll(root, 'second')
  writeTree(root, { 'src/api.mjs': 'export function serve() { return 1 }\n' })
  commitAll(root, 'third')

  const found = signalsOf(root, 'stale-handoff')
  assert.equal(found.length, 1)
  assert.match(found[0].message, /2 commit\(s\) outside memory\/ have landed since its HEAD/)
})

test('a handoff for a branch already merged, or one that no longer exists, is stale', needsGit, (t) => {
  const root = makeFixture(completeMemoryTree())
  cleanupAfter(t, root)
  initRepo(root)
  commitAll(root, 'base')
  git(root, ['checkout', '-q', '-b', 'feature/done'])
  commitAll(root, 'feature work')
  git(root, ['checkout', '-q', 'main'])
  git(root, ['merge', '-q', '--ff-only', 'feature/done'])

  writeHandoff(root, '# Active Handoff\n\nBranch: feature/done\n')
  assert.match(signalsOf(root, 'stale-handoff')[0]?.message ?? '', /feature\/done is already merged into main/)

  writeHandoff(root, '# Active Handoff\n\nBranch: feature/gone\n')
  assert.match(signalsOf(root, 'stale-handoff')[0]?.message ?? '', /feature\/gone no longer exists here/)

  writeHandoff(root, '# Active Handoff\n\nBranch: main\nHEAD: deadbeefdeadbeef\n')
  assert.match(signalsOf(root, 'stale-handoff')[0]?.message ?? '', /is not a commit in this repository/)
})

test('a current handoff on the current branch at HEAD is not stale', needsGit, (t) => {
  const root = makeFixture(completeMemoryTree())
  cleanupAfter(t, root)
  initRepo(root)
  commitAll(root, 'base')
  const head = git(root, ['rev-parse', 'HEAD']).trim()
  writeHandoff(root, `# Active Handoff\n\nBranch: main\nHEAD: ${head}\n`)
  assert.deepEqual(signalsOf(root, 'stale-handoff'), [])
  assert.equal(declaredHead('HEAD: `ABCDEF1`\n'), 'abcdef1')
  assert.equal(declaredHead('HEAD: not applicable\n'), null)
})

function writeHandoff(root, text) {
  writeTree(root, { 'memory/handoff.md': text })
}

// --- journal-entries --------------------------------------------------------

test('dated entries piling up in current-state.md are journal-entries; dates mid-sentence are not', () => {
  const tree = completeMemoryTree()
  const diary = '- 2026-08-03: auth failed.\n- 2026-08-04: fixed OAuth.\n- August 5: refresh tokens broke.\n'
  const root = fixtureWith({ 'memory/current-state.md': `${tree['memory/current-state.md']}\n${diary}` })
  cleanupAfter(test, root)
  const found = signalsOf(root, 'journal-entries')
  assert.equal(found.length, 1)
  assert.equal(found[0].lines.length, 3)

  // The fixture already says "run on 2026-08-01" and carries an Updated: line.
  const quiet = fixtureWith({})
  cleanupAfter(test, quiet)
  assert.deepEqual(signalsOf(quiet, 'journal-entries'), [])
})

// --- unreachable-file -------------------------------------------------------

test('a memory note nothing links to is unreachable; a linked one, a schema file, and the archive are not', () => {
  const tree = completeMemoryTree()
  const root = fixtureWith({
    'memory/notes/orphan.md': '# Orphan\n\nNothing points here.\n',
    'memory/notes/linked.md': '# Linked\n',
    'memory/INDEX.md': `${tree['memory/INDEX.md']}\nSee \`notes/linked.md\`.\n`,
    'memory/archive/retired.md': '# Retired\n',
    'memory/glossary.md': '# Glossary\n',
  })
  cleanupAfter(test, root)
  assert.deepEqual(signalsOf(root, 'unreachable-file').map((s) => s.artifact), ['memory/notes/orphan.md'])
})

test('an unlisted handoff in the directory layout is unreachable', () => {
  const tree = completeMemoryTree()
  delete tree['memory/handoff.md']
  const root = makeFixture({
    ...tree,
    'memory/INDEX.md': tree['memory/INDEX.md'].replace('2. `handoff.md`', '2. `handoffs/main.md`'),
    'memory/handoffs/main.md': '# Active Handoff\n\nBranch: main\n',
    'memory/handoffs/old-spike.md': '# Active Handoff\n\nBranch: old-spike\n',
  })
  cleanupAfter(test, root)
  assert.deepEqual(signalsOf(root, 'unreachable-file').map((s) => s.artifact), ['memory/handoffs/old-spike.md'])
})

// --- startup-budget ---------------------------------------------------------

test('a startup set over budget is a startup-budget signal naming each file', () => {
  const tree = completeMemoryTree()
  const filler = Array.from({ length: STARTUP_LINE_BUDGET }, (_, i) => `- state line ${i}`).join('\n')
  const root = fixtureWith({ 'memory/current-state.md': `${tree['memory/current-state.md']}\n${filler}\n` })
  cleanupAfter(test, root)
  const [found] = signalsOf(root, 'startup-budget')
  assert.ok(found)
  assert.ok(found.total > STARTUP_LINE_BUDGET)
  assert.ok(found.files.some((f) => f.artifact === 'memory/current-state.md'))
  // bugs-and-risks.md is not startup reading, so it never counts toward the budget.
  assert.ok(!found.files.some((f) => f.artifact === 'memory/bugs-and-risks.md'))
})

// --- CLI --------------------------------------------------------------------

test('the CLI reports in JSON, exits 0 with signals, and 2 on a bad directory', () => {
  const tree = completeMemoryTree()
  const root = fixtureWith({ 'memory/next-actions.md': `${tree['memory/next-actions.md']}\n- [x] Done thing\n` })
  cleanupAfter(test, root)

  const run = spawnSync(process.execPath, [SCRIPT, '--json', root], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  const parsed = JSON.parse(run.stdout)
  assert.equal(parsed.schemaVersion, 1)
  assert.ok(parsed.signals.some((s) => s.signal === 'completed-task'))

  const text = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' })
  assert.match(text.stdout, /completed-task/)
  assert.match(text.stdout, /candidates, not findings/)

  const bad = spawnSync(process.execPath, [SCRIPT, join(root, 'no-such-dir')], { encoding: 'utf8' })
  assert.equal(bad.status, 2)
})

test('the script never writes to the tree it inspects', () => {
  const tree = completeMemoryTree()
  const root = fixtureWith({ 'memory/next-actions.md': `${tree['memory/next-actions.md']}\n- [x] Done thing\n` })
  cleanupAfter(test, root)
  const snapshot = () =>
    listFiles(root)
      .map((abs) => `${abs}\n${readFileSync(abs, 'utf8')}`)
      .sort()
      .join('\0')
  const before = snapshot()
  spawnSync(process.execPath, [SCRIPT, '--json', root], { encoding: 'utf8' })
  assert.equal(snapshot(), before)
})
