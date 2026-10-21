#!/usr/bin/env node
// layout-check.mjs — fail when a page loses content at a phone, tablet, or
// desktop width.
//
// Reports a page that scrolls sideways, a control that extends past the
// viewport, a control cut off by an ancestor that clips (overflow hidden or
// clip), and a control whose own text is cut off. A control that overflows a
// scrollable ancestor (overflow auto or scroll) is reachable by scrolling and
// is not reported: an earlier version flagged every wide table in a scroll
// area (2026-10-21 audit).
//
// Writes a screenshot per width and layout.json to the evidence directory.
// Exits 0 when no width has a problem, 1 when one does, 3 when Playwright or
// Chromium is unavailable (not checked), 2 on a usage error.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FAILED, NOT_CHECKED, PASSED, USAGE, evidenceDir, launch, loadPlaywright, parse, toUrl, writeJson } from './lib.mjs'

const HELP = `Usage: layout-check.mjs <url|file> [--widths 375,768,1280] [--height 900] [--wait-for <selector>] [--out <dir>]

Evidence goes to --out, else $EVIDENCE_DIR, else .verify/evidence/layout.
Exits 0 passed, 1 failed, 3 not checked (Playwright or Chromium missing), 2 usage.
`

/** Runs in the page. Returns one message per problem. */
export function findLayoutProblems() {
  const out = []
  const vw = document.documentElement.clientWidth
  if (document.documentElement.scrollWidth > vw + 1) {
    out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide in a ${vw}px viewport)`)
  }
  const clips = (v) => v === 'hidden' || v === 'clip'
  const scrolls = (v) => v === 'auto' || v === 'scroll'
  const controls = document.querySelectorAll('input, select, textarea, button, label, [role="button"], a.button')
  for (const el of controls) {
    const r = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue
    const name = el.getAttribute('aria-label') || el.getAttribute('name') || el.id || el.textContent.trim().slice(0, 40) || el.tagName.toLowerCase()
    let handled = false
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p)
      const pr = p.getBoundingClientRect()
      const outX = r.right > pr.right + 1 || r.left < pr.left - 1
      const outY = r.bottom > pr.bottom + 1 || r.top < pr.top - 1
      if ((outX && clips(ps.overflowX)) || (outY && clips(ps.overflowY))) {
        out.push(`"${name}" is cut off by its container <${p.tagName.toLowerCase()}${p.id ? `#${p.id}` : ''}>`)
        handled = true
        break
      }
      if ((outX && scrolls(ps.overflowX)) || (outY && scrolls(ps.overflowY))) {
        handled = true
        break
      }
    }
    if (!handled && (r.right > vw + 1 || r.left < -1)) out.push(`"${name}" extends past the viewport`)
    const isTextEntry = el.matches('input, textarea, select')
    if (!isTextEntry && el.scrollWidth > el.clientWidth + 1 && clips(style.overflowX)) out.push(`"${name}" cuts off its own text`)
  }
  return out
}

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals, error } = parse(argv, {
    widths: { type: 'string', default: '375,768,1280' },
    height: { type: 'string', default: '900' },
    'wait-for': { type: 'string' },
    out: { type: 'string' },
  }, HELP)
  if (values.help) {
    process.stdout.write(HELP)
    return PASSED
  }
  const widths = String(values.widths ?? '').split(',').map(Number)
  if (error !== null || positionals.length !== 1 || widths.some((w) => !Number.isInteger(w) || w <= 0)) {
    process.stderr.write(`layout-check: ${error ?? 'give one URL or file, and widths as whole numbers'}\n\n${HELP}`)
    return USAGE
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
  const dir = evidenceDir(values.out, '.verify/evidence/layout')
  const report = { url, widths: [], passed: true }
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: Number(values.height) } })
      await page.goto(url, { waitUntil: 'networkidle' })
      if (values['wait-for']) await page.waitForSelector(values['wait-for'])
      const problems = await page.evaluate(findLayoutProblems)
      const shot = `layout-${width}.png`
      await page.screenshot({ path: resolve(dir, shot), fullPage: true })
      report.widths.push({ width, problems, screenshot: shot })
      if (problems.length > 0) report.passed = false
      for (const problem of problems) process.stdout.write(`${width}px: ${problem}\n`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
  writeJson(dir, 'layout.json', report)
  process.stdout.write(`${report.passed ? 'PASSED' : 'FAILED'}: layout at ${widths.join(', ')}px. Evidence: ${dir}\n`)
  return report.passed ? PASSED : FAILED
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = await main()
