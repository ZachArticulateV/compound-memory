#!/usr/bin/env node
// lessons.mjs — find the lessons in memory/lessons/ that bear on a task.
//
// WHAT THIS IS: the read path of the knowledge loop. `learn capture` writes a
// lesson; planning, debugging, review, and building ask this script which
// lessons apply before they start. Matching is deterministic: query words
// against title, tags, and applies_when, plus changed paths against the
// lesson's paths. Stale and retired lessons are skipped unless --all is given.
//
// WHAT THIS IS NOT: a judge of relevance. A match is a candidate to read.
//
// Read-only.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { parseArgs } from 'node:util'

import { findProjectRoot, isDirectory, joinRel, listFiles, readTextContained, relPosix } from './lib/fs-utils.mjs'
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

export function findLessons(root, { query = '', paths = [], includeInactive = false, limit = 5 } = {}) {
  const lessons = loadLessons(root)
  const ranked = rankLessons(lessons, { query, paths, includeInactive, limit })
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
    }
    if (result.matches > result.results.length) out.push('', `${result.matches - result.results.length} more matched; raise --limit to see them.`)
  }
  if (result.excludedInactive > 0) out.push('', `${result.excludedInactive} stale or retired lesson(s) not considered; pass --all to include them.`)
  return out.join('\n')
}

const USAGE = `Usage: lessons.mjs [--query "<words>"] [--paths a,b] [path ...] [--all] [--limit n] [--json] [--cwd <dir>]

Find the lessons under memory/lessons/ that match a task. Paths may be given as
a comma or space separated --paths value, or as bare arguments. With no query
and no paths, list the active lessons. Read-only. Exits 0 when it ran; 2 on a
usage error.
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
  const result = findLessons(root, { query: values.query, paths, includeInactive: values.all, limit })
  emit(result, renderLessonsText(result), { json: values.json })
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
