import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { makeFixture, cleanupAfter, childEnv } from './fixtures/build.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
function invoke(script, cwd, payload, env = {}) {
  return spawnSync(process.execPath, [join(root, 'scripts', script)], {
    cwd, input: JSON.stringify({ cwd, ...payload }), encoding: 'utf8',
    windowsHide: true, env: childEnv({ ...process.env, ...env }),
  })
}
function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? snapshot(path) : [[path, statSync(path).mtimeMs, readFileSync(path).toString('base64')]]
  })
}

test('a project without memory gets exactly one bounded startup or compact packet', (t) => {
  const cwd = makeFixture({ '.claude/settings.json': '{"statusLine":{"type":"command","command":"existing"}}' })
  cleanupAfter(t, cwd)
  const before = snapshot(cwd)
  for (const source of ['startup', 'compact']) {
    const res = invoke('session-status-hook.mjs', cwd, { hook_event_name: 'SessionStart', source })
    assert.equal(res.status, 0, res.stderr)
    assert.equal(res.stdout.trim().split('\n').length, 1)
    const output = JSON.parse(res.stdout)
    assert.deepEqual(Object.keys(output), ['hookSpecificOutput'])
    assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart')
    assert.ok(output.hookSpecificOutput.additionalContext.length <= 3000)
  }
  assert.deepEqual(snapshot(cwd), before)
})

test('disabled hooks do nothing even with an opt-in queue flag', (t) => {
  const cwd = makeFixture({ 'memory/current-state.md': '# Current state\n', 'memory/decisions/001-broken.md': '# Missing frontmatter\n' })
  cleanupAfter(t, cwd)
  const before = snapshot(cwd)
  const env = { COMPOUND_MEMORY_HOOKS: '0', COMPOUND_MEMORY_INTEGRITY_QUEUE: '1' }
  for (const [script, payload] of [
    ['session-status-hook.mjs', { hook_event_name: 'SessionStart', source: 'compact' }],
    ['post-tool-validate-hook.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'memory/current-state.md' } }],
  ]) {
    const enabled = invoke(script, cwd, payload, { COMPOUND_MEMORY_HOOKS: '1', COMPOUND_MEMORY_INTEGRITY_QUEUE: '1' })
    assert.equal(enabled.status, 0, enabled.stderr)
    assert.notEqual(enabled.stdout, '', 'positive control must emit an advisory')
    const res = invoke(script, cwd, payload, env)
    assert.equal(res.status, 0, res.stderr)
    assert.equal(res.stdout, '')
  }
  assert.deepEqual(snapshot(cwd), before)
})

test('unhandled events cannot masquerade as startup or successful edits', (t) => {
  const cwd = makeFixture({ 'memory/current-state.md': '# Current state\n', 'memory/decisions/001-broken.md': '# Missing frontmatter\n' })
  cleanupAfter(t, cwd)
  const startup = invoke('session-status-hook.mjs', cwd, { hook_event_name: 'SessionStart' })
  assert.equal(startup.status, 0, startup.stderr)
  assert.notEqual(startup.stdout, '', 'positive startup control')
  for (const event of ['PreCompact', 'PostCompact', 'Stop']) {
    const res = invoke('session-status-hook.mjs', cwd, { hook_event_name: event })
    assert.equal(res.stdout, '')
    assert.equal(res.status, 0)
  }
  const edit = { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'memory/current-state.md' } }
  const completed = invoke('post-tool-validate-hook.mjs', cwd, edit)
  assert.equal(completed.status, 0, completed.stderr)
  assert.match(completed.stdout, /malformed-frontmatter/, 'positive edit control')
  const res = invoke('post-tool-validate-hook.mjs', cwd, { ...edit, hook_event_name: 'PreToolUse' })
  assert.equal(res.status, 0, res.stderr)
  assert.equal(res.stdout, '')
})

test('auditor declares narrow tools and no ignored plugin-agent enforcement fields', () => {
  const source = readFileSync(join(root, 'agents', 'memory-auditor.md'), 'utf8')
  const frontmatter = source.split('---')[1]
  assert.match(frontmatter, /^tools: Read, Grep, Glob$/m)
  assert.doesNotMatch(frontmatter, /^(permissionMode|hooks|mcpServers):/m)
  assert.match(frontmatter, /^model: inherit$/m)
  // This pins package intent. Only a live dispatch can prove its actual tools.
})
