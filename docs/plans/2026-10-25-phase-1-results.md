# Phase 1 results

Scope: U4-U7 in the [development plan](2026-10-25-compound-memory-development-plan.md).
Branch: codex/phase1-shared-contracts.
Base commit: e47e021ad51b3a08cde6576749161c94132b5e13.

## Work built

| Unit | Result | Main files |
| --- | --- | --- |
| U4 | Version 2 file rules, ownership, schemas, and small and multi-phase examples. | references/work-contracts.md, references/artifacts.md, schemas/, examples/contracts/ |
| U5 | Plan and gate graph checks. Safe ready-task selection. Legacy ticket errors stop dispatch. Shared resources wait. | scripts/lib/plan-contract.mjs, scripts/plan-check.mjs, scripts/tickets-check.mjs |
| U6 | A local run ledger with one lead writer, revision checks, task claims, retries, owner versions, and immutable result files. | scripts/run-state.mjs, scripts/lib/run-state.mjs |
| U7 | Separate command capture with actual exit and output. Start/end source checks. Reported and captured results stay distinct. | scripts/verify/capture.mjs, scripts/lib/proof.mjs, scripts/run-record.mjs |

The plan JSON owns scope. The ledger owns progress.
Workers write results. The lead accepts them after proof checks.
No second task status field is needed in a ticket or memory file.

The new commands are separate from wildcard-granted inspection helpers.
No skill tool grant was widened.
The old run-record helper does not execute commands.
Legacy plans, tickets, and receipts remain supported within their stated limits.

## Checks

G1 passed for the local shared contracts and tools.
The final whole suite ran through the new capture command.
It recorded exit 0, unchanged scoped inputs, and hashed output.

| Check | Final result |
| --- | --- |
| Whole suite | 805 tests: 780 passed, 0 failed, 25 skipped. About 194 seconds. |
| Skips | 19 model-backed cases stayed off. Six browser checks lacked local Playwright. |
| Version 2 examples | Both plans passed the schema and graph checks. |
| Public command flow | Passed in a Git project at a path with spaces. |
| Legacy plan | Passed as version 1. Its phase prose is not treated as a version 2 execution graph. |
| Memory format | Passed with no findings. This checks structure, not truth. |
| Plugin manifest | Strict validation passed. The existing missing-icon directory warning remains non-blocking. |
| Documents | Local links, JSON parse, and whitespace checks passed. |
| Claude recheck | No remaining P1 or P2 findings in the three recovery fixes. Source review only. |

A04-A07 are accepted within the tested local scope.
This does not pass the later host, specialist, dispatch, schedule, or release gates.

The public CLI test already walks this real flow:

1. A failing calculation test produces failed proof.
2. The lead cannot accept that result.
3. Corrected code produces passing task proof.
4. Task acceptance alone does not complete the run.
5. A final combined check permits completion.
6. Changed saved output revokes current success.

Focused tests also cover cycles, unknown blockers, shared paths and ports,
simultaneous result writes, stale revisions and owners, expiry, retry,
orphan files, locked stores, stale source recovery, and malformed proof.

## Review changes

Claude reviewed the shared rules through its CLI.
The review process had only Read, Grep, and Glob.
The initial review prompted these changes:

- Keep ledger mutations in the new run-state command.
- State that even a lead model can fabricate files if it has write access.
- Treat the host's observed capture call as origin evidence.
- Match the plan's file list to the actual implementation.
- Add Phase 1 rows to the host support record.

The first review ran during implementation.
Its missing-entry-point and unchanged-plan-guide findings described that draft.
The final source has a state CLI and the version 2 plan guide.

Cross-component review found and fixed further cases:

- A stale upstream task must not freeze cancellation or recovery.
- Rechecking an upstream result must not revive old dependent proof.
- An identical accepted result can be replayed after its worker lease ends.
- Environment labels must reach the ready-task check.
- The public CLI must not accept a caller-supplied clock.
- Stopped cancelled work must not keep priority over an eligible task.
- Proof readers must enforce the nested schema, not just top-level fields.
- Ignored input scopes and case variants of runtime paths must not produce false proof.

Claude's final fixed-copy review found three more recovery gaps.
They concern an expired lead with active work, the retry budget for stale accepted work,
and acceptance of a timely result after its worker lease ends.
All three received failing regression tests and fixes.
Claude reread the fixed source and tests. It found no remaining P1 or P2 issue in those fixes.
Both final review copies stayed unchanged during review.

The last corrections permit exact-owner renewal after expiry, give stale accepted work
a new per-work retry budget, and save the result with its receipt in one atomic file.
Assignment numbers still increase. Ordinary failed retries keep their limit.
Late first submissions and old assignments remain rejected.

## Limits

This phase adds local state and proof tools.
It does not start agents, make worktrees, install hooks, or run schedules.
External workspaces and cross-machine state transfer remain later work.
Host registration and full Claude/Codex workflow trials remain open.
The Phase 0 Codex file-read block is not fixed by these Node tests.

Source-plan changes need a new run for now.
Stale accepted work in the same plan can be reopened for new checks.
Historical results stay in the record.
Rechecking does not require rebuilding unchanged code.

Stop evidence is supplied by the lead after a host liveness check.
The state tool does not kill or inspect external processes.
It never steals a lock because it is old.
A verified dead writer can require manual local lock recovery.

Whole-repository fingerprints omit Git-ignored files.
Explicit proof scopes reject ignored inputs.
Environment labels are caller declarations, not measured external state.
Capture timeout applies to the direct child.
Local proof is not a signature or a barrier against a writer who controls all files.

No install, global setting, commit, push, or release was made.
The existing Phase 0 documents were preserved.

## Evidence

Raw output is ignored under .verify/phase1/.
It does not travel with a normal Git clone.
The durable summary is this file.

- full-suite-capture.json: points to the final captured proof and output.
- claude-contract-review.jsonl: the early shared-rule review.
- claude-final-review.jsonl: the fixed-copy code review that found three recovery gaps.
- claude-recovery-recheck.jsonl: the clear recheck after those fixes.
- review-snapshot-initial.json and review-snapshot.json: file hashes for both fixed copies.
- run-state-review-red.tap and run-state-review-tests.tap: recovery regression results.
- proof-multiscope-red.tap and proof-multiscope-green.tap: the Git multi-path capture fix.
- document-checks.json, memory-validation.json, and manifest-validation.json: final format checks.

The focused test files are tests/plan-contract.test.mjs,
tests/run-state.test.mjs, tests/capture-proof.test.mjs, and tests/shared-work.test.mjs.
Legacy regressions stay in the existing test files.

Lessons used: field-regex-crosses-lines and nested-node-test-context.
The first has empty-field tests.
The second has a real failing nested Node test and clean child environments.
No account-wide memory file was changed.

## Next step

Phase 1 is complete. Start Phase 2 when the user requests it.
Phase 2 packages and tests the host entry points and request routes.
