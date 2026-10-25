#!/usr/bin/env node
// feature-map-check.mjs — is a verification skill's feature map well-formed?
//
// WHAT THIS IS: the deterministic part of `verify create` and `verify
// maintain`. A feature map is a `features/` directory beside a project's
// verification skill: a README.md index and one file per user-facing feature.
// This reports index entries with no file, feature files the index never
// names, entries listed twice, and feature files that lack one H1 or the four
// sections in order (Sub-features, How to get to it, Driving it with ...,
// Gotchas), or whose Driving section does not open with `Preconditions:`.
//
// WHAT THIS IS NOT: a check that any recipe works. Only driving the app shows
// that; a map can pass here and describe last month's app.
//
// Read-only: it reads Markdown and runs no project code. Exits 0 when the map
// is well-formed, 1 when it is not, 2 on a usage error.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const FEATURE_MAP_SCHEMA_VERSION = 1

/** The four sections every feature file carries, in this order. */
export const SECTIONS = [
  { name: 'Sub-features', match: /^sub-features\b/i },
  { name: 'How to get to it', match: /^how to get to it\b/i },
  { name: 'Driving it with <harness>', match: /^driving it\b/i },
  { name: 'Gotchas', match: /^gotchas\b/i },
]

const stripFences = (text) => text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '')

/** The feature files the index names, in order, with duplicates kept. */
export function indexEntries(readme) {
  const out = []
  for (const m of stripFences(readme).matchAll(/\]\(\.?\/?([^)\s#]+\.md)(?:#[^)]*)?\)|`\.?\/?([\w./-]+\.md)`/g)) {
    const target = m[1] ?? m[2]
    if (!/^https?:/i.test(target) && basename(target).toLowerCase() !== 'readme.md') out.push(target)
  }
  return out
}

/** Problems in one feature file's text. */
export function featureProblems(text) {
  const problems = []
  const body = stripFences(text)
  const h1 = [...body.matchAll(/^# (.+)$/gm)]
  if (h1.length !== 1) problems.push(h1.length === 0 ? 'no H1 title' : `${h1.length} H1 titles; a feature file has one`)
  const h2 = [...body.matchAll(/^## (.+)$/gm)].map((m) => ({ title: m[1].trim(), index: m.index }))
  let at = 0
  const found = []
  for (const section of SECTIONS) {
    const i = h2.findIndex((h, n) => n >= at && section.match.test(h.title))
    if (i === -1) {
      const anywhere = h2.some((h) => section.match.test(h.title))
      problems.push(anywhere ? `section "${section.name}" is out of order` : `no "${section.name}" section`)
      found.push(null)
      continue
    }
    found.push(h2[i])
    at = i + 1
  }
  const driving = found[2]
  if (driving) {
    const next = h2.find((h) => h.index > driving.index)
    const section = body.slice(driving.index, next ? next.index : undefined).split('\n').slice(1).join('\n')
    const first = section.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? ''
    if (!/^(?:[-*]\s+)?(?:\*\*)?Preconditions:/.test(first)) problems.push('the Driving section does not open with `Preconditions:`')
  }
  return problems
}

/** Check a features directory. */
export function checkFeatureMap(dir) {
  const problems = []
  const readmePath = join(dir, 'README.md')
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md' && statSync(join(dir, f)).isFile()).sort()
  let entries = []
  if (existsSync(readmePath)) {
    entries = indexEntries(readFileSync(readmePath, 'utf8'))
  } else {
    problems.push({ file: 'README.md', problem: 'no README.md index' })
  }
  const seen = new Set()
  for (const entry of entries) {
    if (seen.has(entry)) problems.push({ file: 'README.md', problem: `lists ${entry} more than once` })
    seen.add(entry)
    if (!existsSync(join(dir, entry))) problems.push({ file: 'README.md', problem: `lists ${entry}, which does not exist` })
  }
  if (existsSync(readmePath)) {
    for (const file of files) if (!seen.has(file)) problems.push({ file, problem: 'not listed in README.md' })
  }
  for (const file of files) {
    for (const problem of featureProblems(readFileSync(join(dir, file), 'utf8'))) problems.push({ file, problem })
  }
  return { schemaVersion: FEATURE_MAP_SCHEMA_VERSION, dir, features: files.length, problems, ok: problems.length === 0 }
}

const USAGE = `Usage: feature-map-check.mjs <features-dir> [--json]

Check a verification skill's feature map: the README.md index against the
feature files, and each file's H1, its four sections in order, and the
Preconditions line that opens its Driving section. Exits 0 when well-formed,
1 when not, 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  let values
  let positionals
  try {
    ;({ values, positionals } = parseArgs({ args: argv, options: { json: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } }, allowPositionals: true }))
  } catch (err) {
    process.stderr.write(`feature-map-check: ${err.message}\n\n${USAGE}`)
    return 2
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const dir = positionals[0] ? resolve(positionals[0]) : null
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
    process.stderr.write(`feature-map-check: ${dir ? `not a directory: ${positionals[0]}` : 'a features directory is required'}\n\n${USAGE}`)
    return 2
  }
  const result = checkFeatureMap(dir)
  if (values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    const lines = result.problems.map((p) => `  ${p.file}: ${p.problem}`)
    lines.push(result.ok ? `${result.features} feature file(s); the map is well-formed.` : `${result.problems.length} problem(s) in the feature map.`)
    lines.push('Shape only: driving the app is what shows a recipe still works.')
    process.stdout.write(`${lines.join('\n')}\n`)
  }
  return result.ok ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
