# Phase 3 specialist agents

Date: 2026-10-26, America/Denver.

## Scope

Phase 3 is complete. G3 passed for the bounded cases recorded here.

U12-U15 add specialist roles, bounded source maps, frozen review files, and
memory integrity reports. The source is in the working tree. It is unreleased.
Phase 4 automated dispatch and Phase 5 hooks, queues, and schedules are not started.

## What changed

| Unit | Delivery |
| --- | --- |
| U12 | A shared catalog with a main-session lead and seven worker roles. Claude agent entries and explicit Codex packets use the same role text. Packets carry scope, exact result context, model requests, and byte/time limits. Workers do not commit or own shared state. |
| U13 | A bounded source map with exclusions, gaps, hashes, current-content cache checks, and static import paths. It does not claim a runtime call graph. |
| U14 | Fixed file copies, source/copy fingerprints, neutral prompts, sent-prompt checks, native review reports, and app/version/origin evidence checks. Serious findings need lead review. Clean controls can pass. |
| U15 | A bounded integrity bundle with selected claims, frozen sources, and captured probe/format/hygiene checks. It reuses the existing auditor policy. Reports preserve unknowns and propose repairs without editing memory or advancing freshness. |

The workers are code specialist, code scout, UI reviewer, blind critic, test
specialist, memory integrity specialist, and the existing memory auditor.
Models inherit by default. A requested model is distinct from the actual model
reported by a host. The role files avoid fixed model brands.

## Live checks

Claude Code 2.1.310 reported claude-opus-5-5 for the live cases.
Each worker ran in a fresh top-level CLI agent session with a small task.
This tests the plugin entry and actual tool set in that session.
It does not certify every nested-agent configuration.

| Case | Observed result |
| --- | --- |
| Code specialist | Changed only its owned source file. The real check failed before and passed after. Saved proofs carried the exact assignment context. |
| Code scout | Traced the seeded import path. It did not repair adjacent code. |
| Test specialist | Captured a real failed test. It kept the source and assertions unchanged. |
| Memory auditor | Found the false limit claim. It left the unsupported deployment claim unknown. |
| UI reviewer | Read the lead's browser evidence. It reported the broken flow, narrow layout, and keyboard fault. It distinguished the fixed control and made no edits. |
| Blind critic | Found addition where multiplication was required. A clean multiplication control passed. The lead confirmed the concrete failure. |
| Memory integrity | Found a contradiction and duplicate text, supported one source-backed claim, and left runtime uptime unknown. No canonical files changed. |
| Codex code scout | A fresh MXC read passed; a write control was denied. One explicit scout packet traced the assigned files and returned a valid shared result without edits. |

The browser checks used a local seeded app and Playwright CLI 0.1.22.
They captured served source hashes, app version, origin, screenshots, click flow,
narrow layout, and keyboard paths. Broken cases failed and clean cases passed.
Wrong-app and wrong-port controls were rejected. The test browser and servers stopped.
The UI role reviewed this captured evidence; it did not claim to drive the browser itself.

Read-only Claude cases exposed only Read, Grep, and Glob.
Code and test cases had explicit action tools and narrow test command rules.
Path limits for action tools remain instructed unless a host enforces them.
The Codex packet path retains Phase 2 limits: no-delegation is instructed,
and CLI evidence does not prove desktop or cloud support.

## Review fixes

Claude reviewed fixed source copies with only Read, Grep, and Glob.
The first review found source defects. Fixes included absolute snapshot paths,
Windows alias checks, outside-memory evidence for truth claims, captured-check
failure handling, included auditor policy, runnable validation commands, matching
output limits, required role descriptions, and case-safe scout exclusions.

The second review found a missing link between neutral review and task results.
The lead now wraps native review reports with task IDs after validating the
report and exact sent prompt. The critic does not receive the generic task packet.
Other fixes cover short-name temp ancestors, deterministic integrity prompt
reconstruction, selected-claim scope, reserved prompt names, and optional UI gaps.

The final targeted Claude check confirmed all six correction boundaries and
found no high or medium regression. Its remaining assignment-role check was
fixed with a failing-before/passing-after regression. The other low finding
claimed malformed UI evidence would throw. Three direct runtime controls
returned a failed validation without throwing, so the lead rejected that finding.
The final source copy stayed unchanged during Claude's check. The later small
assignment fix passed the focused tests and final suite.

An independent local review also reproduced prompt tampering and self-cited
memory truth. Regression tests reject both. Mixed-case canonical paths cannot
serve as outside-memory evidence.

Early live attempts are retained. Some returned prose around JSON or combined
an allowed command with a denied shell chain. One test worker listed proof
receipts as changed project paths. The contracts now request exact JSON and
put receipts in proofs. Fresh cases passed. No broader grant was added to force a pass.

## Evidence and limits

Local evidence is ignored by Git under `.verify/phase3/`.
The final suite receipt, live summaries, actual sent prompts, source-copy hashes,
CLI traces, and screenshot files are separate records.
Carry required output explicitly for a handoff, or rerun the checks.

The structural validators do not prove a model's reasoning is correct.
The lead checks findings, actual changes, and required captured proof before task acceptance.
Result submission alone is not acceptance. A completed inspection may report a failed test.
No report starts a timer, repairs memory, or updates a freshness store.

This phase does not prove all roles and workflows on every Codex surface.
Broader model and workflow trials remain Phase 7.
No user configuration, global install, commit, push, or release was requested or made.

Host reference checks used the official
[Claude subagent guide](https://code.claude.com/docs/en/sub-agents) and
[Codex subagent guide](https://learn.chatgpt.com/docs/agent-configuration/subagents).
Actual CLI evidence, rather than those pages alone, bounds the claims above.

## Final checks

- Full suite: 911 tests, 886 passed, 0 failed, 25 skipped.
- Skips: 19 gated live-model cases and 6 local Playwright-package cases.
- The separate live role and browser checks above ran outside those gated tests.
- Strict Claude plugin validation passed. The existing missing-icon warning is nonblocking.
- Plan coverage, memory structure, JSON, local links, and whitespace checks passed.
- Final captured proof matches the source files and saved output.

The full test run and captured source fingerprint are in
`.verify/phase3/full-suite-capture.json`.
The seven-role evidence is split between `roles-live-summary.json` and
`live-closed/`. The fresh Codex case is in `codex-scout/summary.json`.
UI evidence is in `ui/summary.json`. `live-checked.json` holds lead checks of
the final blind and integrity cases. Claude review records retain each fixed copy.

Used lessons: field-regex-crosses-lines and nested-node-test-context.
Their regression checks passed in the full suite. New child-process tests use
childEnv(). The external read-only lesson passed the narrow Claude tool trace.
Codex passed real read and denied-write controls. Phase 3 did not independently
enumerate every available Codex action tool; it used the Phase 2 flags and limits.
Codex internal coordination tools remain an instructed limit.

The next phase is Phase 4, U16-U19, when the user requests it.
