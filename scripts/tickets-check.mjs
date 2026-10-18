#!/usr/bin/env node
// tickets-check.mjs — read a directory of tickets and report the work graph.
//
// WHAT THIS IS: the deterministic half of `plan tickets` and `build`. Tickets
// are Markdown files named NN-<slug>.md carrying "Blocked by", "Touches",
// "Verify with", and "Status" lines (see references/artifacts.md). This script
// reports the frontier (open tickets whose blockers are all done), the waves
// the open work falls into, cycles, blockers that name no ticket, tickets with
// no verify command, and frontier tickets that touch the same paths, which two
// parallel agents would collide on.
//
// mattpocock/skills `to-tickets` declares blocking edges but nothing checks
// them, and nothing says which ready tickets are safe to run at once.
//
// Read-only.

import { fileURLToPath } from 'node:url'
import { basename, resolve } from 'node:path'

import { isDirectory, listFiles, readTextContained, relPosix } from './lib/fs-utils.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const TICKETS_SCHEMA_VERSION = 1
// Anchored, so "not done" and the unfilled "ready | in-progress | done" are open.
const DONE = /^\W*(done|merged|closed|complete|completed)\b/i

const field = (text, name) => {
  // [ \t] rather than \s: \s crosses the newline, so an empty field would
  // capture the next line's text.
  const match = new RegExp(`^[ \\t]*\\**${name}:?\\**:?[ \\t]*(.*)$`, 'im').exec(text)
  return match === null ? null : match[1].trim()
}

/**
 * Ticket numbers named on a "Blocked by" line. "None" and empty mean no
 * blockers. Only numbers in list position count, and parenthesized notes are
 * ignored, so "03 (needs Node 18)", "02, see PR #45", and a date are one
 * blocker each, not several.
 */
export function parseBlockers(value) {
  if (value === null) return []
  const text = value.replace(/\([^)]*\)/g, ' ')
  if (/^\W*none\b/i.test(text)) return []
  const ids = [...text.matchAll(/(?:^|[,;&]|\band\b)\s*#?(\d{1,4})\b(?![-./]\d)/gi)].map((m) => String(Number(m[1])))
  return [...new Set(ids)]
}

/** Paths or areas on a "Touches" line, backticks and trailing slashes stripped. */
export function parseTouches(value) {
  if (value === null) return []
  return value
    .split(/[,;]/)
    .map((p) => p.replace(/`/g, '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''))
    .filter((p) => p !== '' && !/^none$/i.test(p))
}

/** Two touched paths collide when either contains the other. */
export function touchesOverlap(a, b) {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

export function parseTicket(rel, text) {
  const number = /^(\d{1,4})-/.exec(basename(rel))
  const heading = /^#\s+(.*)$/m.exec(text)?.[1]?.trim()
  const title = heading === undefined ? basename(rel, '.md') : heading.replace(/^\d{1,4}\s*[:.)-]\s*/, '')
  const status = field(text, 'Status')
  return {
    id: number === null ? null : String(Number(number[1])),
    path: rel,
    title,
    blockedBy: parseBlockers(field(text, 'Blocked by')),
    touches: parseTouches(field(text, 'Touches')),
    verifyWith: field(text, 'Verify with'),
    status: status ?? 'ready',
    done: status !== null && DONE.test(status),
  }
}

/** Find one cycle through each strongly connected group, as ticket id lists. */
export function findCycles(tickets) {
  const byId = new Map(tickets.map((t) => [t.id, t]))
  const state = new Map()
  const cycles = []
  const stack = []
  const visit = (id) => {
    state.set(id, 'open')
    stack.push(id)
    for (const next of byId.get(id)?.blockedBy ?? []) {
      if (!byId.has(next)) continue
      if (state.get(next) === 'open') cycles.push([...stack.slice(stack.indexOf(next)), next])
      else if (!state.has(next)) visit(next)
    }
    stack.pop()
    state.set(id, 'closed')
  }
  for (const t of tickets) if (!state.has(t.id)) visit(t.id)
  return cycles
}

export function analyzeTickets(tickets) {
  const byId = new Map(tickets.map((t) => [t.id, t]))
  const allById = new Map()
  for (const t of tickets) allById.set(t.id, [...(allById.get(t.id) ?? []), t])
  const problems = []
  for (const [id, group] of allById) {
    if (id !== null && group.length > 1) {
      problems.push({ kind: 'duplicate-id', ticket: group[1].path, message: `shares number ${id} with ${group.map((t) => t.path).join(', ')}` })
    }
  }
  for (const t of tickets) {
    if (t.id === null) problems.push({ kind: 'unnumbered', ticket: t.path, message: 'file name does not start with a number' })
    for (const b of t.blockedBy) {
      if (!byId.has(b)) problems.push({ kind: 'unknown-blocker', ticket: t.path, message: `blocked by ${b}, which is not a ticket here` })
      if (b === t.id) problems.push({ kind: 'self-blocked', ticket: t.path, message: 'blocks itself' })
    }
    if (!t.done && (t.verifyWith === null || t.verifyWith === '')) {
      problems.push({ kind: 'missing-verify', ticket: t.path, message: 'no "Verify with" line, so done cannot be checked' })
    }
  }
  const cycles = findCycles(tickets.filter((t) => t.id !== null))
  for (const c of cycles) problems.push({ kind: 'cycle', ticket: byId.get(c[0])?.path ?? c[0], message: `cycle: ${c.join(' -> ')}` })

  // A number is done only when every ticket carrying it is done.
  const isDone = (id) => (allById.get(id) ?? []).length > 0 && allById.get(id).every((t) => t.done)
  const open = tickets.filter((t) => !t.done && t.id !== null)
  const frontier = open.filter((t) => t.blockedBy.every((b) => !byId.has(b) || isDone(b)))

  // Waves: Kahn layering over open tickets, treating done and unknown blockers as satisfied.
  const waves = []
  const placed = new Set()
  let remaining = open.filter((t) => !cycles.some((c) => c.includes(t.id)))
  while (remaining.length > 0) {
    const wave = remaining.filter((t) => t.blockedBy.every((b) => !byId.has(b) || isDone(b) || placed.has(b)))
    if (wave.length === 0) break
    waves.push(wave.map((t) => t.id))
    for (const t of wave) placed.add(t.id)
    remaining = remaining.filter((t) => !placed.has(t.id))
  }

  const collisions = []
  for (let i = 0; i < frontier.length; i += 1) {
    for (let j = i + 1; j < frontier.length; j += 1) {
      const shared = frontier[i].touches.filter((a) => frontier[j].touches.some((b) => touchesOverlap(a, b)))
      if (shared.length > 0) collisions.push({ tickets: [frontier[i].id, frontier[j].id], paths: shared })
    }
  }
  const untouched = frontier.filter((t) => t.touches.length === 0).map((t) => t.id)

  return { problems, cycles, frontier: frontier.map((t) => t.id), waves, collisions, untouched }
}

export function checkTickets(root, dir) {
  const absRoot = resolve(root)
  const absDir = resolve(absRoot, dir)
  if (!isDirectory(absDir)) return { error: `not a directory: ${dir}` }
  const tickets = []
  for (const abs of listFiles(absDir, { extension: '.md', maxDepth: 1 })) {
    if (/^readme\.md$/i.test(basename(abs))) continue
    const text = readTextContained(absRoot, abs)
    if (text === null) continue
    tickets.push(parseTicket(relPosix(absRoot, abs), text))
  }
  tickets.sort((a, b) => Number(a.id ?? Infinity) - Number(b.id ?? Infinity) || a.path.localeCompare(b.path))
  return {
    schemaVersion: TICKETS_SCHEMA_VERSION,
    root: absRoot.split('\\').join('/'),
    dir: relPosix(absRoot, absDir),
    tickets,
    ...analyzeTickets(tickets),
  }
}

export function renderTicketsText(result) {
  const name = (id) => {
    const t = result.tickets.find((x) => x.id === id)
    return t ? `${id.padStart(2, '0')} ${t.title}` : id
  }
  const out = [`Tickets — ${result.dir}`, '', `${result.tickets.length} ticket(s), ${result.tickets.filter((t) => t.done).length} done.`]
  out.push('', 'Frontier (ready now):')
  out.push(...(result.frontier.length === 0 ? ['    none'] : result.frontier.map((id) => `    ${name(id)}`)))
  if (result.waves.length > 0) {
    out.push('', 'Waves:')
    result.waves.forEach((wave, i) => out.push(`    ${i + 1}: ${wave.join(', ')}`))
  }
  if (result.collisions.length > 0) {
    out.push('', 'Frontier tickets that touch the same paths (run these one after another):')
    for (const c of result.collisions) out.push(`    ${c.tickets.join(' and ')}: ${c.paths.join(', ')}`)
  }
  if (result.untouched.length > 0) out.push('', `No "Touches" line, so overlap is unknown: ${result.untouched.join(', ')}`)
  if (result.problems.length > 0) {
    out.push('', 'Problems:')
    for (const p of result.problems) out.push(`    ${p.kind.padEnd(16)} ${p.ticket}: ${p.message}`)
  }
  return out.join('\n')
}

const USAGE = `Usage: tickets-check.mjs --dir <tickets-dir> [--json] [--cwd <dir>]

Report the frontier, parallel waves, cycles, unknown blockers, missing verify
commands, and path collisions for a directory of NN-<slug>.md tickets.
Read-only. Exits 0 when it ran; 1 when it found a cycle, an unknown blocker, or
a duplicate number; 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, root, error } = parseCliArgs(argv, { extraOptions: { dir: { type: 'string' } } })
  if (error !== null || (!values.help && !values.dir)) {
    process.stderr.write(`tickets-check: ${error ?? '--dir is required'}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const result = checkTickets(root, values.dir)
  if (result.error) {
    process.stderr.write(`tickets-check: ${result.error}\n`)
    return USAGE_EXIT_CODE
  }
  emit(result, renderTicketsText(result), { json: values.json })
  return result.problems.some((p) => ['cycle', 'unknown-blocker', 'duplicate-id'].includes(p.kind)) ? 1 : 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
