// Shared plumbing for the verification helpers.
//
// The helpers run against the project being verified, so Playwright is
// resolved from that project (its node_modules, or NODE_PATH), never from the
// plugin. That means a helper runs the project's own Playwright code, which
// is why no helper is pre-approved in allowed-tools. When it is missing, a helper exits NOT_CHECKED with the install
// command: the check did not run, which is different from passing or failing.

import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

/** Exit codes shared by every helper. */
export const PASSED = 0
export const FAILED = 1
export const USAGE = 2
export const NOT_CHECKED = 3

export async function loadPlaywright(cwd = process.cwd()) {
  try {
    const require = createRequire(join(resolve(cwd), 'package.json'))
    const entry = require.resolve('playwright')
    const mod = await import(pathToFileURL(entry).href)
    return { chromium: mod.chromium ?? mod.default?.chromium, error: null }
  } catch (err) {
    return { chromium: null, error: `Playwright is not installed in this project (${err.code ?? err.message}). Install it with \`npm i -D playwright\` and \`npx playwright install chromium\`, or drive the page another way and record this check as unchecked.` }
  }
}

/** Launch Chromium, or explain why it could not start. */
export async function launch(chromium) {
  try {
    return { browser: await chromium.launch(), error: null }
  } catch (err) {
    return { browser: null, error: `Chromium did not start: ${String(err.message).split('\n')[0]}` }
  }
}

/**
 * The evidence directory: --out, then EVIDENCE_DIR, then a default under
 * .verify/. It must sit under .verify/ in the working directory; anything else
 * is refused (null), so a helper never writes elsewhere.
 */
export function evidenceDir(out, fallback) {
  const dir = resolve(out ?? process.env.EVIDENCE_DIR ?? fallback)
  const rel = relative(resolve('.verify'), dir)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  mkdirSync(dir, { recursive: true })
  return dir
}

export function writeJson(dir, name, value) {
  const file = join(dir, name)
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return file
}

/** A URL, or a local file turned into one, so a fixture page needs no server. */
export function toUrl(target) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) return target
  return pathToFileURL(resolve(target)).href
}

export function parse(argv, options, usage) {
  try {
    const { values, positionals } = parseArgs({ args: argv, options: { help: { type: 'boolean', short: 'h' }, ...options }, allowPositionals: true, strict: true })
    return { values, positionals, error: null }
  } catch (err) {
    return { values: {}, positionals: [], error: `${err.message}\n\n${usage}` }
  }
}
