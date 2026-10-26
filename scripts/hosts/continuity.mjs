// Passive notification only. The active lead owns all canonical memory writes.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requestContinuity, pendingContinuity, pendingContinuityCounts } from '../lib/continuity.mjs';
import { digest, safeIntegrityPath, writeIntegrityFile, withIntegrityLock } from '../lib/integrity-state.mjs';
import { contextCheckpoint, contextReading, readContextTelemetry } from './context.mjs';
import { localHooksEnabled } from './integrity-events.mjs';

const validId = value => typeof value === 'string' && value.length > 0 && value.length < 200 && !/[\x00-\x1f]/.test(value);
const signalsPath = '.verify/integrity/continuity-signals.json';
const readSignals = root => {
  const path = safeIntegrityPath(root, signalsPath);
  const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { schemaVersion: 1, sessions: {} };
  if (state.schemaVersion !== 1 || !state.sessions || typeof state.sessions !== 'object' || Array.isArray(state.sessions)) throw Error('invalid continuity signal state');
  return state;
};

function oldLockNotice(root, now) {
  try {
    for (const name of ['continuity.lock', 'state.lock']) {
      const path = safeIntegrityPath(root, '.verify/integrity/' + name);
      if (!existsSync(path)) continue;
      const bytes = readFileSync(path, 'utf8'), lock = JSON.parse(bytes);
      if (!Number.isSafeInteger(lock.createdAt) || now - lock.createdAt < 300000) continue;
      const marker = safeIntegrityPath(root, `.verify/integrity/lock-notices/${digest(name + bytes)}.json`, { createParents: true });
      if (existsSync(marker)) continue;
      writeFileSync(marker, JSON.stringify({ name, at: now }), { flag: 'wx' });
      return `project-memory: the passive save queue's ${name} has stayed locked for at least five minutes. No memory save is confirmed by this notice. Keep working. Inspect the lock owner and use the recovery steps in the continuity recipe; never remove a live writer's lock.`;
    }
  } catch {}
  return null;
}

export function continuitySignal(root, payload, { now = Date.now(), env = process.env } = {}) {
  let active = false;
  try {
    if (env.COMPOUND_MEMORY_HOOKS === '0' || !localHooksEnabled(root) || payload.agent_id || ['integrity', 'repair', 'worker'].includes(env.COMPOUND_MEMORY_ORIGIN)) return null;
    if (!['PostToolUse', 'UserPromptSubmit', 'SessionStart'].includes(payload.hook_event_name) || !validId(payload.session_id)) return null;
    const ownerPath = safeIntegrityPath(root, '.verify/integrity/status-line-owner.json');
    if (!existsSync(ownerPath) || JSON.parse(readFileSync(ownerPath, 'utf8')).restored || !existsSync(safeIntegrityPath(root, 'memory'))) return null;
    active = true;
    const lockNotice = oldLockNotice(root, now);
    if (lockNotice) return lockNotice;
    const identity = { host: 'claude', sessionId: payload.session_id };
    const key = digest(identity);
    const session = withIntegrityLock(root, () => {
      const state = readSignals(root);
      if (!state.sessions[key]) {
        // Signal bookkeeping may expire. Pending saves live in a separate store.
        const keys = Object.keys(state.sessions);
        if (keys.length >= 100) delete state.sessions[keys.sort((a,b) => state.sessions[a].seenAt - state.sessions[b].seenAt)[0]];
        state.sessions[key] = { startedAt: now, seenAt: now, notifiedAt: null, notifiedId: null };
        writeIntegrityFile(root, signalsPath, state);
      }
      if(payload.hook_event_name==='SessionStart'&&payload.source==='compact'){
        state.sessions[key].notices={};state.sessions[key].startedAt=now;
        writeIntegrityFile(root,signalsPath,state);
      }
      return state.sessions[key];
    });
    const recipe = fileURLToPath(new URL('../../references/continuity.md', import.meta.url));
    let recovery = null;
    if(payload.hook_event_name==='SessionStart'&&!session.otherNotified){
      const counts=pendingContinuityCounts(root,identity);
      if(counts.otherSessions){
        withIntegrityLock(root,()=>{const state=readSignals(root);state.sessions[key].otherNotified=true;writeIntegrityFile(root,signalsPath,state)});
        recovery=`project-memory: ${counts.otherSessions} pending save request(s) belong to other sessions. Read ${JSON.stringify(recipe)} for recovery. Do not claim or complete another session's request automatically.`;
      }
    }
    let pending = pendingContinuity(root, identity);
    if (!pending.length && now - session.startedAt >= 1800000) {
      const telemetry = readContextTelemetry(root,identity);
      const modelId = telemetry?.sessionId === identity.sessionId && validId(telemetry.modelId) ? telemetry.modelId : 'unknown';
      const measured = contextReading(telemetry, { ...identity, modelId, epoch: telemetry?.epoch, now });
      if (measured.usedPercentage === null) {
        const checkpoint = contextCheckpoint(root, { ...identity, modelId, event: 'time-fallback', now, nextStep: 'Save progress and keep working.' });
        if (checkpoint.path) requestContinuity(root, { ...identity, modelId, epoch: checkpoint.epoch, reason: 'time-fallback', checkpointPath: checkpoint.path, now });
      }
      pending = pendingContinuity(root, identity);
    }
    const isDue = notice => !notice || now-notice.at >= (notice.count>=5?1800000:60000*2**(notice.count-1));
    const request = pending.find(row=>isDue(session.notices?.[row.id]));
    if (!request) return recovery;
    const emit = withIntegrityLock(root, () => {
      const state = readSignals(root), current = state.sessions[key];
      current.notices ??= {};
      const notice=current.notices[request.id];
      if(!isDue(notice))return false;
      for(const id of Object.keys(current.notices))if(!pending.some(row=>row.id===id))delete current.notices[id];
      current.notices[request.id]={count:(notice?.count??0)+1,at:now};
      current.notifiedId = request.id; current.notifiedAt = now; current.seenAt = now;
      writeIntegrityFile(root, signalsPath, state); return true;
    });
    if (!emit) return recovery;
    return [`project-memory: passive continuity save is due (request ${request.id}; ${pending.length} pending). At the next safe task step, read ${JSON.stringify(recipe)} and save verified progress, current memory, a continuation handoff, and plan/proof links. Use the Bash tool with setup's exact helper commands. This request is pending; memory has not been saved by this hook. Keep the session open and continue the user's work. Do not ask for routine approval. Respect explicit read-only scope; leave the request pending if writes are not allowed. Do not transfer run ownership or start another session.`,recovery].filter(Boolean).join('\n');
  } catch {
    // A stale lock must not become a silent permanent loss of continuity.
    // Record one notice per lock instance without taking the blocked lock.
    if (!active) return null;
    return oldLockNotice(root, now);
  }
}
