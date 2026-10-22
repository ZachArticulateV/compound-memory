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
// WHAT THIS IS NOT: a check of meaning. A rewrite can keep every token and
// still say something else; read it.
//
// Read-only. Exits 0 when nothing was lost or added, 1 when something was,
// 2 on a usage error.

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

Compare a rewrite with its source: code, commands, paths, links, numbers, and
words of doubt or failure that were lost, and identifiers or numbers that were
added. Exits 0 when nothing was, 1 when something was, 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, error } = parseCliArgs(argv, { extraOptions: { before: { type: 'string' }, after: { type: 'string' } } })
  if (error !== null || (!values.help && (!values.before || !values.after))) {
    process.stderr.write(`rewrite-check: ${error ?? '--before and --after are required'}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
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
