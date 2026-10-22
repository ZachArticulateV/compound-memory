# Pull request

Push the branch and open, or update, a pull request a reviewer can judge in a
minute.

1. **Check the branch:** it is not the default branch, it is up to date with
   its base (merge the base in when it has moved and conflicts are likely), and
   the working tree is committed.
2. **Push** with `git push -u <remote> HEAD`, using the remote chosen in the
   router's conventions.
3. **Write the body.** Use the repository's PR template when it has one, and
   fill it from these parts:

   ```markdown
   ## Summary
   What changed and why, in two or three sentences.

   ## Changes
   By requirement or ticket (R1, 03), not by file.

   ## Verification
   Before and after for the behavior that changed (a failing then passing
   test run, two screenshots, two outputs); each command run and its result;
   each `verify` evidence path; what was not verified, and why.

   ## Merge danger
   One-way or two-way door (can it be rolled back by reverting?), and the
   blast radius: who or what is affected if it is wrong.

   ## Open items
   - [ ] Review findings not applied, with their severity
   - [ ] Assumptions made without the user (from an autopilot run)
   ```

   State each check's result as observed, with the code version it ran on.
   When there is a run record for this work, take the results from
   `node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" gate --run <id>`:
   a stale or failed check is listed as such, never as passing.
4. **Open it** (`gh pr create`, or the host's GitHub tool) as a draft when the
   work is not ready for review. For an existing PR, update the body and say
   what changed since the last push. Before creating, look for an open PR on
   this branch (`gh pr list --head <branch>`); update it rather than opening a
   second one.

Report "PR created" with its URL. Checks have not passed yet; `watch` says when
they have.
