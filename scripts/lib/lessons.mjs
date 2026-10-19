// The lesson model: how a file under memory/lessons/ is read, checked, and
// matched to a task.
//
// One reader serves the validator and the lookup script, so a lesson the
// validator accepts is a lesson lookup can find. The reader accepts both YAML
// list styles (`tags: [a, b]` and a `- a` block) because a hand-edited lesson
// should still be found; the validator then asks for the bracket style, which
// the flat frontmatter parser shared with the rest of memory can read.
//
// Compound Engineering's learnings store showed why this is code: its prompt
// told agents to grep `tags:.*kw`, which never matches a block-list tag, and
// four copies of that prompt drifted apart. Here there is one matcher.

import { MEMORY_DIRNAME, parseSections } from './memory-model.mjs'

export const LESSONS_DIRNAME = 'lessons'
export const LESSONS_REL = `${MEMORY_DIRNAME}/${LESSONS_DIRNAME}`
export const LESSON_STATUSES = ['active', 'stale', 'retired']
export const LESSON_REQUIRED_FIELDS = ['title', 'tags', 'applies_when', 'status']
export const LESSON_REQUIRED_SECTION = 'Do this'

const LIST_FIELDS = new Set(['tags', 'paths'])

/** True for a repository-relative path inside memory/lessons/. */
export const isLessonPath = (rel) => rel.startsWith(`${LESSONS_REL}/`) && rel.endsWith('.md')

function unquote(value) {
  return value.trim().replace(/^["'](.*)["']$/, '$1')
}

/** `[a, "b c"]` to ['a', 'b c']; a bare scalar to a one-item list. */
export function parseInlineList(raw) {
  const value = raw.trim()
  if (value === '') return []
  const inner = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
  return inner
    .split(',')
    .map(unquote)
    .filter((item) => item !== '')
}

/**
 * Read a lesson's frontmatter. Never throws.
 *
 * Returns { present, data, listStyle, error }. `listStyle` records, per list
 * field, whether the file used brackets or a block, so the validator can ask
 * for brackets without lookup ever missing a block-style lesson.
 */
export function readLessonFrontmatter(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { present: false, data: {}, listStyle: {}, error: null }
  const end = lines.findIndex((line, i) => i > 0 && (line.trim() === '---' || line.trim() === '...'))
  if (end === -1) return { present: true, data: {}, listStyle: {}, error: 'frontmatter block is never closed' }

  const data = {}
  const listStyle = {}
  let openList = null
  for (let i = 1; i < end; i += 1) {
    const raw = lines[i]
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue
    // Indented or not: both are valid YAML block lists.
    const item = /^\s*-\s+(.*)$/.exec(raw)
    if (item !== null && openList !== null) {
      data[openList].push(unquote(item[1]))
      continue
    }
    const pair = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(raw)
    if (pair === null) return { present: true, data, listStyle, error: `line ${i + 1}: not a "key: value" pair` }
    const [, key, value] = pair
    openList = null
    if (LIST_FIELDS.has(key)) {
      if (value.trim() === '') {
        data[key] = []
        listStyle[key] = 'block'
        openList = key
      } else {
        data[key] = parseInlineList(value)
        listStyle[key] = value.trim().startsWith('[') ? 'inline' : 'scalar'
      }
    } else {
      data[key] = unquote(value)
    }
  }
  return { present: true, data, listStyle, error: null }
}

/** Parse one lesson file into the shape lookup and the validator share. */
export function parseLesson(rel, text) {
  const fm = readLessonFrontmatter(text)
  const sections = parseSections(text)
  const title = fm.data.title || sections.find((s) => s.level === 1)?.title || rel
  return {
    path: rel,
    title,
    tags: fm.data.tags ?? [],
    paths: fm.data.paths ?? [],
    appliesWhen: fm.data.applies_when ?? '',
    status: (fm.data.status ?? 'active').toLowerCase(),
    created: fm.data.created ?? null,
    updated: fm.data.updated ?? null,
    retireWhen: fm.data.retire_when ?? null,
    body: text,
    frontmatter: fm,
    sections,
  }
}

/**
 * Format problems in one lesson, as plain messages. Empty when it is well
 * formed. Structure only: whether the lesson is true is not checkable here.
 */
export function lessonProblems(lesson) {
  const { frontmatter: fm } = lesson
  if (!fm.present) return ['no frontmatter; a lesson needs title, tags, applies_when, and status']
  if (fm.error !== null) return [`frontmatter: ${fm.error}`]
  const problems = []
  for (const field of LESSON_REQUIRED_FIELDS) {
    const value = fm.data[field]
    const empty = Array.isArray(value) ? value.length === 0 : (value ?? '').trim() === ''
    if (empty) problems.push(`missing ${field}`)
  }
  for (const field of LIST_FIELDS) {
    if (fm.listStyle[field] === 'block') {
      problems.push(`${field} is a block list; write it as [a, b] so every reader parses it`)
    }
  }
  if (fm.data.status !== undefined && !LESSON_STATUSES.includes(fm.data.status.toLowerCase())) {
    problems.push(`status "${fm.data.status}" is not one of ${LESSON_STATUSES.join(', ')}`)
  }
  if (!lesson.sections.some((s) => s.level === 2 && s.title.toLowerCase() === LESSON_REQUIRED_SECTION.toLowerCase())) {
    problems.push(`no "## ${LESSON_REQUIRED_SECTION}" section`)
  }
  return problems
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'an', 'as', 'at', 'be', 'by', 'do', 'if', 'in', 'is', 'it', 'of', 'on', 'or', 'so',
  'to', 'up', 'we', 'my', 'no', 'me',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'what', 'how', 'why',
  'are', 'was', 'were', 'has', 'have', 'not', 'but', 'our', 'your', 'its', 'can', 'use',
  'add', 'fix', 'make', 'change', 'update',
])

/**
 * Lowercase word tokens, hyphens and slashes split. Two letters is enough
 * (`ci`, `db`, `ui` are real tags); the stopword list drops the short words
 * that carry nothing.
 */
export function tokenize(text) {
  return (text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word))
}

/**
 * The forms a word may stand for: itself, its singular, and its stem without
 * -ing or -ed (with and without a restored final e). Two words match when their
 * form sets meet, so "retry" meets "retries", "file" meets "files", and
 * "parse" meets "parsing", while "red" and "ring" stay themselves.
 */
export function wordForms(word) {
  const forms = new Set([word])
  const add = (form) => form.length >= 3 && forms.add(form)
  if (word.endsWith('ies') && word.length > 4) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('es') && word.length > 4) {
    add(word.slice(0, -1))
    add(word.slice(0, -2))
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) add(word.slice(0, -1))
  if (word.endsWith('ing') && word.length >= 6) {
    add(word.slice(0, -3))
    add(`${word.slice(0, -3)}e`)
  }
  if (word.endsWith('ed') && word.length >= 5) {
    add(word.slice(0, -2))
    add(word.slice(0, -1))
  }
  return forms
}

function overlap(queryWords, words) {
  const pool = new Set(words.flatMap((w) => [...wordForms(w)]))
  return [...queryWords].filter((q) => [...wordForms(q)].some((form) => pool.has(form)))
}

const normalizePath = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')

/** A changed path matches a lesson path when either contains the other as a prefix. */
export function pathMatches(lessonPath, changedPath) {
  const a = normalizePath(lessonPath)
  const b = normalizePath(changedPath)
  if (a === '' || b === '') return false
  return b === a || b.startsWith(`${a}/`) || a.startsWith(`${b}/`)
}

/**
 * Score one lesson against a query and a set of changed paths.
 *
 * Weights favor what a lesson's author chose to say it is about (title, tags,
 * applies_when, paths) over incidental body words.
 */
export function scoreLesson(lesson, { query = '', paths = [] } = {}) {
  const queryWords = new Set(tokenize(query))
  const matched = {
    title: overlap(queryWords, tokenize(lesson.title)),
    tags: overlap(queryWords, lesson.tags.flatMap(tokenize)),
    appliesWhen: overlap(queryWords, tokenize(lesson.appliesWhen)),
    body: overlap(queryWords, tokenize(lesson.body)),
    paths: lesson.paths.filter((lp) => paths.some((cp) => pathMatches(lp, cp))),
  }
  const score =
    3 * matched.title.length +
    3 * matched.tags.length +
    2 * matched.appliesWhen.length +
    Math.min(3, matched.body.length) +
    4 * matched.paths.length
  return { score, matched }
}

/**
 * Rank lessons for a task. Stale and retired lessons are left out unless
 * `includeInactive` is set, and the count left out is returned so a caller can
 * say what it did not show.
 */
export function rankLessons(lessons, { query = '', paths = [], includeInactive = false, limit = 5 } = {}) {
  const inactive = lessons.filter((l) => l.status !== 'active')
  const pool = includeInactive ? lessons : lessons.filter((l) => l.status === 'active')
  // Browse only when nothing was asked. A query of stopwords alone matches
  // nothing rather than everything.
  const browsing = query.trim() === '' && paths.length === 0
  const scored = pool
    .map((lesson) => ({ lesson, ...scoreLesson(lesson, { query, paths }) }))
    .filter((entry) => browsing || entry.score > 0)
    .sort((a, b) => b.score - a.score || a.lesson.path.localeCompare(b.lesson.path))
  return {
    results: limit > 0 ? scored.slice(0, limit) : scored,
    total: scored.length,
    excludedInactive: includeInactive ? 0 : inactive.length,
  }
}
