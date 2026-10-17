// The cleanup mode: contradictions, inaccuracies, and rot.
//
// The playbook is instruction, so these tests pin the sentences that carry
// its guarantees -- nothing is written before the user agrees, the pass is
// never presented as independent, history is archived or superseded rather
// than deleted -- and check that the playbook and the rot script agree on
// which signals exist.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { SIGNALS } from '../scripts/memory-hygiene.mjs'
import { AUDIT_CLASSIFICATIONS } from '../scripts/auditor-bridge.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const raw = readFileSync(join(repoRoot, 'skills', 'project-memory', 'references', 'cleanup.md'), 'utf8')
const cleanup = raw.replace(/\s+/g, ' ')

test('the playbook names every rot signal the script raises, and no other', () => {
  for (const id of SIGNALS) assert.ok(raw.includes(`\`${id}\``), `cleanup.md never names the ${id} signal`)
  const named = new Set([...raw.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((m) => m[1]))
  const signalShaped = [...named].filter((n) => /^(completed|resolved|duplicated|diverging|stale|journal|unreachable|startup)-/.test(n))
  assert.deepEqual(signalShaped.sort(), [...SIGNALS].sort())
})

test('the playbook classifies with the shared taxonomy and does not restate it', () => {
  assert.ok(cleanup.includes('evidence-policy.md'))
  for (const c of AUDIT_CLASSIFICATIONS) assert.ok(raw.includes(`\`${c}\``), `cleanup.md never names ${c}`)
  assert.doesNotMatch(raw, /\| Classification \| Means \|/, 'cleanup.md restates the taxonomy table')
})

test('signals are confirmed by reading, never acted on directly', () => {
  assert.match(cleanup, /These are where the review starts, not the review/)
  assert.match(cleanup, /Every signal is confirmed by reading the files it names before it becomes a finding/)
})

test('cleanup reads the whole tree but keeps its ledger out of memory', () => {
  assert.match(cleanup, /Read every file under `memory\/` except `archive\/`/)
  assert.match(cleanup, /Keep the ledger in your working notes, never under `memory\/`/)
})

test('contradictions are settled by evidence, and unsettled ones go to the user', () => {
  assert.match(cleanup, /The repository settles a contradiction, not the file that sounds more sure/)
  assert.match(cleanup, /`CONFLICTING`/)
})

test('the accuracy pass is never presented as an independent audit', () => {
  assert.match(cleanup, /Cleanup's accuracy pass is thorough, not independent/)
  assert.match(cleanup, /an unrun suite is `UNVERIFIABLE`, never `VALID`/)
  assert.match(cleanup, /recommend `audit`/)
})

test('nothing is written before the user accepts the plan', () => {
  assert.match(cleanup, /Nothing is written before that answer/)
  const plan = raw.indexOf('## 6. Present the plan, then stop')
  const apply = raw.indexOf('## 7. Apply what was accepted')
  assert.ok(plan !== -1 && apply > plan, 'the plan must come before any write')
})

test('history is archived or superseded, never deleted or rewritten', () => {
  assert.match(cleanup, /A decision record is never edited/)
  assert.match(cleanup, /moves to `archive\/`\. It is not deleted/)
  assert.match(cleanup, /`project-brief\.md`, which is frozen/)
  assert.match(cleanup, /Leaving two copies of a claim after resolving a duplicate/)
})

test('fixes resolve to the shared ownership table', () => {
  assert.match(cleanup, /Which artifact owns a fact/)
  const schema = readFileSync(join(repoRoot, 'skills', 'project-memory', 'references', 'memory-schema.md'), 'utf8')
  assert.match(schema, /^## Which artifact owns a fact$/m)
})

test('cleanup converges and does not churn', () => {
  assert.match(cleanup, /A second cleanup on an unchanged tree should find nothing new/)
  assert.match(cleanup, /Do not refresh `Updated:` dates/)
  assert.match(cleanup, /Structural validation is not semantic correctness/)
})
