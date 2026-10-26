// These are catalog and grader checks, not evidence of live model routing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const shortcuts = ['handoff', 'sync', 'grill', 'cleanup', 'repair']

test('shortcuts load one shared playbook and stay explicit on both hosts', () => {
  for (const mode of shortcuts) {
    const text = read(`skills/${mode}/SKILL.md`)
    assert.match(text, /^disable-model-invocation:[ \t]*true$/m)
    assert.match(read(`skills/${mode}/agents/openai.yaml`), /allow_implicit_invocation:[ \t]*false/)
    const playbooks = [...text.matchAll(/\.\.\/project-memory\/references\/([a-z-]+)\.md/g)]
    assert.deepEqual([...new Set(playbooks.map((m) => m[1]))], [mode])
    assert.ok(existsSync(resolve(root, `skills/project-memory/references/${mode}.md`)))
    assert.match(text, /canonical base/i)
    assert.match(text, /project-state\.mjs/)
    assert.match(text, /Keep `\$\{CLAUDE_SKILL_DIR\}` bound to this shortcut's directory/)
    assert.doesNotMatch(text, /substitute the absolute project-memory skill/)
    const grant = /^allowed-tools:[ \t]*(.*)$/m.exec(text)?.[1] ?? ''
    for (const script of ['project-state', 'memory-validate', 'memory-hygiene']) {
      const command = `node "\${CLAUDE_SKILL_DIR}/../../scripts/${script}.mjs"`
      assert.ok(grant.includes(`Bash(${command} *)`))
      assert.ok(existsSync(resolve(root, `skills/${mode}/../../scripts/${script}.mjs`)))
    }
    const playbook = read(`skills/project-memory/references/${mode}.md`)
    for (const [, scriptPath] of playbook.matchAll(/^[ \t]*node "(\$\{CLAUDE_SKILL_DIR\}\/[^"\r\n]+)"/gm)) {
      assert.ok(grant.includes(`Bash(node "${scriptPath}" *)`), `${mode}: shared command must match the shortcut grant`)
      const fromShortcut = resolve(root, 'skills', mode, scriptPath.replace('${CLAUDE_SKILL_DIR}/', ''))
      const fromMemory = resolve(root, 'skills/project-memory', scriptPath.replace('${CLAUDE_SKILL_DIR}/', ''))
      assert.equal(fromShortcut, fromMemory, `${mode}: command must reach the same script`)
    }
    assert.doesNotMatch(text, /Skill\(|invoke .*project-memory/i)
  }
})

test('all core entries preserve question, plan-only, and small-task scope', () => {
  for (const skill of ['project-memory', 'plan', 'prototype', 'build', 'debug', 'review', 'verify', 'ship', 'autopilot', 'learn', 'write', 'catch-up']) {
    assert.match(read(`skills/${skill}/SKILL.md`), /\.\.\/\.\.\/references\/task-routing\.md/)
  }
  const routing = read('references/task-routing.md')
  assert.match(routing, /question.*does not authorize/i)
  assert.match(routing, /plan-only/i)
  assert.match(routing, /small typo/i)
  assert.match(routing, /compound-memory:handoff/)
  assert.match(routing, /collision/i)
})

test('script effects are disclosed without blanket permission advice', () => {
  const text = read('skills/project-memory/SKILL.md')
  assert.doesNotMatch(text, /approve it|scripts are read-only inspectors/)
  assert.match(text, /model calls/)
  assert.match(text, /temporary output/)
  assert.match(text, /authority already granted/)
  assert.doesNotMatch(/^allowed-tools:[ \t]*(.*)$/m.exec(text)?.[1] ?? '', /auditor-bridge/)
})

test('routing cases accept observed expected results and reject unsafe outcomes', async () => {
  const { ROUTING_CASES, gradeRoutingRun } = await import('../evals/routing-cases.mjs')
  assert.ok(ROUTING_CASES.length >= 12)
  assert.equal(new Set(ROUTING_CASES.map((c) => c.id)).size, ROUTING_CASES.length)
  for (const c of ROUTING_CASES) {
    const valid = { skills: c.expectedSkills.slice(0, 1), changedFiles: [], agents: 0, complete: true }
    assert.equal(gradeRoutingRun(c.id, valid).ok, true, c.id)
    if (c.writePolicy === 'none') {
      assert.equal(gradeRoutingRun(c.id, { ...valid, changedFiles: ['memory/current-state.md'] }).ok, false, c.id)
    }
    if (c.maxAgents === 0) assert.equal(gradeRoutingRun(c.id, { ...valid, agents: 1 }).ok, false, c.id)
    assert.equal(gradeRoutingRun(c.id, { ...valid, complete: false }).ok, false, c.id)
    assert.equal(gradeRoutingRun(c.id, { ...valid, skills: ['compound-memory:autopilot'] }).ok, false, c.id)
  }
  assert.equal(gradeRoutingRun('question', { skills: [], agents: 0, complete: true }).ok, false)
  assert.throws(() => gradeRoutingRun('unknown', {}), /Unknown routing case/)
})

test('routing scope rejects traversal, absolute paths, and edits outside task files', async () => {
  const { gradeRoutingRun } = await import('../evals/routing-cases.mjs')
  const run = (id, changedFiles, skill) => gradeRoutingRun(id, {
    skills: [skill], changedFiles, agents: 0, complete: true,
  })
  for (const path of ['../README.md', '/README.md', 'C:/README.md', './README.md', '.', 'memory/../settings.json', 'memory//current-state.md', 'memory/./current-state.md', 'memory/current-state.md:stream', 'memory/']) {
    assert.equal(run('explicit-sync', [path], 'compound-memory:sync').ok, false, path)
    assert.equal(run('typo', [path], 'compound-memory:build').ok, false, path)
    assert.equal(run('build', [path], 'compound-memory:build').ok, false, path)
  }
  assert.equal(run('explicit-sync', ['memory/current-state.md'], 'compound-memory:sync').ok, true)
  assert.equal(run('typo', ['README.md'], 'compound-memory:build').ok, true)
  assert.equal(run('build', ['src/export.mjs'], 'compound-memory:build').ok, true)
  assert.equal(run('build', ['.claude/settings.json'], 'compound-memory:build').ok, false)
  assert.equal(run('code-cleanup', ['src/format.mjs'], 'compound-memory:build').ok, true)
  assert.equal(run('code-cleanup', ['src/export.mjs'], 'compound-memory:build').ok, false)
})
