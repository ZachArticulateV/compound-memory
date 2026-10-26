import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { makeTempRoot, cleanupAfter, writeTree, childEnv } from './fixtures/build.mjs';
import { requestContinuity, pendingContinuity, pendingContinuityCounts, prepareContinuity, saveContinuity, recoverContinuityLock } from '../scripts/lib/continuity.mjs';

const identity = { host: 'claude', sessionId: 'session-a', modelId: 'model-a', epoch: 0 };
const owner = { host: 'claude', sessionId: 'session-a' };
const fixture = t => {
  const root = makeTempRoot(); cleanupAfter(t, root);
  writeTree(root, {
    'memory/current-state.md': '# Current state\n\nOld state.\n',
    'memory/next-actions.md': '# Next actions\n\nOld next step.\n',
    'memory/INDEX.md': '# Index\n\nNo active handoff.\n',
    'docs/plan.md': '# Plan\n\nBuild the next step.\n',
    '.verify/check.txt': 'One check passed.\n',
  });
  return root;
};
const packet = () => ({
  files: [
    { path: 'memory/current-state.md', content: '# Current state\n\nFirst step built.\n' },
    { path: 'memory/next-actions.md', content: '# Next actions\n\nCheck the second step.\n' },
    { path: 'memory/INDEX.md', content: '# Index\n\nRead `handoff.md`.\n' },
  ],
  handoff: { path: 'memory/handoff.md', content: '# Active Handoff\n\nBranch: main\n\n## Objective\n\nBuild the feature.\n\n## Verified\n\nOne check passed. See `.verify/check.txt`.\n\n## Unverified\n\nThe second step is not checked.\n\n## Continue here\n\nCheck the second step.\n\n## Do not assume\n\nThe whole feature is not complete.\n' },
  nextStep: 'Check the second step.',
  references: { plan: ['docs/plan.md'], documentation: [], evidence: ['.verify/check.txt'] },
  evidenceStatus: 'observed',
});

test('passive request saves no canonical files until the lead applies a prepared handoff', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'threshold', now: 1000 }).request;
  assert.equal(pendingContinuity(root, owner).length, 1);
  assert.equal(readFileSync(join(root, 'memory/current-state.md'), 'utf8'), '# Current state\n\nOld state.\n');
  const prepared = prepareContinuity(root, { ...owner, id: request.id, packet: packet(), now: 1100 });
  assert.equal(existsSync(join(root, 'memory/handoff.md')), false);
  const saved = saveContinuity(root, { ...owner, id: request.id, proposalPath: prepared.proposalPath, now: 1200 }, { authorized: true });
  assert.equal(saved.saved, true); assert.equal(saved.current, true);
  assert.equal(pendingContinuity(root, owner).length, 0);
  assert.match(readFileSync(join(root, 'memory/handoff.md'), 'utf8'), /Check the second step/);
});

test('repeat triggers and repeated saves do not duplicate work or claim changed memory is current', t => {
  const root = fixture(t);
  const trigger = { ...identity, reason: 'threshold', now: 1000 };
  const first = requestContinuity(root, trigger);
  assert.equal(requestContinuity(root, { ...trigger, now: 2000 }).request.id, first.request.id);
  assert.equal(requestContinuity(root, trigger).requested, false);
  const prepared = prepareContinuity(root, { ...owner, id: first.request.id, packet: packet() });
  const input = { ...owner, id: first.request.id, proposalPath: prepared.proposalPath };
  saveContinuity(root, input, { authorized: true });
  assert.equal(saveContinuity(root, input, { authorized: true }).repeated, true);
  assert.equal(requestContinuity(root, trigger).request.status, 'saved');
  writeFileSync(join(root, 'memory/current-state.md'), 'Later user work.\n');
  assert.equal(saveContinuity(root, input, { authorized: true }).current, false);
  assert.equal(readFileSync(join(root, 'memory/current-state.md'), 'utf8'), 'Later user work.\n');
});

test('a file edit after prepare is preserved and a fresh prepare can complete the pending request', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const prepared = prepareContinuity(root, { ...owner, id: request.id, packet: packet() });
  writeFileSync(join(root, 'memory/current-state.md'), 'User changed this.\n');
  assert.throws(() => saveContinuity(root, { ...owner, id: request.id, proposalPath: prepared.proposalPath }, { authorized: true }), /changed since proposal/);
  assert.equal(readFileSync(join(root, 'memory/current-state.md'), 'utf8'), 'User changed this.\n');
  assert.equal(existsSync(join(root, 'memory/handoff.md')), false);
  assert.equal(pendingContinuity(root, owner).length, 1);
  const nextPacket = packet(); nextPacket.files[0].content = 'User changed this.\nNew session fact.\n';
  const next = prepareContinuity(root, { ...owner, id: request.id, packet: nextPacket });
  assert.throws(() => saveContinuity(root, { ...owner, id: request.id, proposalPath: prepared.proposalPath }, { authorized: true }), /current prepared/);
  assert.equal(saveContinuity(root, { ...owner, id: request.id, proposalPath: next.proposalPath }, { authorized: true }).saved, true);
});

test('changed source references keep a save pending before canonical writes', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const prepared = prepareContinuity(root, { ...owner, id: request.id, packet: packet() });
  writeFileSync(join(root, '.verify/check.txt'), 'The check later failed.\n');
  assert.throws(() => saveContinuity(root, { ...owner, id: request.id, proposalPath: prepared.proposalPath }, { authorized: true }), /evidence changed/);
  assert.equal(existsSync(join(root, 'memory/handoff.md')), false);
  assert.equal(pendingContinuity(root, owner).length, 1);
});

test('session identity and write authority are required without clearing a newer request', t => {
  const root = fixture(t);
  const first = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const later = requestContinuity(root, { ...identity, epoch: 1, reason: 'threshold' }).request;
  assert.deepEqual(pendingContinuity(root, { ...owner, sessionId: 'other' }), []);
  assert.throws(() => prepareContinuity(root, { ...owner, sessionId: 'other', id: first.id, packet: packet() }), /another session/);
  const prepared = prepareContinuity(root, { ...owner, id: first.id, packet: packet() });
  const input = { ...owner, id: first.id, proposalPath: prepared.proposalPath };
  assert.throws(() => saveContinuity(root, input), /authority/);
  assert.throws(() => saveContinuity(root, { ...input, host: 'codex' }, { authorized: true }), /another session/);
  saveContinuity(root, input, { authorized: true });
  assert.deepEqual(pendingContinuity(root, owner).map(row => row.id), [later.id]);
});

test('incomplete handoffs, branch collisions and unrelated memory writes cannot be prepared', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'handoff' }).request;
  const prepare = p => prepareContinuity(root, { ...owner, id: request.id, packet: p });
  const incomplete = packet(); incomplete.handoff.content = '# Active handoff\n';
  assert.throws(() => prepare(incomplete), /next step/);
  const missingMemory = packet(); missingMemory.files.pop();
  assert.throws(() => prepare(missingMemory), /updates required/);
  const unrelated = packet(); unrelated.files.push({ path: 'memory/project-brief.md', content: 'Replacement.' });
  assert.throws(() => prepare(unrelated), /invalid.*memory/);
  const emptyBranch = packet(); emptyBranch.handoff.content = emptyBranch.handoff.content.replace('Branch: main', 'Branch:');
  assert.throws(() => prepare(emptyBranch), /branch required/);
  writeTree(root, { 'memory/handoff.md': '# Handoff\n\nBranch: other\n\nKeep other work.\n' });
  assert.throws(() => prepare(packet()), /another or unknown branch/);
  assert.match(readFileSync(join(root, 'memory/handoff.md'), 'utf8'), /Keep other work/);
});

test('a busy memory writer does not lose the request and a later retry can save', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const prepared = prepareContinuity(root, { ...owner, id: request.id, packet: packet() });
  const input = { ...owner, id: request.id, proposalPath: prepared.proposalPath };
  writeTree(root, { '.verify/integrity/state.lock': 'Other writer owns this.\n' });
  assert.throws(() => saveContinuity(root, input, { authorized: true }), error => error.code === 'EEXIST' && /busy; retry the SAME prepared save/.test(error.message));
  assert.equal(pendingContinuity(root, owner).length, 1);
  assert.equal(existsSync(join(root, 'memory/handoff.md')), false);
  unlinkSync(join(root, '.verify/integrity/state.lock'));
  assert.equal(saveContinuity(root, input, { authorized: true }).saved, true);
});

test('Codex can request a time fallback without inventing a context percentage', t => {
  const root = fixture(t);
  const input = { ...identity, host: 'codex', reason: 'time-fallback', now: 1000 };
  const first = requestContinuity(root, input);
  assert.equal(first.request.reason, 'time-fallback');
  assert.equal(Object.hasOwn(first.request, 'usedPercentage'), false);
  assert.equal(requestContinuity(root, { ...input, now: 1500 }).requested, false);
  assert.equal(requestContinuity(root, { ...input, now: 1_801_000 }).requested, true);
});

test('checkpoint references must belong to the trigger session', t => {
  const root = fixture(t);
  const checkpointPath = '.verify/integrity/checkpoints/example.json';
  writeTree(root, { [checkpointPath]: JSON.stringify({ kind: 'context-checkpoint', ...identity, reason: 'threshold' }) });
  assert.equal(requestContinuity(root, { ...identity, checkpointPath, reason: 'threshold' }).requested, true);
  assert.throws(() => requestContinuity(root, { ...identity, sessionId: 'other', checkpointPath, reason: 'threshold' }), /identity differs/);
});

test('queue expiry prunes only the oldest saved receipt and keeps pending work', t => {
  const root = fixture(t);
  const first = requestContinuity(root, { ...identity, reason: 'threshold', now: 1000 }).request;
  const path = join(root, '.verify/integrity/continuity.json');
  const rows = [first, ...Array.from({ length: 127 }, (_, i) => ({ ...first, id: 'saved-' + i, key: 'saved-key-' + i, status: 'saved', createdAt: i + 1, receipt: { savedAt: i + 1 } }))];
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, requests: rows }));
  assert.equal(requestContinuity(root, { ...identity, reason: 'threshold', now: 2000 }).requested, false);
  assert.equal(JSON.parse(readFileSync(path)).requests.length, 128);
  const fresh = requestContinuity(root, { ...identity, epoch: 1, reason: 'threshold', now: 3000 });
  const stored = JSON.parse(readFileSync(path));
  assert.equal(stored.requests.length, 128);
  assert.equal(stored.requests.some(row => row.id === 'saved-0'), false);
  assert.equal(stored.requests.some(row => row.id === 'saved-1'), true);
  assert.deepEqual(pendingContinuity(root, owner).map(row => row.id), [first.id, fresh.request.id]);
  for (const row of stored.requests) row.status = 'pending';
  writeFileSync(path, JSON.stringify(stored));
  assert.throws(() => requestContinuity(root, { ...identity, epoch: 2, reason: 'threshold', now: 4000 }), /queue is full/);
  assert.equal(pendingContinuity(root, owner).length, 128);
});

test('host identities reject line breaks and control bytes', t => {
  const root = fixture(t);
  for (const values of [{ sessionId: 's\n1' }, { modelId: 'm\r1' }, { sessionId: 's\u00001' }]) {
    assert.throws(() => requestContinuity(root, { ...identity, ...values, reason: 'threshold' }), /identity required|invalid continuity trigger/);
  }
  assert.equal(existsSync(join(root, '.verify/integrity')), false);
});

test('an existing trigger can be read while the queue lock is held, but a new one cannot write', t => {
  const root = fixture(t);
  const trigger = { ...identity, reason: 'threshold' };
  const first = requestContinuity(root, trigger);
  const path = join(root, '.verify/integrity/continuity.json');
  const original = readFileSync(path, 'utf8');
  writeTree(root, { '.verify/integrity/continuity.lock': 'Other writer owns this.\n' });
  assert.equal(requestContinuity(root, trigger).request.id, first.request.id);
  assert.throws(() => requestContinuity(root, { ...trigger, epoch: 1 }), error => error.code === 'EEXIST' && /busy; retry/.test(error.message));
  assert.equal(readFileSync(path, 'utf8'), original);
  assert.equal(readFileSync(join(root, '.verify/integrity/continuity.lock'), 'utf8'), 'Other writer owns this.\n');
});

test('references cannot overlap the proposed memory writes, including case variants', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const originalState = readFileSync(join(root, '.verify/integrity/continuity.json'), 'utf8');
  const originalMemory = readFileSync(join(root, 'memory/current-state.md'), 'utf8');
  for (const path of ['memory/current-state.md', 'MEMORY/CURRENT-STATE.MD', 'memory/handoff.md']) {
    const candidate = packet(); candidate.references.plan = [path];
    assert.throws(() => prepareContinuity(root, { ...owner, id: request.id, packet: candidate }), /reference overlaps a proposed write/);
  }
  assert.equal(readFileSync(join(root, '.verify/integrity/continuity.json'), 'utf8'), originalState);
  assert.equal(readFileSync(join(root, 'memory/current-state.md'), 'utf8'), originalMemory);
  assert.equal(existsSync(join(root, '.verify/integrity/continuity-proposals')), false);
  assert.equal(existsSync(join(root, 'memory/handoff.md')), false);
});

test('saved handoff links preserve special characters in real file names', t => {
  const root = fixture(t);
  const source = 'docs/plan [v2] (draft)#50%.md';
  writeTree(root, { [source]: 'Source file with a valid local name.\n' });
  const request = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const candidate = packet(); candidate.references.plan = [source];
  const prepared = prepareContinuity(root, { ...owner, id: request.id, packet: candidate });
  saveContinuity(root, { ...owner, id: request.id, proposalPath: prepared.proposalPath }, { authorized: true });
  const handoff = readFileSync(join(root, 'memory/handoff.md'), 'utf8');
  assert.ok(handoff.includes('[docs/plan \\[v2\\] (draft)#50%.md](../docs/plan%20%5Bv2%5D%20%28draft%29%2350%25.md)'));
  assert.equal(readFileSync(join(root, source), 'utf8'), 'Source file with a valid local name.\n');
});

test('pending counts expose old-session work without changing its owner or reading through a writer lock', t => {
  const root = fixture(t);
  assert.deepEqual(pendingContinuityCounts(root, owner), { current: 0, otherSessions: 0 });
  assert.equal(existsSync(join(root, '.verify/integrity')), false);
  requestContinuity(root, { ...identity, reason: 'threshold' });
  const old = requestContinuity(root, { ...identity, sessionId: 'old-session', reason: 'threshold' }).request;
  requestContinuity(root, { ...identity, host: 'codex', reason: 'handoff' });
  writeTree(root, { '.verify/integrity/continuity.lock': 'Other writer owns this.\n' });
  const before = readFileSync(join(root, '.verify/integrity/continuity.json'), 'utf8');
  assert.deepEqual(pendingContinuityCounts(root, owner), { current: 1, otherSessions: 2 });
  assert.deepEqual(pendingContinuityCounts(root, { ...owner, sessionId: 'new-session' }), { current: 0, otherSessions: 3 });
  assert.equal(pendingContinuity(root, { ...owner, sessionId: 'old-session' })[0].id, old.id);
  assert.equal(readFileSync(join(root, '.verify/integrity/continuity.json'), 'utf8'), before);
});

test('continuity lock recovery requires authority, age, and a confirmed dead process', t => {
  const root = fixture(t);
  const path = join(root, '.verify/integrity/continuity.lock');
  writeTree(root, { '.verify/integrity/continuity.lock': JSON.stringify({ pid: process.pid, createdAt: 1000 }) });
  assert.throws(() => recoverContinuityLock(root, { now: 400000 }), /authority/);
  assert.throws(() => recoverContinuityLock(root, { authorized: true, now: 1100 }), /not stale/);
  assert.throws(() => recoverContinuityLock(root, { authorized: true, now: 400000 }), /may still be alive/);
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { env: childEnv() });
  assert.equal(child.status, 0);
  assert.throws(() => process.kill(child.pid, 0), error => error.code === 'ESRCH');
  writeFileSync(path, JSON.stringify({ pid: child.pid, createdAt: 1000 }));
  assert.equal(recoverContinuityLock(root, { authorized: true, now: 400000 }).recovered, true);
  assert.equal(existsSync(path), false);
  assert.equal(recoverContinuityLock(root, { authorized: true, now: 400000 }).recovered, false);
});

test('recovery keeps an unknown process or a lock changed during the process probe', t => {
  const root = fixture(t);
  const path = join(root, '.verify/integrity/continuity.lock');
  const original = JSON.stringify({ pid: 123, createdAt: 1000 });
  writeTree(root, { '.verify/integrity/continuity.lock': original });
  assert.throws(() => recoverContinuityLock(root, { authorized: true, now: 400000 }, { probeProcess: () => { throw Object.assign(Error('unknown'), { code: 'EPERM' }); } }), /may still be alive/);
  assert.equal(readFileSync(path, 'utf8'), original);
  const replacement = JSON.stringify({ pid: process.pid, createdAt: 400000 });
  assert.throws(() => recoverContinuityLock(root, { authorized: true, now: 400000 }, { probeProcess: () => {
    writeFileSync(path, replacement);
    throw Object.assign(Error('gone'), { code: 'ESRCH' });
  } }), /changed during recovery/);
  assert.equal(readFileSync(path, 'utf8'), replacement);
});

test('the CLI prepares then saves real files and returns a nonzero conflict code', t => {
  const root = fixture(t);
  const request = requestContinuity(root, { ...identity, reason: 'threshold' }).request;
  const run = args => spawnSync(process.execPath, ['scripts/continuity.mjs', ...args], { encoding: 'utf8', env: childEnv() });
  writeTree(root, { 'prepare.json': JSON.stringify({ ...owner, id: request.id, packet: packet() }) });
  const prepared = run(['prepare', root, join(root, 'prepare.json')]); assert.equal(prepared.status, 0, prepared.stderr);
  writeTree(root, { 'save.json': JSON.stringify({ ...owner, id: request.id, proposalPath: JSON.parse(prepared.stdout).proposalPath }) });
  const saved = run(['save', root, join(root, 'save.json')]); assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(saved.stdout).current, true);
  const pending = run(['pending', root, owner.host, owner.sessionId]); assert.equal(pending.status, 0); assert.deepEqual(JSON.parse(pending.stdout), []);
  writeTree(root, { 'save.json': JSON.stringify({ ...owner, sessionId: 'wrong', id: request.id, proposalPath: JSON.parse(prepared.stdout).proposalPath }) });
  assert.equal(run(['save', root, join(root, 'save.json')]).status, 2);
  const stopped = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { env: childEnv() });
  assert.equal(stopped.status, 0);
  assert.throws(() => process.kill(stopped.pid, 0), error => error.code === 'ESRCH');
  writeTree(root, { '.verify/integrity/continuity.lock': JSON.stringify({ pid: stopped.pid, createdAt: 1000 }), 'recover.json': JSON.stringify({ authorized: false, now: 400000 }) });
  assert.equal(run(['recover-lock', root, join(root, 'recover.json')]).status, 2);
  writeTree(root, { 'recover.json': JSON.stringify({ authorized: true, now: 400000 }) });
  const recovered = run(['recover-lock', root, join(root, 'recover.json')]);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).recovered, true);
});
