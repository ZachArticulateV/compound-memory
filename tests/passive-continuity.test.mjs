import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixture, cleanupAfter, completeMemoryTree } from './fixtures/build.mjs';
import { installStatusLine, removeStatusLine } from '../scripts/hosts/context.mjs';
import { statusLine } from '../scripts/hosts/status-line.mjs';
import { runPostToolHook } from '../scripts/post-tool-validate-hook.mjs';
import { runContinuityHook } from '../scripts/continuity-hook.mjs';
import { runSessionHook } from '../scripts/session-status-hook.mjs';
import { requestContinuity } from '../scripts/lib/continuity.mjs';

test('measured 50 percent queues a passive save and a read tool delivers it without blocking', t => {
  const root = makeFixture(completeMemoryTree()); cleanupAfter(t, root);
  installStatusLine(root, { authorized: true, command: 'bridge', inheritedStatusLineAcknowledged: true });
  const before = readFileSync(join(root, 'memory/current-state.md'), 'utf8');
  const raw = JSON.stringify({ session_id: 's1', model: { id: 'm1' }, context_window: { used_percentage: 50 } });
  statusLine(root, raw, { now: 1000 });
  assert.equal(existsSync(join(root, '.verify/integrity/continuity.json')), true, 'a checkpoint alone is not a pending memory save');
  const result = runPostToolHook(JSON.stringify({ cwd: root, session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'src/a.mjs' } }), { now: 1001 });
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /passive continuity save/);
  assert.match(output.hookSpecificOutput.additionalContext, /Keep the session open/);
  assert.equal(output.decision, undefined);
  assert.equal(output.continue, undefined);
  assert.equal(readFileSync(join(root, 'memory/current-state.md'), 'utf8'), before, 'the hook is not a second memory writer');
});

const setup = t => {
  const root = makeFixture(completeMemoryTree()); cleanupAfter(t, root);
  installStatusLine(root, { authorized: true, command: 'bridge', inheritedStatusLineAcknowledged: true });
  return root;
};
const sample = used => JSON.stringify({ session_id: 's1', model: { id: 'm1' }, context_window: { used_percentage: used } });
const prompt = root => JSON.stringify({ cwd: root, session_id: 's1', hook_event_name: 'UserPromptSubmit' });

test('prompt delivery survives repeat telemetry and stays quiet during save tool calls', t => {
  const root = setup(t);
  statusLine(root, sample(49), { now: 1000 });
  assert.equal(runContinuityHook(prompt(root), { now: 1001 }).stdout, '');
  statusLine(root, sample(50), { now: 2000 });
  assert.match(runContinuityHook(prompt(root), { now: 2001 }).stdout, /passive continuity save/);
  statusLine(root, sample(65), { now: 3000 });
  assert.equal(runContinuityHook(prompt(root), { now: 3001 }).stdout, '');
  assert.match(runContinuityHook(prompt(root), { now: 62001 }).stdout, /passive continuity save/);
  assert.equal(runContinuityHook(prompt(root).replace('s1','other'), { now: 62001 }).stdout, '');
});

test('off switches and recursive origins create no passive request', t => {
  const root = setup(t);
  for (const env of [{ COMPOUND_MEMORY_HOOKS: '0' }, { COMPOUND_MEMORY_ORIGIN: 'worker' }, { COMPOUND_MEMORY_ORIGIN: 'integrity' }]) {
    statusLine(root, sample(60), { now: 1000, env });
    assert.equal(existsSync(join(root,'.verify/integrity/continuity.json')), false);
    assert.equal(runContinuityHook(prompt(root), { now: 1001, env }).stdout, '');
  }
  removeStatusLine(root);
  statusLine(root, sample(60), { now: 2000 });
  assert.equal(runContinuityHook(prompt(root), { now: 2001 }).stdout, '');
});

test('unknown usage gets a passive time fallback at an active boundary after thirty minutes', t => {
  const root = setup(t);
  assert.equal(runContinuityHook(prompt(root), { now: 1000 }).stdout, '');
  assert.equal(runContinuityHook(prompt(root), { now: 1800999 }).stdout, '');
  const result = runContinuityHook(prompt(root), { now: 1801000 });
  assert.equal(result.code, 0); assert.match(result.stdout, /passive continuity save/);
  assert.doesNotMatch(result.stdout, /50%/);
});

test('a busy checkpoint writer never blocks the host and the next reading retries', t => {
  const root = setup(t), lock = join(root,'.verify/integrity/state.lock');
  writeFileSync(lock, '{}');
  assert.doesNotThrow(() => statusLine(root, sample(50), { now: 1000 }));
  assert.equal(runContinuityHook(prompt(root), { now: 1001 }).code, 0);
  unlinkSync(lock);
  statusLine(root, sample(50), { now: 2000 });
  assert.match(runContinuityHook(prompt(root), { now: 2001 }).stdout, /passive continuity save/);
});

test('invalid or subagent hook payloads never start passive work', t => {
  const root = setup(t);
  statusLine(root, sample(50), { now: 1000 });
  for (const raw of ['bad json', '{}', JSON.stringify({cwd:root,session_id:'s1',agent_id:'child',hook_event_name:'UserPromptSubmit'})]) {
    assert.deepEqual(runContinuityHook(raw, { now: 1001 }), { code: 0, stdout: '' });
  }
});

test('an unresolved request backs off to one notice per thirty minutes after five notices', t => {
  const root = setup(t); statusLine(root, sample(50), { now: 1000 });
  for (const now of [1000, 61000, 181000, 421000, 901000]) assert.match(runContinuityHook(prompt(root), {now}).stdout, /passive continuity save/);
  assert.equal(runContinuityHook(prompt(root), {now:1801000}).stdout, '');
  assert.match(runContinuityHook(prompt(root), {now:3601000}).stdout, /passive continuity save/);
  assert.equal(runContinuityHook(prompt(root), {now:3602000}).stdout, '');
});

test('compaction restores pending notice and a newer request is not hidden behind backoff', t => {
  const root=setup(t);statusLine(root,sample(50),{now:1000});
  runContinuityHook(prompt(root),{now:1001});
  const next=requestContinuity(root,{host:'claude',sessionId:'s1',modelId:'m2',epoch:0,reason:'handoff',now:1002}).request;
  assert.match(runContinuityHook(prompt(root),{now:1003}).stdout,new RegExp(next.id));
  const text=runSessionHook(JSON.stringify({cwd:root,session_id:'s1',hook_event_name:'SessionStart',source:'compact'}),{now:1004}).stdout;
  assert.match(text,/passive continuity save/);assert.match(text,/2 pending/);
});

test('a new session can see older pending work without consuming it',t=>{
  const root=setup(t);statusLine(root,sample(50),{now:1000});
  const raw=JSON.stringify({cwd:root,session_id:'new-session',hook_event_name:'SessionStart',source:'startup'});
  assert.match(runSessionHook(raw,{now:1001}).stdout,/belong to other sessions/);
  assert.doesNotMatch(runSessionHook(raw,{now:1002}).stdout,/belong to other sessions/);
});

test('fresh below-threshold usage does not request the unknown-usage time fallback', t => {
  const root = setup(t);
  runContinuityHook(prompt(root), {now:1000});
  statusLine(root, sample(25), {now:1801000});
  assert.equal(runContinuityHook(prompt(root), {now:1801001}).stdout, '');
  assert.match(runContinuityHook(prompt(root), {now:1861001}).stdout, /passive continuity save/);
});

test('long memory warnings cannot cut off the passive save instruction', t => {
  const root = setup(t);
  for (let i=0;i<20;i++) writeFileSync(join(root,'memory',`bad-${i}.md`), `# Bad\n\nSee [missing](missing-${i}.md).\n`);
  statusLine(root, sample(50), {now:1000});
  const raw = JSON.stringify({cwd:root,session_id:'s1',hook_event_name:'PostToolUse',tool_name:'Edit',tool_input:{file_path:'memory/current-state.md'}});
  const text = JSON.parse(runPostToolHook(raw,{now:1001}).stdout).hookSpecificOutput.additionalContext;
  assert.ok(text.startsWith('project-memory: passive continuity save'));
  assert.match(text,/Do not transfer run ownership or start another session\./);
  assert.ok(text.length<=4000);
  const session = JSON.parse(runSessionHook(JSON.stringify({cwd:root,session_id:'s1',hook_event_name:'SessionStart',source:'resume'}),{now:62001}).stdout).hookSpecificOutput.additionalContext;
  assert.ok(session.startsWith('project-memory: passive continuity save'));
  assert.ok(session.length<=3000);
});

test('an old writer lock gets one non-blocking recovery notice and stays in place', t => {
  const root = setup(t), lock = join(root,'.verify/integrity/state.lock');
  writeFileSync(lock,JSON.stringify({pid:process.pid,createdAt:1000}));
  const result=runContinuityHook(prompt(root),{now:301000});
  assert.equal(result.code,0);assert.match(result.stdout,/stayed locked/);
  assert.equal(runContinuityHook(prompt(root),{now:401000}).stdout,'');
  assert.equal(existsSync(lock),true);
});
