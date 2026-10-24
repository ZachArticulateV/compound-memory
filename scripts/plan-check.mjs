#!/usr/bin/env node
// plan-check.mjs — the parts of a plan's readiness check that code can decide.
//
// WHAT THIS IS: the deterministic call under `plan`. A plan in the shape of
// `references/artifacts.md` names requirements (R1, R2, ...) and units (U1,
// U2, ...) that each carry a Verify and the requirement IDs they cover. This
// script reads those IDs and reports:
//
//   - requirements no unit covers;
//   - units that cite a requirement the plan does not have;
//   - units with no Verify, or a Verify that says TBD;
//   - a `Depends on` that names a unit the plan does not have, or the unit itself;
//   - a missing or empty Out of scope;
//   - open questions not marked answered, deferred, or assumed;
//   - two decisions or two units sharing an ID.
//
// Units may be a table (a `Unit` column, plus `Verify` and `Covers` columns)
// or one heading or list item per unit with `Verify:` and `Covers:` lines.
// `--stage brainstorm` checks only what brainstorm writes.
//
// WHAT THIS IS NOT: a judge of whether a Verify could fail or a requirement is
// testable. It checks that the links exist; whether they hold is review's job.
//
// Read-only. Exits 0 when nothing is missing, 1 when something is, 2 on a
// usage error.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isAbsolute, join, resolve } from 'node:path'

import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const PLAN_CHECK_SCHEMA_VERSION = 1
const TBD = /\b(TBD|TODO|to be decided|to be determined)\b|\?\?\?/i
const SETTLED = /\b(answered|deferred|assumed|resolved|settled|decided)\b/i

/** `## Heading` sections, keyed by lower-case heading text. */
export function sections(text) {
  const out = new Map()
  let current = null
  let fenced = false
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced
    const h = fenced ? null : /^##\s+(.+?)\s*$/.exec(line)
    if (h) {
      current = h[1].toLowerCase().replace(/\s+[A-Z]\d.*$/i, '').trim()
      out.set(current, [])
      continue
    }
    if (current !== null) out.get(current).push(line)
  }
  return out
}

const find = (secs, name) => {
  for (const [key, body] of secs) if (key === name || key.startsWith(`${name} `)) return body
  return null
}
const ids = (text, letter) => [...text.matchAll(new RegExp(`\\b${letter}(\\d+)\\b`, 'g'))].map((m) => `${letter}${m[1]}`)
/** A list item or table row that starts with an ID: `- R1`, `1. R1`, `| R1`, `- **R1**`. */
const itemWith = (letter) => new RegExp(`^\\s*(?:[-*]|\\d+[.)]|\\|)\\s*\\**${letter}\\d+`)
const meaningful = (body) => (body ?? []).some((l) => l.trim() !== '' && !/^<!--.*-->$/.test(l.trim()))

/** Units from a table or from one block per unit. */
export function parseUnits(body) {
  const units = []
  const rows = body.filter((l) => /^\s*\|/.test(l))
  if (rows.length >= 2) {
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
    const header = cells(rows[0]).map((c) => c.toLowerCase())
    const col = (name) => header.findIndex((h) => h === name || h.startsWith(name))
    const [u, v, cov, dep] = [col('unit'), col('verify'), col('covers'), col('depends')]
    if (u !== -1) {
      for (const row of rows.slice(1)) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(row)) continue
        const c = cells(row)
        const id = ids(c[u] ?? '', 'U')[0]
        if (!id) continue
        units.push({ id, verify: v === -1 ? null : c[v] ?? '', covers: cov === -1 ? [] : ids(c[cov] ?? '', 'R'), dependsOn: dep === -1 ? [] : ids(c[dep] ?? '', 'U'), text: row })
      }
      return units
    }
  }
  let current = null
  for (const line of body) {
    const start = /^\s*(?:#{2,4}\s+|(?:[-*]|\d+[.)])\s+(?:\*\*)?)(U\d+)\b/.exec(line)
    if (start) {
      current = { id: start[1], verify: null, covers: [], dependsOn: [], text: line }
      units.push(current)
    }
    if (current === null) continue
    if (current.text !== line) current.text += `\n${line}`
    const v = /\bVerify\b\**\s*:\**\s*(.*)$/i.exec(line)
    if (v && current.verify === null) {
      current.verify = v[1].replace(/^\**:?\s*/, '').trim()
      current.verifyOpen = current.verify === ''
    } else if (current.verifyOpen && line.trim() !== '') {
      // The command sits on the lines under `Verify:` (an indented block or a
      // fence); take the first one.
      if (/^\s*(?:[-*]\s+\**[A-Z][a-z]+\**\s*:|#{2,4}\s)/.test(line)) current.verifyOpen = false
      else if (!/^\s*```/.test(line)) {
        current.verify = line.trim()
        current.verifyOpen = false
      }
    }
    const c = /\bCovers\b\**\s*:?\**\s*(.*)$/i.exec(line)
    if (c) current.covers.push(...ids(c[1], 'R'))
    const d = /\bDepends on\b\**\s*:\**\s*(.*)$/i.exec(line)
    if (d) current.dependsOn.push(...ids(d[1], 'U'))
  }
  return units
}

export function checkPlan(text, { stage = 'plan' } = {}) {
  const secs = sections(text)
  const problems = []
  const add = (id, message) => problems.push({ id, message })

  const reqBody = find(secs, 'requirements')
  if (reqBody === null) add('no-requirements', 'no Requirements section')
  const reqLines = (reqBody ?? []).filter((l) => itemWith('R').test(l))
  const requirements = [...new Set(reqLines.map((l) => /R\d+/.exec(l)[0]))]
  if (reqBody !== null && requirements.length === 0) add('no-requirements', 'the Requirements section names no R1, R2, ... IDs')
  const reqDupes = reqLines.map((l) => /R\d+/.exec(l)[0])
  for (const dupe of reqDupes.filter((id, i) => reqDupes.indexOf(id) !== i)) add('duplicate-id', `requirement ${dupe} is listed twice`)

  if (!meaningful(find(secs, 'out of scope'))) add('no-out-of-scope', 'Out of scope is missing or empty')

  const open = find(secs, 'open questions') ?? []
  for (const line of open.filter((l) => /^\s*[-*]\s+\S/.test(l))) {
    if (!SETTLED.test(line) && !/^\s*[-*]\s+none\b/i.test(line)) add('open-question', `open question not marked answered, deferred, or assumed: ${line.trim().slice(0, 100)}`)
  }

  let units = []
  if (stage === 'plan') {
    const unitBody = find(secs, 'units')
    if (unitBody === null) add('no-units', 'no Units section')
    units = parseUnits(unitBody ?? [])
    if (unitBody !== null && units.length === 0) add('no-units', 'the Units section names no U1, U2, ... IDs')
    const seen = new Set()
    for (const u of units) {
      if (seen.has(u.id)) add('duplicate-id', `unit ${u.id} appears twice`)
      seen.add(u.id)
      if (u.verify === null || u.verify.trim() === '') add('no-verify', `${u.id} has no Verify`)
      else if (TBD.test(u.verify)) add('no-verify', `${u.id}'s Verify is not decided: ${u.verify.slice(0, 80)}`)
      if (/\bTBD\b|\?\?\?/.test(u.text) && !(u.verify && TBD.test(u.verify))) add('tbd', `${u.id} still says TBD`)
      for (const r of u.covers) if (!requirements.includes(r)) add('unknown-requirement', `${u.id} covers ${r}, which the Requirements section does not list`)
      if (u.covers.length === 0) add('covers-nothing', `${u.id} covers no requirement`)
    }
    for (const u of units) {
      for (const d of u.dependsOn) {
        if (d === u.id) add('unknown-unit', `${u.id} depends on itself`)
        else if (!seen.has(d)) add('unknown-unit', `${u.id} depends on ${d}, which the Units section does not list`)
      }
    }
    const covered = new Set(units.flatMap((u) => u.covers))
    for (const r of requirements) if (!covered.has(r)) add('uncovered', `${r} is covered by no unit`)
    const decisions = (find(secs, 'decisions') ?? []).filter((l) => itemWith('D').test(l)).map((l) => /D\d+/.exec(l)[0])
    for (const dupe of decisions.filter((id, i) => decisions.indexOf(id) !== i)) add('duplicate-id', `decision ${dupe} is listed twice`)
    if (!meaningful(find(secs, 'verification'))) add('no-verification', 'Verification is missing or empty')
  }

  return {
    schemaVersion: PLAN_CHECK_SCHEMA_VERSION,
    stage,
    requirements,
    units: units.map((u) => ({ id: u.id, covers: u.covers, dependsOn: u.dependsOn, verify: u.verify })),
    problems,
    ready: problems.length === 0,
  }
}

function render(file, r) {
  const out = [`Plan ${file} (${r.stage}): ${r.requirements.length} requirement(s), ${r.units.length} unit(s)`]
  for (const p of r.problems) out.push(`  ${p.id.padEnd(20)} ${p.message}`)
  out.push('', r.ready ? 'Every requirement is covered and every unit has a Verify.' : `${r.problems.length} problem(s). Fix them before handing the plan on.`)
  out.push('Links checked, not truth: whether each Verify could fail is review\'s call.')
  return out.join('\n')
}

const USAGE = `Usage: plan-check.mjs <plan.md> [--stage brainstorm|plan] [--json] [--cwd <dir>]

Check a plan's requirement coverage, Verify lines, Out of scope, open
questions, and IDs. Read-only. Exits 0 when nothing is missing, 1 when
something is, 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const [file, ...rest] = argv
  if (file === '--help' || file === '-h') {
    process.stdout.write(USAGE)
    return 0
  }
  const { values, root, error } = parseCliArgs(rest, { extraOptions: { stage: { type: 'string', default: 'plan' } } })
  if (!file || file.startsWith('-') || error !== null || !['plan', 'brainstorm'].includes(values.stage)) {
    process.stderr.write(`plan-check: ${error ?? (file && !file.startsWith('-') ? '--stage is plan or brainstorm' : 'name the plan file first')}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  let text
  try {
    text = readFileSync(isAbsolute(file) ? file : join(values.cwd ? resolve(root) : process.cwd(), file), 'utf8')
  } catch (err) {
    process.stderr.write(`plan-check: cannot read ${file}: ${err.message}\n`)
    return USAGE_EXIT_CODE
  }
  const result = checkPlan(text, { stage: values.stage })
  emit({ file, ...result }, render(file, result), { json: values.json })
  return result.ready ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
