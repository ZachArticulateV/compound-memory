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

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { runGit } from './git.mjs'
import { isFile } from './fs-utils.mjs'

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

/**
 * Changed lines per file, as a multiset of "+text" / "-text" keys. Comparing
 * lines rather than hunks keeps the answer stable when a later edit merges
 * into a neighbouring hunk.
 */
export function changedLines(patch) {
  const files = new Map()
  let current = null
  for (const line of patch.split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
    if (header) {
      current = header[2]
      if (!files.has(current)) files.set(current, new Map())
      continue
    }
    if (current === null || line.startsWith('+++') || line.startsWith('---')) continue
    if ((line.startsWith('+') || line.startsWith('-')) && line.length > 0) {
      const bag = files.get(current)
      bag.set(line, (bag.get(line) ?? 0) + 1)
    }
  }
  return files
}

/** Staged and unstaged changed lines, per file. */
export function indexState(root, { paths = [] } = {}) {
  const head = headOf(root)
  const staged = git(root, ['diff', '--cached', '--no-ext-diff', '--no-color', '-U0', ...(head === null ? [EMPTY_TREE] : []), '--', ...pathspec(paths)])
  const unstaged = git(root, ['diff', '--no-ext-diff', '--no-color', '-U0', '--', ...pathspec(paths)])
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...pathspec(paths)])
  if (!staged.ok || !unstaged.ok || !untracked.ok) return { ok: false, error: (staged.error ?? unstaged.error ?? untracked.error) || 'git failed' }
  return { ok: true, staged: changedLines(staged.stdout), unstaged: changedLines(unstaged.stdout), untracked: nulList(untracked.stdout) }
}

const toObject = (files) => Object.fromEntries([...files].map(([f, bag]) => [f, Object.fromEntries(bag)]))
export const fromObject = (obj) => new Map(Object.entries(obj ?? {}).map(([f, bag]) => [f, new Map(Object.entries(bag))]))

/** What is staged right now, in a form that can be saved and compared later. */
export function stagedSnapshot(root) {
  const state = indexState(root)
  if (!state.ok) return state
  return { ok: true, head: headOf(root), staged: toObject(state.staged) }
}

/** Lines staged before the work began that are still staged now. */
export function stillStaged(before, now) {
  const out = []
  for (const [file, bag] of before) {
    const current = now.get(file)
    if (!current) continue
    let count = 0
    for (const [key, n] of bag) count += Math.min(n, current.get(key) ?? 0)
    if (count > 0) out.push({ file, lines: count })
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

/**
 * The version of the code a check ran against: HEAD plus every uncommitted
 * change (staged, unstaged, and new files) under the given paths. Two runs
 * with the same fingerprint saw the same files.
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
  const spec = pathspec(paths)
  const diff = git(root, ['diff', '--no-ext-diff', '--no-color', '--binary', head ?? EMPTY_TREE, '--', ...spec])
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...spec])
  if (!diff.ok || !untracked.ok) return { ok: false, error: diff.error ?? untracked.error ?? 'git failed' }
  // With no paths, HEAD pins the committed code. With paths, a commit outside
  // them must not count as a change, so the scoped tree stands in for HEAD.
  if (paths.length === 0 || head === null) hash.update(`${head ?? 'no-commits'}\0`)
  else {
    const tree = git(root, ['ls-tree', '-r', head, '--', ...paths])
    hash.update(tree.ok ? tree.stdout : '')
  }
  hash.update(diff.stdout)
  const newFiles = nulList(untracked.stdout).sort()
  for (const f of newFiles) {
    hash.update(`\0new:${f}\0`)
    const abs = join(root, ...f.split('/'))
    if (isFile(abs)) {
      try {
        hash.update(readFileSync(abs))
      } catch {
        /* unreadable: its name still counts */
      }
    }
  }
  const dirty = diff.stdout.trim() !== '' || newFiles.length > 0
  const fingerprint = hash.digest('hex').slice(0, 16)
  return { ok: true, git: true, head, branch: branchOf(root), dirty, paths, fingerprint }
}

/** True when `.verify/` is ignored, so run output cannot be committed by accident. */
export function scratchIgnored(root) {
  if (!isGitCheckout(root)) return null
  return git(root, ['check-ignore', '-q', `${SCRATCH_DIR}/x`]).ok
}
