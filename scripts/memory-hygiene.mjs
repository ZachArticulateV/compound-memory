#!/usr/bin/env node
// memory-hygiene.mjs — list the places a memory tree is most likely rotting,
// with no model in the loop.
//
// WHAT THIS IS: the deterministic half of the `cleanup` mode. Context rot has a
// handful of mechanical shapes -- a finished task still on the punch list, a
// resolved bug never archived, the same sentence in two files, two test counts
// for one suite, a handoff for a branch that already merged, a snapshot file
// turning into a diary, a note nothing links to, a startup read that has grown
// past what a session should load. Each of those is findable by code, so it is
// found by code rather than left to a model reading carefully.
//
// WHAT THIS IS NOT: a verdict. Every signal is a CANDIDATE. A duplicated
// sentence may be a deliberate pointer; a checked task may be waiting for its
// completion to be recorded elsewhere. The cleanup playbook decides. That is
// why this script exits 0 whenever it ran, however many signals it found.
//
// Read-only: nothing here writes, and Git is only ever queried.

import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { countLines, isFile, joinRel, lineOf, listFiles, readTextSafe } from './lib/fs-utils.mjs'
import { runGit, readGitState } from './lib/git.mjs'
import {
  CLAUDE_MD_SCOPE,
  CORE_MEMORY_FILES,
  MEMORY_DIRNAME,
  OPTIONAL_MEMORY_FILES,
  discoverMemory,
  extractReferences,
  extractTasks,
  maskNonProse,
  parseSections,
  resolveActiveHandoff,
  resolveReference,
} from './lib/memory-model.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const HYGIENE_SCHEMA_VERSION = 1

/** Every signal this script can raise, so the report can name its own coverage. */
export const SIGNALS = [
  'completed-task',
  'resolved-bug',
  'duplicated-text',
  'diverging-test-counts',
  'stale-handoff',
  'journal-entries',
  'unreachable-file',
  'startup-budget',
]

/**
 * Combined line budget for the startup set (INDEX.md, current-state.md, the
 * active handoff, next-actions.md). One file may reach 400 lines before the
 * validator calls it oversized; the whole startup read should not cost more.
 */
export const STARTUP_LINE_BUDGET = 400

/** A sentence shorter than this is too generic for a repeat to mean anything. */
const MIN_DUPLICATE_CHARS = 60
const MIN_DUPLICATE_WORDS = 8

/** Line-leading dates in a snapshot file are diary entries once there are this many. */
const JOURNAL_THRESHOLD = 3

export const HYGIENE_DISCLAIMER =
  'Rot signals are candidates, not findings. Each one needs a reading of the files it names ' +
  'before anything is changed, and a clean run does not mean memory is accurate.'

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'project-memory', 'templates')

const signal = (id, artifact, message, extra = {}) => ({ signal: id, artifact, message, ...extra })

const memoryRel = (name) => `${MEMORY_DIRNAME}/${name}`
const isArchive = (rel) => rel.startsWith(`${MEMORY_DIRNAME}/archive/`)
// Lessons are reached through scripts/lessons.mjs, which matches them to the
// task at hand, not through links, so an unlinked lesson is not unreachable.
const isLesson = (rel) => rel.startsWith(`${MEMORY_DIRNAME}/lessons/`)

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function collectHygiene(root, options = {}) {
  const absRoot = resolve(root)
  const memory = discoverMemory(absRoot)
  const result = {
    schemaVersion: HYGIENE_SCHEMA_VERSION,
    root: absRoot.split('\\').join('/'),
    memoryExists: memory.exists,
    checked: SIGNALS,
    signals: [],
    disclaimer: HYGIENE_DISCLAIMER,
  }
  if (!memory.exists) return result

  const texts = new Map()
  for (const rel of memory.markdownFiles) texts.set(rel, readTextSafe(joinRel(absRoot, rel)) ?? '')

  const git = readGitState(absRoot, options)
  const handoff = resolveActiveHandoff(memory.handoffs, git?.branch ?? null)
  const handoffPaths = memory.handoffs.files.map((f) => f.path)
  const startupSet = [memoryRel('INDEX.md'), memoryRel('current-state.md'), memoryRel('next-actions.md')]
  if (handoff.active !== null) startupSet.splice(2, 0, handoff.active.path)

  const out = result.signals
  out.push(...completedTasks(texts))
  out.push(...resolvedBugs(texts))
  out.push(...duplicatedText(texts, templateSentences()))
  out.push(...divergingTestCounts(texts, [...new Set([...startupSet, ...handoffPaths])]))
  out.push(...staleHandoffs(absRoot, texts, memory.handoffs.files, git, options))
  out.push(...journalEntries(texts, [memoryRel('current-state.md'), ...handoffPaths]))
  out.push(...unreachableFiles(absRoot, texts, memory))
  out.push(...startupBudget(texts, startupSet))
  return result
}

// ---------------------------------------------------------------------------
// Punch list and bug log: lifecycle not followed
// ---------------------------------------------------------------------------

/** A checked box on the punch list: done work that never left it. */
export function completedTasks(texts) {
  const rel = memoryRel('next-actions.md')
  const text = texts.get(rel)
  if (text === undefined) return []
  return extractTasks(text)
    .filter((task) => task.done)
    .map((task) =>
      signal('completed-task', rel, `checked item still on the punch list: ${task.text}`, { line: task.line })
    )
}

/** A bug entry whose status says it is over, still in the live file. */
export function resolvedBugs(texts) {
  const rel = memoryRel('bugs-and-risks.md')
  const text = texts.get(rel)
  if (text === undefined) return []
  const found = []
  for (const section of parseSections(text)) {
    if (section.level !== 2) continue
    const status = /^\s*Status:\s*\**\s*(resolved|fixed|closed|done)\b/im.exec(maskNonProse(section.body))
    if (status === null) continue
    found.push(
      signal('resolved-bug', rel, `"${section.title}" is marked ${status[1].toLowerCase()} but not archived`, {
        line: section.line,
      })
    )
  }
  return found
}

// ---------------------------------------------------------------------------
// The same claim in two places
// ---------------------------------------------------------------------------

/**
 * Sentences of a document with their line numbers. Fences, comments, headings,
 * and table rows are skipped; list items and wrapped lines are joined into the
 * paragraph they belong to, so a re-wrapped copy still matches.
 */
export function sentencesOf(text) {
  const prose = maskNonProse(text.replace(/\r\n/g, '\n'))
  const out = []
  const blocks = []
  let start = null
  const lines = prose.split('\n')
  let offset = 0
  const close = (end) => {
    if (start !== null) blocks.push([start, end])
    start = null
  }
  for (const line of lines) {
    const lineEnd = offset + line.length
    const boundary = /^\s*$/.test(line) || /^\s*(#{1,6}\s|\|)/.test(line)
    const listItem = /^\s*([-*+]|\d+\.)\s/.test(line)
    if (boundary) close(offset)
    else {
      if (listItem) close(offset)
      if (start === null) start = offset
    }
    offset = lineEnd + 1
  }
  close(prose.length)

  for (const [from, to] of blocks) {
    // Newlines become spaces, so offsets inside the block still map to lines.
    const block = prose.slice(from, to).replace(/\n/g, ' ')
    const re = /[^.!?]+(?:[.!?]+|$)/g
    let m
    while ((m = re.exec(block)) !== null) {
      if (m[0].trim() === '') {
        re.lastIndex += 1
        continue
      }
      const key = normalizeSentence(m[0])
      if (key.length < MIN_DUPLICATE_CHARS || key.split(' ').length < MIN_DUPLICATE_WORDS) continue
      const lead = m[0].length - m[0].trimStart().length
      out.push({ key, line: lineOf(prose, from + m.index + lead) })
    }
  }
  return out
}

/** Comparable form of a sentence: no list markers, emphasis, or case. */
export function normalizeSentence(sentence) {
  return sentence
    .replace(/^\s*([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Sentences every rendered file inherits from a template, which repeat by design. */
function templateSentences() {
  const keys = new Set()
  for (const abs of listFiles(TEMPLATES_DIR, { extension: '.md' })) {
    for (const { key } of sentencesOf(readTextSafe(abs) ?? '')) keys.add(key)
  }
  return keys
}

/**
 * A sentence that appears in two or more memory files. Two copies of a claim
 * drift the moment one is updated, and the reader cannot tell which is current.
 * The archive is history and is left out.
 */
export function duplicatedText(texts, ignore = new Set()) {
  const seen = new Map()
  for (const [rel, text] of texts) {
    if (isArchive(rel)) continue
    for (const { key, line } of sentencesOf(text)) {
      if (ignore.has(key)) continue
      if (!seen.has(key)) seen.set(key, [])
      const at = seen.get(key)
      if (!at.some((o) => o.artifact === rel)) at.push({ artifact: rel, line })
    }
  }
  const found = []
  for (const [key, occurrences] of seen) {
    if (occurrences.length < 2) continue
    const [first] = occurrences
    const preview = key.length > 90 ? `${key.slice(0, 87)}...` : key
    found.push(
      signal('duplicated-text', first.artifact, `the same sentence is in ${occurrences.length} files: "${preview}"`, {
        line: first.line,
        occurrences,
      })
    )
  }
  return found
}

// ---------------------------------------------------------------------------
// Numbers that should agree and do not
// ---------------------------------------------------------------------------

const TEST_COUNT = /\b(\d+)\s+passed\b(?:,?\s*(\d+)\s+failed\b)?(?:,?\s*(\d+)\s+skipped\b)?/gi

/** Every "N passed, M failed, K skipped" result stated in a document. */
export function testCounts(text) {
  const prose = maskNonProse(text)
  const found = []
  let m
  TEST_COUNT.lastIndex = 0
  while ((m = TEST_COUNT.exec(prose)) !== null) {
    const parts = [`${m[1]} passed`]
    if (m[2] !== undefined) parts.push(`${m[2]} failed`)
    if (m[3] !== undefined) parts.push(`${m[3]} skipped`)
    found.push({ value: parts.join(', '), line: lineOf(prose, m.index) })
  }
  return found
}

/**
 * Two different suite results in the files a session reads first. One of them
 * is older than the other, and a reader has no way to tell which.
 */
export function divergingTestCounts(texts, files) {
  const occurrences = []
  for (const rel of files) {
    const text = texts.get(rel)
    if (text === undefined) continue
    for (const { value, line } of testCounts(text)) occurrences.push({ artifact: rel, line, value })
  }
  const values = [...new Set(occurrences.map((o) => o.value))]
  if (values.length < 2) return []
  return [
    signal('diverging-test-counts', occurrences[0].artifact, `startup files state ${values.length} different test results: ${values.join(' | ')}`, {
      line: occurrences[0].line,
      occurrences,
    }),
  ]
}

// ---------------------------------------------------------------------------
// Handoffs that describe a checkout that no longer exists
// ---------------------------------------------------------------------------

/** The `HEAD:` sha a handoff records, or null. */
export function declaredHead(text) {
  const match = /^HEAD:\s*`?([0-9a-f]{7,40})`?\s*$/im.exec(text ?? '')
  return match ? match[1].toLowerCase() : null
}

/**
 * A handoff whose recorded HEAD is behind or unknown, or whose branch has
 * merged or is gone. Each is a continuation pointer pointing at the past.
 */
export function staleHandoffs(root, texts, files, git, options = {}) {
  if (git === null) return []
  const run = (args) => runGit(args, { ...options, cwd: root })
  const found = []
  for (const file of files) {
    const text = texts.get(file.path) ?? ''
    const reasons = []

    const head = declaredHead(text)
    if (head !== null) {
      if (!run(['cat-file', '-e', `${head}^{commit}`]).ok) reasons.push(`its HEAD ${head} is not a commit in this repository`)
      else {
        // Commits that touch only memory/ do not count: the commit that saves a
        // handoff always lands after the HEAD it records.
        const count = run(['rev-list', '--count', `${head}..HEAD`, '--', '.', `:(exclude)${MEMORY_DIRNAME}`])
        const behind = count.ok ? Number.parseInt(count.stdout.trim(), 10) : NaN
        if (behind > 0) reasons.push(`${behind} commit(s) outside memory/ have landed since its HEAD ${head.slice(0, 7)}`)
      }
    }

    const branch = file.declaredBranch
    if (branch !== null && branch !== git.branch) {
      const refs = run(['for-each-ref', '--format=%(refname)', `refs/heads/${branch}`, `refs/remotes/*/${branch}`])
      const ref = refs.ok ? refs.stdout.split(/\r?\n/).find((l) => l.trim() !== '') : undefined
      if (refs.ok && ref === undefined) reasons.push(`its branch ${branch} no longer exists here`)
      else if (ref !== undefined && run(['merge-base', '--is-ancestor', ref.trim(), 'HEAD']).ok) {
        reasons.push(`its branch ${branch} is already merged into ${git.branch ?? 'HEAD'}`)
      }
    }

    if (reasons.length > 0) {
      found.push(signal('stale-handoff', file.path, reasons.join('; '), { reasons, declaredBranch: branch, head }))
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// Snapshots turning into diaries
// ---------------------------------------------------------------------------

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2}'
const DATED_LINE = new RegExp(
  `^\\s*(?:#{2,6}\\s+|[-*+]\\s+)?(?:\\*\\*)?(?:\\d{4}-\\d{2}-\\d{2}|${MONTH})(?:,?\\s+\\d{4})?(?:\\*\\*)?\\s*(?:[:—–-]|$)`,
  'i'
)

/**
 * Lines that open with a date in a file whose lifecycle is "replace, never
 * append". A few are a journal; the snapshot has started keeping history.
 */
export function journalEntries(texts, files) {
  const found = []
  for (const rel of files) {
    const text = texts.get(rel)
    if (text === undefined) continue
    const lines = maskNonProse(text)
      .split(/\r?\n/)
      .map((l, i) => (DATED_LINE.test(l) ? i + 1 : null))
      .filter((n) => n !== null)
    if (lines.length < JOURNAL_THRESHOLD) continue
    found.push(
      signal('journal-entries', rel, `${lines.length} lines open with a date: this file is meant to be replaced, not appended to`, {
        line: lines[0],
        lines,
      })
    )
  }
  return found
}

// ---------------------------------------------------------------------------
// Content nothing leads to
// ---------------------------------------------------------------------------

/**
 * A memory file no other memory file or contract file references. The schema's
 * own files are found by convention and the archive is meant to be unread, so
 * both are exempt; anything else unlinked is never loaded and quietly ages.
 */
export function unreachableFiles(root, texts, memory) {
  const known = new Set([...CORE_MEMORY_FILES, ...OPTIONAL_MEMORY_FILES].map(memoryRel))
  known.add(`${memory.decisions.dir}/INDEX.md`)

  const sources = [...texts.entries()]
  for (const rel of CLAUDE_MD_SCOPE) {
    if (isFile(joinRel(root, rel))) sources.push([rel, readTextSafe(joinRel(root, rel)) ?? ''])
  }
  const reached = new Set()
  for (const [from, text] of sources) {
    for (const { ref } of extractReferences(text)) {
      const target = resolveReference(root, from, ref)
      if (target !== null && target !== from) reached.add(target)
    }
  }

  return memory.markdownFiles
    .filter((rel) => !known.has(rel) && !isArchive(rel) && !isLesson(rel) && !reached.has(rel))
    .map((rel) => signal('unreachable-file', rel, 'no memory or contract file links here, so no session will read it'))
}

// ---------------------------------------------------------------------------
// What every session pays
// ---------------------------------------------------------------------------

export function startupBudget(texts, files, budget = STARTUP_LINE_BUDGET) {
  const sizes = files.filter((rel) => texts.has(rel)).map((rel) => ({ artifact: rel, lines: countLines(texts.get(rel)) }))
  const total = sizes.reduce((sum, s) => sum + s.lines, 0)
  if (total <= budget) return []
  return [
    signal('startup-budget', memoryRel('INDEX.md'), `the startup set is ${total} lines, over the ${budget}-line budget`, {
      total,
      budget,
      files: sizes,
    }),
  ]
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function renderHygieneText(result) {
  const out = [`Memory rot signals — ${result.root}`, '']
  if (!result.memoryExists) {
    out.push('No memory/ directory. Nothing to check.')
  } else if (result.signals.length === 0) {
    out.push(`No rot signals (${result.checked.length} kinds checked).`)
  } else {
    for (const s of result.signals) {
      const where = s.line ? `${s.artifact}:${s.line}` : s.artifact
      out.push(`${s.signal.padEnd(22)} ${where}`)
      out.push(`        ${s.message}`)
      for (const o of s.occurrences ?? []) out.push(`        - ${o.artifact}:${o.line}${o.value ? `  ${o.value}` : ''}`)
    }
    out.push('', `${result.signals.length} signal(s).`)
  }
  out.push('', HYGIENE_DISCLAIMER)
  return out.join('\n')
}

const USAGE = `Usage: memory-hygiene.mjs [--json] [--cwd <dir>] [dir]

List deterministic context-rot candidates in a project's memory/ tree.
Read-only. Exits 0 when it ran, whatever it found; 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, root, error } = parseCliArgs(argv)
  if (error !== null) {
    process.stderr.write(`memory-hygiene: ${error}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const result = collectHygiene(root)
  emit(result, renderHygieneText(result), { json: values.json })
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
