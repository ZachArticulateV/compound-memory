#!/usr/bin/env node
// lessons.mjs — find the lessons in memory/lessons/ that bear on a task.
//
// WHAT THIS IS: the read path of the knowledge loop. `learn capture` writes a
// lesson; planning, debugging, review, and building ask this script which
// lessons apply before they start. Matching is deterministic: query words
// against title, tags, and applies_when, plus changed paths against the
// lesson's paths. Stale and retired lessons are skipped unless --all is given.
//
// Each returned lesson also says whether the code it names has moved on: a
// path it lists that no longer exists, or commits to its paths after the
// lesson was last committed. Such a lesson is a candidate for `learn refresh`;
// it is still returned, because changed code does not make it false.
// `--drift` lists every lesson with drift and nothing else. `--check` lists
// the commits lessons cite (in their Evidence section, or right after the
// word "commit") that do not exist or are not reachable from HEAD, so a
// lesson cannot rest on history that was rewritten or never pushed.
//
// WHAT THIS IS NOT: a judge of relevance. A match is a candidate to read.
//
// Read-only.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { parseArgs } from 'node:util'

import { findProjectRoot, isDirectory, joinRel, listFiles, pathExists, readTextContained, relPosix } from './lib/fs-utils.mjs'
import { commitsTouchingPathSince, isRepository, lastCommitForPath, runGit } from './lib/git.mjs'
import { LESSONS_REL, lessonProblems, parseLesson, rankLessons } from './lib/lessons.mjs'
import { USAGE_EXIT_CODE, emit } from './lib/report.mjs'

export const LESSONS_SCHEMA_VERSION = 1

/** Every lesson file under memory/lessons/, parsed. Files outside the repository are skipped. */
export function loadLessons(root) {
  const absRoot = resolve(root)
  const dir = joinRel(absRoot, LESSONS_REL)
  if (!isDirectory(dir)) return []
  const lessons = []
  for (const abs of listFiles(dir, { extension: '.md' })) {
    const text = readTextContained(absRoot, abs)
    if (text === null) continue
    lessons.push(parseLesson(relPosix(absRoot, abs), text))
  }
  return lessons
}

/**
 * Has the code a lesson names moved on since the lesson was written? Paths that
 * no longer exist, and commits to its paths after the lesson's last commit.
 * `checked: false` with a reason when Git cannot say (no repository, the
 * lesson is uncommitted, or it names no paths).
 */
export function lessonDrift(root, lesson, { git = isRepository(root) } = {}) {
  const missing = lesson.paths.filter((p) => !pathExists(joinRel(root, p.replace(/\/+$/, ''))))
  if (lesson.paths.length === 0) return { checked: false, reason: 'names no paths', missing, changed: [] }
  if (!git) return { checked: false, reason: 'no Git history', missing, changed: [] }
  const last = lastCommitForPath(root, lesson.path)
  if (last === null) return { checked: false, reason: 'the lesson is not committed yet', missing, changed: [] }
  const changed = []
  for (const p of lesson.paths) {
    const res = commitsTouchingPathSince(root, last.sha, p.replace(/\/+$/, ''))
    if (!res.ok) return { checked: false, reason: res.error, missing, changed }
    if (res.commits.length > 0) changed.push({ path: p, commits: res.commits.length, latest: res.commits[0].sha.slice(0, 12) })
  }
  return { checked: true, reason: null, missing, changed }
}

/** Commit hashes a lesson cites: in its Evidence section, or after the word "commit". */
export function citedCommits(body) {
  const out = new Set()
  const hash = /(?<![\w/.-])([0-9a-f]{7,40})(?![\w/.-])/g
  const evidence = /^## Evidence\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body)?.[1] ?? ''
  for (const m of evidence.matchAll(hash)) if (/[a-f]/.test(m[1]) && /\d/.test(m[1])) out.add(m[1])
  for (const m of body.matchAll(/\bcommits?\s+`?([0-9a-f]{7,40})\b/gi)) out.add(m[1])
  return [...out]
}

/** Each cited commit that does not exist, or is not reachable from HEAD. */
export function checkLessonCommits(root) {
  const absRoot = resolve(root)
  if (!isRepository(absRoot)) return { checked: false, reason: 'no Git history', problems: [] }
  const problems = []
  for (const lesson of loadLessons(absRoot)) {
    if (lesson.status === 'retired') continue
    for (const sha of citedCommits(lesson.body)) {
      const exists = runGit(['cat-file', '-e', `${sha}^{commit}`], { cwd: absRoot }).ok
      if (!exists) {
        problems.push({ path: lesson.path, sha, problem: 'no such commit' })
        continue
      }
      const reachable = runGit(['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: absRoot }).ok
      if (!reachable) problems.push({ path: lesson.path, sha, problem: 'not reachable from HEAD' })
    }
  }
  return { checked: true, reason: null, problems }
}

export function lessonsWithDrift(root) {
  const absRoot = resolve(root)
  const git = isRepository(absRoot)
  return loadLessons(absRoot)
    .filter((l) => l.status === 'active')
    .map((l) => ({ path: l.path, title: l.title, drift: lessonDrift(absRoot, l, { git }) }))
    .filter((l) => l.drift.missing.length > 0 || l.drift.changed.length > 0)
}

export function findLessons(root, { query = '', paths = [], includeInactive = false, limit = 5 } = {}) {
  const lessons = loadLessons(root)
  const ranked = rankLessons(lessons, { query, paths, includeInactive, limit })
  const absRoot = resolve(root)
  const git = ranked.results.length > 0 && isRepository(absRoot)
  return {
    schemaVersion: LESSONS_SCHEMA_VERSION,
    root: resolve(root).split('\\').join('/'),
    lessonsDir: LESSONS_REL,
    present: lessons.length > 0,
    count: lessons.length,
    query,
    paths,
    excludedInactive: ranked.excludedInactive,
    matches: ranked.total,
    results: ranked.results.map(({ lesson, score, matched }) => ({
      path: lesson.path,
      title: lesson.title,
      status: lesson.status,
      appliesWhen: lesson.appliesWhen,
      tags: lesson.tags,
      score,
      matched,
      problems: lessonProblems(lesson),
      drift: lessonDrift(absRoot, lesson, { git }),
    })),
  }
}

export function renderLessonsText(result) {
  const out = [`Lessons — ${result.root}`, '']
  if (!result.present) {
    out.push(`No lessons under ${result.lessonsDir}/.`)
    return out.join('\n')
  }
  if (result.results.length === 0) {
    out.push(`No lesson matched (${result.count} checked).`)
  } else {
    for (const r of result.results) {
      out.push(`${r.title}  [${r.status}, score ${r.score}]`)
      out.push(`    ${r.path}`)
      if (r.appliesWhen) out.push(`    applies when: ${r.appliesWhen}`)
      for (const p of r.problems) out.push(`    format: ${p}`)
      for (const m of r.drift?.missing ?? []) out.push(`    drift: ${m} no longer exists; check the lesson before relying on it`)
      for (const c of r.drift?.changed ?? []) out.push(`    drift: ${c.path} has ${c.commits} commit(s) since the lesson was written; check it still holds`)
    }
    if (result.matches > result.results.length) out.push('', `${result.matches - result.results.length} more matched; raise --limit to see them.`)
  }
  if (result.excludedInactive > 0) out.push('', `${result.excludedInactive} stale or retired lesson(s) not considered; pass --all to include them.`)
  return out.join('\n')
}

const USAGE = `Usage: lessons.mjs [--query "<words>"] [--paths a,b] [path ...] [--all] [--limit n] [--json] [--cwd <dir>]
       lessons.mjs --drift [--json] [--cwd <dir>]
       lessons.mjs --check [--json] [--cwd <dir>]

Find the lessons under memory/lessons/ that match a task. Paths may be given as
a comma or space separated --paths value, or as bare arguments. With no query
and no paths, list the active lessons. Each result says whether its paths have
changed since it was written. --drift lists only the active lessons whose paths
changed or are gone. --check lists cited commits that do not exist or are not
reachable from HEAD, and exits 1 when there is one. Read-only. Otherwise exits
0 when it ran; 2 on a usage error.
`

/**
 * Parse arguments. Unlike the other scripts, a bare argument is a changed path,
 * not the project root: `--paths app tests` must not read "tests" as the root
 * and silently report that no lessons exist. The root comes only from --cwd.
 */
export function parseLessonsArgs(argv) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: {
        json: { type: 'boolean', default: false },
        cwd: { type: 'string' },
        help: { type: 'boolean', default: false, short: 'h' },
        query: { type: 'string', default: '' },
        paths: { type: 'string', default: '' },
        all: { type: 'boolean', default: false },
        limit: { type: 'string', default: '5' },
        drift: { type: 'boolean', default: false },
        check: { type: 'boolean', default: false },
      },
      allowPositionals: true,
      strict: true,
    })
    if (values.cwd !== undefined && !isDirectory(resolve(values.cwd))) {
      return { values, error: `not a directory: ${values.cwd}` }
    }
    const paths = [...values.paths.split(/[,\s]+/), ...positionals].map((p) => p.trim()).filter(Boolean)
    return { values, paths, root: values.cwd ?? findProjectRoot(process.cwd()), error: null }
  } catch (err) {
    return { values: { json: false, help: false }, error: err.message }
  }
}

export function main(argv = process.argv.slice(2)) {
  const { values, paths, root, error } = parseLessonsArgs(argv)
  if (error !== null) {
    process.stderr.write(`lessons: ${error}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const limit = Number.parseInt(values.limit, 10)
  if (!Number.isInteger(limit) || limit < 0) {
    process.stderr.write(`lessons: --limit must be a whole number\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.check) {
    const result = checkLessonCommits(root)
    const text = !result.checked
      ? `Commits not checked: ${result.reason}.`
      : result.problems.length === 0
        ? 'Every commit the lessons cite exists and is reachable from HEAD.'
        : [`${result.problems.length} cited commit(s) to fix:`, ...result.problems.map((p) => `    ${p.path}: ${p.sha} ${p.problem}`)].join('\n')
    emit({ schemaVersion: LESSONS_SCHEMA_VERSION, ...result }, text, { json: values.json })
    return result.problems.length === 0 ? 0 : 1
  }
  if (values.drift) {
    const drifted = lessonsWithDrift(root)
    const text = drifted.length === 0
      ? 'No active lesson names a path that changed or disappeared since it was written.'
      : [`${drifted.length} lesson(s) to re-check with learn refresh:`, ...drifted.map((d) => `    ${d.path}: ${[...d.drift.missing.map((m) => `${m} gone`), ...d.drift.changed.map((c) => `${c.path} +${c.commits} commit(s)`)].join('; ')}`)].join('\n')
    emit({ schemaVersion: LESSONS_SCHEMA_VERSION, drifted }, text, { json: values.json })
    return 0
  }
  const result = findLessons(root, { query: values.query, paths, includeInactive: values.all, limit })
  emit(result, renderLessonsText(result), { json: values.json })
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
