#!/usr/bin/env node
// findings-check.mjs — check review findings against the code they cite.
//
// WHAT THIS IS: the deterministic gate under `review`. Reviewers return
// findings with a file, a line, a quoted line of code, a severity, and a
// confidence. This script confirms each quote is really in that file near that
// line, demotes the ones that are not, merges duplicates, raises confidence
// only when reviewers on different models agree, and keeps what clears the bar:
// confidence 75 or more, or severity P0.
//
// Compound Engineering's equivalent checked only that a quote was present, so a
// reviewer could quote code that does not exist and keep its confidence. Here
// the quote is looked up.
//
// WHAT THIS IS NOT: a judge of whether a finding is right. A verified quote
// proves the reviewer looked at real code, not that its reasoning holds.
//
// Read-only.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

import { isFile, joinRel, readTextContained } from './lib/fs-utils.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const FINDINGS_SCHEMA_VERSION = 1
export const SEVERITIES = ['P0', 'P1', 'P2', 'P3']
export const CONFIDENCE_LEVELS = [0, 25, 50, 75, 100]
export const KEEP_CONFIDENCE = 75
/** How far from the cited line a quote may sit and still count as at that line. */
export const LINE_TOLERANCE = 3

const squash = (text) => (text ?? '').replace(/\s+/g, ' ').trim()
const titleKey = (title) => (title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Round a confidence down to the nearest allowed level. */
export function floorConfidence(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return [...CONFIDENCE_LEVELS].reverse().find((level) => n >= level) ?? 0
}

const promote = (confidence) => CONFIDENCE_LEVELS[Math.min(CONFIDENCE_LEVELS.length - 1, CONFIDENCE_LEVELS.indexOf(confidence) + 1)]

/**
 * Where a quote sits in a file: 'at-line' within tolerance of the cited line,
 * 'moved' with the actual line when it is elsewhere, 'not-found' otherwise.
 */
export function locateQuote(text, quote, line) {
  const needle = squash(quote)
  if (needle === '') return { status: 'no-quote', line: null }
  // Search the whitespace-squashed file so a quote may span lines or differ in
  // indentation, then map each match back to the line it starts on.
  const starts = []
  let joined = ''
  for (const raw of text.split(/\r?\n/)) {
    const part = squash(raw)
    starts.push(joined.length === 0 ? 0 : joined.length + 1)
    joined = joined.length === 0 ? part : `${joined} ${part}`
  }
  const lineAt = (offset) => {
    let n = 0
    while (n + 1 < starts.length && starts[n + 1] <= offset) n += 1
    return n + 1
  }
  const hits = []
  for (let at = joined.indexOf(needle); at !== -1; at = joined.indexOf(needle, at + 1)) hits.push(lineAt(at))
  if (hits.length === 0) return { status: 'not-found', line: null }
  const cited = Number.isInteger(line) ? line : null
  if (cited !== null) {
    const near = hits.find((h) => Math.abs(h - cited) <= LINE_TOLERANCE)
    if (near !== undefined) return { status: 'at-line', line: near }
  }
  return { status: cited === null ? 'at-line' : 'moved', line: hits[0] }
}

/** Check and normalize one finding against the working tree. */
export function checkFinding(root, finding, index) {
  const problems = []
  const out = { ...finding, index }
  out.severity = String(finding.severity ?? '').toUpperCase()
  if (!SEVERITIES.includes(out.severity)) {
    problems.push(`severity "${finding.severity}" is not one of ${SEVERITIES.join(', ')}; treated as P2`)
    out.severity = 'P2'
  }
  const stated = Number(finding.confidence)
  out.confidence = floorConfidence(stated)
  if (!CONFIDENCE_LEVELS.includes(stated)) problems.push(`confidence ${finding.confidence} rounded down to ${out.confidence}`)

  const rel = typeof finding.file === 'string' ? finding.file.replace(/\\/g, '/').replace(/^\.\//, '') : ''
  const abs = rel === '' ? null : joinRel(root, rel)
  const text = abs !== null && isFile(abs) ? readTextContained(root, abs) : null
  if (text === null) {
    out.quoteStatus = 'file-missing'
    problems.push(rel === '' ? 'no file given' : `file not found in the repository: ${rel}`)
    out.confidence = Math.min(out.confidence, 25)
  } else {
    const where = locateQuote(text, finding.quote, Number.isInteger(finding.line) ? finding.line : Number.parseInt(finding.line, 10) || null)
    out.quoteStatus = where.status
    if (where.status === 'no-quote' && out.confidence >= KEEP_CONFIDENCE) {
      problems.push('no quoted line; confidence capped at 50')
      out.confidence = 50
    } else if (where.status === 'not-found') {
      problems.push('the quoted text is not in the file; confidence capped at 25')
      out.confidence = Math.min(out.confidence, 25)
    } else if (where.status === 'moved' && where.line !== null) {
      problems.push(`quote found at line ${where.line}, not ${finding.line}`)
      out.line = where.line
    }
  }
  out.file = rel
  out.problems = problems
  return out
}

/** Findings that cite the same place and say the same thing are one finding. */
export function mergeFindings(findings) {
  const groups = []
  for (const f of findings) {
    const group = groups.find(
      (g) => g.file === f.file && titleKey(g.title) === titleKey(f.title) && Math.abs((g.line ?? 0) - (f.line ?? 0)) <= LINE_TOLERANCE
    )
    if (group === undefined) {
      groups.push({ ...f, lenses: [f.lens].filter(Boolean), models: [f.model].filter(Boolean), sources: [f.index] })
      continue
    }
    if (f.lens && !group.lenses.includes(f.lens)) group.lenses.push(f.lens)
    if (f.model && !group.models.includes(f.model)) group.models.push(f.model)
    group.sources.push(f.index)
    if (SEVERITIES.indexOf(f.severity) < SEVERITIES.indexOf(group.severity)) group.severity = f.severity
    group.confidence = Math.max(group.confidence, f.confidence)
    group.problems = [...group.problems, ...f.problems]
    if (group.quoteStatus !== 'at-line' && f.quoteStatus === 'at-line') {
      group.quoteStatus = 'at-line'
      group.quote = f.quote
      group.line = f.line
    }
  }
  // Reviewers on one model agreeing is one reading repeated. Only agreement
  // across different models, on a quote that checks out, raises confidence.
  for (const g of groups) {
    g.promoted = g.models.length >= 2 && g.quoteStatus === 'at-line' && g.confidence < 100
    if (g.promoted) g.confidence = promote(g.confidence)
  }
  return groups
}

const order = (a, b) =>
  SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
  b.confidence - a.confidence ||
  a.file.localeCompare(b.file) ||
  (a.line ?? 0) - (b.line ?? 0)

export function checkFindings(root, input) {
  const absRoot = resolve(root)
  const list = Array.isArray(input) ? input : Array.isArray(input?.findings) ? input.findings : null
  if (list === null) return { error: 'input must be a JSON array of findings or an object with a "findings" array' }
  const checked = list.map((f, i) => checkFinding(absRoot, f ?? {}, i))
  const merged = mergeFindings(checked).sort(order)
  const kept = merged.filter((f) => f.confidence >= KEEP_CONFIDENCE || f.severity === 'P0')
  const suppressed = merged.filter((f) => !kept.includes(f))
  return {
    schemaVersion: FINDINGS_SCHEMA_VERSION,
    root: absRoot.split('\\').join('/'),
    received: list.length,
    merged: merged.length,
    kept,
    suppressed,
    counts: {
      kept: kept.length,
      suppressed: suppressed.length,
      quoteNotFound: checked.filter((f) => f.quoteStatus === 'not-found' || f.quoteStatus === 'file-missing').length,
      promoted: merged.filter((f) => f.promoted).length,
    },
  }
}

export function renderFindingsText(result) {
  const out = [`Findings — ${result.root}`, '', `${result.received} received, ${result.merged} after merging, ${result.counts.kept} kept.`]
  for (const f of result.kept) {
    out.push('', `${f.severity} (${f.confidence}) ${f.title ?? '(untitled)'}`)
    out.push(`    ${f.file}${f.line ? `:${f.line}` : ''}  [${(f.lenses ?? []).join(', ') || 'no lens'}]${f.promoted ? '  cross-model agreement' : ''}`)
    for (const p of f.problems) out.push(`    note: ${p}`)
  }
  if (result.suppressed.length > 0) {
    out.push('', `Suppressed below confidence ${KEEP_CONFIDENCE}:`)
    for (const f of result.suppressed) out.push(`    ${f.severity} (${f.confidence}) ${f.title ?? '(untitled)'} — ${f.file}${f.line ? `:${f.line}` : ''}`)
  }
  if (result.counts.quoteNotFound > 0) out.push('', `${result.counts.quoteNotFound} finding(s) quoted code that is not in the repository.`)
  out.push('', 'A verified quote shows the reviewer read real code. It does not show the finding is right.')
  return out.join('\n')
}

const USAGE = `Usage: findings-check.mjs --input <findings.json> [--json] [--cwd <dir>]

Check review findings against the working tree: verify each quoted line, merge
duplicates, and keep findings at confidence ${KEEP_CONFIDENCE}+ or severity P0.
Read "-" as the input to read standard input. Read-only. Exits 0 when it ran; 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, root, error } = parseCliArgs(argv, { extraOptions: { input: { type: 'string' } } })
  if (error !== null || (!values.help && !values.input)) {
    process.stderr.write(`findings-check: ${error ?? '--input is required'}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  let input
  try {
    input = JSON.parse(readFileSync(values.input === '-' ? 0 : values.input, 'utf8'))
  } catch (err) {
    process.stderr.write(`findings-check: cannot read ${values.input}: ${err.message}\n`)
    return USAGE_EXIT_CODE
  }
  const result = checkFindings(root, input)
  if (result.error) {
    process.stderr.write(`findings-check: ${result.error}\n`)
    return USAGE_EXIT_CODE
  }
  emit(result, renderFindingsText(result), { json: values.json })
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
