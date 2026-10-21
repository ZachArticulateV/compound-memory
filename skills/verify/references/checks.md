# Scripted checks

Re-runnable checks that write their evidence and exit with a result anyone can
read. The two browser helpers ship with the plugin and run as they are; the
rest are recipes for other surfaces.

Every helper exits 0 passed, 1 failed, 2 on a usage error, and 3 **not
checked** when Playwright or a browser is missing. Exit 3 is not a pass: record
the check as unchecked with the helper's message as the reason, and drive the
page another way (the host's browser tool, a screenshot read by eye) when the
behavior still needs proof. The helpers resolve Playwright from the project
being verified (`npm i -D playwright`, then `npx playwright install chromium`).
Evidence goes to `--out`, else `$EVIDENCE_DIR`, else a folder under
`.verify/evidence/`.

## Clipped or overflowing layout

Fails when the page scrolls sideways, a control extends past the viewport, a
control is cut off by an ancestor that clips (`overflow: hidden` or `clip`), or
a control cuts off its own text, at each width. A control inside a scroll area
(`overflow: auto` or `scroll`) can be scrolled to and is not reported. Writes a
full-page screenshot per width and `layout.json`.

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/verify/layout-check.mjs" <url-or-file> --widths 375,768,1280 --out .verify/evidence/<run-id>/layout
```

Add `--wait-for <selector>` when the page renders after load.

## Console errors and failed requests during a journey

Fails on a console error, an uncaught exception, a failed request, or a
response of 400 or above, while the page loads and a journey runs. The journey
is a module that drives the page as a user does:

```js
// .verify/journeys/save-invoice.mjs
export default async ({ page }) => {
  await page.getByLabel('Amount').fill('135')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByText('Saved').waitFor()
}
```

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/verify/console-check.mjs" <url> --journey .verify/journeys/save-invoice.mjs --out .verify/evidence/<run-id>/console # not pre-approved: it runs the journey module
```

Without `--journey` it checks the page load only, and says so; a load is not a
journey. `--allow <regex>` ignores known noise (a missing favicon): say why in
the report. Writes `console.json` and a final screenshot.

## Raw elements beside installed components

Flags a change that adds a raw `<button>`, `<input>`, or similar while the
project has an installed component for it (for example under `components/ui/`
from shadcn or 21st.dev). It is a pattern match on the diff: a hit is a
question for review, and no hit does not prove the right component is used.
Read the registry directory from `components.json` when the project has one.

```bash
# component-check.sh: report raw elements added where an installed component exists.
base=$(git merge-base HEAD "${BASE_REF:-origin/main}")
ui_dir=${UI_DIR:-components/ui}
status=0
added() { git diff "$base" -- '*.tsx' '*.jsx'; git ls-files --others --exclude-standard -- '*.tsx' '*.jsx' | xargs -r cat | sed 's/^/+/'; }
for el in button input select textarea dialog checkbox; do
  ls "$ui_dir/$el".* >/dev/null 2>&1 || continue
  if added | grep -nE "^\+.*<${el}([ />]|$)"; then
    echo "raw <$el> added while $ui_dir/$el exists; use the installed component"
    status=1
  fi
done
exit $status
```

## API contract

For a service: call each changed endpoint with `curl -sS -w '\n%{http_code}\n'`,
save the request and response to the evidence directory, and compare the status
and the fields the requirement names. For a write, read the record back with a
second request.

## CLI transcript

For a CLI or TUI: run each command in an isolated tmux session or PTY, and save
the command, stdout, stderr, and exit code.
