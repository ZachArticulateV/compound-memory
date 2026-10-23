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

/** The skills chosen for adoption, plus Compound Engineering's loop. */
const REQUIRED = {
  'mattpocock/skills': ['writing-for-agents', 'to-tickets', 'code-review', 'prototype', 'retro'],
  'cursor/plugins (pstack)': [
    'create-verification-skill', 'correct', 'recall', 'technical-writing', 'automate-me', 'ketchup',
    'principle-prove-it-works', 'principle-encode-lessons-in-structure',
  ],
  'EveryInc/compound-engineering-plugin': [
    'ce-brainstorm', 'ce-plan', 'ce-work', 'ce-simplify-code', 'ce-code-review', 'ce-compound',
    'ce-compound-refresh', 'ce-debug', 'ce-pov', 'ce-optimize', 'lfg',
  ],
}

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
