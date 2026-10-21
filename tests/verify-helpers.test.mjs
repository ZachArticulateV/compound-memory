// The verification helpers under scripts/verify/, run against fixture pages.
//
// The browser cases need Playwright and Chromium; they skip when either is
// missing (as on CI) and say so. The not-checked case always runs: a helper
// without Playwright must exit 3, never 0, so a missing tool cannot read as a
// pass.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { cleanupAfter, makeTempRoot, writeTree } from './fixtures/build.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const helper = (name) => join(repoRoot, 'scripts', 'verify', name)

function playwrightAvailable() {
  try {
    createRequire(join(repoRoot, 'package.json')).resolve('playwright')
  } catch {
    return 'Playwright is not installed'
  }
  const probe = spawnSync(process.execPath, ['-e', "require('playwright').chromium.launch().then(b => b.close()).then(() => process.exit(0), () => process.exit(1))"], { encoding: 'utf8', timeout: 60_000 })
  return probe.status === 0 ? null : 'Chromium does not start here'
}
const missing = playwrightAvailable()
const browser = () => (missing === null ? { timeout: 120_000 } : { skip: missing })

const PAGES = {
  'clipped.html': '<!doctype html><meta name=viewport content="width=device-width"><style>form{width:300px;overflow:hidden}input{width:500px}</style><form><label>Name <input name="fullname"></label></form>',
  'scroll.html': '<!doctype html><meta name=viewport content="width=device-width"><style>.wrap{overflow-x:auto}table{width:1200px}</style><div class=wrap><table><tr><td><button>Edit row</button></td><td style="width:1100px"></td><td><button>Delete row</button></td></tr></table></div>',
  'clean.html': '<!doctype html><meta name=viewport content="width=device-width"><form><label>Name <input name="n"></label><button>Save</button></form>',
  'console.html': '<!doctype html><button id=go onclick="console.error(\'save failed: 500\')">Save</button>',
  'journey.mjs': "export default async ({ page }) => { await page.click('#go') }\n",
}

function pages(t) {
  const root = makeTempRoot()
  cleanupAfter(t, root)
  writeTree(root, PAGES)
  return root
}
const run = (name, args, cwd, env = process.env) => spawnSync(process.execPath, [helper(name), ...args], { cwd, encoding: 'utf8', env, timeout: 120_000 })

test('a helper without Playwright exits 3, not checked, with the install command', (t) => {
  const root = pages(t)
  const env = { ...process.env }
  delete env.NODE_PATH
  for (const name of ['layout-check.mjs', 'console-check.mjs']) {
    const res = run(name, [join(root, 'clean.html'), '--out', join(root, 'out')], root, env)
    if (res.status === 0 || res.status === 1) t.skip('Playwright resolves without NODE_PATH here, so the missing case cannot be staged')
    assert.equal(res.status, 3, res.stdout + res.stderr)
    assert.match(res.stdout, /NOT CHECKED: .*npm i -D playwright/)
  }
})

test('layout: a control clipped by its container fails, with a screenshot and a report', browser(), (t) => {
  const root = pages(t)
  const res = run('layout-check.mjs', [join(root, 'clipped.html'), '--widths', '375', '--out', join(root, 'out')], root)
  assert.equal(res.status, 1, res.stdout + res.stderr)
  assert.match(res.stdout, /cut off by its container <form>/)
  assert.ok(existsSync(join(root, 'out', 'layout-375.png')))
  assert.equal(JSON.parse(readFileSync(join(root, 'out', 'layout.json'), 'utf8')).passed, false)
})

test('layout: a wide table inside a scroll area passes', browser(), (t) => {
  // The earlier snippet reported "Delete row" as cut off and past the viewport.
  const root = pages(t)
  const res = run('layout-check.mjs', [join(root, 'scroll.html'), '--widths', '375', '--out', join(root, 'out')], root)
  assert.equal(res.status, 0, res.stdout + res.stderr)
})

test('layout: a clean form passes at every default width', browser(), (t) => {
  const root = pages(t)
  const res = run('layout-check.mjs', [join(root, 'clean.html'), '--out', join(root, 'out')], root)
  assert.equal(res.status, 0, res.stdout + res.stderr)
  for (const w of [375, 768, 1280]) assert.ok(existsSync(join(root, 'out', `layout-${w}.png`)))
})

test('console: a page load alone passes but says no journey was driven', browser(), (t) => {
  const root = pages(t)
  const res = run('console-check.mjs', [join(root, 'console.html'), '--out', join(root, 'out')], root)
  assert.equal(res.status, 0, res.stdout + res.stderr)
  assert.match(res.stdout, /page load only; no journey was driven/)
  assert.equal(JSON.parse(readFileSync(join(root, 'out', 'console.json'), 'utf8')).journeyDriven, false)
})

test('console: the journey drives the page and its console error fails the check, with evidence', browser(), (t) => {
  const root = pages(t)
  const res = run('console-check.mjs', [join(root, 'console.html'), '--journey', join(root, 'journey.mjs'), '--out', join(root, 'out')], root)
  assert.equal(res.status, 1, res.stdout + res.stderr)
  assert.match(res.stdout, /save failed: 500/)
  const report = JSON.parse(readFileSync(join(root, 'out', 'console.json'), 'utf8'))
  assert.equal(report.journeyDriven, true)
  assert.ok(existsSync(join(root, 'out', 'console-final.png')))
  const allowed = run('console-check.mjs', [join(root, 'console.html'), '--journey', join(root, 'journey.mjs'), '--allow', 'save failed', '--out', join(root, 'out2')], root)
  assert.equal(allowed.status, 0, allowed.stdout)
})
