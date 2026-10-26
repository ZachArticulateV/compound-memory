#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePayload, payloadRoot, readStdin } from './session-status-hook.mjs';
import { continuitySignal } from './hosts/continuity.mjs';
import { hookPolicy } from './hosts/events.mjs';

export function runContinuityHook(raw, options = {}) {
  try {
    if(!hookPolicy(options.env).enabled)return {code:0,stdout:''};
    const payload = parsePayload(raw);
    if (payload.hook_event_name !== 'UserPromptSubmit') return { code: 0, stdout: '' };
    const text = continuitySignal(payloadRoot(payload), payload, options);
    return { code: 0, stdout: text ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }) + '\n' : '' };
  } catch { return { code: 0, stdout: '' }; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = runContinuityHook(await readStdin()); process.stdout.write(result.stdout); } catch {}
  process.exitCode = 0;
}
