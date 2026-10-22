# Watch CI

Follow a PR's checks to a decision and fix what fails, at its cause.

## Loop

1. Wait for the checks on the current head to finish (`gh pr checks --watch`,
   or the host's equivalent; prefer an event or a single long wait to polling).
2. Read the state for the current head:

   ```bash
   gh pr view <n> --json number,url,state,isDraft,headRefOid,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup > .verify/pr.json
   node "${CLAUDE_SKILL_DIR}/../../scripts/pr-state.mjs" --input .verify/pr.json
   ```

   It exits 0 only when every check on the PR's head commit passed, there was
   at least one, and your local HEAD is that commit. Add
   `--threads <file>` (the review threads from `gh api graphql`) and
   `--want ready` to ask whether it is ready to merge. With a host GitHub tool
   instead of `gh`, save the same fields to the file.

   Checks passed: report it, with the head SHA, and stop.
3. For each red check, read its log and decide whose failure it is:
   - **This PR's:** reproduce it locally, fix the cause, run the same check
     locally, commit, and push.
   - **Not this PR's:** the same check is red on the base branch, or the error
     names a service the diff does not touch. Say so on the PR, with the
     evidence, and port the fix when one exists.
   - **Infrastructure** (the job died before any test ran): re-run it once.
4. Each push moves the head, so the earlier results stop counting: go back to
   step 1. Repeat up to three fix rounds on one PR by default (a run record
   counts them: `run-record.mjs add` each attempt, `gate` names the check to
   stop on). Then stop and report the checks still red, what you tried, and
   what you think is wrong. A red check that is not this PR's stays red in the
   report, with the evidence.

"Flaky" is a hypothesis, not a cause. Measure it: run the test in a loop and
report the failure rate. Make the test robust when the fix is in scope; leave
it alone otherwise, and say so. A test is never skipped or disabled to get a
green run.

## Merge conflicts

When the base branch moved and the PR conflicts, merge the base into the branch,
resolve, regenerate lockfiles with the project's tool rather than by hand, run
the checks, and push. On a branch someone else owns, merge rather than rebase.

Report the state `pr-state.mjs` gave, each check's final result on the head
SHA, and, for every fix, the commit that made it.
