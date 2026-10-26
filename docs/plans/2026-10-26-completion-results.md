# Completion results: Phases 4–7

Date: 2026-10-26. Local Windows CLI scope.
Candidate: 2.1.0-rc.1. Base commit: e47e021a plus the working-tree changes.
The user authorized the remaining work after Phase 3. No commit, push, public
release, global install, user status-line setup, or production job was made.

This is the original completion record. The later
[passive continuity change](2026-10-26-passive-continuity.md) replaces the
optional-only warning policy and records newer checks for the changed source.

## Delivered units

| Unit | Result | Main implementation and checks |
| --- | --- | --- |
| U16 | Bounded native CLI dispatch and explicit sequential fallback | `scripts/agents/dispatch.mjs`; parallel dispatch tests |
| U17 | External worker copies, base hashes, ownership checks, recoverable conflicts | `scripts/agents/workspaces.mjs`; worker isolation tests |
| U18 | Lead result review, task proof on merged code, final combined checks | dispatch integration helpers; individually-green/combined-red control |
| U19 | Portable state and unfinished bytes; source fence; import once | `scripts/lib/handoff.mjs`, `scripts/handoff.mjs`; portable handoff tests |
| U20 | Claim sources and review-needed coverage | `scripts/lib/integrity-state.mjs`; source change controls |
| U21 | Separate inspect, propose, and authorized single-writer apply | integrity state helper; repeat and conflicting proposal controls |
| U22 | Default-off ignored queue; cheap hooks; bounded native consumer | `scripts/integrity-due.mjs`; hook, cancellation, stale, unknown, and repeat cases |
| U23 | Measured/unknown context, epoch latches, optional owned status-line restore | context and status-line adapters; path, compaction, and unknown-input tests |
| U24 | Explicit local polling reports for either CLI | `scripts/scheduling/local.mjs`; downtime, pause, failure, lock, and retention tests |
| U25 | Research, setup, UI, intake, product, launch, migration, release, support, and refactor recipes | `references/workflow-recipes.md`; 11 decision samples per host plus action-specific tests |
| U26 | Find-before-write learning proposals; evidence and scope limits | `scripts/learning-policy.mjs`; dedupe, retirement, repeated fault, and preference tests |
| U27 | Preview, exact backups, apply, conflict-safe rollback, disable/remove | `scripts/migrate.mjs`; legacy/custom data and owned setup tests |
| U28 | Receipt grading with explicit required cases; negative controls; nested failure test | `evals/acceptance.mjs`; acceptance, workflow, and nested-runner tests |
| U29 | Native host and continuation trials | `.verify/finish/`; current matrix below |
| U30 | Matched short policy trial; result explicitly inconclusive | `evals/context-trial.mjs`; `.verify/finish/context-trial.json` |
| U31 | Candidate version, operation/rollback guide, plan and memory reconciliation | three manifests, docs, project memory, final checks |

## Runtime evidence

Claude Code: 2.1.310. The observed model was `claude-opus-5-5`.
Codex CLI: 0.162.1. Worker stderr named `gpt-6.1-sol`. The inspection JSON
stream did not name a model, so those report model fields remain null.
Node: 24.20.0. These facts describe this local run, not minimum supported versions.

| Case | Claude | Codex | Evidence and bounds |
| --- | --- | --- | --- |
| Workflow decision samples | Passed 11 | Passed 11 | Actual recipe text supplied; outputs graded. This is not a full browser, publishing, or research trial. |
| Scheduled false claim | Passed | Passed | Actual read-only CLI; source value 25 contradicted memory value 100; memory unchanged. |
| Due queue to specialist | Passed | Passed | Explicit enabled fixture; queue consumed through the native inspector; contradiction recorded; then disabled. |
| Two native workers | Passed | Passed | Separate owned files; overlap; worker and combined checks. |
| Claude to Codex handoff | Passed source task | Passed resumed task | All 14 checks passed; portable unfinished bytes; no duplicate edit. |
| Codex to Claude handoff | Passed resumed task | Passed source task | All 14 checks passed in the other direction. |
| Context trial | 3 arms passed the task | 3 arms passed the task | Unknown context usage; too few samples; no threshold selected. |
| Desktop, cloud, Linux live workflows | Not run | Not run | Windows CLI evidence does not certify these surfaces. |

The repeatable native decision/schedule/due checks are in
`tests/acceptance/live-v2.test.mjs`. They ran with
`COMPOUND_MEMORY_LIVE_V2=1`: 2 tests passed, none failed or skipped.
The first Codex memory trial correctly returned unknown because the packet
blocked its command-based file reader. A checked `readMethod` field now gives
that host its read-only file-read path. The repeat found the false claim.

Early Claude worker attempts made no changes because exact write rules used
the wrong path syntax. The corrected rule uses the current host's absolute
path form and only the worker's owned files. It grants no shell or outside
action tool. Failed attempts remain local evidence.

## Review and fixes

Claude reviewed fixed source copies through Read, Grep, and Glob. The initial
review found valid schedule and receipt faults. Fixes cover per-read config
checks, lock recovery, pause/save races, cancellation fencing, unknown coverage,
bounded reports, receipt paths, and explicit required case lists.

Its claim that `--restricted` and `--permission-prompts none` do not exist was
disproved by the installed CLI help and successful live calls. Those flags
remain. `--safe-mode` now prevents automatic instruction loading in the native
inspection path. A hostile `CLAUDE.md` control was present in the live fixture.

Short matching quotes remain structural evidence only. No arbitrary minimum
quote size can prove meaning. The lead must still check the claim against the
source. This limit remains explicit.

Independent code review also checked portable state, migration, and integration.
Claude's correction pass confirmed the earlier lease, inherited-display, and
queue-flag fixes. It found two related shutdown/disable cases and three lower
priority details. The final fixes keep a durable in-flight marker before a
runner starts, preserve active jobs while disabling their future work, check
all queue output paths for local storage, and align check time limits with the
remaining lease. Each accepted finding has a focused regression check.

Review evidence: `.verify/finish/claude-final-source.json` and
`.verify/finish/claude-correction-review.json`. The outside-read allegation was
disproved by `.verify/finish/claude-read-control.json`: the real host allowed the
inside read and rejected the outside read. The reviewer did not certify every
file or host surface; its stated read limits remain in the saved reports.

## Combined checks

The final Windows source suite ran 1,019 tests: **992 passed, 0 failed, 27 skipped**.
The skips are 19 existing opt-in model tests, 6 unavailable local Playwright
package tests, and 2 new opt-in native tests. The two new native tests also ran
separately with opt-in enabled and passed. A skip is not counted as a pass.

Captured proof: `.verify/proofs/8d8564f6-eb06-4f0d-b527-fc2d4d731ee6/proof.json`.
Capture summary: `.verify/finish/full-suite-capture.json`.
The first combined attempt failed one changelog version check. The parser now
accepts the prerelease version already allowed by the manifest check. The final
combined run passed. The final JSON scan also caught a missing schema brace.
It was fixed, and new tests now parse every shipped schema. No failed test was
removed or marked skipped.

Native worker proof is in `.verify/finish/parallel/live-final/claude-result.json`
and `.verify/finish/parallel/live/codex-cli-result.json`. Each reports real
overlap and final `mayClaimSuccess: true` after lead checks.
Both handoff directions are in `.verify/finish/portable/live/checked/`.
Those live targets were fresh plain folders. Separate deterministic tests used
real Git clones and staged/unstaged/new-file fixtures. These are distinct checks.

Strict Claude manifest validation passed. Its separate directory check noted
an optional missing listing icon. This warning did not fail manifest validation.

## Support bounds

- The release is a candidate. It is not a measured replacement for every entry
  in the dated 132-entry comparison map.
- Recipe decision samples prove their named decisions. Dedicated code tests
  prove storage and state behavior. Neither replaces runtime tool evidence.
- Claude inspection checks its actual file-only tool list. Codex uses tested
  read-only filesystem controls and disabled action features. Internal
  coordination is instructed off; complete tool removal is not asserted.
- A local polling process runs only while open. It is not an installed OS job.
  A leftover metadata lock requires manual inspection. A known live process or
  unconfirmed cancellation is never silently taken over.
- One store can fence ownership. Disconnected copies still need host-confirmed
  stop evidence. Portable proof is rechecked against the destination checkout.
  A merged but unaccepted worker must be reconciled before export; the old
  worker base is rejected. Its source and copy remain intact.
- Current usage is unknown in headless context trials. The 50% trial mark is
  advisory. No claim about general model degradation follows from it.
- Interactive status-line delivery, iOS, formal proof, managed PR stacks, and
  vendor integrations remain unverified, optional, or deferred.

The two matching local lessons were used: `field-regex-crosses-lines` and
`nested-node-test-context`. Their parser and child-process checks ran. No AI OS
lesson matched this task. Local runtime evidence stays ignored under `.verify/`.

## Phase gates

G4 passed the bounded dispatch, collision, interruption, integration, and resume
cases. G5 passed the signal, source-drift, unknown, cancellation, and downtime
cases. Interactive telemetry remains outside the runtime claim. G6 passed the
recipe decision samples and the migration/data-preservation checks; full
catalog parity remains unclaimed. G7 passed for a local release candidate with
these limits. Publication and persistent installation were not performed.

The final plan, memory, JSON, Markdown-link, and whitespace checks passed.
Memory validation returned no errors or warnings. The source-bound summary is
`.verify/finish/final-checks.json`. The candidate is ready for a later local
installation request.
