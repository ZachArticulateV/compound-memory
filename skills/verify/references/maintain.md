# Maintain the verification skill

Keep the verification skill and its feature map true as the app changes. A map
that describes last month's app sends the next agent down paths that no longer
exist.

Run it after a change that adds, removes, or moves a user-facing feature; when a
`verify run` hit a selector, command, or precondition the map got wrong; or as a
periodic pass.

## Scope

Edit only the verification skill's own directory: its `SKILL.md`, `features/`,
and the helpers it owns. A behavior the map describes that the app no longer
does is either map drift (fix the map) or a product regression (report it to
the user and leave the product code alone).

## Pass

0. **Find the skill:** `.claude/skills/verify-*` or `.agents/skills/verify-*`.
   With several, ask which one; with none, run `verify create` instead.
1. **Index.** Check `features/README.md` against the feature files, and fix
   every missing, extra, duplicate, or dead entry it reports:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/verify/feature-map-check.mjs" <skill dir>/features
   ```

2. **Read the source per feature.** One read-only subagent per feature file,
   all at once. Each explains from the code how the feature works for a user,
   flags drift with citations, and returns one recipe for driving it. Then look
   at recent changes for user-facing surfaces the map does not list; name the
   source path before calling one missing. Check each cited drift against its
   source before editing the map, and merge overlapping recipes so the live
   pass needs few app states.
3. **Drive every feature live**, even when the source looks clean. Follow the
   skill's own launch model. Run Doctor before the first drive, on each fresh
   session, and after any failed drive. Keep captured evidence through every
   cleanup, and clean up what each failed drive left behind (on a shared
   instance, the residue, not the instance). A wedged UI on a healthy process
   gets a reset or a relaunch. A Doctor failure caused by the skill's own drift
   is fixed and retried once before the pass is called blocked. A feature that
   cannot be reached is reported with the prerequisite it needs (a login, an
   entitlement, an operating system) and the route tried; a prerequisite the
   map never mentioned is drift too. Tear down after the last re-proof.
4. **Sort what you found:**
   - a wrong or missing description is map drift: fix it;
   - working behavior the harness cannot drive is a harness gap: fix the helper
     and re-drive it;
   - behavior that is actually broken is a product gap: record it for the user.

## Outcome

Say which:

- **clean:** every feature had source and live coverage, and nothing needed a
  change;
- **changed:** one set of proven corrections, committed (or one PR);
- **blocked:** coverage could not finish, and exactly why.

Report the features covered, unreachable prerequisites, confirmed drift, and the
evidence path for each feature you re-proved.
