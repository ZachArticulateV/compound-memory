#!/usr/bin/env node
// rewrite-check.mjs — did a rewrite keep the facts and the doubt?
//
// WHAT THIS IS: the deterministic call under `write`. A rewrite for clarity
// must keep what the reader acts on: code spans and blocks, commands, paths,
// links, numbers, and the words that carry uncertainty or failure ("not run",
// "unverified", "may", "failed"). Plain prose loses these first, and a
// confident rewrite of a cautious source is a false report. This script lists
// each one the source had and the rewrite lost, and each number or identifier
// the rewrite has that the source did not (facts nobody supplied).
//
// With --tells <file> it instead lists the writing tells a pattern can find
// in one file (listed vocabulary and filler, em dashes, curly quotes, arrows
// in prose, slashes, "(s)", Latin abbreviations, "click here", title-case or
// skipped headings, a second H1), skipping code. Each hit is a candidate for
// judgment, not a verdict.
//
// WHAT THIS IS NOT: a check of meaning or tone. A rewrite can keep every
// token and still say something else, and a text with no listed tell can
// still read like a machine wrote it; read it.
//
// Read-only. Exits 0 when nothing was lost or added (or no tell found), 1
// when something was, 2 on a usage error.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const REWRITE_SCHEMA_VERSION = 1

/** Words that carry doubt, failure, or a gap, grouped so a synonym counts as kept. */
export const UNCERTAINTY = {
  unverified: /\b(unverified|not verified|unchecked|not checked|untested|not tested)\b/gi,
  'not run': /\b(not run|did not run|never ran|could not run|skipped)\b/gi,
  failed: /\b(fail(?:s|ed|ing|ure)?|broken|red)\b/gi,
  hedge: /\b(may|might|could|likely|probably|possibly|appears?|seems?|suspect(?:ed)?)\b/gi,
  unknown: /\b(unknown|unclear|unresolved|uncertain|not known|hypothes[ie]s)\b/gi,
  assumed: /\b(assum(?:e|ed|ption)|estimate[ds]?|approximately|roughly)\b/gi,
  partial: /\b(partial(?:ly)?|incomplete|not all|some of)\b/gi,
  negation: /\b(not|no|never|none|without)\b/gi,
}

const stripFences = (text) => text.replace(/```[\s\S]*?```/g, ' ')

export function protectedTokens(text) {
  const fences = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean)
  const prose = stripFences(text)
  const code = [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])
  const bare = prose.replace(/`[^`\n]+`/g, ' ')
  const urls = [...bare.matchAll(/\bhttps?:\/\/[^\s)<>\]]+/g)].map((m) => m[0].replace(/[.,;:]+$/, ''))
  const links = [...bare.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1])
  const noUrls = bare.replace(/\bhttps?:\/\/[^\s)<>\]]+/g, ' ').replace(/\]\([^)\s]+\)/g, ']')
  const paths = [...noUrls.matchAll(/(?:^|[\s(])((?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)+\/?)/g)].map((m) => m[1].replace(/[.,;:]+$/, '')).filter((p) => /[a-z]/i.test(p))
  const numbers = [...noUrls.matchAll(/(?<![\w.])(\d[\d,]*(?:\.\d+)?(?:%|ms|s|MB|KB|GB|px)?)(?![\w])/g)].map((m) => m[1]).filter((n) => !/^[01]$/.test(n))
  return { fences, code, urls, links, paths, numbers }
}

export function uncertainty(text) {
  const prose = stripFences(text).replace(/`[^`\n]+`/g, ' ')
  const out = {}
  for (const [name, re] of Object.entries(UNCERTAINTY)) out[name] = (prose.match(re) ?? []).length
  return out
}

/** Tells a pattern can find. Each is a candidate the writer judges. */
export const TELLS = {
  vocabulary: /\b(delve[sd]?|delving|robust|seamless(?:ly)?|leverag(?:e|es|ed|ing)|pivotal|landscape|tapestry|testament|underscor(?:e|es|ed|ing)|synerg(?:y|ies)|paradigm|game-chang(?:er|ing)|flywheel|north star|substrate|holistic|empower(?:s|ed|ing)?)\b/gi,
  filler: /\b(it(?:'s| is) worth noting|it(?:'s| is) important to (?:note|remember)|in order to|needless to say|at the end of the day|in today's (?:fast-paced )?world)\b/gi,
  chatbot: /\b(great question|i hope this helps|happy to help|let me know if you|certainly!|absolutely!)/gi,
  'fancy is': /\b(serves as|stands as|boasts)\b/gi,
  'not just': /\bnot (?:just|only|merely)\b[^.\n]{1,80}\bbut\b/gi,
  'ing tail': /, (?:highlighting|underscoring|showcasing|emphasizing|reflecting|demonstrating|ensuring)\b/gi,
  'em dash': /\u2014/g,
  'curly quote': /[\u201c\u201d\u2018\u2019]/g,
  arrow: /(?:\u2192|\u21d2|(?<![-=<])(?:->|=>)(?![->]))/g,
  slash: /\b(?:and\/or|[a-z]{2,12}\/[a-z]{2,12})\b(?![./\w])/gi,
  'plural (s)': /\w\(s\)/g,
  latin: /\b(?:e\.g\.|i\.e\.|etc\.|viz\.)/gi,
  'click here': /\bclick here\b/gi,
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'])

/** Words of a heading, ignoring code spans and links' targets. */
const headingWords = (text) => text.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']').match(/[A-Za-z][A-Za-z'-]*/g) ?? []

/**
 * Candidate writing tells in one Markdown text, with line numbers. Code
 * fences, code spans, URLs, and link targets are skipped; front matter too.
 */
export function findTells(text) {
  const hits = []
  const lines = text.split(/\r?\n/)
  let fenced = false
  let frontmatter = lines[0] === '---'
  let h1 = 0
  let lastLevel = 0
  lines.forEach((raw, i) => {
    const line = i + 1
    if (frontmatter) {
      if (i > 0 && raw === '---') frontmatter = false
      return
    }
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced
      return
    }
    if (fenced) return
    const prose = raw.replace(/`[^`]*`/g, ' ').replace(/\bhttps?:\/\/\S+/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/<[^>]+>/g, ' ')
    const heading = /^(#{1,6})\s+(.*)$/.exec(raw)
    if (heading) {
      const level = heading[1].length
      if (level === 1 && ++h1 === 2) hits.push({ line, category: 'second H1', match: raw.trim() })
      if (lastLevel > 0 && level > lastLevel + 1) hits.push({ line, category: 'skipped heading level', match: raw.trim() })
      lastLevel = level
      const words = headingWords(heading[2]).slice(1).filter((w) => !SMALL_WORDS.has(w.toLowerCase()))
      if (words.length >= 2 && words.every((w) => /^[A-Z]/.test(w)) && !words.every((w) => w === w.toUpperCase())) {
        hits.push({ line, category: 'title case', match: raw.trim() })
      }
      if (/\p{Extended_Pictographic}/u.test(heading[2])) hits.push({ line, category: 'emoji', match: raw.trim() })
    } else if (/^\s*(?:[-*+]|\d+\.)\s+\p{Extended_Pictographic}/u.test(raw)) {
      hits.push({ line, category: 'emoji', match: raw.trim() })
    }
    // A word in straight double quotes is being mentioned, not used (a style
    // guide's example); character tells still count there.
    const unquoted = prose.replace(/"[^"\n]{1,120}"/g, ' ')
    for (const [category, re] of Object.entries(TELLS)) {
      const scope = category === 'em dash' || category === 'curly quote' ? prose : unquoted
      for (const m of scope.matchAll(re)) hits.push({ line, category, match: m[0] })
    }
  })
  return { schemaVersion: REWRITE_SCHEMA_VERSION, tells: hits, ok: hits.length === 0 }
}

function renderTells(r) {
  const out = r.tells.map((t) => `  ${String(t.line).padStart(4)}  ${t.category.padEnd(22)} ${t.match.slice(0, 100)}`)
  out.push(r.ok ? 'No listed tell found.' : `${r.tells.length} candidate tell(s). Fix the ones that make the sentence worse; keep a quoted or deliberate one and say why.`)
  out.push('Patterns, not tone: a text with no listed tell can still read like a machine wrote it.')
  return out.join('\n')
}

const squash = (s) => s.replace(/\s+/g, ' ').trim()

export function compareRewrite(before, after) {
  const b = protectedTokens(before)
  const a = protectedTokens(after)
  const afterText = squash(after)
  const lost = []
  for (const kind of ['fences', 'code', 'urls', 'links', 'paths', 'numbers']) {
    for (const token of new Set(b[kind])) {
      if (!afterText.includes(squash(token))) lost.push({ kind, token })
    }
  }
  const beforeText = squash(before)
  const added = []
  for (const kind of ['code', 'urls', 'paths', 'numbers']) {
    for (const token of new Set(a[kind])) {
      if (!beforeText.includes(squash(token))) added.push({ kind, token })
    }
  }
  const ub = uncertainty(before)
  const ua = uncertainty(after)
  const doubt = Object.keys(UNCERTAINTY).filter((k) => ub[k] > 0 && ua[k] === 0).map((k) => ({ kind: k, before: ub[k] }))
  return { schemaVersion: REWRITE_SCHEMA_VERSION, lost, added, doubtDropped: doubt, ok: lost.length === 0 && added.length === 0 && doubt.length === 0 }
}

function render(r) {
  const out = []
  for (const l of r.lost) out.push(`  LOST   ${l.kind.padEnd(8)} ${l.token.slice(0, 120)}`)
  for (const a of r.added) out.push(`  ADDED  ${a.kind.padEnd(8)} ${a.token.slice(0, 120)}`)
  for (const d of r.doubtDropped) out.push(`  DOUBT  ${d.kind}: the source had ${d.before}, the rewrite has none`)
  out.push(r.ok ? 'Every protected token and kind of doubt in the source survives, and nothing was added.' : 'Restore what was lost or remove what was added, unless the change was deliberate and you can say why.')
  out.push('Tokens checked, not meaning: read the rewrite against the source.')
  return out.join('\n')
}

const USAGE = `Usage: rewrite-check.mjs --before <file> --after <file> [--json]
       rewrite-check.mjs --tells <file> [--json]

Compare a rewrite with its source: code, commands, paths, links, numbers, and
words of doubt or failure that were lost, and identifiers or numbers that were
added. Exits 0 when nothing was, 1 when something was, 2 on a usage error.

With --tells, list the candidate writing tells in one file instead (exit 1
when there is any).
`

export function main(argv = process.argv.slice(2)) {
  const { values, error } = parseCliArgs(argv, { extraOptions: { before: { type: 'string' }, after: { type: 'string' }, tells: { type: 'string' } } })
  const pair = values.before && values.after
  if (error !== null || (!values.help && (values.tells ? values.before || values.after : !pair))) {
    process.stderr.write(`rewrite-check: ${error ?? (values.tells ? '--tells takes one file, without --before or --after' : '--before and --after are required')}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  if (values.tells) {
    let text
    try {
      text = readFileSync(values.tells, 'utf8')
    } catch (err) {
      process.stderr.write(`rewrite-check: ${err.message}\n`)
      return USAGE_EXIT_CODE
    }
    const result = findTells(text)
    emit(result, renderTells(result), { json: values.json })
    return result.ok ? 0 : 1
  }
  let before
  let after
  try {
    before = readFileSync(values.before, 'utf8')
    after = readFileSync(values.after, 'utf8')
  } catch (err) {
    process.stderr.write(`rewrite-check: ${err.message}\n`)
    return USAGE_EXIT_CODE
  }
  const result = compareRewrite(before, after)
  emit(result, render(result), { json: values.json })
  return result.ok ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
