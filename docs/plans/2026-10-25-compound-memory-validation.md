# Validation and sources

Date: 2026-10-25.

This file supports the [development plan](2026-10-25-compound-memory-development-plan.md).
It defines acceptance cases. The Phase 0 update below records the checks now run.
It does not claim that proposed features exist or that later cases passed.

## Case rules

Use isolated sample projects.
Keep the starting code and expected outcome fixed.
Include clean controls as well as seeded faults.
Record host version, model when known, code version, input, actual tools, outcome, and proof path.

Separate four result states:

- Passed: the required behavior was observed.
- Failed: the observed behavior broke the requirement.
- Skipped: the case did not run.
- Unsupported: the host does not provide a required capability.

Skipped and unsupported cases are not passes.
A failed or absent required case blocks the matching support claim.

For model-backed cases, repeat trials.
Use at least three trials for the first live comparison.
State that small samples cannot prove universal reliability.
Increase trials when results vary or the cost of failure is high.
Do not lower a check because the model did not pass it.

## Acceptance cases

| Case | Setup and action | Pass condition | Failure condition |
| --- | --- | --- | --- |
| A01: Baseline truth | Compare code, saved results, current-state notes, and advertised claims. | Each claim has evidence or an explicit unverified label. | A prose claim or skipped test becomes proof. |
| A02: Replacement coverage | List the full relevant catalogs and agreed daily use cases. Map each to this plugin. | Each use case has a home and a check, or a named gap. | A library is declared replaced from a few overlapping names. |
| A03: Host capability truth | Probe supported host setup in an isolated project. Compare it with official docs. | Documented, observed, unavailable, and unknown states remain distinct. | Valid metadata is called a working feature. |
| A04: Single ownership | Walk a small task and a large plan through the proposed records. | Each fact and state has one owner. Other records link to it. | A task needs two manual status changes to remain consistent. |
| A05: Graph checks | Supply a valid plan, a cycle, unknown blockers, explicit gate prerequisites, and shared resources. | Invalid graphs stop dispatch. Valid shared-resource tasks run in turn. Cross-phase overlap respects named gates. | The runner uses an invalid graph, ignores a required gate, or rejects a valid plan only because tasks must wait. |
| A06: Run state | Submit two results together. Expire a lease. Resubmit an old attempt. Crash during a write. | Both valid results survive. Old attempts are rejected. State recovers. | A result is lost, accepted twice, or accepted after reassignment. |
| A07: Proof capture | Supply a failed command, a false reported success, changed output, an edit during a check, and a capture error. | Actual capture records the failure. Start/end fingerprint changes make proof stale. Capture failure stays distinct. | Old output is attached to new code, or a reported exit code becomes captured proof. |
| A08: Packaging | Load the package in both hosts. Compare shared role content and metadata. | Intended entries load from one shared source. Names and paths resolve. | One host silently uses a different role or missing reference. |
| A09: Request routing | Use named commands, plain build/review/handoff requests, a question, and a small typo fix. | Correct workflows start. Read-only tasks do not write. Small tasks stay small. | A question starts a build, or a simple fix launches a team. |
| A10: Claude adapter | Exercise install, roles, hook trust, disabled hooks, and restricted review. Inspect actual tool grants. Test ignored plugin-agent permissionMode/hooks/mcpServers fields, headless status, and existing status lines. | Behavior matches the capability matrix. Existing settings survive. Disabled queue hooks do nothing. Startup and compaction produce one packet. | A package silently changes user setup, assumes ignored fields enforce access, or claims untested access limits. |
| A11: Codex adapter | Exercise the same packets and fallbacks on named CLI, desktop, and cloud surfaces. Retest local file access. Test apply_patch, Edit/Write, shell edits, filter conversion, and inherited external tools. | Results use the same schema. Unsupported hooks or signals are reported. Trust is explicit. | Claude-only metadata is assumed to work in Codex, a failed read passes, or hook trust is bypassed. |
| A12: Role boundaries | Give every role one narrow task and a misleading adjacent task. | Each returns the required result within scope and output limits. | A scout edits code, a reviewer repairs memory, or a worker rewrites the plan. |
| A13: Code scout | Seed a call path, a generated directory, an unreadable path, and an external link. | The relevant path is found. Exclusions and gaps are reported. | The scout reads excluded material or claims full coverage from a sample. |
| A14: Blind review | Use a frozen file copy with seeded faults and a clean control. Inspect the actual sent prompt. Try a builder edit during review and compare fingerprints. | The critic receives no builder defence. Findings cite the fixed target. A changed target makes the review stale. Clean work can pass. | A commit ID substitutes for a readable fixed copy, a target changes unnoticed, or hidden identity or earlier findings leak. |
| A15: UI and test proof | Run a known app version with a broken flow, narrow screen, keyboard path, and wrong-port control. | Evidence shows the actual target and user path. Seeded faults are detected. | A screenshot of the wrong app or a build pass replaces user-path proof. |
| A16: Integrity specialist | Seed false memory, unsupported claims, duplicate facts, a clean source, and a source edit during the audit. | Findings and coverage are correct for the inspected snapshot. Changed-target results cannot advance current freshness. Canonical files do not change. | Format validity becomes truth, a stale result marks current memory fresh, or the specialist repairs memory. |
| A17: Parallel dispatch | Queue independent tasks, a shared-file pair, a shared-port pair, and excess tasks. | Independent work overlaps. Conflicts wait. Limits and cancel hold. | Conflicting claims run together or spawning exceeds the configured limit. |
| A18: Workspace safety | Seed staged, unstaged, and untracked user work. Add an out-of-scope worker edit. | User work survives. The bad result is rejected. Recovery copies remain. | A commit absorbs user edits or cleanup deletes unfinished work. |
| A19: Combined result | Use two changes that pass alone but conflict when combined. | The combined check fails and the run remains incomplete. | Worker passes are used as final acceptance. |
| A20: Resume | Resume in both hosts and a fresh clone with all .verify/ data removed. Include accepted tasks, unfinished edits, an old active lead, and a late worker. | Required run-state export restores state. Missing edits block affected tasks. Ownership transfer is checked. Missing proof stays missing. | Pointers replace required data, two leads claim one run, work repeats, or an old result overwrites new work. |
| A21: Claim freshness | Change a cited source. Leave another old source unchanged. Add a claim with no source. | Changed claims need review. Old unchanged claims are not declared false. Unsourced claims stay unchecked. | Calendar age alone becomes proof of an error. |
| A22: Memory writes | Repeat a sync. Run status and review. Submit competing repair proposals. | No duplicate facts appear. Inspection is read-only. One lead applies permitted changes. | A proposal becomes an automatic repair or repeated sync grows the tree. |
| A23: Trigger queue | Send repeated events, auditor-origin events, two branch events, failed checks, cancellation, and a source edit during audit. Drive the next lead boundary. | The event reaches one specialist report. Requests coalesce by target. Only successful matching-snapshot coverage advances freshness. | A queue is never consumed, a failure marks memory fresh, or an audit triggers another audit. |
| A24: Context signals | Supply null, stale, 49%, 50%, repeated 50%, first-valid 65%, model/window changes, and no post-compaction callback. | One advisory action occurs per epoch. Null does not reset it. Local recovery and the next supported resume boundary work. | A guessed percentage triggers a reset or storm, a hook writes canonical memory, or missing callbacks lose the next step. |
| A25: Idle schedules | Pause the schedule. Simulate downtime, missing credentials, a changing checkout, and a stale lock. Try runtime and canonical writes. | One catch-up run occurs. Scoped runtime reports are allowed. Canonical writes are blocked. The next lead checks freshness. Disable stops future work. | Missed ticks replay in a burst, memory changes, or a failed run reports health. |
| A26: Workflow breadth | Run agreed research, UI, setup, refactor, migration, release, and support samples. | Each reaches its stated outcome with named tools and proof. | A supported workflow requires another skill library or hides missing tools. |
| A27: Learning | Repeat a lesson. Change its source. Give one new preference and a repeated mechanical mistake. | Duplicate lessons merge. Stale claims are reviewed. Repeated faults get a check where feasible. | One observation becomes a global rule or unsupported claims gain certainty. |
| A28: Migration | Upgrade a legacy project with custom rules. Roll back. Disable and remove plugin-owned setup. | Project data, settings, and old memory survive. Only owned jobs and hooks are removed. | User files are replaced or unrelated schedules stop. |
| A29: Test harness | Run each grader against a wrong result and a known-good result. Spawn a failing nested test. | Bad results fail. Good controls pass. Nested failures retain nonzero exit codes. | A grader accepts every result or inherited runner state hides failure. |
| A30: Live host matrix | Run required cases in real Claude Code and Codex sessions. Include both handoff directions. | Reports show actual versions, models when known, and all case states. | A mock, skipped case, or text assertion is called live proof. |
| A31: Context and cost trial | Run matched tasks at several measured context levels with no policy and trial policies. | Quality, time, token use, and uncertainty are reported without a universal threshold claim. | A 50% mark is declared optimal from one run or guessed usage. |
| A32: Release truth | Compare the release text, support matrix, test results, migration, and rollback. | Required claims have evidence. Remaining limits are visible. | Advertised support exceeds observed support. |

## Live trial matrix

Record each selected model separately.
Do not use a Claude result as proof of Codex behavior.
Do not use one Codex model as proof of every model.

| Dimension | Minimum trial coverage |
| --- | --- |
| Host | Claude Code and Codex. Record app/CLI path and version. |
| Operating system | Windows live workflows first. Keep Windows and Linux script checks. Mark untested systems. |
| Invocation | Named skill, plain request, explicit specialist, and multi-agent request. |
| Project state | Empty project, existing memory, old format, dirty checkout, branch/worktree split. |
| Task size | Small fix, one feature, multi-phase work, inspection only. |
| Access | Full required tools, missing optional tool, denied action, restricted critic. |
| Failure | Worker exit, invalid result, stale target, missing proof, cancellation, duplicate event. |
| Continuation | Same host, other host, another checkout, missing local evidence. |
| Memory | Fresh, contradicted, changed source, unsourced claim, duplicate fact, oversized startup set. |
| Scheduling | Active-session due check, idle run, pause, downtime, disable. |

Use local fakes for ordinary script checks.
Run live model cases only within approved execution scope.
Use harmless test records for tools that can change external state.
Do not test access limits by changing a real account.

## Context trial design

Treat accuracy and context occupancy as separate measures.
The baseline must contain the same relevant facts and task difficulty.
Vary unrelated history and placement of key facts in a controlled way.

Compare:

1. Host without the plugin.
2. Plugin with memory and handoff support, without percentage triggers.
3. Plugin with the trial 50% advisory policy.

Add other marks only when the first comparison supports further work.
Use measured levels below, around, and above the trial mark.
Record the host's effective window and the signal source.
If a host cannot provide a supported measure, label the trial unavailable for that dimension.

Measure:

- Requirement recall.
- Incorrect or unsupported memory claims.
- Lost decisions after compaction.
- Repeated work after resume.
- Task success and false success.
- Time to first useful action.
- Total elapsed time.
- Tokens and cost when reported.
- Unnecessary questions and extra agent calls.
- Startup memory size and specialist packet size.

Keep measured, estimated, and unknown costs separate.
Do not infer dollars from token counts without verified model pricing.
Keep model and host versions in the results.
Publish sample size and variation.
An inconclusive result is valid.

## Hook decision

Use command hooks for short signals.
Use normal lead dispatch for the memory specialist.
Use a scheduler for a real time-based idle run.

This avoids depending on experimental agent hooks.
It also keeps the same core flow in both hosts.
Use manual status and audit as fallbacks.

A hook can detect that a check is due.
It cannot by itself prove that memory is wrong.
A specialist can inspect claims.
It does not free space in the lead's context.
A checkpoint preserves the next step.
Compaction or a new session changes the active context.

## Official sources

Sources were checked on 2026-10-25.
Documentation can change.
Verify it again before implementing an adapter.
These are documentation findings, not local runtime test results.

### S1: Claude hooks

[Claude Code hook reference](https://code.claude.com/docs/en/hooks)

The event list includes session start, tool use, and compaction events.
Agent hooks are experimental.
SessionStart and PreCompact do not support agent handlers.
There is no general interval or context-percentage event in the documented list.
Use supported command events for the shared design.

### S2: Claude context signal

[Claude Code status-line reference](https://code.claude.com/docs/en/statusline)

The status-line input includes context_window.used_percentage.
It reflects the last model response.
The value can be null.
This is a status-line signal, not a common hook input.
Test any bridge into the plugin and preserve the existing status line.

### S3: Codex hooks

[Codex hook documentation](https://learn.chatgpt.com/docs/hooks)

Command and mcp_tool handlers run.
Prompt and agent handlers are parsed but skipped.
Plugin hooks require trust.
The documented hook input does not provide a context percentage.
The transcript format is not a stable integration contract.
The documented events do not provide a general interval trigger.

### S4: Codex token events

[Codex App Server documentation](https://learn.chatgpt.com/docs/app-server)

The App Server documents thread/tokenUsage/updated.
This is a possible signal for a supported integration.
This review did not establish that an installed plugin can subscribe to it.
Do not make it a required plugin capability without a local test.

### S5: Agent support

[Claude subagents](https://code.claude.com/docs/en/sub-agents)

[Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

Both hosts support focused subagents.
Their configuration and access controls differ.
Codex custom-agent instructions do not create a separate read-only permission boundary.
Test actual capabilities.
Do not promise identical setup from one agent file.

[Claude agent teams](https://code.claude.com/docs/en/agent-teams)

Claude marks agent teams as experimental.
They are not required for the first release.

### S6: Long context

[Anthropic: Effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)

The article describes reduced recall as context grows.
It supports bounded context and careful retrieval.
It does not establish a universal 50% failure mark.
The threshold in this plan is a trial policy.

### S7: Plugin packaging and prompt size

[OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)

Current guidance covers portable manifests and Codex compatibility paths.
It also explains plugin hook trust and path resolution.
Check the supported package form before changing this repo's manifests.

[OpenAI skill guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

The guidance favors short descriptions and loading only relevant instructions.
This supports a small shared core and task-specific references.

### S8: Scheduling

[Claude scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)

Scheduling has host-specific session and background paths.
Select and test the installed host's supported path during U24.
This plan does not establish a portable scheduler API or create a job.

## Repository evidence

| Source | Planning use |
| --- | --- |
| [Plan checker](../../scripts/plan-check.mjs) | Extend current ID and coverage checks. Add cycle checks. |
| [Ticket checker](../../scripts/tickets-check.mjs) | Reuse dependency and path checks. Add task claims and resource checks. |
| [Run record](../../scripts/run-record.mjs) | Extend proof records. Keep one writer and do not broaden pre-approved command access. |
| [Build work guide](../../skills/build/references/work.md) | Preserve worker packets and isolated work guidance. |
| [Review guide](../../skills/review/references/code.md) | Reuse evidence-backed findings and fixed targets. |
| [Memory auditor](../../agents/memory-auditor.md) | Reuse the deep evaluator rather than add a second conflicting audit. |
| [Memory probe](../../scripts/project-state.mjs) | Preserve the distinction between drift, changed sources, and unchecked claims. |
| [Limits](../limitations.md) | Keep advertised behavior within measured bounds. |
| [Current state](../../memory/current-state.md) | Treat historical verification claims as items to reconcile. |
| [Evaluation report](../../evals/README.md) | Address missed skill invocation with plain requests. |

## Lesson use and check status

| Lesson | Use in this plan | Check status |
| --- | --- | --- |
| lesson-2026-09-30-codex-read-only-not-app-safe | External source: the owner's AI OS Wiki/Lessons/2026-09-30 - Codex read-only sandbox does not stop app and MCP actions.md. Not shipped with this package. Add actual tool checks to A10, A11, and A14. | Phase 0: Claude review had only Read/Grep/Glob and read files. Codex reported zero mcp__ tools but could not start its file-read process. The Codex lesson check remains incomplete. |
| [nested-node-test-context](../../memory/lessons/nested-node-test-context.md) | Require childEnv() and a failing nested-test control in U28 and A29. | Runtime lesson not exercised. No nested test or agent CLI was launched from a Node test. The check is part of the future harness. |

These lessons inform the checks. The Phase 0 report records their current limits.
They do not prove all proposed role restrictions work.

## Initial planning validation record

These checks ran on the planning documents.
They do not verify future runtime behavior.

- Implementation state: not started.
- Runtime and schedule changes: none.
- Plan checker: passed. All 22 requirements have task coverage. All 31 tasks have a Verify field.
- Combined dependency check: passed. The 31 tasks and 8 phase gates form a graph with no cycles or unknown targets.
- Acceptance mapping: passed. Task references resolve to the 32 acceptance cases.
- Local links: passed. All 24 local links resolve.
- Whitespace check: passed for all three new files.
- Independent document review: three read-only reviewers checked the draft. One used a fresh context without the author's research history.
- Review changes: clarified resource waits, gate prerequisites, lead ownership transfer, portable run-state exports, changing-source audits, start/end proof capture, queue consumption, context latches, compaction recovery, and idle report writes.
- Review recheck: all three reviewers confirmed their findings were addressed. No unresolved issue remained within their review scopes.
- Change scope: three new Markdown files under docs/plans/. No production code, settings, canonical memory, or schedules changed.
- Runtime checks: not run for this documentation-only task. The earlier baseline is labelled in the main plan.
- Remaining implementation decisions: listed in the plan's Open questions.

## Phase 0 update

The user then authorized U1-U3 and a Claude CLI review.
See the [Phase 0 report](2026-10-25-phase-0-findings.md).

- A01: current baseline and explicit historical/unverified claim records are complete.
- A02: 132 source entries are mapped. Instruction coverage is distinct from runtime proof.
- A03: host matrix is complete as a truth record. Claude has bounded live observations. Codex file execution is blocked. No full host support pass is claimed.
- G0: met. The source conflicts and host unknowns have explicit records.
- A04-A32: not accepted by this phase. Narrow probes do not replace those cases.
- Whole-suite baseline: 732 passed, 0 failed, 25 skipped out of 757.
- Manifest, memory format, and memory hygiene checks: completed with limits in the phase report.
- Claude: actual CLI review ran. Its eight findings have plan dispositions.
- Code and runtime configuration: unchanged. Only documentation and ignored local evidence were written.
- Schedules, installs, global settings, commits, and pushes: none.
- Next task: U4 when Phase 1 is authorized.

## Phase 1 update

The user authorized U4-U7 and Claude CLI review.
See [Phase 1 results](2026-10-25-phase-1-results.md).

- A04: passed. Both plan examples use one scope source and one progress source.
- A05: passed. Graph errors stop readiness. Shared resources wait. Legacy support is explicit.
- A06: passed in local tests. Parallel submissions survive. Old revisions, owners, and attempts fail. Interrupted-file controls preserve the prior ledger. Expiry and stale-proof recovery have regression tests.
- A07: passed. Real failed commands, reported receipts, changed output, changed source, and capture errors cannot become current passing proof.
- G1: passed in the local shared-contract scope.
- Final suite: 805 tests; 780 passed, 0 failed, 25 skipped.
- Claude: initial contract review, fixed-copy code review, and a clear recovery recheck. These are source reviews, not runtime trials.
- A08-A32: not accepted by this phase. No host adapter, worker launcher, hook, or schedule was added.
- Next task: U8 when Phase 2 is authorized.
