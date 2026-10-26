#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestContinuity, pendingContinuity, prepareContinuity, saveContinuity, recoverContinuityLock } from './lib/continuity.mjs';

export function main(args = process.argv.slice(2)) {
  try {
    const [mode, root, input, sessionId] = args;
    if (mode === '--help') {
      process.stdout.write('Usage: continuity.mjs request|pending|prepare|save|recover-lock <root> <input.json>\nOr: continuity.mjs pending <root> claude|codex <session-id>\nPrepare captures existing file hashes. Save applies only that prepared proposal. Save is an authorized memory write. Recovery requires authorized:true and a stale lock owned by a confirmed dead process. No command stops the session or transfers a run.\n');
      return 0;
    }
    if (!['request', 'pending', 'prepare', 'save', 'recover-lock'].includes(mode) || !root || !input || (args.length !== 3 && !(mode === 'pending' && args.length === 4))) throw Error('Use --help for continuity command inputs.');
    const options = mode === 'pending' && sessionId !== undefined ? { host: input, sessionId } : JSON.parse(readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
    const result = mode === 'request' ? requestContinuity(root, options) : mode === 'pending' ? pendingContinuity(root, options) : mode === 'prepare' ? prepareContinuity(root, options) : mode === 'recover-lock' ? recoverContinuityLock(root, options) : saveContinuity(root, options, { authorized: true });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
  } catch (error) {
    process.stderr.write(error.message + '\n');
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
