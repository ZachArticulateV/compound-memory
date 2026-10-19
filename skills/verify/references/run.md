# Run verification

Prove a change works in the running app and keep the evidence.

## Steps

1. **Decide what to prove.** List the user-facing behaviors the change touches,
   from the plan's requirements, the ticket's `Verify with`, or the diff. Each
   one needs its own evidence.
2. **Find the recipe.** Use the project's verification skill
   (`.claude/skills/verify-*` or `.agents/skills/verify-*`) and its feature
   map. Drive every entry point the map lists for an affected feature, not just
   the most convenient one. Without a verification skill, launch the app the
   way its README or package scripts say, and drive it with what the host
   offers (a browser tool, Playwright, curl, a terminal).
3. **Doctor first.** Confirm the instance is up, is the build you just made,
   and belongs to this run.
4. **Drive and capture** into `.verify/evidence/<run-id>/`: the action, the
   resulting state, side effects, and for UI an accessibility snapshot and a
   screenshot with the app visibly identified.
5. **Run the scripted checks** that fit the change, from `references/checks.md`
   or the verification skill's helpers, and save each check and its output
   beside the rest of the run's evidence. A scripted check is evidence anyone
   can re-run; an eyeballed screenshot is evidence of one moment, and a check
   seen only in the transcript is gone when the session ends.
6. **Compare** what you observed with what the requirement says, and decide
   pass or fail for each behavior.
7. **Clean up** what this run started; confirm the evidence survived.

## Report

One line per behavior: passed (evidence path), failed (what you saw instead,
then hand it to `debug`), or not driven (the reason, and what would make it
drivable). Name any entry point you skipped; a skipped path is never reported
as verified through a different one.

When a run exposes a gap in the feature map, fix it with `verify maintain`.
