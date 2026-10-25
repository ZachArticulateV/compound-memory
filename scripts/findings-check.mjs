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
// Checking only that a quote is present would let a reviewer quote code that
// does not exist and keep its confidence, so the quote is looked up.
//
// Severity and confidence never stand in for evidence. A P0 is kept even when
// its quote does not check out, because dropping a possible outage is worse
// than reading one more line, but it is kept labelled `unproved`, apart from
// the findings whose quotes were found.
//
// With --final, it also checks the disprove pass: every kept P0 and P1 must
// carry a `verdict` (confirmed, disproved, or unresolved). Disproved findings
// are dropped; only findings whose evidence checked out and that are either
// confirmed or below P1 are listed as safe to fix. A missing verdict exits 1.
//
// With --patch <file> (the patch `changes.mjs review --write` saved), a kept
// finding whose line is not within a few lines of a changed line, or whose
// file the change does not touch, is marked `outsideDiff`: a pre-existing
// problem, reported apart and kept off the safe-to-fix list.
//
// WHAT THIS IS NOT: a judge of whether a finding is right. A verified quote
// proves the reviewer looked at real code, not that its reasoning holds. The
// `model` label is whatever the reviewer wrote; nothing here proves which
// model produced a finding.
//
// Read-only.

import { fileURLToPath } from 'node:url'
import { isAbsolute, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

import { isFile, joinRel, readTextContained, relPosix } from './lib/fs-utils.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const FINDINGS_SCHEMA_VERSION = 1
export const SEVERITIES = ['P0', 'P1', 'P2', 'P3']
export const VERDICTS = ['confirmed', 'disproved', 'unresolved']
/** Severities whose findings must survive a disprove attempt before a fix. */
export const CHALLENGED = ['P0', 'P1']
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
    // A blank line adds nothing, so a quote spanning one still matches; its
    // start maps to the next line with text.
    if (part !== '') joined = joined.length === 0 ? part : `${joined} ${part}`
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

  const given = typeof finding.file === 'string' ? finding.file : ''
  const rel = (isAbsolute(given) ? relPosix(root, given) : given).replace(/\\/g, '/').replace(/^\.\//, '')
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
  // The quote was found in the file (at the cited line or nearby): the
  // finding points at real code. Anything else is unproved, whatever its
  // severity or stated confidence.
  out.evidence = out.quoteStatus === 'at-line' || out.quoteStatus === 'moved' ? 'checked' : 'unproved'
  if (finding.verdict !== undefined) {
    const verdict = String(finding.verdict).toLowerCase()
    if (VERDICTS.includes(verdict)) out.verdict = verdict
    else {
      problems.push(`verdict "${finding.verdict}" is not one of ${VERDICTS.join(', ')}; treated as unresolved`)
      out.verdict = 'unresolved'
    }
  }
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
      // Only a model whose quote checked out counts toward agreement: a
      // second model quoting code that is not there has not corroborated
      // anything.
      const verified = f.quoteStatus === 'at-line' && f.model ? [f.model] : []
      groups.push({ ...f, lenses: [f.lens].filter(Boolean), models: [f.model].filter(Boolean), verifiedModels: verified, sources: [f.index] })
      continue
    }
    if (f.lens && !group.lenses.includes(f.lens)) group.lenses.push(f.lens)
    if (f.model && !group.models.includes(f.model)) group.models.push(f.model)
    if (f.model && f.quoteStatus === 'at-line' && !group.verifiedModels.includes(f.model)) group.verifiedModels.push(f.model)
    group.sources.push(f.index)
    if (SEVERITIES.indexOf(f.severity) < SEVERITIES.indexOf(group.severity)) group.severity = f.severity
    group.confidence = Math.max(group.confidence, f.confidence)
    group.problems = [...group.problems, ...f.problems]
    if (group.quoteStatus !== 'at-line' && f.quoteStatus === 'at-line') {
      group.quoteStatus = 'at-line'
      group.quote = f.quote
      group.line = f.line
    }
    if (f.evidence === 'checked') group.evidence = 'checked'
    // Readers who disagree have not settled it: any two different verdicts
    // merge to unresolved, so neither "confirmed" nor "disproved" survives a
    // dissent, and only a unanimous confirmation reaches the safe-to-fix list.
    if (f.verdict !== undefined) group.verdict = group.verdict === undefined || group.verdict === f.verdict ? f.verdict : 'unresolved'
    else if (group.verdict !== undefined) group.verdictMissing = true
  }
  // Reviewers on one model agreeing is one reading repeated. Only agreement
  // across different models, on a quote that checks out, raises confidence.
  for (const g of groups) {
    g.promoted = g.verifiedModels.length >= 2 && g.quoteStatus === 'at-line' && g.confidence < 100
    if (g.promoted) g.confidence = promote(g.confidence)
  }
  return groups
}

const order = (a, b) =>
  SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
  b.confidence - a.confidence ||
  a.file.localeCompare(b.file) ||
  (a.line ?? 0) - (b.line ?? 0)

/** Lines within this distance of a changed line count as part of the change. */
export const DIFF_NEIGHBORHOOD = 3

/**
 * The new-side lines each file's change touches, from a unified diff: added
 * lines, and the position where lines were removed. A deleted file maps to
 * null (the whole file is the change).
 */
export function changedLines(patch) {
  const files = new Map()
  let file = null
  let oldFile = null
  let next = 0
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      file = null
      oldFile = null
      continue
    }
    if (line.startsWith('--- ')) {
      oldFile = line.slice(4).replace(/^a\//, '')
      continue
    }
    if (line.startsWith('+++ ')) {
      const target = line.slice(4)
      file = target === '/dev/null' ? oldFile : target.replace(/^b\//, '')
      if (target === '/dev/null') files.set(file, null)
      else if (!files.has(file)) files.set(file, new Set())
      continue
    }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (h) {
      next = Number(h[1])
      continue
    }
    if (file === null || files.get(file) === null) continue
    if (line.startsWith('+')) files.get(file).add(next++)
    else if (line.startsWith('-')) files.get(file).add(Math.max(next, 1))
    else if (line.startsWith(' ')) next++
  }
  return files
}

/** Is a finding at file:line inside the change? */
export function insideChange(files, file, line) {
  if (!files.has(file)) return false
  const lines = files.get(file)
  if (lines === null || !line) return true
  for (const l of lines) if (Math.abs(l - line) <= DIFF_NEIGHBORHOOD) return true
  return false
}

export function checkFindings(root, input, { final = false, patch = null } = {}) {
  const absRoot = resolve(root)
  const list = Array.isArray(input) ? input : Array.isArray(input?.findings) ? input.findings : null
  if (list === null) return { error: 'input must be a JSON array of findings or an object with a "findings" array' }
  const checked = list.map((f, i) => checkFinding(absRoot, f ?? {}, i))
  const merged = mergeFindings(checked).sort(order)
  const passing = merged.filter((f) => f.confidence >= KEEP_CONFIDENCE || f.severity === 'P0')
  const suppressed = merged.filter((f) => !passing.includes(f))
  for (const f of passing) f.unproved = f.evidence !== 'checked'
  const changed = patch === null ? null : changedLines(patch)
  if (changed !== null) for (const f of passing) f.outsideDiff = !insideChange(changed, f.file, f.line)
  // A confirmed verdict cannot rest on a quote that is not in the file.
  for (const f of passing) {
    if (f.unproved && f.verdict === 'confirmed') {
      f.problems = [...f.problems, 'confirmed, but its quote is not in the file; treated as unresolved until it quotes real code']
      f.verdict = 'unresolved'
    }
  }
  const disproved = final ? passing.filter((f) => f.verdict === 'disproved') : []
  const kept = passing.filter((f) => !disproved.includes(f))
  // A duplicate with no verdict means one reading was never challenged.
  for (const f of kept) if (f.verdictMissing && f.verdict === 'confirmed') f.verdict = 'unresolved'
  const missingVerdict = final ? kept.filter((f) => CHALLENGED.includes(f.severity) && f.verdict === undefined) : []
  // Safe to fix: real code is quoted, and a serious finding survived the
  // attempt to disprove it.
  const fixable = kept.filter((f) => !f.unproved && !f.outsideDiff && (!CHALLENGED.includes(f.severity) || f.verdict === 'confirmed'))
  return {
    schemaVersion: FINDINGS_SCHEMA_VERSION,
    root: absRoot.split('\\').join('/'),
    received: list.length,
    merged: merged.length,
    final,
    kept,
    suppressed,
    disproved,
    missingVerdict: missingVerdict.map((f) => ({ severity: f.severity, title: f.title, file: f.file, line: f.line })),
    fixable: fixable.map((f) => ({ severity: f.severity, title: f.title, file: f.file, line: f.line })),
    counts: {
      kept: kept.length,
      unproved: kept.filter((f) => f.unproved).length,
      suppressed: suppressed.length,
      disproved: disproved.length,
      missingVerdict: missingVerdict.length,
      fixable: fixable.length,
      preExisting: kept.filter((f) => f.outsideDiff).length,
      quoteNotFound: checked.filter((f) => f.quoteStatus === 'not-found' || f.quoteStatus === 'file-missing').length,
      promoted: merged.filter((f) => f.promoted).length,
    },
  }
}

export function renderFindingsText(result) {
  const out = [`Findings — ${result.root}`, '', `${result.received} received, ${result.merged} after merging, ${result.counts.kept} kept.`]
  const line = (f) => {
    out.push('', `${f.severity} (${f.confidence}) ${f.title ?? '(untitled)'}${f.verdict ? `  [${f.verdict}]` : ''}`)
    out.push(`    ${f.file}${f.line ? `:${f.line}` : ''}  [${(f.lenses ?? []).join(', ') || 'no lens'}]${f.promoted ? '  agreement across model labels' : ''}`)
    for (const p of f.problems) out.push(`    note: ${p}`)
  }
  for (const f of result.kept.filter((k) => !k.unproved && !k.outsideDiff)) line(f)
  const before = result.kept.filter((k) => !k.unproved && k.outsideDiff)
  if (before.length > 0) {
    out.push('', 'PRE-EXISTING — on lines this change did not touch. Report them apart; fix one only when the change depends on it:')
    for (const f of before) line(f)
  }
  const unproved = result.kept.filter((k) => k.unproved)
  if (unproved.length > 0) {
    out.push('', 'UNPROVED — kept for severity, but the quoted evidence is not in the file. Report these as unproved, not as defects:')
    for (const f of unproved) line(f)
  }
  if (result.final) {
    if (result.disproved.length > 0) out.push('', `Dropped as disproved: ${result.disproved.map((f) => f.title ?? '(untitled)').join('; ')}`)
    if (result.missingVerdict.length > 0) {
      out.push('', 'Not yet challenged (P0 and P1 need a verdict before any fix):')
      for (const f of result.missingVerdict) out.push(`    ${f.severity} ${f.title ?? '(untitled)'} — ${f.file}${f.line ? `:${f.line}` : ''}`)
    }
    out.push('', `Safe to fix: ${result.counts.fixable} finding(s).`)
  }
  if (result.suppressed.length > 0) {
    out.push('', `Suppressed below confidence ${KEEP_CONFIDENCE}:`)
    for (const f of result.suppressed) out.push(`    ${f.severity} (${f.confidence}) ${f.title ?? '(untitled)'} — ${f.file}${f.line ? `:${f.line}` : ''}`)
  }
  if (result.counts.quoteNotFound > 0) out.push('', `${result.counts.quoteNotFound} finding(s) quoted code that is not in the repository.`)
  out.push('', 'A verified quote shows the reviewer read real code. It does not show the finding is right.')
  return out.join('\n')
}

const USAGE = `Usage: findings-check.mjs --input <findings.json> [--final] [--patch <review.patch>] [--json] [--cwd <dir>]

Check review findings against the working tree: verify each quoted line, merge
duplicates, and keep findings at confidence ${KEEP_CONFIDENCE}+ or severity P0. A kept
finding whose quote is not in the file is labelled unproved.
--final also checks the disprove pass: each kept P0 and P1 needs a "verdict"
(${VERDICTS.join(', ')}); disproved ones are dropped and the safe-to-fix list
is printed.
--patch marks findings outside the change's lines as pre-existing and keeps
them off the safe-to-fix list.
Read "-" as the input to read standard input. Read-only. Exits 0 when it ran;
1 with --final when a kept P0 or P1 has no verdict; 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, root, error } = parseCliArgs(argv, { extraOptions: { input: { type: 'string' }, final: { type: 'boolean', default: false }, patch: { type: 'string' } } })
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
  let patch = null
  if (values.patch) {
    try {
      patch = readFileSync(resolve(root, values.patch), 'utf8')
    } catch (err) {
      process.stderr.write(`findings-check: cannot read ${values.patch}: ${err.message}\n`)
      return USAGE_EXIT_CODE
    }
  }
  const result = checkFindings(root, input, { final: values.final, patch })
  if (result.error) {
    process.stderr.write(`findings-check: ${result.error}\n`)
    return USAGE_EXIT_CODE
  }
  emit(result, renderFindingsText(result), { json: values.json })
  return result.counts.missingVerdict > 0 ? 1 : 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
