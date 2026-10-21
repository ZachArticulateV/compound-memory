#!/usr/bin/env node
// changes.mjs — what is changed, where it sits, and what a commit would take.
//
// WHAT THIS IS: the deterministic part of `review` scoping and `ship commit`.
//
//   review    Lists every change a review should cover: commits since the
//             base, staged, unstaged, and new files. `--write <file>` saves the
//             whole change as one patch, new files included. Exits 1 when
//             there is nothing to review.
//   snapshot  Saves which lines are staged right now, before the agent stages
//             anything (default `.verify/staged-before.json`).
//   staged    Checks the index before a commit: every staged file falls under
//             `--intended` paths, no line staged before the work began is
//             still staged (with `--baseline`), and files with both staged and
//             unstaged lines are named so a partial commit is deliberate.
//             Exits 1 when the commit would take something not intended.
//
// The earlier review playbook prescribed `git diff <base>...HEAD`, which is
// empty for staged, unstaged, and new files; the commit playbook staged with
// `git add -p` and committed whatever the index held. Both were found by the
// 2026-10-21 audit and are pinned in tests/audit-regressions.test.mjs.
//
// It never stages, commits, or resets: the agent keeps the method. `snapshot`
// and `review --write` write only under `.verify/` (any other path is
// refused); `staged` is read-only.

import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import {
  SCRATCH_DIR, changeSets, fromObject, fullDiff, indexState, isGitCheckout, reviewBase,
  scratchIgnored, stagedSnapshot, stillStaged, underPath,
} from './lib/changes.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const CHANGES_SCHEMA_VERSION = 2
const DEFAULT_SNAPSHOT = `${SCRATCH_DIR}/staged-before.json`

const list = (raw) => (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const abs = (root, p) => (isAbsolute(p) ? p : join(root, ...p.split('/')))

/** A path this script may write: inside the checkout's .verify/ and nowhere else. */
export function scratchPath(root, p) {
  const target = resolve(abs(root, p))
  const rel = relative(resolve(root, SCRATCH_DIR), target)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) return null
  return target
}

/** The review scope: base, commits, and every changed file by where it lives. */
export function reviewScope(root, { base = null, paths = [], write = null } = {}) {
  if (!isGitCheckout(root)) return { error: 'not a Git checkout: review the files you were given directly' }
  const b = reviewBase(root, base)
  if (!b.ok) return { error: b.error }
  const sets = changeSets(root, { base: b.sha, paths })
  if (!sets.ok) return { error: sets.error }
  const files = new Set([...sets.committed, ...sets.staged, ...sets.unstaged].map((c) => c.path).concat(sets.untracked))
  const result = {
    schemaVersion: CHANGES_SCHEMA_VERSION,
    mode: 'review',
    base: { sha: b.sha, ref: b.ref, how: b.how },
    paths,
    commits: sets.commits,
    committed: sets.committed,
    staged: sets.staged,
    unstaged: sets.unstaged,
    untracked: sets.untracked,
    files: [...files].sort(),
    empty: files.size === 0,
    // The one command that shows tracked changes (committed, staged, and
    // unstaged) against the base. New files are not in it: read them whole,
    // or use the patch.
    diffCommand: `git diff ${b.sha.slice(0, 12)}`,
    patch: null,
    scratchIgnored: scratchIgnored(root),
  }
  if (write) {
    const target = scratchPath(root, write)
    if (target === null) return { error: `--write must name a file under ${SCRATCH_DIR}/, not ${write}` }
    const diff = fullDiff(root, { base: b.sha, paths, untracked: sets.untracked })
    if (!diff.ok) return { error: diff.error }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, diff.patch, 'utf8')
    result.patch = write.replace(/\\/g, '/')
  }
  return result
}

/** Check what a commit would take against what the agent means to commit. */
export function checkStaged(root, { intended = [], baseline = null } = {}) {
  if (!isGitCheckout(root)) return { error: 'not a Git checkout' }
  const state = indexState(root)
  if (!state.ok) return { error: state.error }
  const staged = [...state.staged.keys()].sort()
  const problems = []
  const notes = []

  if (staged.length === 0) problems.push({ id: 'nothing-staged', message: 'nothing is staged; the commit would be empty' })

  const outside = intended.length === 0 ? [] : staged.filter((f) => !intended.some((p) => underPath(p, f)))
  for (const file of outside) problems.push({ id: 'unintended-file', file, message: `${file} is staged but is not among the intended paths` })

  if (baseline !== null) {
    for (const r of stillStaged(fromObject(baseline.staged), state.staged)) {
      problems.push({
        id: 'staged-before',
        file: r.file,
        message: r.whole
          ? `${r.file} is staged exactly as it was before this work began`
          : `${r.hunks} hunk(s) in ${r.file} were staged before this work began and are still staged`,
      })
    }
  }

  const mixed = staged.filter((f) => state.unstaged.has(f))
  for (const file of mixed) {
    notes.push({ id: 'partial-file', file, message: `${file} has staged and unstaged changes; only the staged ones go in this commit` })
  }
  const pending = [...new Set([...state.unstaged, ...state.untracked])]
    .filter((f) => !state.staged.has(f) && intended.some((p) => underPath(p, f)))
  for (const file of pending) notes.push({ id: 'intended-not-staged', file, message: `${file} is under an intended path but nothing in it is staged` })

  return {
    schemaVersion: CHANGES_SCHEMA_VERSION,
    mode: 'staged',
    intended,
    baseline: baseline !== null,
    staged,
    problems,
    notes,
    ok: problems.length === 0,
  }
}

function renderReview(r) {
  const out = [`Review scope — base ${r.base.sha.slice(0, 12)} (${r.base.how})`]
  const section = (title, items) => {
    if (items.length === 0) return
    out.push('', `${title} (${items.length}):`)
    for (const i of items) out.push(`    ${typeof i === 'string' ? i : `${i.status} ${i.path}`}`)
  }
  section('Commits', r.commits)
  section('Committed', r.committed)
  section('Staged', r.staged)
  section('Unstaged', r.unstaged)
  section('New, untracked', r.untracked)
  out.push('')
  if (r.empty) out.push('Nothing to review: no committed, staged, unstaged, or new changes against the base.')
  else {
    out.push(`${r.files.length} file(s) in scope. Tracked changes: \`${r.diffCommand}\`${r.untracked.length > 0 ? '; read the new files whole' : ''}.`)
    if (r.patch) out.push(`Whole change, new files included: ${r.patch}`)
  }
  if (r.scratchIgnored === false) out.push(`Note: ${SCRATCH_DIR}/ is not ignored by Git; add it to .gitignore before writing run output.`)
  return out.join('\n')
}

function renderStaged(r) {
  const out = [`Staged for commit: ${r.staged.length} file(s)`]
  for (const p of r.problems) out.push(`  PROBLEM ${p.message}`)
  for (const n of r.notes) out.push(`  note    ${n.message}`)
  out.push('', r.ok ? 'The index holds only intended work.' : 'Do not commit yet: the index holds work that was not intended. Unstage it (keep a patch of it first) or name it as intended.')
  return out.join('\n')
}

const USAGE = `Usage:
  changes.mjs review   [--base <ref>] [--paths a,b] [--write <patch>] [--json] [--cwd <dir>]
  changes.mjs snapshot [--out <file>] [--cwd <dir>]
  changes.mjs staged   --intended a,b [--baseline <file>] [--json] [--cwd <dir>]

review    every change in scope: commits since the base, staged, unstaged, and
          new files. Exits 1 when there is nothing to review.
snapshot  save the lines staged right now (default ${DEFAULT_SNAPSHOT}).
staged    check the index before a commit. Exits 1 when it holds a file outside
          --intended, or lines that were staged before the snapshot.
Exits 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const [mode, ...rest] = argv
  if (mode === '--help' || mode === '-h') {
    process.stdout.write(USAGE)
    return 0
  }
  if (!['review', 'snapshot', 'staged'].includes(mode)) {
    process.stderr.write(`changes: the first argument must be review, snapshot, or staged\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  const { values, root, error } = parseCliArgs(rest, {
    extraOptions: {
      base: { type: 'string' },
      paths: { type: 'string' },
      write: { type: 'string' },
      out: { type: 'string' },
      intended: { type: 'string' },
      baseline: { type: 'string' },
    },
  })
  if (error !== null) {
    process.stderr.write(`changes: ${error}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const absRoot = resolve(root)

  if (mode === 'snapshot') {
    const snap = stagedSnapshot(absRoot)
    if (!snap.ok) {
      process.stderr.write(`changes: ${snap.error}\n`)
      return USAGE_EXIT_CODE
    }
    const target = values.out ?? DEFAULT_SNAPSHOT
    const file = scratchPath(absRoot, target)
    if (file === null) {
      process.stderr.write(`changes: --out must name a file under ${SCRATCH_DIR}/, not ${target}\n`)
      return USAGE_EXIT_CODE
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify({ schemaVersion: CHANGES_SCHEMA_VERSION, ...snap }, null, 2)}\n`, 'utf8')
    const count = Object.keys(snap.staged).length
    process.stdout.write(`Saved the index state to ${target}: ${count === 0 ? 'nothing staged' : `${count} file(s) with staged lines`}.\n`)
    return 0
  }

  if (mode === 'review') {
    const result = reviewScope(absRoot, { base: values.base ?? null, paths: list(values.paths), write: values.write ?? null })
    if (result.error) {
      process.stderr.write(`changes: ${result.error}\n`)
      return USAGE_EXIT_CODE
    }
    emit(result, renderReview(result), { json: values.json })
    return result.empty ? 1 : 0
  }

  let baseline = null
  if (values.baseline) {
    try {
      baseline = JSON.parse(readFileSync(abs(absRoot, values.baseline), 'utf8'))
    } catch (err) {
      process.stderr.write(`changes: cannot read the baseline ${values.baseline}: ${err.message}\n`)
      return USAGE_EXIT_CODE
    }
    if (baseline.schemaVersion !== CHANGES_SCHEMA_VERSION) {
      process.stderr.write(`changes: ${values.baseline} was written by another version; take a new snapshot\n`)
      return USAGE_EXIT_CODE
    }
  }
  const result = checkStaged(absRoot, { intended: list(values.intended), baseline })
  if (result.error) {
    process.stderr.write(`changes: ${result.error}\n`)
    return USAGE_EXIT_CODE
  }
  emit(result, renderStaged(result), { json: values.json })
  return result.ok ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
