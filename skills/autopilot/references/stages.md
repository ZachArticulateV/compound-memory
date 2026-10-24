# Stages

What each stage receives, what it hands on, and the gate it clears before the
next stage starts. Each skill's own reference has the detail; this file only
joins them.

| Stage | Receives | Hands on | Gate |
| --- | --- | --- | --- |
| Plan | the request, memory, lessons | a plan file | `plan-check.mjs` passes, and the rest of the readiness check in `../plan/references/plan.md` holds |
| Tickets (large work) | the plan | a tickets directory | `tickets-check.mjs` reports no cycle or unknown blocker |
| Debug (defects) | the report | a fix with a regression test | the reproduction passes and the regression test failed first |
| Build | the plan or tickets | commits, one per unit | every unit's check gave the right answer this run (failed first for new behavior; unchanged for cleanup), recorded in the run record |
| Simplify | the branch diff | smaller commits | the suite result is unchanged |
| Verify | the requirements, the diff | evidence under `.verify/evidence/<run-id>/` | each user-facing behavior is recorded as passed (output saved), or unchecked with a reason |
| Review | the diff from `changes.mjs review`, the plan | findings and applied fixes | `findings-check.mjs --final` exits 0 |
| Re-check | the run record | fresh results | `run-record.mjs gate` exits 0 on the code after review's fixes |
| Learn | what the run discovered | a lesson file, when one is warranted | `memory-validate.mjs` reports no new finding on the lesson |
| Ship | commits, the run record, open items | a PR URL (through the project's own publishing process when its instructions name one) | `pr-state.mjs` exits 0: checks passed on the PR's current head |

## Reading a stage's result

Advance only on a result that carries its evidence. "Done" without the check
output, a PR without a URL, or a review without its findings file counts as not
done: run the stage again once, then stop and report.

## Open items

Write every one of these into the PR body's Open items list (or the final
report when there is no PR):

- review findings that were not applied, with severity;
- decisions made without the user, with the reason;
- behaviors `verify` could not drive;
- red CI checks that are not this PR's, with the evidence (still red, and
  reported as red);
- optional checks recorded as unchecked, with the reason.

## Resuming

When a run stops partway, the files say where it got to: the run record
(`run-record.mjs gate --run <id>`, or `--run latest` when the id is lost, lists what passed, what is stale, the open
items, and the next action), the plan, the tickets' status lines, the commits,
and the PR (`pr-state.mjs`). A new run picks up at the first stage whose gate
is not yet met, and re-runs a passed check only when `gate` says it is stale.

## Attempt limits

One check that fails three times in a run, three fix rounds on CI, or three
failed fixes for one bug: stop that line of work and report what was tried.
The run record counts the attempts per check.
