# Pull request

Push the branch and open, or update, a pull request a reviewer can judge in a
minute.

1. **Check the branch:** it is not the default branch, it is up to date with
   its base (merge the base in when it has moved and conflicts are likely), and
   the working tree is committed. Fetch and list `git log <remote>/<base>..HEAD`:
   a commit that was made on the local default branch and never pushed rides
   into the PR, so ask whether it belongs.
2. **Push** with `git push -u <remote> HEAD`, using the remote chosen in the
   router's conventions.
3. **Write the body.** Size it to what the reviewer must decide: a small
   change is one to three sentences and its verification line; add a section
   only when it answers a question a reviewer would ask. Use the repository's
   PR template when it has one (its required sections stay), and fill it from
   these parts:

   ```markdown
   ## Summary
   What is now different and why, in two or three sentences, beside the
   smallest picture that makes it clear when words alone do not: pseudocode
   for logic, a call tree for control flow, a file or component tree for
   structure, a Mermaid sequence for parts talking to each other, or a `diff`
   of that sketch when the shape already existed. One or two at most.

   ## Changes
   By requirement or ticket (R1, 03), not by file.

   ## Verification
   Before and after for the behavior that changed: a screenshot pair for a
   visual change, otherwise a failing then passing test run or two outputs;
   each command run and its result; each `verify` evidence path; what was not
   verified, and why.

   ## Merge danger
   One-way or two-way door (can it be rolled back by reverting?), and the
   blast radius: who or what is affected if it is wrong.

   ## Open items
   - [ ] Review findings not applied, with their severity
   - [ ] Assumptions made without the user (from an autopilot run)
   ```

   A ticket's PR says where it sits in its series (02 of 05, blocked by 01).
   Use a closing keyword (`Closes #12`) only when the PR fully resolves that
   issue and targets the default branch; otherwise write `Related: #12`. Keep
   the issue references an existing body has when you rewrite it.

   State each check's result as observed, with the code version it ran on.
   When there is a run record for this work, take the results from
   `node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" gate --run <id>`:
   a stale or failed check is listed as such, never as passing.
4. **Open it** (`gh pr create --body-file <file>`, or the host's GitHub tool)
   as a draft when the work is not ready for review, then read the PR back to
   confirm the body arrived intact. For an existing PR, update the body and
   say what changed since the last push. Before creating, look for an open PR
   on this branch (`gh pr list --head <branch>`, with `-R <base repo>` from a
   fork, matching the head's owner); update it rather than opening a second
   one. A failed lookup means unknown, not none: resolve it before creating.

Report "PR created" with its URL. Checks have not passed yet; `watch` says when
they have.
