# Stages

What each stage receives, what it hands on, and the gate it clears before the
next stage starts. Each skill's own reference has the detail; this file only
joins them.

| Stage | Receives | Hands on | Gate |
| --- | --- | --- | --- |
| Plan | the request, memory, lessons | a plan file | the readiness check in `../plan/references/plan.md` passes |
| Tickets (large work) | the plan | a tickets directory | `tickets-check.mjs` reports no cycle or unknown blocker |
| Debug (defects) | the report | a fix with a regression test | the reproduction passes and the regression test failed first |
| Build | the plan or tickets | commits, one per unit | every unit's check failed before and passes after, observed this run |
| Simplify | the branch diff | smaller commits | the suite result is unchanged |
| Verify | the requirements, the diff | evidence under `.verify/evidence/` | each user-facing behavior passed, or is listed as not driven with a reason |
| Review | the diff, the plan | findings and applied fixes | findings went through `findings-check.mjs`; kept P0 and P1 were re-checked |
| Learn | what the run discovered | a lesson file, when one is warranted | `memory-validate.mjs` reports no new finding on the lesson |
| Ship | commits, evidence, open items | a PR URL | CI is green, or each red check is explained on the PR |

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
- red CI checks that are not this PR's, with the evidence.

## Resuming

When a run stops partway, the files say where it got to: the plan, the
tickets' status lines, the commits, the PR. A new run starting from the plan
path picks up at the first stage whose gate is not yet met.
