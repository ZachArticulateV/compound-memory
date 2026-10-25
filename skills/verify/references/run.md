# Run verification

Prove a change works in the running app and keep the evidence.

## Steps

1. **Decide what to prove.** List the user-facing behaviors the change touches,
   from the plan's requirements, the ticket's `Verify with`, or the diff. Each
   one needs its own evidence. A change to a layout, a global style, or a
   shared component reaches every page that uses it: drive the main ones.
2. **Find the recipe.** Use the project's verification skill
   (`.claude/skills/verify-*` or `.agents/skills/verify-*`) and its feature
   map. Drive every entry point the map lists for an affected feature, not just
   the most convenient one. Without a verification skill, launch the app the
   way its README or package scripts say, and drive it with what the host
   offers (a browser tool, Playwright, curl, a terminal).
3. **Doctor first.** Confirm the instance is up, is the build you just made
   (match a version, build ID, or commit it serves against this checkout), and
   belongs to this run (a process you started, on a port you chose). When two
   apps could answer on one port (a dev server and Storybook), check which one
   did. Record what you matched.
4. **Record into the run** when the result goes on to review or ship. Inside
   a larger run (autopilot names its run id), add to that one with
   `--run <id>`. Start a record only when this work has none:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" start --task "verify <change>" --skill verify --env app=<url>,build=<id>
   ```

5. **Drive and capture** into `.verify/evidence/<run-id>/`: the action, the
   resulting state, what was saved (read back through a second path), side
   effects, and for UI an accessibility snapshot and a screenshot with the app
   visibly identified. A step only an outside party can complete (a provider
   sign-in, an emailed or texted code, a sandbox payment) is handed to the user
   when one is present and recorded as user-confirmed; unattended, the behavior
   is recorded as unchecked with that reason.
6. **Run the scripted checks** that fit the change, from `references/checks.md`
   or the verification skill's helpers, with `--out` set to the run's evidence
   directory. A scripted check is evidence anyone can re-run; an eyeballed
   screenshot is evidence of one moment, and a check seen only in the
   transcript is gone when the session ends.
7. **Compare** what you observed with what the requirement says, decide pass
   or fail for each behavior, and record each one
   (`run-record.mjs add --check <behavior> --exit <0|1> --output <file>`, or
   `--status unchecked --reason` for one you could not drive).
8. **Clean up** what this run started and the test data it created; confirm
   the evidence survived.

## Report

One line per behavior: passed (evidence path), failed (what you saw instead,
then hand it to `debug`), or not driven (the reason, and what would make it
drivable). Name any entry point you skipped; a skipped path is never reported
as verified through a different one. Name the app and version you drove. When
the code changes after this run (a review fix), these results are stale; run
the affected behaviors again.

When a run exposes a gap in the feature map, fix it with `verify maintain`.
