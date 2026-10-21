#!/usr/bin/env node
// console-check.mjs — fail on console errors, uncaught exceptions, and failed
// requests while a page loads and a user journey runs.
//
// The journey is a module whose default export drives the page the way a user
// does: `export default async ({ page, url, evidence }) => { ... }`. Without
// --journey only the page load is checked, and the output says so: a load is
// not a journey. (The earlier snippet left the journey as a comment and never
// wrote evidence; 2026-10-21 audit.)
//
// Writes console.json and a final screenshot to the evidence directory. Exits
// 0 when nothing was reported, 1 when something was or the journey threw, 3
// when Playwright or Chromium is unavailable (not checked), 2 on a usage error.

import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FAILED, NOT_CHECKED, PASSED, USAGE, evidenceDir, launch, loadPlaywright, parse, toUrl, writeJson } from './lib.mjs'

const HELP = `Usage: console-check.mjs <url|file> [--journey <module.mjs>] [--allow <regex>] [--out <dir>]

--journey  a module exporting async ({ page, url, evidence }) => {} that drives the page
--allow    ignore problems whose text matches this regular expression (say why in the report)
Evidence goes to --out, else $EVIDENCE_DIR, else .verify/evidence/console.
Exits 0 passed, 1 failed, 3 not checked (Playwright or Chromium missing), 2 usage.
`

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals, error } = parse(argv, {
    journey: { type: 'string' },
    allow: { type: 'string' },
    out: { type: 'string' },
  }, HELP)
  if (values.help) {
    process.stdout.write(HELP)
    return PASSED
  }
  let allow = null
  try {
    allow = values.allow ? new RegExp(values.allow) : null
  } catch (err) {
    process.stderr.write(`console-check: --allow is not a regular expression: ${err.message}\n`)
    return USAGE
  }
  if (error !== null || positionals.length !== 1) {
    process.stderr.write(`console-check: ${error ?? 'give one URL or file'}\n\n${HELP}`)
    return USAGE
  }
  let journey = null
  if (values.journey) {
    try {
      journey = (await import(pathToFileURL(resolve(values.journey)).href)).default
    } catch (err) {
      process.stderr.write(`console-check: cannot load the journey ${values.journey}: ${err.message}\n`)
      return USAGE
    }
    if (typeof journey !== 'function') {
      process.stderr.write(`console-check: ${values.journey} has no default export function\n`)
      return USAGE
    }
  }
  const { chromium, error: missing } = await loadPlaywright()
  if (!chromium) {
    process.stdout.write(`NOT CHECKED: ${missing}\n`)
    return NOT_CHECKED
  }
  const { browser, error: noBrowser } = await launch(chromium)
  if (!browser) {
    process.stdout.write(`NOT CHECKED: ${noBrowser}\n`)
    return NOT_CHECKED
  }
  const url = toUrl(positionals[0])
  const dir = evidenceDir(values.out, '.verify/evidence/console')
  if (dir === null) {
    await browser.close()
    process.stderr.write(`${'console-check'}: the evidence directory must be under .verify/ in the working directory\n`)
    return USAGE
  }
  const problems = []
  const ignored = []
  const note = (text) => (allow && allow.test(text) ? ignored : problems).push(text)
  const report = { url, journey: values.journey ?? null, journeyDriven: false, problems, ignored, passed: false }
  try {
    const page = await browser.newPage()
    page.on('console', (m) => m.type() === 'error' && note(`console: ${m.text()}`))
    page.on('pageerror', (e) => note(`exception: ${e.message}`))
    page.on('requestfailed', (r) => note(`request failed: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`))
    page.on('response', (r) => r.status() >= 400 && note(`${r.status()} ${r.url()}`))
    await page.goto(url, { waitUntil: 'networkidle' })
    if (journey) {
      try {
        await journey({ page, url, evidence: dir })
        report.journeyDriven = true
        await page.waitForLoadState('networkidle').catch(() => {})
      } catch (err) {
        problems.push(`journey threw: ${String(err.message).split('\n')[0]}`)
      }
    }
    await page.screenshot({ path: resolve(dir, 'console-final.png'), fullPage: true })
  } finally {
    await browser.close()
  }
  report.passed = problems.length === 0
  writeJson(dir, 'console.json', report)
  for (const p of problems) process.stdout.write(`${p}\n`)
  const scope = journey ? (report.journeyDriven ? 'page load and journey' : 'page load; the journey did not finish') : 'page load only; no journey was driven'
  process.stdout.write(`${report.passed ? 'PASSED' : 'FAILED'}: ${scope}. Evidence: ${dir}\n`)
  return report.passed ? PASSED : FAILED
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = await main()
