import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeHostEvent, hookPolicy, contextSignal } from '../scripts/hosts/events.mjs'
import { runPostToolHook } from '../scripts/post-tool-validate-hook.mjs'
import { makeFixture, cleanupAfter, completeMemoryTree } from './fixtures/build.mjs'

test('Claude and Codex file events carry paths without granting authority', () => {
  for (const host of ['claude', 'codex']) {
    for (const tool_name of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
      const tool_input = tool_name === 'NotebookEdit' ? { notebook_path: 'memory/current-state.md' } : { file_path: 'memory/current-state.md' }
      const event = normalizeHostEvent({ hook_event_name: 'PostToolUse', tool_name, tool_input }, { host })
      assert.deepEqual(event.paths, ['memory/current-state.md'])
      assert.equal(event.kind, 'file-change')
      assert.equal(event.basis, 'tool-input')
    }
  }
})

test('Codex apply_patch reports old and new names once, including spaces', () => {
  const event = normalizeHostEvent({ hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: memory/old name.md\n*** Move to: memory/new name.md\n@@\n-old\n+new\n*** Add File: src/a.mjs\n+export {}\n*** Delete File: memory/gone.md\n*** End Patch' } }, { host: 'codex' })
  assert.deepEqual(event.paths, ['memory/old name.md', 'memory/new name.md', 'src/a.mjs', 'memory/gone.md'])
  assert.equal(event.kind, 'file-change')
  assert.equal(event.basis, 'tool-input')
})

test('shell and unknown patch formats need a manual status check, not guessed paths', () => {
  for (const tool_name of ['Bash', 'exec_command', 'PowerShell', 'apply_patch']) {
    const event = normalizeHostEvent({ hook_event_name: 'PostToolUse', tool_name, tool_input: { command: 'echo x > memory/current-state.md' } }, { host: 'codex' })
    assert.equal(event.kind, 'change-unknown')
    assert.deepEqual(event.paths, [])
    assert.equal(event.manualCheck, 'project-memory status')
  }
})

test('empty patch path cannot consume the following header', () => {
  const event = normalizeHostEvent({ hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: \n*** Delete File: memory/a.md\n*** End Patch' } }, { host: 'codex' })
  assert.equal(event.kind, 'change-unknown')
  assert.deepEqual(event.paths, [])
})

test('unsupported hosts/events and read tools produce no change signal', () => {
  for (const payload of [null, {}, { hook_event_name: 'Stop' }, { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'memory/a.md' } }]) {
    assert.equal(normalizeHostEvent(payload, { host: 'claude' }).kind, 'ignored')
  }
  assert.equal(normalizeHostEvent({ hook_event_name: 'SessionStart' }, { host: 'cloud' }).kind, 'ignored')
})

test('startup and compact use the same orientation event, never an agent queue', () => {
  for (const host of ['claude', 'codex']) for (const source of ['startup', 'resume', 'clear', 'compact', 'fork']) {
    const event = normalizeHostEvent({ hook_event_name: 'SessionStart', source }, { host })
    assert.equal(event.kind, 'orientation')
    assert.equal(event.source, source)
  }
})

test('environment flags cannot enable the project-local opt-in queue', () => {
  assert.deepEqual(hookPolicy({}), { enabled: true, queueRequested: false, queueSupported: true, queueEnabled: false })
  assert.deepEqual(hookPolicy({ COMPOUND_MEMORY_HOOKS: '0', COMPOUND_MEMORY_INTEGRITY_QUEUE: '1' }), { enabled: false, queueRequested: true, queueSupported: true, queueEnabled: false })
  assert.equal(hookPolicy({ COMPOUND_MEMORY_INTEGRITY_QUEUE: '1' }).queueEnabled, false)
})

test('unverified status-line payloads do not become context readings', () => {
  for (const payload of [null, {}, { context_window: { used_percentage: 50 } }]) {
    assert.deepEqual(contextSignal(payload), { usedPercentage: null, basis: 'unknown', reason: 'No verified status-line bridge is installed.' })
  }
})

test('Codex patch adapter applies the same scope filter and returns one report', (t) => {
  const cwd = makeFixture({ ...completeMemoryTree(), 'memory/decisions/100-a.md': '# Decision 100: A\n', 'memory/decisions/100-b.md': '# Decision 100: B\n' })
  cleanupAfter(t, cwd)
  const run = (command) => runPostToolHook(JSON.stringify({ cwd, hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: { command } }), { host: 'codex' })
  assert.equal(run('*** Begin Patch\n*** Update File: src/a.mjs\n*** End Patch').stdout, '')
  const result = run('*** Begin Patch\n*** Update File: memory/current-state.md\n*** Update File: memory/next-actions.md\n*** End Patch')
  assert.equal(result.code, 0)
  assert.equal(result.stdout.trim().split('\n').length, 1)
  const output = JSON.parse(result.stdout)
  assert.equal(output.hookSpecificOutput.hookEventName, 'PostToolUse')
  assert.match(output.hookSpecificOutput.additionalContext, /malformed-frontmatter/)
  assert.equal(output.hookSpecificOutput.additionalContext.match(/structural validation of project memory found:/g).length, 1)
  assert.ok(output.hookSpecificOutput.additionalContext.length <= 4000)
})
