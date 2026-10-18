# Scripted checks

Re-runnable checks to copy into a verification skill's helpers. Each one exits
non-zero on a failure and writes its evidence to `EVIDENCE_DIR`. They assume
Playwright is installed in the project (`npm i -D playwright`); adapt them to
the project's own harness when it has one.

## Clipped or overflowing layout

Fails when the page scrolls sideways, or when a form control, label, or button
is cut off by its container or the viewport, at phone, tablet, and desktop
widths. It catches the form that looks fine on a wide screen and loses its
right edge on a phone.

```js
// layout-check.mjs: node layout-check.mjs <url> [width,width,...]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.argv[2]
const widths = (process.argv[3] ?? '375,768,1280').split(',').map(Number)
const dir = process.env.EVIDENCE_DIR ?? '.verify/evidence/layout'
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch()
let failures = 0
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(url, { waitUntil: 'networkidle' })
  const problems = await page.evaluate(() => {
    const out = []
    const vw = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth > vw + 1) {
      out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide in a ${vw}px viewport)`)
    }
    const controls = document.querySelectorAll('input, select, textarea, button, label, [role="button"], a.button')
    for (const el of controls) {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue
      const name = el.getAttribute('aria-label') || el.getAttribute('name') || el.id || el.textContent.trim().slice(0, 40) || el.tagName.toLowerCase()
      if (r.right > vw + 1 || r.left < -1) out.push(`"${name}" extends past the viewport`)
      const isTextEntry = el.matches('input, textarea')
      if (!isTextEntry && el.scrollWidth > el.clientWidth + 1 && style.overflowX !== 'visible') out.push(`"${name}" cuts off its own text`)
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p)
        if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue
        const pr = p.getBoundingClientRect()
        if (r.right > pr.right + 1 || r.left < pr.left - 1 || r.bottom > pr.bottom + 1) {
          out.push(`"${name}" is cut off by its container <${p.tagName.toLowerCase()}${p.id ? `#${p.id}` : ''}>`)
          break
        }
      }
    }
    return out
  })
  await page.screenshot({ path: `${dir}/layout-${width}.png`, fullPage: true })
  for (const problem of problems) console.log(`${width}px: ${problem}`)
  failures += problems.length
  await page.close()
}
await browser.close()
process.exit(failures > 0 ? 1 : 0)
```

## Console errors and failed requests

Fails on any console error, uncaught exception, or response with status 400 or
above while a page loads and a journey runs.

```js
// console-check.mjs: node console-check.mjs <url>
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
const problems = []
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
page.on('pageerror', (e) => problems.push(`exception: ${e.message}`))
page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`))
await page.goto(process.argv[2], { waitUntil: 'networkidle' })
// Drive the journey here with the feature map's steps.
await browser.close()
for (const p of problems) console.log(p)
process.exit(problems.length > 0 ? 1 : 0)
```

## Component provenance

Checks that a UI change uses the components the project installed from its
registry (for example components added from 21st.dev or shadcn into
`components/ui/`) instead of hand-rolled copies. Read the registry directory
from `components.json` when the project has one.

```bash
# component-check.sh: fail when the change adds a raw element that an installed component replaces.
base=$(git merge-base HEAD "${BASE_REF:-origin/main}")
ui_dir=${UI_DIR:-components/ui}
status=0
for el in button input select textarea dialog checkbox; do
  ls "$ui_dir/$el".* >/dev/null 2>&1 || continue
  if git diff "$base" -- '*.tsx' '*.jsx' | grep -nE "^\+.*<${el}([ />]|$)"; then
    echo "raw <$el> added while $ui_dir/$el exists; use the installed component"
    status=1
  fi
done
exit $status
```

Report which registry components the change imports
(`grep -n "components/ui/" <changed files>`) as evidence that the intended
components are in use.

## API contract

For a service: call each changed endpoint with `curl -sS -w '\n%{http_code}\n'`,
save the request and response to the evidence directory, and compare the status
and the fields the requirement names.

## CLI transcript

For a CLI or TUI: run each command in an isolated tmux session or PTY, and save
the command, stdout, stderr, and exit code.
