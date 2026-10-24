// The coverage map says where each upstream skill now lives. These tests keep
// it honest: every target exists, every skill chosen for adoption is
// mapped, and every rejection says why.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const coverage = readFileSync(join(repoRoot, 'docs', 'coverage.md'), 'utf8')

/** Rows of every coverage table: { source, upstream, here, note }. */
function rows() {
  const out = []
  let source = null
  for (const line of coverage.split('\n')) {
    const heading = /^## (.+)$/.exec(line)
    if (heading) source = heading[1].trim()
    const cells = /^\| `([^`]+)` \| (.+?) \| (.*?) \|$/.exec(line)
    if (cells && source) out.push({ source, upstream: cells[1], here: cells[2].trim(), note: cells[3].trim() })
  }
  return out
}

/**
 * Every upstream skill this plugin replaces. Each must have an adopted row, so
 * a user who installs the plugin needs none of these.
 */
const REQUIRED = {
  'mattpocock/skills': [
    'writing-for-agents', 'to-tickets', 'code-review', 'prototype', 'retro', 'tdd', 'diagnosing-bugs',
    'implement', 'to-spec', 'pr', 'handoff', 'grilling', 'grill-with-docs', 'domain-modeling', 'wait-what',
  ],
  'cursor/plugins (pstack)': [
    'create-verification-skill', 'maintain-verification-skill', 'principle-prove-it-works', 'correct',
    'principle-encode-lessons-in-structure', 'recall', 'ketchup', 'technical-writing', 'automate-me', 'unslop',
    'principle-fix-root-causes',
  ],
  'EveryInc/compound-engineering-plugin': [
    'ce-brainstorm', 'ce-plan', 'ce-work', 'ce-simplify-code', 'ce-code-review', 'ce-doc-review', 'ce-compound',
    'ce-compound-refresh', 'ce-debug', 'ce-pov', 'ce-optimize', 'ce-prototype', 'ce-commit', 'ce-commit-push-pr',
    'ce-babysit-pr', 'ce-resolve-pr-feedback', 'lfg', 'ce-handoff', 'ce-noslop', 'wtf', 'ce-test-browser',
    'ce-worktree',
  ],
}

/** The dated parity review the coverage map cites. */
const REVIEW = /`(docs\/benchmark\/parity-\d{4}-\d{2}-\d{2}\.md)`/.exec(coverage)?.[1]

test('the coverage map has rows for all three upstreams', () => {
  const sources = new Set(rows().map((r) => r.source))
  for (const source of Object.keys(REQUIRED)) assert.ok(sources.has(source), `no section for ${source}`)
})

test('every skill chosen for adoption is adopted somewhere', () => {
  const all = rows()
  for (const [source, names] of Object.entries(REQUIRED)) {
    for (const name of names) {
      const adopted = all.filter((r) => r.source === source && r.upstream === name && r.here !== 'not adopted')
      assert.ok(adopted.length > 0, `${source} ${name} has no adopted row`)
    }
  }
})

test('every target in the Here column exists', () => {
  for (const row of rows()) {
    if (row.here === 'not adopted') continue
    const target = /^`([^`]+)`$/.exec(row.here)?.[1]
    assert.ok(target, `${row.upstream}: the Here cell must be one backticked target or "not adopted"`)
    if (target.startsWith('references/')) {
      assert.ok(existsSync(join(repoRoot, target)), `${row.upstream} maps to ${target}, which does not exist`)
      continue
    }
    const [skill, mode] = target.split(' ')
    assert.ok(existsSync(join(repoRoot, 'skills', skill, 'SKILL.md')), `${row.upstream} maps to skill ${skill}, which does not exist`)
    if (mode) {
      assert.ok(
        existsSync(join(repoRoot, 'skills', skill, 'references', `${mode}.md`)),
        `${row.upstream} maps to ${skill} ${mode}, which has no reference`
      )
    }
  }
})

test('every rejection gives its reason', () => {
  for (const row of rows().filter((r) => r.here === 'not adopted')) {
    assert.ok(row.note.length > 20, `${row.upstream} is not adopted with no reason given`)
  }
})

test('the coverage map cites a dated parity review that covers every required skill', () => {
  assert.ok(REVIEW, 'docs/coverage.md names no docs/benchmark/parity-YYYY-MM-DD.md')
  assert.ok(existsSync(join(repoRoot, REVIEW)), `${REVIEW} does not exist`)
  const review = readFileSync(join(repoRoot, REVIEW), 'utf8')
  for (const [source, names] of Object.entries(REQUIRED)) {
    assert.ok(review.includes(`## ${source}`), `${REVIEW} has no section for ${source}`)
    for (const name of names) assert.ok(review.includes(`### \`${name}\``), `${REVIEW} has no entry for ${name}`)
  }
})
