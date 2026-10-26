# Phase 2 results

This is the first Phase 2 record. The open checks below were resolved in the
[Phase 2 closure](2026-10-25-phase-2-closure.md). Read that record for current status.

Date: 2026-10-25, America/Denver.
Base commit: e47e021ad51b3a08cde6576749161c94132b5e13.
Work remains on codex/phase1-shared-contracts. Phase 0/1 changes were preserved.

## Result

U8-U11 source is built. The full local suite passes.
Claude reviewed the Claude parts. Its findings were fixed.
G2 remains open. Live Codex file access is still blocked.
Some Claude install, routing, and write cases also need live proof.
No commit, push, release, persistent plugin install, or user setting change was made.

## What changed

| Unit | Built | Acceptance limit |
| --- | --- | --- |
| U8 | Portable root manifest plus both legacy manifests. Shared metadata checks. One source for 12 core skills and 5 shortcuts. | Claude loaded all 17 entries. Codex live load is unverified. |
| U9 | Explicit handoff, sync, grill, cleanup, and repair shortcuts. Shorter core descriptions. Shared scope and name-collision rules. 13 routing cases and a grader. | Six of seven sampled plain requests met the selection/scope grader. This does not prove all task outcomes. |
| U10 | Claude auditor entry and shared packets. One script-filtered edit handler. Hook off switch. Bounded startup/compaction output. | Live auditor read and startup hook passed. Other lifecycle and settings-preservation cases have local tests only. |
| U11 | Read-only setup checks for CLI, desktop, and cloud. Explicit role packets. Shared event parsing. Codex hooks remain off. | Local packets and result validation pass. Live Codex file access failed again. |

The setup command checks package facts. It does not install, edit settings,
claim tasks, launch agents, or grant tools.
The packet command reads a current assignment and checks the plan and leases.
It includes the shared role source, result schema, and audit finding schema.
It labels code freshness and tool access as unchecked.
The lead must check those facts before dispatch.

Only the existing memory auditor is registered in Phase 2.
New specialists remain Phase 3. Agent launch remains Phase 4.
The persistent integrity queue, context bridge, and schedules remain Phase 5.
The queue flag cannot silently start work in this phase.

## Checks

- Full Windows suite: 868 tests; 843 passed; 0 failed; 25 skipped.
- The 25 skips are 19 gated live-model cases and 6 cases needing Playwright.
- Claude strict manifest validation passed. The missing icon warning is nonblocking.
- Setup checks passed for claude, codex-cli, codex-desktop, and codex-cloud.
- Plan coverage and memory structure checks passed.
- No Linux, macOS, CI, desktop install, or cloud runtime test ran.

The full suite was captured by the separate Phase 1 proof tool.
The final receipt is `.verify/phase2/full-suite-capture.json`.
It links the proof and raw test output under `.verify/proofs/`.
The first full run found four regressions. These were fixed before the passing run.
The final comment correction was followed by another full capture so the receipt
matches the final source files.

## Live Claude observations

Claude Code version: 2.1.310. Tests used session-local plugin loading.
Fixtures had their own Git roots and paths with spaces.
No external MCP servers were enabled. Hooks were off except in the named hook smoke.

| Case | Observation | Limit |
| --- | --- | --- |
| Package | Init event listed all 17 entries and compound-memory:memory-auditor. | Session-local loading is not a persistent install or upgrade test. |
| Auditor | Actual tools were Read, Grep, Glob. README read and file search passed. | Narrow empty-project probe, not a full audit or worker run. |
| Simple question | Replied 4 without tools. | One sample. |
| Plan only | Loaded plan and returned a plan. No fixture file changed. | No saved plan or build was requested. |
| Memory status | Loaded project-memory and ran both local checks. No writes. | Empty memory fixture. |
| Plain handoff | Selected project-memory handoff, checked state, and stopped as requested when memory was absent. | No handoff file was created or validated. |
| Typo | Kept the task small. Reported denied edits without claiming success or using a shell write. | Edit permissions blocked the outcome. |
| Build | Selected build. Ran the provided failing test. Reported denied edits without claiming completion. | The implementation outcome was not verified. |
| Plain review | Found the seeded add/subtract bug. No writes. | Did not load the review skill. This fails the strict selection case. |
| Explicit cleanup | Literal slash input reached the state probe and stopped on missing memory. | User slash expansion happens before model Skill calls. This does not prove live cleanup of stale content. |
| Startup hook | Debug record shows one command completed with exit 0 and supplied additional context. | Real compaction and interactive trust were not tested. |

The write probes first used incorrect path rules. A second run used settings-relative
Edit rules. The host still denied the requested writes. That cause remains unresolved.
The test did not widen write access or use shell writes to obtain a passing result.
The grading result records routing and scope only. It does not turn these blocked
outcomes into successful task runs.

## Claude review and fixes

Reviews used fixed temporary copies with only Read, Grep, and Glob.
The snapshot hashes stayed unchanged during review.
The review was static evidence, not a runtime test.

Fixed findings:

1. Removed the broad auditor-bridge tool grant. External model calls use existing user authority and host rules.
2. Kept shortcut script paths aligned with their exact tool grants.
3. Added positive controls to disabled-hook and wrong-event tests.
4. Covered the named edit tools and used prefixed commands in hook hints.
5. Embedded the audit finding schema in role packets.
6. Checked role and skill fields only in real headers. Body text and YAML comments cannot satisfy them.
7. Matched the hook comment to every supported orientation event.

The second review found no high or medium issue.
The final parser recheck found no actionable code issue.
Its final comment finding was corrected without a behavior change.

## Codex retry

Codex CLI version: 0.162.1.
The model session ran and reported no tools with the mcp__ prefix.
Its actual file-read command failed before execution:
helper_sandbox_lock_failed while opening the local `.sandbox-bin` directory,
with Access denied, error 5.
The expected probe text was not read.

No security bypass or host permission change was attempted.
Package checks do not substitute for this failed read.
CLI, desktop, and cloud runtime support remain separate unknowns.

## Lessons checked

- field-regex-crosses-lines: empty-field and body-decoy checks passed.
- nested-node-test-context: child tests use childEnv; regression checks passed in the full suite.
- lesson-2026-09-30-codex-read-only-not-app-safe: zero external tool names were reported, but the required real read failed. The lesson check is partial, not passed.

## Evidence and next step

Ignored evidence lives in `.verify/phase2/`: host check receipts, routing logs and
file hashes, review snapshots, Claude reviews, Codex failure, and full-suite receipt.
`live-summary.json` separates selection from task completion.
These local files are not committed or guaranteed to travel with a handoff.

Close G2 before accepting cross-host support:

1. Restore Codex file access through supported host setup, then test plugin loading and packets.
2. Resolve the Claude fixture edit profile and rerun write outcomes.
3. Check plain review on a representative change and complete explicit shortcut, install/upgrade/disable, trust, and compaction cases.

The [host matrix](../host-support.md) and [development plan](2026-10-25-compound-memory-development-plan.md)
carry the same limits. Phase 3 is the next build phase after this gate.
