// The working state of a checkout, as the engineering scripts need it.
//
// Three questions, each a fact Git can answer and a model gets wrong when it
// answers from memory:
//
//   - What is the full change under review? Committed since the base, staged,
//     unstaged, and new files. `git diff <base>...HEAD` sees only the first, so
//     a review of uncommitted work reviewed nothing (2026-10-21 audit).
//   - Which changed lines sit in the index right now? A commit takes the index,
//     not the files the agent meant, so staged work that belongs to someone
//     else rides along unless something looks.
//   - Which version of the code did a check run against? A fingerprint of HEAD
//     plus every uncommitted change, so a result can be compared with the code
//     as it is now.
//
// Every Git call goes through runGit (array argv, never throws). `.verify/` is
// left out of every answer: it holds this plugin's own run output.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { runGit } from './git.mjs'

export const SCRATCH_DIR = '.verify'
/** Git's empty tree: the base for a repository with no commits. */
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const EXCLUDE_SCRATCH = `:(exclude)${SCRATCH_DIR}`

const git = (root, args) => runGit(['-c', 'core.quotepath=false', ...args], { cwd: root })
const lines = (text) => text.split(/\r?\n/).filter((l) => l !== '')
const nulList = (text) => text.split('\0').filter((l) => l !== '').map((p) => p.split('\\').join('/'))

/** Pathspec for a set of repository-relative paths, always without `.verify/`. */
export function pathspec(paths = []) {
  const clean = paths.map((p) => p.replace(/\\/g, '/').replace(/^\.\//, '')).filter(Boolean)
  return [...(clean.length > 0 ? clean : ['.']), EXCLUDE_SCRATCH]
}

/** True when a changed path falls under a declared path (a file or a directory prefix). */
export function underPath(declared, changed) {
  const d = declared.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
  if (d === '' || d === '.') return true
  return changed === d || changed.startsWith(`${d}/`)
}

export function isGitCheckout(root) {
  return git(root, ['rev-parse', '--is-inside-work-tree']).ok
}

export function headOf(root) {
  const res = git(root, ['rev-parse', '--verify', '-q', 'HEAD'])
  return res.ok ? res.stdout.trim() || null : null
}

export function branchOf(root) {
  const res = git(root, ['branch', '--show-current'])
  return res.ok ? res.stdout.trim() || null : null
}

const resolveRef = (root, ref) => {
  const res = git(root, ['rev-parse', '--verify', '-q', `${ref}^{commit}`])
  return res.ok ? res.stdout.trim() || null : null
}

/** The repository's default branch as a ref name, or null when nothing names one. */
export function defaultBranch(root) {
  const remoteHead = git(root, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'])
  if (remoteHead.ok && remoteHead.stdout.trim()) return remoteHead.stdout.trim()
  for (const name of ['main', 'master', 'trunk', 'origin/main', 'origin/master']) {
    if (resolveRef(root, name)) return name
  }
  return null
}

/**
 * The point a review compares against.
 *
 * An explicit ref is used as given (its merge base with HEAD, so a moved base
 * branch does not drag its own commits in). Otherwise the merge base with the
 * default branch; on the default branch itself, the upstream when there is one
 * (unpushed commits), else HEAD (uncommitted work only).
 */
export function reviewBase(root, ref = null) {
  const head = headOf(root)
  if (head === null) return { ok: true, sha: EMPTY_TREE, ref: null, how: 'no commits yet: everything is new' }
  if (ref) {
    const sha = resolveRef(root, ref)
    if (!sha) return { ok: false, error: `the base "${ref}" does not resolve to a commit` }
    const mb = git(root, ['merge-base', head, sha])
    return { ok: true, sha: mb.ok ? mb.stdout.trim() : sha, ref, how: `merge base with ${ref}` }
  }
  const branch = branchOf(root)
  const def = defaultBranch(root)
  const onDefault = def !== null && branch !== null && (def === branch || def.endsWith(`/${branch}`))
  if (def !== null && !onDefault) {
    const mb = git(root, ['merge-base', head, def])
    if (mb.ok && mb.stdout.trim()) return { ok: true, sha: mb.stdout.trim(), ref: def, how: `merge base with the default branch ${def}` }
  }
  const upstream = resolveRef(root, '@{upstream}')
  if (upstream) {
    const mb = git(root, ['merge-base', head, upstream])
    if (mb.ok && mb.stdout.trim()) return { ok: true, sha: mb.stdout.trim(), ref: '@{upstream}', how: 'merge base with the upstream branch' }
  }
  return { ok: true, sha: head, ref: 'HEAD', how: def === null ? 'no default branch found: uncommitted work only' : 'on the default branch: uncommitted work only' }
}

const nameStatus = (text) =>
  lines(text).map((line) => {
    const [status, ...paths] = line.split('\t')
    return { status: status[0], path: paths[paths.length - 1].split('\\').join('/') }
  })

/** Every change in scope, by where it lives. */
export function changeSets(root, { base, paths = [] } = {}) {
  const spec = pathspec(paths)
  const head = headOf(root)
  const committed = head !== null && base !== head
    ? git(root, ['diff', '--name-status', '--no-renames', base, head, '--', ...spec])
    : { ok: true, stdout: '' }
  const staged = git(root, ['diff', '--cached', '--name-status', '--no-renames', ...(head === null ? [EMPTY_TREE] : []), '--', ...spec])
  const unstaged = git(root, ['diff', '--name-status', '--no-renames', '--', ...spec])
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...spec])
  const commits = head !== null && base !== head && base !== EMPTY_TREE
    ? git(root, ['log', '--format=%h %s', `${base}..${head}`])
    : head !== null && base === EMPTY_TREE
      ? git(root, ['log', '--format=%h %s', head])
      : { ok: true, stdout: '' }
  const failed = [committed, staged, unstaged, untracked, commits].find((r) => !r.ok)
  if (failed) return { ok: false, error: failed.error ?? 'git failed' }
  return {
    ok: true,
    committed: nameStatus(committed.stdout),
    staged: nameStatus(staged.stdout),
    unstaged: nameStatus(unstaged.stdout),
    untracked: nulList(untracked.stdout),
    commits: lines(commits.stdout),
  }
}

const isBinary = (buf) => buf.subarray(0, 8000).includes(0)

/** A new-file diff for an untracked file, written by hand so no platform path for /dev/null is involved. */
export function newFileDiff(root, rel) {
  const abs = join(root, ...rel.split('/'))
  let buf
  try {
    buf = readFileSync(abs)
  } catch {
    return ''
  }
  const head = `diff --git a/${rel} b/${rel}\nnew file mode 100644\n`
  if (isBinary(buf)) return `${head}Binary files /dev/null and b/${rel} differ\n`
  const text = buf.toString('utf8')
  if (text === '') return head
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  const rows = body.split(/\r?\n/)
  const tail = text.endsWith('\n') ? '' : '\n\\ No newline at end of file'
  return `${head}--- /dev/null\n+++ b/${rel}\n@@ -0,0 +1,${rows.length} @@\n${rows.map((r) => `+${r}`).join('\n')}${tail}\n`
}

/** The whole change as one patch: base to working tree for tracked files, plus every new file. */
export function fullDiff(root, { base, paths = [], untracked = [] } = {}) {
  const tracked = git(root, ['diff', '--no-ext-diff', '--no-color', base, '--', ...pathspec(paths)])
  if (!tracked.ok) return { ok: false, error: tracked.error }
  return { ok: true, patch: tracked.stdout + untracked.map((rel) => newFileDiff(root, rel)).join('') }
}

/** Flags every diff the scripts parse: fixed prefixes, whatever the user's diff config says. */
const DIFF_FLAGS = ['--no-ext-diff', '--no-color', '--src-prefix=a/', '--dst-prefix=b/']

/** `git diff --raw -z` records: path to { status, blob }. */
export function parseRaw(text) {
  const out = new Map()
  const parts = text.split('\0')
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const meta = parts[i].replace(/^\n/, '')
    if (!meta.startsWith(':')) break
    const [, , , dst, status] = meta.slice(1).split(' ')
    out.set(parts[i + 1].split('\\').join('/'), { status: status[0], blob: dst })
  }
  return out
}

/**
 * Hunks of a zero-context diff, keyed by their position in the old file and
 * their changed lines. Both the snapshot and the later check diff the index
 * against HEAD, so a hunk keeps its key while other hunks come and go, and a
 * common line (`}`) in two different hunks is not mistaken for the same change.
 */
export function hunkKeys(patch) {
  const keys = []
  let current = null
  for (const line of patch.split(/\r?\n/)) {
    const h = /^@@ -(\d+(?:,\d+)?) \+\d+(?:,\d+)? @@/.exec(line)
    if (h) {
      current = { at: h[1], body: [] }
      keys.push(current)
      continue
    }
    if (current !== null && (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) current.body.push(line)
  }
  return keys.map((k) => `${k.at}|${k.body.join('\n')}`)
}

/**
 * The index against HEAD, per path: status, staged blob, and hunks; plus the
 * paths with unstaged changes and the untracked files. Paths come from
 * NUL-separated output, so spaces and odd characters are safe.
 */
export function indexState(root, { paths = [] } = {}) {
  const head = headOf(root)
  const against = head === null ? [EMPTY_TREE] : []
  const raw = git(root, ['diff', '--cached', '--raw', '--no-renames', '--no-abbrev', '-z', ...against, '--', ...pathspec(paths)])
  const unstaged = git(root, ['diff', '--name-only', '--no-renames', '-z', '--', ...pathspec(paths)])
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...pathspec(paths)])
  if (!raw.ok || !unstaged.ok || !untracked.ok) return { ok: false, error: (raw.error ?? unstaged.error ?? untracked.error) || 'git failed' }
  const staged = new Map()
  for (const [path, entry] of parseRaw(raw.stdout)) {
    const diff = git(root, ['diff', '--cached', ...DIFF_FLAGS, '-U0', ...against, '--', path])
    staged.set(path, { ...entry, hunks: diff.ok ? hunkKeys(diff.stdout) : [] })
  }
  return { ok: true, staged, unstaged: new Set(nulList(unstaged.stdout)), untracked: nulList(untracked.stdout) }
}

/**
 * The working tree's own changes before any work began: for each tracked file
 * with unstaged edits, its hunks against HEAD that are not already staged; for
 * each untracked file, its blob. A later commit that stages one of these
 * unchanged is committing someone else's edit.
 */
export function workingTreeState(root, state) {
  const head = headOf(root)
  const against = head === null ? [EMPTY_TREE] : ['HEAD']
  const unstaged = {}
  for (const path of state.unstaged) {
    const diff = git(root, ['diff', ...DIFF_FLAGS, '-U0', ...against, '--', path])
    const already = state.staged.get(path)?.hunks ?? []
    const hunks = diff.ok ? hunkKeys(diff.stdout).filter((k) => !already.includes(k)) : []
    if (hunks.length > 0) unstaged[path] = { hunks }
  }
  const untracked = {}
  for (const path of state.untracked) {
    const blob = git(root, ['hash-object', '--', path])
    if (blob.ok) untracked[path] = blob.stdout.trim()
  }
  return { unstaged, untracked }
}

/** What is staged right now, and what the working tree already held, in a form that can be saved and compared later. */
export function stagedSnapshot(root) {
  const state = indexState(root)
  if (!state.ok) return state
  return { ok: true, head: headOf(root), staged: Object.fromEntries(state.staged), ...workingTreeState(root, state) }
}

/**
 * Edits that were in the working tree, unstaged, before the snapshot and are
 * now staged unchanged: a hunk at the same place with the same lines, or a
 * then-untracked file staged with the same content.
 */
export function stagedFromWorkingTree(before, now) {
  const out = []
  for (const [file, was] of Object.entries(before.unstaged ?? {})) {
    const cur = now.get(file)
    if (!cur) continue
    const taken = was.hunks.filter((k) => cur.hunks.includes(k)).length
    if (taken > 0) out.push({ file, whole: false, hunks: taken })
  }
  for (const [file, blob] of Object.entries(before.untracked ?? {})) {
    const cur = now.get(file)
    if (cur && cur.blob === blob) out.push({ file, whole: true })
  }
  return out
}

export const fromObject = (obj) => new Map(Object.entries(obj ?? {}))

/**
 * Work staged before the snapshot that is still staged now: a path whose
 * staged blob is exactly as it was (this covers binary files, deletions,
 * renames, and empty files, which have no changed lines), or a hunk that is
 * still in the index at the same place.
 */
export function stillStaged(before, now) {
  const out = []
  for (const [file, was] of before) {
    const cur = now.get(file)
    if (!cur) continue
    if (cur.status === was.status && cur.blob === was.blob) {
      out.push({ file, whole: true })
      continue
    }
    const kept = (was.hunks ?? []).filter((k) => cur.hunks.includes(k)).length
    if (kept > 0) out.push({ file, whole: false, hunks: kept })
  }
  return out
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

const WALK_SKIP = new Set(['.git', 'node_modules', SCRATCH_DIR, '.next', 'dist', 'build', '.venv', '__pycache__'])

function walk(root, rel = '', out = []) {
  let entries = []
  try {
    entries = readdirSync(join(root, ...rel.split('/').filter(Boolean)), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (!WALK_SKIP.has(e.name)) walk(root, child, out)
    } else if (e.isFile()) out.push(child)
  }
  return out
}

/** Run git with extra environment (a temporary index); never throws. */
function gitWith(root, args, env) {
  try {
    const stdout = execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 60_000,
    })
    return { ok: true, stdout }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * The tree the working files would make if every change were committed: the
 * real index copied to a temporary one, every change under the paths added to
 * it, and the tree written. The real index is never touched. Content decides
 * the answer, so committing unchanged files does not change it.
 */
export function workingTree(root, { paths = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cm-index-'))
  const env = { GIT_INDEX_FILE: join(dir, 'index') }
  try {
    const where = git(root, ['rev-parse', '--git-path', 'index'])
    const realIndex = where.ok ? resolve(root, where.stdout.trim()) : null
    if (realIndex !== null && existsSync(realIndex)) {
      copyFileSync(realIndex, env.GIT_INDEX_FILE)
      // Git trusts a file's stat data only when the file is older than the
      // index. A copy stamped "now" would make an edit made in the same
      // second as the last index write look unchanged, so the copy keeps the
      // original's times.
      const st = statSync(realIndex)
      utimesSync(env.GIT_INDEX_FILE, st.atime, st.mtime)
    }
    // `git add` refuses a pathspec that names an ignored path, so the
    // `.verify/` exclusion is passed only when Git does not already ignore it.
    const spec = scratchIgnored(root) ? pathspec(paths).filter((p) => p !== EXCLUDE_SCRATCH) : pathspec(paths)
    const add = gitWith(root, ['add', '-A', '--', ...spec], env)
    if (!add.ok) return { ok: false, error: add.error }
    const tree = gitWith(root, ['write-tree'], env)
    return tree.ok ? { ok: true, tree: tree.stdout.trim() } : { ok: false, error: tree.error }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The version of the code a check ran against: the content of every tracked
 * and new file under the given paths (staged, unstaged, or committed alike).
 * Two runs with the same fingerprint saw the same files. Files Git ignores
 * (`.env`, build output) are not part of it, and neither is `.verify/`.
 *
 * Without Git, the fingerprint hashes the files themselves.
 */
export function codeFingerprint(root, { paths = [] } = {}) {
  const hash = createHash('sha256')
  if (!isGitCheckout(root)) {
    const files = walk(root).filter((f) => paths.length === 0 || paths.some((p) => underPath(p, f)))
    for (const f of files) {
      hash.update(`${f}\0`)
      try {
        hash.update(readFileSync(join(root, ...f.split('/'))))
      } catch {
        /* unreadable: its name still counts */
      }
    }
    return { ok: true, git: false, head: null, branch: null, dirty: null, paths, fingerprint: hash.digest('hex').slice(0, 16) }
  }
  const head = headOf(root)
  const work = workingTree(root, { paths })
  if (!work.ok) return { ok: false, error: work.error }
  const scoped = (tree) => {
    if (tree === null) return ''
    if (paths.length === 0) return tree
    const res = git(root, ['ls-tree', '-r', tree, '--', ...paths])
    return res.ok ? res.stdout : ''
  }
  const headTree = head === null ? null : git(root, ['rev-parse', `${head}^{tree}`]).stdout.trim()
  const now = scoped(work.tree)
  hash.update(now)
  return { ok: true, git: true, head, branch: branchOf(root), dirty: now !== scoped(headTree), paths, fingerprint: hash.digest('hex').slice(0, 16) }
}

/** True when `.verify/` is ignored, so run output cannot be committed by accident. */
export function scratchIgnored(root) {
  if (!isGitCheckout(root)) return null
  return git(root, ['check-ignore', '-q', `${SCRATCH_DIR}/x`]).ok
}
