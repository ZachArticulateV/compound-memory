# Watch CI

Follow a PR's checks to a decision and fix what fails, at its cause.

## Loop

1. Wait for the checks on the current head to finish (`gh pr checks --watch`,
   or the host's equivalent; prefer an event or a single long wait to polling).
2. All green: report it and stop.
3. For each red check, read its log and decide whose failure it is:
   - **This PR's:** reproduce it locally, fix the cause, run the same check
     locally, commit, and push.
   - **Not this PR's:** the same check is red on the base branch, or the error
     names a service the diff does not touch. Say so on the PR, with the
     evidence, and port the fix when one exists.
   - **Infrastructure** (the job died before any test ran): re-run it once.
4. Repeat, up to three fix rounds on one PR by default. Then stop and report
   the checks still red, what you tried, and what you think is wrong.

"Flaky" is a hypothesis, not a cause. Measure it: run the test in a loop and
report the failure rate. Make the test robust when the fix is in scope; leave
it alone otherwise, and say so. A test is never skipped or disabled to get a
green run.

## Merge conflicts

When the base branch moved and the PR conflicts, merge the base into the branch,
resolve, regenerate lockfiles with the project's tool rather than by hand, run
the checks, and push. On a branch someone else owns, merge rather than rebase.

Report each check's final state and, for every fix, the commit that made it.
