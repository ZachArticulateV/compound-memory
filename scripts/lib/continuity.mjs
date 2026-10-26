// A passive handoff is a saved pointer. It does not stop a session or transfer a run.
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { resolve, posix } from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, safeIntegrityPath, writeIntegrityFile, proposeMemoryUpdate, applyMemoryUpdate } from './integrity-state.mjs';

const STATE = '.verify/integrity/continuity.json';
const LIMIT = 128;
const check = (yes, message) => { if (!yes) throw Error(message); };
const short = (value, max = 200) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\x00-\x1f]/.test(value);
const hosts = new Set(['claude', 'codex']);
const reasons = new Set(['threshold', 'pre-compact', 'handoff', 'time-fallback', 'task-boundary']);
const ownerFiles = new Set(['memory/current-state.md', 'memory/next-actions.md', 'memory/INDEX.md', 'memory/bugs-and-risks.md']);
const fileHash = (root, path) => {
  const absolute = safeIntegrityPath(root, path);
  if (!existsSync(absolute)) return null;
  check(statSync(absolute).isFile() && statSync(absolute).size <= 1_048_576, 'reference must be a bounded file');
  return digest(readFileSync(absolute));
};

function state(root) {
  const path = safeIntegrityPath(root, STATE);
  if (!existsSync(path)) return { schemaVersion: 1, requests: [] };
  check(statSync(path).size <= 1_048_576, 'continuity state exceeds limit');
  const value = JSON.parse(readFileSync(path, 'utf8'));
  check(value?.schemaVersion === 1 && Array.isArray(value.requests) && value.requests.length <= LIMIT, 'invalid continuity state');
  check(value.requests.every(row => short(row.id) && ['pending', 'saved'].includes(row.status) && hosts.has(row.host) && short(row.sessionId)), 'invalid continuity request');
  return value;
}

// Hold this short queue lock outside the shared memory writer lock. No process is
// launched here. A dead writer's lock is retained for explicit recovery.
function locked(root, action) {
  const path = safeIntegrityPath(root, '.verify/integrity/continuity.lock', { createParents: true });
  let held = false;
  try {
    try {
      writeFileSync(path, JSON.stringify({ pid: process.pid, createdAt: Date.now() }), { flag: 'wx' });
    } catch (error) {
      if (error.code === 'EEXIST') throw Object.assign(Error('Continuity writer is busy; retry this operation after the active writer finishes. Preserve any prepared save.', { cause: error }), { code: error.code });
      throw error;
    }
    held = true;
    return action();
  } finally {
    if (held) unlinkSync(path);
  }
}

export function recoverContinuityLock(root, { authorized = false, now = Date.now(), minAgeMs = 300_000 } = {}, { probeProcess = pid => process.kill(pid, 0) } = {}) {
  check(authorized === true, 'explicit lock recovery authority required');
  check(Number.isSafeInteger(now) && now >= 0 && Number.isSafeInteger(minAgeMs) && minAgeMs >= 0, 'valid recovery time and minimum age required');
  const path = safeIntegrityPath(root, '.verify/integrity/continuity.lock');
  if (!existsSync(path)) return { recovered: false };
  check(statSync(path).size <= 4096, 'invalid continuity lock');
  const original = readFileSync(path, 'utf8');
  const lock = JSON.parse(original);
  check(Number.isSafeInteger(lock.pid) && lock.pid > 0 && Number.isSafeInteger(lock.createdAt) && lock.createdAt >= 0 && now - lock.createdAt >= minAgeMs, 'lock is not stale');
  let alive = true;
  try { probeProcess(lock.pid); } catch (error) { if (error.code === 'ESRCH') alive = false; }
  check(!alive, 'writer may still be alive');
  check(readFileSync(path, 'utf8') === original, 'lock changed during recovery');
  unlinkSync(path);
  return { recovered: true };
}

function identity({ host, sessionId }) {
  check(hosts.has(host) && short(sessionId), 'host and session identity required');
}

function ownedRequest(store, { id, host, sessionId }) {
  identity({ host, sessionId });
  const request = store.requests.find(row => row.id === id);
  check(request && request.host === host && request.sessionId === sessionId, 'request belongs to another session or is missing');
  return request;
}

export function requestContinuity(root, { host, sessionId, modelId, epoch = 0, reason, checkpointPath = null, now = Date.now() } = {}) {
  identity({ host, sessionId });
  check(short(modelId) && Number.isSafeInteger(epoch) && epoch >= 0 && reasons.has(reason) && Number.isSafeInteger(now) && now >= 0, 'invalid continuity trigger');
  if (checkpointPath !== null) {
    check(/^\.verify\/integrity\/checkpoints\/[a-zA-Z0-9-]+\.json$/.test(checkpointPath), 'invalid checkpoint path');
    const path = safeIntegrityPath(root, checkpointPath);
    check(existsSync(path) && statSync(path).size <= 4096, 'bounded checkpoint required');
    const checkpoint = JSON.parse(readFileSync(path, 'utf8'));
    check(checkpoint.kind === 'context-checkpoint' && checkpoint.host === host && checkpoint.sessionId === sessionId && checkpoint.modelId === modelId && checkpoint.epoch === epoch && checkpoint.reason === reason, 'checkpoint identity differs');
  }
  // Time fallbacks can recur once per half hour. A threshold fires once per epoch.
  const window = reason === 'time-fallback' ? Math.floor(now / 1_800_000) : null;
  const key = digest({ host, sessionId, modelId, epoch, reason, window });
  // Existing records are immutable trigger receipts. Reading one needs no write
  // lock, so repeated host signals cannot contend with a pending memory save.
  const existing = state(root).requests.find(row => row.key === key);
  if (existing) return { requested: false, request: existing };
  return locked(root, () => {
    const store = state(root);
    const prior = store.requests.find(row => row.key === key);
    if (prior) return { requested: false, request: prior };
    // Keep every unfinished save. Old saved receipts may expire so normal use
    // does not exhaust the queue; an expired old trigger can request a new save.
    if (store.requests.length >= LIMIT) {
      const oldest = store.requests.filter(row => row.status === 'saved').sort((a, b) => (a.receipt?.savedAt ?? a.createdAt) - (b.receipt?.savedAt ?? b.createdAt))[0];
      if (oldest) store.requests = store.requests.filter(row => row.id !== oldest.id);
    }
    check(store.requests.length < LIMIT, 'continuity queue is full; preserve it for review');
    const request = { id: randomUUID(), key, host, sessionId, modelId, epoch, reason, checkpointPath, createdAt: now, status: 'pending', prepared: null, receipt: null };
    store.requests.push(request);
    writeIntegrityFile(root, STATE, store);
    return { requested: true, request };
  });
}

export function pendingContinuity(root, options = {}) {
  identity(options);
  return state(root).requests.filter(row => row.status === 'pending' && row.host === options.host && row.sessionId === options.sessionId);
}

export function pendingContinuityCounts(root, options = {}) {
  identity(options);
  const counts = { current: 0, otherSessions: 0 };
  for (const request of state(root).requests) {
    if (request.status !== 'pending') continue;
    const current = request.host === options.host && request.sessionId === options.sessionId;
    counts[current ? 'current' : 'otherSessions']++;
  }
  return counts;
}

function section(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp('^##[ \\t]+' + escaped + '[ \\t]*\\r?\\n([\\s\\S]*?)(?=^##[ \\t]|$(?![\\s\\S]))', 'm'))?.[1]?.trim() ?? '';
}

function boundedContent(value) {
  return typeof value === 'string' && value.trim().length > 0 && Buffer.byteLength(value) <= 16_000;
}

function packetFiles(root, packet) {
  check(packet && Array.isArray(packet.files) && packet.files.length >= 3 && packet.files.length <= 4, 'current state, next actions and index updates required');
  const seen = new Set();
  for (const file of packet.files) {
    check(ownerFiles.has(file?.path) && !seen.has(file.path) && boundedContent(file.content), 'invalid or duplicate continuity memory update');
    seen.add(file.path);
  }
  for (const name of ['memory/current-state.md', 'memory/next-actions.md', 'memory/INDEX.md']) check(seen.has(name), 'current state, next actions and index updates required');
  const handoff = packet.handoff;
  check(handoff && /^memory\/(?:handoff\.md|handoffs\/[a-z0-9][a-z0-9-]*\.md)$/.test(handoff.path) && boundedContent(handoff.content), 'bounded canonical handoff required');
  check(short(packet.nextStep, 1000) && section(handoff.content, 'Continue here').includes(packet.nextStep), 'handoff must include the exact next step');
  for (const title of ['Objective', 'Continue here', 'Do not assume', 'Verified', 'Unverified']) check(section(handoff.content, title), `handoff needs a nonempty ${title} section`);
  const branch = handoff.content.match(/^Branch:[ \t]*([^\r\n]+)$/m)?.[1]?.trim();
  check(short(branch), 'handoff branch required');
  const target = safeIntegrityPath(root, handoff.path);
  if (existsSync(target)) {
    const oldBranch = readFileSync(target, 'utf8').match(/^Branch:[ \t]*([^\r\n]+)$/m)?.[1]?.trim();
    check(oldBranch === branch, 'existing handoff belongs to another or unknown branch');
  }
  const index = packet.files.find(file => file.path === 'memory/INDEX.md');
  check(index.content.includes(handoff.path.slice('memory/'.length)), 'index must point to the active handoff');
  check(['observed', 'not-run'].includes(packet.evidenceStatus), 'explicit evidence status required');
  const references = [];
  const writePaths = new Set([...seen, handoff.path].map(path => path.toLowerCase()));
  for (const kind of ['plan', 'documentation', 'evidence']) {
    const paths = packet.references?.[kind];
    check(Array.isArray(paths) && paths.length <= 10, 'bounded plan, documentation and evidence reference arrays required');
    for (const path of paths) {
      check(typeof path === 'string' && !writePaths.has(path.toLowerCase()), 'reference overlaps a proposed write or has an invalid path');
      const sha256 = fileHash(root, path);
      check(sha256 !== null, 'referenced document or evidence is missing');
      references.push({ kind, path, sha256 });
    }
  }
  check(packet.evidenceStatus !== 'observed' || references.some(row => row.kind === 'evidence'), 'observed checks need evidence references');
  let content = handoff.content.trimEnd();
  if (references.length) {
    content += '\n\n## Saved work references\n\n' + references.map(row => {
      const label = row.path.replace(/[\\[\]]/g, '\\$&');
      const target = posix.relative(posix.dirname(handoff.path), row.path).split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase())).join('/');
      return `- ${row.kind}: [${label}](${target})`;
    }).join('\n');
  }
  content += '\n';
  check(boundedContent(content), 'handoff exceeds the save limit');
  return { files: [...packet.files, { path: handoff.path, content }], references, handoffPath: handoff.path, nextStep: packet.nextStep, evidenceStatus: packet.evidenceStatus };
}

export function prepareContinuity(root, { id, host, sessionId, packet, now = Date.now() } = {}) {
  check(Number.isSafeInteger(now) && now >= 0, 'valid prepare time required');
  return locked(root, () => {
    const store = state(root);
    const request = ownedRequest(store, { id, host, sessionId });
    check(request.status === 'pending', 'request already saved');
    const prepared = packetFiles(root, packet);
    const proposal = proposeMemoryUpdate(root, { id: 'continuity-' + id + '-' + randomUUID(), reason: 'Passive handoff and session memory save', files: prepared.files });
    const body = { schemaVersion: 1, kind: 'continuity-save', root: resolve(root), id, host, sessionId, preparedAt: now, ...prepared, proposal };
    delete body.files;
    const value = { ...body, fingerprint: digest(body) };
    const proposalPath = `.verify/integrity/continuity-proposals/${id}-${randomUUID()}.json`;
    writeIntegrityFile(root, proposalPath, value);
    request.prepared = { proposalPath, fingerprint: value.fingerprint };
    writeIntegrityFile(root, STATE, store);
    return { prepared: true, id, proposalPath, files: proposal.files.map(file => ({ path: file.path, before: file.before, after: file.after })) };
  });
}

export function saveContinuity(root, { id, host, sessionId, proposalPath, now = Date.now() } = {}, { authorized = false } = {}) {
  check(authorized === true, 'memory save authority required');
  check(Number.isSafeInteger(now) && now >= 0, 'valid save time required');
  return locked(root, () => {
    const store = state(root);
    const request = ownedRequest(store, { id, host, sessionId });
    check(request.prepared?.proposalPath === proposalPath, 'proposal is not the current prepared save');
    check(typeof proposalPath === 'string' && proposalPath.startsWith('.verify/integrity/continuity-proposals/'), 'invalid continuity proposal path');
    const path = safeIntegrityPath(root, proposalPath);
    check(statSync(path).size <= 100_000, 'continuity proposal exceeds limit');
    const { fingerprint, ...prepared } = JSON.parse(readFileSync(path, 'utf8'));
    check(fingerprint === digest(prepared) && fingerprint === request.prepared.fingerprint && prepared.kind === 'continuity-save' && prepared.root === resolve(root) && prepared.id === id && prepared.host === host && prepared.sessionId === sessionId, 'changed or foreign continuity proposal');
    const currentFiles = () => prepared.proposal.files.every(file => fileHash(root, file.path) === file.after);
    const currentReferences = () => prepared.references.every(row => fileHash(root, row.path) === row.sha256);
    if (request.status === 'saved') return { saved: true, repeated: true, current: currentFiles() && currentReferences(), receipt: request.receipt };
    check(currentReferences(), 'referenced plan, documentation or evidence changed since prepare');
    let applied;
    try {
      applied = applyMemoryUpdate(root, prepared.proposal, { authorized: true });
    } catch (error) {
      if (error.code === 'EEXIST' && error.path === safeIntegrityPath(root, '.verify/integrity/state.lock')) throw Object.assign(Error('Memory writer is busy; retry the SAME prepared save after that writer finishes. Do not prepare a replacement for this lock conflict.', { cause: error }), { code: error.code });
      throw error;
    }
    check(currentFiles() && currentReferences(), 'saved files or references changed; request stays pending for review');
    request.status = 'saved';
    request.receipt = { savedAt: now, proposalPath, fingerprint, files: prepared.proposal.files.map(file => ({ path: file.path, sha256: file.after })), references: prepared.references, handoffPath: prepared.handoffPath, nextStep: prepared.nextStep, evidenceStatus: prepared.evidenceStatus, basis: 'Saved bytes and references. The lead is responsible for the meaning and truth of claims.', backupId: applied.backupId ?? null };
    writeIntegrityFile(root, STATE, store);
    return { saved: true, repeated: false, current: true, receipt: request.receipt };
  });
}
