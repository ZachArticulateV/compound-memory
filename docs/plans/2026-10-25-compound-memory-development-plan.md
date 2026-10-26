# Compound Memory development plan

Date: 2026-10-25.

The user authorized a full Claude branch recovery and source push/merge on
2026-10-26. The [branch reconciliation](2026-10-26-claude-branch-reconciliation.md)
records the seven checked branches, missing changes, preserved newer work,
and checks. This follow-up does not install the plugin or start jobs.

Phases 0-3 passed within their recorded scope. The remaining units are built for
2.1.0-rc.1. The [completion results](2026-10-26-completion-results.md) record
Phases 4-7, final gate evidence, and explicit support limits.
The user authorized the remaining fixes and development after Phase 3 on 2026-10-26.
This includes implementation, checks, Claude review, plan updates, and project memory.
The user then chose passive continuity saves on 2026-10-26. This replaces the
optional-only warning policy: after local setup, measured 50% use requests a
memory update, handoff, and documentation links while the session continues.
See [the passive-save follow-up](2026-10-26-passive-continuity.md).
Phase 2 closure passed the named local CLI checks. Desktop UI and cloud are not runtime-certified.
Source push and merge were authorized later, as recorded above. A global
install, a scheduled job, and a public release remain outside that scope.

Read the [validation cases and source notes](2026-10-25-compound-memory-validation.md) with this plan.
They define the proof each task must produce.

Read the [Phase 0 findings](2026-10-25-phase-0-findings.md), [coverage map](../coverage.md), and [host matrix](../host-support.md) before starting U4.
U1-U3 have deliverables. G0 is met because source conflicts and host unknowns now have explicit records.
This is not a claim that all host tests passed.
The Phase 0 Codex file-read failure was resolved in Phase 2 with the supported Windows MXC mode.
Later phase gates were open at that Phase 0 checkpoint. The completion results
above record their later bounded checks; public release remains a separate step.
Read the [Phase 1 results](2026-10-25-phase-1-results.md) for U4-U7, the final tests, and Claude's recheck.
Read the [Phase 2 results](2026-10-25-phase-2-results.md) for U8-U11, Claude review, routing observations, and the remaining host checks.
The [Phase 2 closure](2026-10-25-phase-2-closure.md) resolves those checks and records the current host limits.
The [Phase 3 results](2026-10-26-phase-3-results.md) record U12-U15, live roles, review fixes, and current limits.

## Goal

Make Compound Memory the main plugin for project development in Claude Code and Codex.
It must support research, plans, design trials, code, review, tests, releases, lessons, and handoffs.
It must use focused specialist agents when they help.
It must keep project memory small, useful, and tied to evidence.
It must let the model choose a suitable method.

The user should be able to give a plain request.
The plugin should select the needed work, show the result, and preserve the next step.
A fresh session in the other app should be able to continue from files.

The plugin replaces overlapping workflow instructions.
It still uses host tools, browsers, Git, test tools, and service connections.
It does not need another skill library to complete its supported workflows.

## Terms

- **Host:** the app that runs the model, such as Claude Code or Codex.
- **Adapter:** the small part that connects shared plugin rules to one host.
- **Lead:** the main agent that owns the run and combines results.
- **Specialist:** an agent with a narrow job and a defined result.
- **Unit:** one task in this plan. Each unit has a stable U number.
- **Phase gate:** the checks needed before dependent work can start.
- **Lease:** a time-limited task claim. It prevents two workers from owning the same task.
- **Fingerprint:** a saved value that changes when the inspected files change.
- **Checkpoint:** a short saved record of work that can be resumed.
- **Memory integrity:** whether saved claims still agree with their sources.
- **Context pressure:** how much of a session's usable context is occupied.
- **Compaction:** the host's process for shortening a session's context.
- **Unknown:** the available evidence cannot establish the answer.

## Baseline evidence and later results

The planning baseline is local commit e47e021a.
The working tree was clean before plan work.
Phase 0 rechecked that baseline. Confirm it again before implementation.
The Phase 0 report qualifies older memory and release claims with current evidence.

| Area | Existing support | Gap to close |
| --- | --- | --- |
| Skills | Twelve skills and eight project-memory modes exist. | Plain request routing needs stronger live tests. The five short memory commands are absent. |
| Plans | Requirements, decisions, units, dependency links, and checks exist. | No complete phase and task execution model exists. Plan checks do not detect dependency cycles. |
| Tickets | The script checks cycles and declared path overlap. | Ownership, leases, shared resources, and retry state are missing. |
| Parallel work | The build guide defines worker packets and separate working copies. | Most control is prose. Concurrent updates can overwrite run state. |
| Agents | A memory-auditor definition exists. | The requested code, scout, UI, critic, test, and integrity roles are not packaged. |
| Proof | Run records bind saved output to code fingerprints. | The recorded exit code comes from the agent. Capture needs its own permission-aware path. |
| Memory | A probe, validator, hygiene scan, and audit bridge exist. | There is no shared due-check queue, integrity policy, or timed run path. |
| Handoffs | Branch-aware handoffs exist. | Ignored evidence under .verify/ is not portable to another clone by default. |
| Hosts | Claude and Codex manifests exist. | This package disables Codex hooks. Full skill behavior in Codex remains unverified in the repo's records. |
| Documentation | Limits are stated in several places. | Some notes disagree about live Codex audit coverage. Four memory files were flagged for source changes. |

The local baseline run recorded on 2026-10-25 passed 732 tests.
It failed no tests and skipped 25.
That was not a live Claude/Codex workflow test.
The memory format check passed.
Neither result proves that memory claims are true.

Phase 0 also observed Claude plugin discovery and a namespaced Skill call.
The Claude review returned eight findings that are included below.
Codex model access worked, but its file-read process failed before skill execution.
See the host matrix for the exact tested scope and fallback.

Phase 1 added opt-in version 2 plans, checked task state, immutable submissions,
and separate command capture. The table above records the Phase 0 baseline.
The Phase 1 report records the current additions and their limits.

Keep these existing parts where possible:

- [Shared principles](../../references/principles.md).
- [File contracts](../../references/artifacts.md).
- [Plan checks](../../scripts/plan-check.mjs).
- [Ticket checks](../../scripts/tickets-check.mjs).
- [Run records](../../scripts/run-record.mjs).
- [Memory state probe](../../scripts/project-state.mjs).
- [Memory validator](../../scripts/memory-validate.mjs).
- [Memory hygiene scan](../../scripts/memory-hygiene.mjs).
- [Audit bridge](../../scripts/auditor-bridge.mjs).

## Requirements

- R1: Complete the agreed workflow coverage without a runtime dependency on another skill library.
- R2: Support tested Claude Code and Codex paths with the same project files and outcomes.
- R3: Route plain requests correctly. Keep explicit commands and short memory commands available.
- R4: Scale process to task size. Keep model choice and method flexible.
- R5: Produce a durable project, feature, phase, and task structure with stable links.
- R6: Preserve task state across interruption, failed workers, and host changes.
- R7: Provide the lead, code specialist, code scout, UI reviewer, blind critic, test specialist, and memory integrity specialist.
- R8: Run independent tasks in parallel without conflicting file or resource ownership.
- R9: Keep blind reviews separate from builder claims. Review an unchanged target.
- R10: Bind completion claims to checks on the final combined code.
- R11: Keep one home for each project fact, work state, and user preference.
- R12: Detect stale, conflicting, unsupported, and oversized memory. Preserve unknowns.
- R13: Use supported hooks for bounded signals. Prevent repeated or recursive agent runs.
- R14: Treat context use as a host-reported signal. Test a configurable 50% advisory mark.
- R15: Support periodic integrity checks during active work and optional scheduled checks while idle.
- R16: Preserve user edits and approved scope. Keep inspection separate from repair.
- R17: Bound worker count, retries, elapsed time, context input, and model use.
- R18: Carry useful handoffs across apps and machines without treating missing proof as present.
- R19: Cover research, UI work, setup, code changes, release work, and project support.
- R20: Turn useful experience into checks or small lessons without growing duplicate rules.
- R21: Test actual host behavior, permission limits, routing, resume, and context policy.
- R22: Upgrade and disable the plugin without losing project files or changing unrelated setup.

## Out of scope

- Building any feature during this planning task.
- Creating an automation or changing host settings now.
- Replacing the host's model, permission system, browser, or service tools.
- Making one large always-loaded prompt.
- Promising that every model fails at 50% context use.
- Treating a memory audit as a way to empty the lead's context.
- Adding a vector database or a remote memory service in the first release.
- Adding a web dashboard in the first release.
- Requiring Claude agent teams or direct mixed-vendor teams for the first release.
- Automatically merging, publishing, changing user-wide preferences, or deleting work.
- Automatically repairing memory from a hook or an idle scheduled audit.
- Claiming full replacement of a skill library before its relevant catalog and use cases have been compared.

## Decisions

- D1: User-settled. Deliver a documented development plan only. Do not start implementation.
- D2: User-settled. Target Claude Code and Codex. Include specialist agents and parallel work.
- D3: User-settled. Add a memory integrity specialist with support for periodic checks.
- D4: Recommended. Keep the current skills and scripts as the base. Extend their contracts instead of replacing the repo.
- D5: Recommended. Use one shared source for role instructions and file formats. Keep host settings in small adapters.
- D6: Recommended. Use native subagents first. Fall back to sequential work when the required agent support is absent.
- D7: Recommended. Use one lead writer for shared run state and canonical memory. Workers return separate result files.
- D8: Recommended. Keep the current audit path as the deep claim checker. Let the integrity specialist select and combine bounded checks.
- D9: Recommended. Use command hooks to mark work due. Let the lead dispatch the specialist at a safe task boundary.
- D10: Recommended. Keep the current hooks read-only. Add a separate, opt-in hook for local queue writes.
- D11: Chosen on 2026-10-26. Make 50% a passive save point after local setup. The lead updates supported memory facts, saves a handoff and documentation links, and continues work. No hard failure or forced session reset. Do not infer a quality threshold.
- D12: Recommended. Default paid or model-backed idle checks to off. Expose time and cost limits during setup.
- D13: Recommended. Use one role source with explicit host outputs. Do not maintain two independent sets of role prose.
- D14: Recommended. Keep inspection, canonical repair, and user preference changes as separate actions.
- D15: Recommended. Add a plan status view from task records. Do not copy task status into several documents.
- D16: Recommended. Keep skills joined through files. The lead selects the next skill or agent. Skills do not need a hidden call engine.

These recommendations are design defaults for the plan.
They are not claims about shipped behavior.
Implementation must record any replacement decision and its reason.

## Target structure

### Shared core

The shared core owns skill goals, role goals, plan formats, task results, evidence rules, and memory rules.
Keep the root instructions short.
Load details only for the current task.
A small fix should not start a team or create a long plan.

Use scripts for exact checks.
Use models for code judgment, design judgment, and claim review.
Do not turn a prose preference into a blocking rule without a clear failure case.

### Host adapters

Each adapter must report its tested capabilities.
Include host version, model identity when available, tool access, hook support, and context signal support.
Do not equate a valid manifest with a working workflow.

Keep shared behavior independent of host-specific variable names.
Resolve installed plugin paths through the host.
Test Windows paths with spaces.
Do not hard-code a machine path.

The Claude adapter can package agents in the plugin's agents/ directory.
The Codex adapter must use the supported custom-agent or task-packet path for its tested host version.
Do not assume that Claude agent Markdown registers a Codex agent.
Setup must report anything that needs project registration or host trust.

An unavailable feature must have a named fallback.
Examples are sequential work, manual status, explicit audit, or manual handoff.
Do not claim equivalent protection when a fallback has weaker access control.

### Task selection and user experience

Keep the existing skill names where their scope remains useful.
Add short memory commands as thin routes to the existing modes.
Use a plugin prefix when a bare command collides with another command.
Document the actual invocation form for each host.

Normal requests should select the right skill without requiring the user to know the internal phases.
A plan-only request must not start a build.
A review request must not start a repair.
A small question must not start an audit.

Use one short report:

- What changed.
- What passed.
- What remains unknown or blocked.
- The next needed step.

Offer at most two choices when a user decision is needed.
Keep the reason for each choice plain.
Use prior authorization within its scope.
Do not request the same approval at every phase.

## Plan and execution hierarchy

    Project brief
      Feature plan
        Requirements and decisions
        Phase
          Task
            Assignment
            Result and evidence
        Final acceptance
      Current project memory
      Resume checkpoint

The feature plan is the source for scope and success checks.
The run ledger is the source for live task state.
Memory points to both and records lasting facts.
A dashboard or status reply is a view of those sources.

### Required records

| Record | Required fields |
| --- | --- |
| Project brief | Intended users, outcome, limits, links to source projects, key project rules. |
| Feature plan | Plan ID, revision, requirements, decisions and their owner, exclusions, risks, phases, final checks. |
| Phase | Stable phase ID, outcome, task IDs, entry conditions, exit checks. |
| Task | Stable task ID, requirement links, goal, allowed paths, shared resources, unit dependencies, required gate IDs, result shape, verify method. |
| Assignment | Run ID, lead owner version, task ID, attempt ID, worker ID, role, workspace, base fingerprint, lease, time and output limits. |
| Result | Assignment ID, actual changed paths, result state, checks, evidence paths, blockers, unresolved findings. |
| Run ledger | Revision, lead owner and owner version, plan revision, task states, active leases, accepted results, integration state, next action. |
| Checkpoint | Plan and run IDs, code state, completed work, unfinished edits, active decisions, missing proof, exact next step. |

Use planned, ready, claimed, running, blocked, failed, awaiting-review, accepted, and cancelled task states.
Use a separate integration state.
A worker result is not accepted just because the worker reports success.
The lead checks scope, proof, and the combined result.

A task is ready only when its named unit dependencies and required gate IDs passed.
An omitted Requires gates field means no extra gate prerequisite.
Phase numbers alone do not create a dependency.
Reject malformed dependency graphs before reading the ready-task list.
Require an atomic claim before dispatch.
An expired lease needs a liveness check before reassignment.
Reject late results from an old attempt.

Plan edits preserve IDs.
Record the reason for scope or decision changes.
A changed requirement invalidates its task and acceptance checks until reviewed.
Unrelated checks can remain valid when their scope and input fingerprints still match.

## Specialist agents

| Role | Inputs | Output | Write boundary |
| --- | --- | --- | --- |
| Lead | User request, plan, current run, small memory set. | Assignments, accepted results, combined changes, final report. | Owns shared run state. Owns permitted canonical memory updates. |
| Code specialist | One task, relevant decisions, allowed paths, base version, checks. | Code changes, actual path list, test output, unresolved items. | Only assigned files in its work area. |
| Code scout | Scoped repository question and exclusions. | Code map, call paths, tests, dependencies, evidence links, coverage limits. | No source edits. |
| UI reviewer | User flow, fixed app version, test data, design criteria. | Screenshots, interaction findings, access and mobile checks. | Evidence only. Test data actions stay within the assigned test environment. |
| Blind critic | Requirements, fixed target, isolated task packet. | Evidence-backed findings or a supported pass. | No code, memory, or external-service changes. |
| Test specialist | Plan checks, combined code version, real test entry points. | Test results, behavior checks, gaps, saved output. | Test work area and evidence only. |
| Memory integrity specialist | Memory snapshot, source changes, last coverage record, due reasons. | Bounded integrity report, unchecked claims, repair proposals, next due reasons. | No canonical memory edits. |
| Existing memory auditor | A deep claim-check request from the integrity flow or explicit audit. | Classified claim findings with evidence. | Preserve its restricted read access. |

These are roles, not fixed model brands.
For each host, label a write limit as tool-enforced or instruction-only.
Claude plugin agents ignore permissionMode, hooks, and mcpServers in their frontmatter.
Codex custom agents inherit parent permissions and MCP servers.
Neither a role title nor frontmatter alone proves isolation.
The lead runs deterministic inspection scripts for a restricted integrity reviewer.
Pass their captured output and source fingerprints into the review packet.
Keep the reviewer on file-read tools where the host supports that grant.
A role that needs shell or browser actions has a different, tested access profile.
Inherit a suitable model by default.
Allow an explicit model map where the host supports it.
Record the actual evaluator when known.
Do not infer independence from a role name or an unverified model label.

### Blind review contract

Use a fresh context.
Do not fork the builder's full conversation into the critic.
Provide requirements, standards needed for the check, and a fixed target.
Withhold the builder's defence, earlier review verdicts, and preferred answer.
Build the packet from approved requirement and target fields.
Use deterministic packet construction where feasible.
Keep the actual sent prompt as evidence and inspect it for leaked review history.

For visual comparisons, hide which side is the new work until the critic records its first choice.
Keep the assignment and side mapping separate.
For code review, the lead prepares a frozen worktree or file copy at the chosen commit.
A commit ID alone is not a readable target for a file-only reviewer.
Record the copy's fingerprint before and after review.
A builder edit during review makes that review stale.

A critic may report no defects.
Each reported defect needs a specific failure path and source evidence.
The lead tries to disprove serious findings before requesting a fix.
Do not reward finding count or harsh wording.

Read-only instructions are not a permission boundary.
Test actual file and external-tool access on each host.
If strict isolation is not available, use a separate restricted process or a frozen evidence bundle.
Label weaker fallback reviews.

### Code scout contract

Start with a bounded file map.
Skip generated output, dependencies, binaries, secrets, and unrelated external paths.
Expand only where the question needs it.
Name directories inspected, directories excluded, and paths that could not be read.
Do not call a partial scan a full code audit.
Cache maps by code version and invalidate changed areas.

## Parallel work and recovery

Start with a lead and at most three workers.
The host's lower limit wins.
The limit is a configurable policy, not a promise of faster work.
Small tasks remain single-agent tasks.

Read-heavy research and independent review are the first parallel modes.
Enable concurrent code work only after task claims and integration checks pass.

Each worker gets a small task packet.
It must not receive the whole repository history by default.
Declare both file ownership and shared resource ownership.
Resources include ports, databases, lockfiles, generated files, schemas, and test accounts.
Different files can still share a resource.

Prefer separate working copies for code workers.
Shared-tree work is allowed only for non-overlapping paths.
Shared-tree workers must not run Git mutations, installs, or shared full-suite tests.
The lead owns integration.

Workers write separate result files.
The lead consumes each result once.
Use revision checks for shared state updates.
Do not allow worker processes or hook processes to overwrite the same run record.

The lead also holds an ownership lease and an increasing owner version.
Stamp assignments, results, and state writes with that version.
On the same state store, reject writes from an old owner version.
Before a cross-host transfer, stop the old lead and reconcile its workers.
Import the checkpoint under a new owner version.
Separate offline clones cannot fence each other's writes with a local file.
If the old lead's stop cannot be established, inspect only or create a separate run.
Do not claim exclusive ownership across disconnected copies.

Before integration, check the worker base and actual changed paths.
Preserve edits that existed before the run.
Check the combined code after integration.
Run the final acceptance checks on the final version.

On failure, preserve the working copy and result evidence.
Retry only the failed task within the run's retry limit.
Stop the dependent tasks.
Independent tasks can continue if the shared state remains sound.
On cancel, stop owned processes and retain work needed for recovery.
Do not delete an unmerged working copy as routine cleanup.

## Memory and handoff design

### Three separate kinds of memory

| Kind | Purpose | Owner |
| --- | --- | --- |
| Project facts | What exists, why decisions were made, known risks, source links. | Lead through the memory workflow. |
| Current work | Plan pointer, task state pointer, unfinished edits, next action. | Lead through the run and handoff workflow. |
| User preferences | Working and report rules that the user owns. | Existing preference source. Changes require their own scope. |

Keep one source for each fact.
A handoff links to the plan and run.
It does not copy all their contents.
Keep a small startup set.
Retrieve detailed lessons and decisions only when the task needs them.

Record enough source data to test important claims.
For a check result, include the code version, command, output reference, and check time.
For an outside fact, include its source and checked date.
Keep measured, estimated, assumed, contradicted, and unknown states distinct.
A recent check date alone does not make a claim true.

An authorized build can save confirmed task state at a phase boundary.
A question, status check, or review remains read-only.
Repair is a separate step.
Do not promote an auditor's suggested change directly into canonical memory.

### Portable handoff

Keep a small durable handoff manifest in the project.
Include repository identity, branch, commit, dirty-state fingerprint, plan revision, run ID, task IDs, and next step.
Include evidence references and availability status.
Exclude credentials, raw private transcripts, and unrelated personal history.

Every portable handoff also carries a versioned run-state export.
It includes task states, attempts, accepted result summaries, active claims, owner version, and unresolved work.
This export is a frozen transfer record, not a second writable ledger.
Import it once after checkout and ownership checks.

A fingerprint cannot restore unfinished edits.
For another checkout, transfer the approved patch and required untracked work files.
Otherwise mark those tasks blocked until the source work is available.
Keep large test output optional.
Without that output, preserve historical task status but require fresh proof for current acceptance.
Do not rebuild unchanged code only because its proof needs to run again.

Offer an explicit evidence bundle when a different machine needs local output.
Do not assume that ignored .verify/ files travel with Git.
On resume, compare the manifest with the actual checkout.
Missing proof stays missing.
Re-run a needed check or mark the result unverified.

## Memory integrity and context policy

### Separate the two problems

Saved memory can become stale when its source changes.
A crowded session can miss relevant facts even when saved memory is correct.
One can happen without the other.

The user's 50% observation is a useful test hypothesis.
It is not a proven limit for all models.
Available research supports treating long context as a limited resource.
It does not establish one shared failure percentage. See source S6 in the companion file.

Use 50% as the chosen passive save mark after local setup. It is a continuity preference, not a quality claim.
Measure the result before making any model-quality claim about the mark.
Do not infer context use from elapsed time or a message count.
Do not divide lifetime token totals by the context window.
Store the signal source, effective window, basis, timestamp, and model when known.
An absent or old signal is unknown.

### Three levels of checking

1. A cheap local probe checks changed paths, file shape, queue state, and due times.
2. The integrity specialist checks selected claims in a fresh context.
3. A deep audit checks a wider memory scope when requested or justified by confirmed drift.

The report must name the checked scope and the unchecked scope.
Use fresh, review-needed, contradicted, and unchecked claim states.
Do not reduce mixed results to one green score.
Time can make a check due.
Time alone does not prove that memory is wrong.

### Proposed trigger policy

These are trial defaults for future implementation.
They are not enabled by this plan.

| Trigger | Proposed action | Limit |
| --- | --- | --- |
| Session start or resume | Run the cheap probe. Show a short signal only when action is needed. | No automatic full audit. |
| Accepted phase or task group | Save permitted work state. Queue checks for changed source claims. | Reuse the completed check evidence. |
| Relevant source or memory edit | Debounce changes and mark affected claims for review. | Ignore unrelated paths. |
| 60 minutes since the last probe, during active work | Run the cheap probe at the next supported event. | This is not an exact timer. |
| 24 hours since the last integrity check, with relevant changes | Queue one bounded specialist run if the project enabled model-backed checks. | At most one routine run per interval. |
| Confirmed contradiction or invalid required memory | Queue a focused check at the next safe boundary. | May bypass the routine interval. Still obey the run budget. |
| Measured context crosses 50%, or its first valid reading is already at least 50% | Save a checkpoint and queue the active lead's memory update, continuation handoff, and plan/proof links. Keep working. | Once per context epoch. Never trigger a full audit or forced reset just from the percentage. |
| Before compaction | Copy the last lead-owned checkpoint into a bounded local recovery file. | No canonical write, long audit, or compaction block. |
| After compaction | Re-anchor the lead through the adapter's supported context-delivery point. | Read a small packet. Do not reload all memory. |
| User-set idle schedule | Run a scoped integrity check through an installed scheduler adapter. | Report only. No canonical repairs. |

An epoch is one continuous context period.
Key its threshold latch by session, model, effective window, and confirmed compaction count.
Reset it after confirmed compaction, a new session, or a model/window change.
A null or stale reading does not reset the latch.
If the host cannot identify an epoch, use a cooldown and report the weaker signal.

### Hook and queue contract

Hooks are event handlers.
They are not a general clock.
A timer is required to run while no host event occurs.

The preferred flow is:

    Supported host event
      Cheap command hook
      One local due request
      Lead reaches a safe boundary
      Memory integrity specialist gets a fresh task packet
      Lead receives a short report
      Permitted repair is a separate action

The lead reads the queue at session start, before a new task group, and after accepting results.
A supported prompt/start event may add one short due signal.
If context injection is unavailable, the workflow explicitly reads the queue at those boundaries.
A queue file alone is not a dispatch mechanism.
Test the full path from event to report.

Claude agent hooks are experimental.
They do not support every event.
Codex currently skips agent hook handlers.
Do not use an agent hook as the shared dispatch contract.
See sources S1 and S3.

Keep the existing read-only hooks unchanged until their contracts are deliberately revised.
A separate opt-in queue hook may write only ignored local runtime state.
Use a versioned project-local enable flag under ignored runtime state.
Default the queue hook to off. A registered hook must return without action when the flag is absent.
Keep one owner for SessionStart output. Merge the resume packet into that output instead of printing a second packet.
It must not edit memory, code, a task status, or a user profile.
It must use a short timeout and bounded input.

Scope requests by repository, worktree, run, and memory snapshot.
Coalesce duplicate reasons.
Use one active integrity run per target snapshot.
Record the last attempt separately from the last successful check.
A failed or cancelled audit must not advance freshness.
Bind each verdict to the inspected memory and source fingerprints.
Recheck those fingerprints before advancing current coverage.
If they changed, retain the result as history and queue the affected claims again.
Apply this rule to idle audits as well as lead-dispatched audits.

Use a run-origin marker to prevent hook loops.
Audit activity must not start another audit.
Ignore queue and report writes as source changes.
Use a single lead consumer with a claim lease.
Unexpected output or hook failure must not block normal editing.

Queue loss is a recoverable condition.
Rebuild due state from source changes and the last successful coverage record.
Host tools, not text inside a repository file, decide which actions are allowed.

### Context telemetry and safe handoff

Claude status-line data includes a context percentage.
Its source is the last model response.
The value can be missing.
A future adapter must preserve the user's existing status-line setup.
Install that optional bridge only within explicit setup authority.
Record owned fields and a reversible change. Do not replace an existing command without a tested composition path.
If setup is declined, incompatible, or headless without a signal, report percentage unknown and use event checks.
This field is not a universal hook field. See source S2.

Codex hooks do not currently document a context percentage.
App Server has a token-usage event, but plugin access to it is not established here.
Do not depend on unstable transcript parsing.
Use event and elapsed-time checks when a supported percentage source is absent. See sources S3 and S4.

A fresh integrity agent does not empty the lead's context.
After saving a checkpoint, the lead may use a supported compact or fresh-session path within the user's scope.
The plugin must preserve unfinished work before a reset.
It must not automatically clear the user's conversation at 50%.

The pre-compaction hook can copy only an existing lead-owned checkpoint into local runtime storage.
It does not create new canonical facts from the transcript.
If no checkpoint exists, record that limit and allow compaction.
The lead creates the durable handoff at ordinary task boundaries.

For Claude, use SessionStart with the compact source to deliver the small resume packet.
Do not assume that PostCompact can inject it.
Verify the separate Codex delivery path.
When no supported post-compaction delivery exists, use the next prompt/start boundary or explicit resume.

### Idle schedules

Provide a scheduler adapter only after the active-session path works.
The schedule setup must name the project, branch or snapshot policy, cadence, time zone, access limits, model budget, and report location.
The idle worker reads a stable target.
If the live checkout is changing, defer or inspect an isolated snapshot.

If the machine was off, perform at most one catch-up check.
Do not replay every missed interval.
If credentials or model access fail, record a blocked check.
Do not mark memory healthy.
The job may write only its scoped runtime reports and queue/check-attempt records.
It may not write canonical memory, code, or task status.
The next lead checks report fingerprints before accepting current coverage.
Allow pause, resume, disable, and removal without deleting reports.
Notify only on new material findings, completion requested by the user, failure, or required user action.

## Coverage beyond coding

Keep these workflows within one plugin.
Use modes or references where they fit.
Create a new public skill only when tests show a distinct trigger is needed.

| Area | Existing home | Planned extension |
| --- | --- | --- |
| Research and code explanation | plan, catch-up | Scoped code maps, official-source research, source dates, unknowns. |
| UI and product work | prototype, plan, verify, review | Design criteria, real flows, visual evidence, blind comparison. |
| Setup and diagnosis | debug, verify | Host capability check, project launch recipe, named tool gaps. |
| Larger code changes | plan, build | Phase gates, dependency checks, safe parallel tasks, migration checks. |
| Release and support | ship, debug, verify | Release checklist, rollback proof, post-release checks within granted scope. |
| Docs and instructions | write | Plain reports, fact-preserving edits, small agent instructions. |
| Lessons and preferences | learn | Deduplication, source checks, checks for repeated faults, explicit profile scope. |
| Continuation | project-memory, catch-up | Portable checkpoints, evidence availability, host-to-host resume. |

Compare the full relevant catalogs of other libraries before claiming replacement coverage.
Record use cases and gaps.
Do not copy whole libraries or load their prompts at runtime.
Preserve licenses for any code actually reused.
First trial replacement by disabling overlapping skills.
Do not uninstall the user's tools as part of a test.

## Phases

| Phase | Outcome | Units | Exit gate |
| --- | --- | --- | --- |
| P0: Baseline and scope | Current facts and replacement scope are known. | U1-U3 | G0: Source conflicts and host unknowns have explicit records. |
| P1: Shared contracts | Plans, tasks, results, and proof have one shape. | U4-U7 | G1: Invalid graphs and false completion records are rejected. |
| P2: Host support and routing | Both hosts load the same core and use clear fallbacks. | U8-U11 | G2: Installation, explicit use, and plain request cases pass. |
| P3: Specialists | Narrow roles return bounded, useful results. | U12-U15 | G3: Access, blind review, and claim-report cases pass. |
| P4: Parallel execution | Independent work can run and recover safely. | U16-U19 | G4: Concurrent, conflicting, interrupted, and resumed runs pass. |
| P5: Memory and context | Due checks, checkpoints, and idle checks work without loops. | U20-U24 | G5: Missing signals, repeat events, drift, and downtime cases pass. |
| P6: Coverage and migration | The plugin covers agreed daily work and upgrades safely. | U25-U27 | G6: Coverage gaps are explicit. Existing project data survives. |
| P7: Validation and release | Live results support the advertised claims. | U28-U31 | G7: Required cases pass in both hosts. Limits and rollback are published. |

Each gate requires the listed units to be accepted and the named exit checks to pass.
Only a task's explicit Requires gates field makes a phase gate block dispatch.
For example, U8 can start after U4 without waiting for every P1 task.
U16 must wait for G1 as well as its unit dependencies.
G7 is evaluated after U31. It is not a prerequisite of U31.
Validate the combined unit-and-gate graph for cycles.
Independent tasks may overlap across phases when their named prerequisites are met.
The lead must still check shared paths and resources.
The unit list and explicit gate fields are authoritative for dispatch.

## Units

U1-U3 have Phase 0 deliverables. U4-U7 are built and verified in the Phase 1 report.
U8-U11 passed the bounded Phase 2 closure checks. U12-U15 passed the Phase 3 cases.
U16-U31 have implementations and bounded checks in the completion report.
The short context trial is inconclusive, as U30 permits. No broad replacement
or desktop/cloud support claim follows from the bounded CLI cases.
Verify lines define acceptance checks. The phase reports state which checks ran and their limits.
New file paths below are proposed implementation locations.
Use existing files where they already own the responsibility.

### U1: Establish the baseline

- Phase 0 state: complete. See the dated baseline and claim-conflict table in the Phase 0 report.
- Phase: P0.
- Owner: Lead with code scout.
- Depends on: None.
- Covers: R11, R12, R21.
- Files: docs/limitations.md, memory/current-state.md, memory/acceptance-criteria.md, tests/.
- Work: Confirm the checkout and host versions. Reconcile the conflicting audit claims from saved evidence. Record skipped tests and untested paths. Do not upgrade a claim from prose alone.
- Deliverable: A dated baseline with source pointers and explicit unknowns.
- Verify: A01 in the companion file. Every working claim has current evidence or is marked unverified.

### U2: Map replacement coverage

- Phase 0 state: complete. docs/coverage.md maps 132 entries at named source versions. Runtime replacement remains unproved.
- Phase: P0.
- Owner: Code scout and lead.
- Depends on: U1.
- Covers: R1, R19, R22.
- Files: docs/coverage.md (new), skills/*/SKILL.md.
- Work: Read the full relevant catalogs of the named workflow libraries. Map the user's real work to this plugin. Identify duplicate triggers, missing workflows, and tools that remain external.
- Deliverable: A keep, extend, or gap decision for each agreed use case.
- Verify: A02. A second reader can trace every claimed replacement to a tested workflow or an open gap.

### U3: Define the host capability matrix

- Phase 0 state: complete as a support record. Claude probes are bounded. Codex file-read execution is blocked. These limits do not pass later host gates.
- Phase: P0.
- Owner: Code scout.
- Depends on: U1.
- Covers: R2, R13, R14, R15, R21.
- Files: docs/host-support.md (new), .claude-plugin/plugin.json, .codex-plugin/plugin.json.
- Work: Record documented and locally observed support separately. Split Claude CLI, Codex CLI, Codex desktop, and cloud. Separate install, enablement, trust, discovery, and execution. Include agents, hooks, context signals, scheduling, output, and cancellation. Record tested versions without inventing minimum versions.
- Deliverable: A capability matrix with fallback and test case for each row.
- Verify: A03. Unsupported or untested features cannot appear as supported.

### U4: Define shared data and authority contracts

- Phase 1 state: complete. A04 passed. Versioned rules, schemas, and both examples are in place.
- Phase: P1.
- Owner: Lead.
- Depends on: U2, U3.
- Covers: R4, R5, R11, R16.
- Files: references/artifacts.md, references/work-contracts.md, references/principles.md, schemas/, examples/contracts/, docs/architecture.md.
- Work: Define the hierarchy, stable IDs, one owner per record, and the write rules. Keep project preferences separate from global preferences. Document which current invariants change and why.
- Deliverable: Versioned contracts and examples for a small task and a multi-phase plan.
- Verify: A04. Each field has one owner. No example requires duplicate status edits.

### U5: Extend plan and task validation

- Phase 1 state: complete. A05 passed. Invalid graphs stop dispatch; valid shared claims wait.
- Phase: P1.
- Owner: Code specialist.
- Depends on: U4.
- Covers: R5, R6, R8.
- Files: scripts/plan-check.mjs, scripts/tickets-check.mjs, scripts/lib/plan-contract.mjs, skills/plan/, tests/plan-contract.test.mjs, tests/engineering-scripts.test.mjs.
- Work: Validate phase links, task IDs, cycles, unknown blockers, resource claims, and required checks. Fail closed on an invalid graph or unsafe assignment. Valid tasks with overlapping resources wait in order. Preserve legacy plan support with explicit version handling.
- Deliverable: A validated plan-to-task graph.
- Verify: A05. Cycles, unknown IDs, and unsafe assignments fail. Valid tasks with shared resources run in order. Valid old and new plans pass.

### U6: Add durable run and assignment state

- Phase 1 state: complete. A06 passed in local tests. Real host liveness checks and external workspace control remain later work.
- Phase: P1.
- Owner: Code specialist.
- Depends on: U4, U5.
- Covers: R6, R8, R16, R17.
- Files: scripts/run-state.mjs (new), scripts/lib/run-state.mjs (new), schemas/, tests/run-state.test.mjs (new).
- Work: Add plan revision, task attempts, state transitions, leases, result IDs, and revision checks. Keep worker results separate. Make accepted-result processing repeat-safe. Keep ledger mutations in the new run-state command, outside the existing wildcard-granted run-record helper.
- Deliverable: One lead-owned run ledger with recoverable claims.
- Verify: A06. Simultaneous results survive. Old attempts, invalid transitions, and stale updates are rejected.

### U7: Capture proof without expanding hidden permissions

- Phase 1 state: complete. A07 passed. The final suite used captured proof. No wildcard tool grant was widened.
- Phase: P1.
- Owner: Code specialist and test specialist.
- Depends on: U4, U6.
- Covers: R10, R16, R18.
- Files: scripts/run-record.mjs, scripts/lib/proof.mjs, scripts/verify/capture.mjs, references/artifacts.md, tests/capture-proof.test.mjs, tests/result-helpers.test.mjs.
- Work: Add a separate host-authorized capture path for actual command results. Keep manually entered results labelled as reported. Bind output, command, environment, and code version. Fingerprint inspected inputs before launch and after completion. If they changed, mark the result stale. Separate capture failure from test failure.
- Deliverable: Proof records with explicit capture basis.
- Verify: A07. A false reported exit code cannot become captured proof. Missing, altered, or stale output fails the completion check.

### U8: Package the shared core

- Phase 2 state: accepted. A08 passed: both hosts loaded all 17 entries. Native install, upgrade, and disable checks passed with preserved user settings.
- Phase: P2.
- Owner: Code specialist.
- Depends on: U3, U4.
- Covers: R1, R2, R22.
- Files: .claude-plugin/plugin.json, .codex-plugin/plugin.json, agents/, skills/*/agents/, tests/manifest.test.mjs.
- Work: Keep shared role and skill content in one source. Produce supported host entry points. Check current portable-manifest rules before adding a root manifest. Preserve legacy install paths where supported.
- Deliverable: One plugin source with tested host packages.
- Verify: A08. Both hosts discover the intended skills. Metadata and shared role content cannot silently drift.

### U9: Improve request routing and short commands

- Phase 2 state: accepted. A09 passed on the bounded closure fixtures: typo/build outcomes, all five shortcuts, representative plain review, and read-only scope. The earlier one-line review chose direct work; perfect model routing is not claimed.
- Phase: P2.
- Owner: Lead and code specialist.
- Depends on: U2, U8.
- Covers: R3, R4, R16.
- Files: skills/*/SKILL.md, skills/project-memory/, evals/, tests/skills.test.mjs.
- Work: Add thin handoff, sync, grill, cleanup, and repair routes. Keep prefixes and collisions explicit. Reduce long overlapping descriptions. Preserve question-only and plan-only scope. Remove the blanket instruction to approve bundled scripts. State each script's effects, including model calls and temporary output. Respect authority already granted by the user.
- Deliverable: A small command map and a plain-request routing set.
- Verify: A09. Normal requests select the right work. Trivial requests avoid extra process. No read-only request causes a write.

### U10: Implement the Claude adapter

- Phase 2 state: accepted. A10 passed: live install/upgrade/disable/enable, both trust choices, real compaction, disabled hooks, narrow auditor tools, and all shortcuts. Test fixtures must be outside the loaded plugin tree for normal edit checks.
- Phase 2 scope note: this unit provides command-hook controls, event normalization, and bounded advisory output. The persistent integrity queue and dispatch remain U22. No queue flag in Phase 2 may imply that an agent was queued or started. The status-line bridge remains U23; unknown context values are preserved here.
- Phase: P2.
- Owner: Code specialist.
- Depends on: U3, U8.
- Covers: R2, R7, R13, R16.
- Files: agents/, hooks/, scripts/session-status-hook.mjs, docs/advanced.md, tests/host-claude.test.mjs (new).
- Work: Register role entry points and supported command hooks. Test actual tool restrictions and task packets. Do not rely on ignored plugin-agent permissionMode, hooks, or mcpServers fields. Preserve existing user settings. Treat experimental agent hooks as optional. Test enabled and disabled queue flags, plus one startup/compaction packet. Keep the status-line bridge optional with an unknown-value fallback.
- Deliverable: Claude setup, capability checks, and manual fallbacks.
- Verify: A10. Install, role dispatch, trust, disabled hooks, and restricted review cases match the matrix.

### U11: Implement the Codex adapter

- Phase 2 state: accepted for CLI and declared fallback contracts. A11 passed: MXC real read and denied-write control, installed status, live audit, and a live packet result validated by shared submission. Hooks stay off. Desktop/cloud runtime evidence remains absent. Codex no-delegation is instructed; strict tool isolation uses Claude.
- Phase: P2.
- Owner: Code specialist.
- Depends on: U3, U8.
- Covers: R2, R7, R13, R16.
- Files: .codex-plugin/plugin.json, skills/*/agents/openai.yaml, scripts/hosts/ (new), docs/advanced.md, tests/codex.test.mjs.
- Work: Use supported agent registration or explicit role packets. Add trusted command-hook support where verified. Do not rely on agent hook handlers or inherited read-only prose. Retest the Phase 0 Windows process failure before claiming skill support. Test apply_patch, Edit, Write, shell changes, and filter conversion. Keep hooks disabled until the adapter passes. Separate CLI, desktop, and cloud results.
- Deliverable: Codex setup, capability checks, and manual fallbacks.
- Verify: A11. The same task packet and result schema work in Codex. Unsupported signals remain unknown.

### U12: Define and package all specialist roles

- Phase 3 state: accepted. A12 passed bounded Claude CLI cases for all seven worker entries. The lead stays in the main session. Generic packets serve five roles; blind and integrity roles use native prompts plus a lead-validated result wrapper. Codex passed an explicit scout case; broad all-role host trials remain U29.
- Phase: P3.
- Owner: Lead.
- Depends on: U4, U10, U11.
- Covers: R4, R7, R17.
- Files: agents/, references/agents.md (new), skills/build/SKILL.md, skills/build/references/work.md, schemas/, tests/agents.test.mjs (new).
- Work: Define each role's purpose, inputs, output, access, and stop rules. Keep model maps optional. Add per-task context and output limits. Keep the lead as a role of the main session. Mark access as enforced or instructed per host. Define worker completion as a result plus proof. Shared-tree workers do not branch or commit. Adapt the build skill's existing completion rule to this role context.
- Deliverable: Shared role contracts with host-specific entry points.
- Verify: A12. Each role can finish a narrow case without drifting into another role or receiving the full conversation.

### U13: Add the code scout

- Phase 3 state: accepted. A13 passed seeded import-path, exclusion, unreadable-path, link, limit, source-change, and cache checks. Static paths are candidates, not runtime proof. Requested exclusions ignore case to avoid accidental disclosure across filesystem types.
- Phase: P3.
- Owner: Code specialist.
- Depends on: U12.
- Covers: R7, R19.
- Files: agents/, skills/plan/, skills/catch-up/, scripts/repo-map.mjs (new), tests/repo-map.test.mjs (new).
- Work: Build scoped maps and trace code paths. Exclude generated and private material. Record coverage, unreadable paths, and source versions.
- Deliverable: A bounded code report and reusable source map.
- Verify: A13. A seeded call path is found. Excluded files stay unread. Partial coverage is reported.

### U14: Add UI, blind, and test review contracts

- Phase 3 state: accepted. A14-A15 passed frozen-source and sent-prompt checks, faulty and clean live critic cases, visual identity contract controls, and real local app flow/mobile/keyboard/wrong-target cases. Source or copied-file changes invalidate results. App evidence validation does not invent browser observations.
- Phase: P3.
- Owner: Lead and review specialists.
- Depends on: U7, U12.
- Covers: R7, R9, R10, R16.
- Files: agents/, skills/review/, skills/verify/, schemas/, tests/review-isolation.test.mjs (new).
- Work: Prepare frozen file targets for read-only reviewers. Save start/end fingerprints. Build packets from approved fields and inspect the actual sent prompt. Separate builder context from critic input. Keep visual identity hidden for first-choice review. Verify serious findings. Capture actual app and version evidence.
- Deliverable: Review packets and result reports with tested access limits.
- Verify: A14 and A15. Seeded defects are found. Clean cases can pass. Builder hints do not enter the actual sent prompt. A target edit during review makes the result stale.

### U15: Add the memory integrity specialist

- Phase 3 state: accepted. A16 passed live false/unknown/valid/duplicate claim cases and regression checks for changed sources, altered output, prompt changes, and self-cited memory truth. Captured checks run in the selected copy. Native reports never repair memory or update freshness. Timed dispatch remains Phase 5.
- Phase: P3.
- Owner: Lead and code specialist.
- Depends on: U7, U12.
- Covers: R7, R11, R12, R16.
- Files: agents/, skills/project-memory/, scripts/auditor-bridge.mjs, schemas/, tests/memory-integrity.test.mjs (new).
- Work: Have the lead run probe, format, and hygiene checks. Supply captured outputs to a file-read-only integrity reviewer for selected deep claim checks. Reuse the memory auditor. Bound the check by changed claims and a fixed source snapshot. Test actual grants; shell access is not a read-only grant.
- Deliverable: Integrity reports with coverage, findings, unchecked claims, and repair proposals.
- Verify: A16. False claims are caught. Uncheckable claims stay unknown. No audit edits canonical memory.

### U16: Add bounded parallel dispatch

- Phase: P4.
- Owner: Code specialist.
- Depends on: U5, U6, U12.
- Requires gates: G1.
- Covers: R6, R8, R17.
- Files: scripts/run-record.mjs, scripts/agents/ (new), skills/build/references/work.md, skills/autopilot/.
- Work: Claim ready tasks and respect task, path, resource, time, and worker limits. Keep one dispatch authority. Reject graph errors before starting agents. Shared-tree worker completion returns a result and evidence without Git mutations. The lead owns integration and commits within the user's authorized scope.
- Deliverable: A native-host dispatch path with a sequential fallback.
- Verify: A17. Independent tasks overlap in time. Conflicting tasks wait. Limits and cancellation work.

### U17: Isolate code work and preserve existing edits

- Phase: P4.
- Owner: Code specialist.
- Depends on: U16.
- Covers: R8, R16, R22.
- Files: scripts/changes.mjs, scripts/lib/changes.mjs, skills/build/references/work.md, tests/worker-isolation.test.mjs (new).
- Work: Track base versions and actual changed paths. Use separate working copies when needed. Preserve staged, unstaged, and untracked user work. Detect writes outside ownership.
- Deliverable: Safe worker workspaces and a recoverable conflict path.
- Verify: A18. Seeded user edits survive. Out-of-scope changes cannot be accepted. Cleanup keeps unmerged work.

### U18: Integrate results and verify the combined code

- Phase: P4.
- Owner: Lead and test specialist.
- Depends on: U7, U14, U17.
- Covers: R8, R10.
- Files: scripts/run-record.mjs, skills/build/, skills/verify/, skills/review/, skills/autopilot/.
- Work: Inspect results and combine them in dependency order. Refresh checks affected by integration. Review a fixed combined target. Keep separate worker passes from final acceptance.
- Deliverable: A reviewed, tested combined result with linked evidence.
- Verify: A19. Two changes that pass alone but fail together cannot be marked complete.

### U19: Resume across sessions and hosts

- Phase: P4.
- Owner: Code specialist.
- Depends on: U6, U7, U18.
- Covers: R6, R18.
- Files: skills/project-memory/references/handoff.md, skills/catch-up/, scripts/run-record.mjs, schemas/, tests/handoffs.test.mjs.
- Work: Add portable manifests with required run-state exports and optional large evidence bundles. Transfer required unfinished edits explicitly. Reconcile plan revision, checkout state, lead ownership, leases, and result availability. Reject late results and duplicate completion.
- Deliverable: Claude-to-Codex and Codex-to-Claude resume.
- Verify: A20. Resume interrupted work once. Missing evidence and changed checkout state are reported.

### U20: Add source-linked memory coverage

- Phase: P5.
- Owner: Code specialist.
- Depends on: U4, U15.
- Covers: R11, R12.
- Files: scripts/project-state.mjs, scripts/memory-hygiene.mjs, skills/project-memory/references/memory-schema.md, schemas/.
- Work: Record claim sources, coverage, and verification basis. Detect changed source paths and contradictory records. Keep unsupported claims unchecked.
- Deliverable: A small integrity index with source and claim states.
- Verify: A21. Source changes mark review-needed claims. Age alone does not mark unchanged facts false.

### U21: Join memory updates to accepted work

- Phase: P5.
- Owner: Lead.
- Depends on: U19, U20.
- Covers: R11, R16, R18, R20.
- Files: skills/project-memory/, skills/build/, skills/autopilot/, skills/learn/, references/artifacts.md.
- Work: Save confirmed state at accepted boundaries within granted scope. Separate inspect, propose, and repair. Use one memory writer. Link reports and checkpoints without copying logs.
- Deliverable: Small, repeat-safe memory updates and portable checkpoints.
- Verify: A22. Repeating a sync adds no duplicate facts. Read-only work makes no canonical changes. Concurrent proposals cannot overwrite memory.

### U22: Add the due-check queue and hook signals

- Phase: P5.
- Owner: Code specialist.
- Depends on: U10, U11, U15, U20, U21.
- Covers: R12, R13, R17.
- Files: hooks/, scripts/integrity-due.mjs (new), scripts/lib/, tests/integrity-triggers.test.mjs (new).
- Work: Add a local queue enabled by a versioned project-local ignored flag. Default it to off. Missing or disabled flags cause no queue action. Coalesce repeated events. Track attempts and successful coverage separately. Add origin markers, cooldowns, and recovery from queue loss. Keep one owner for startup and compaction output.
- Deliverable: Cheap signals with one bounded lead-dispatched integrity run.
- Verify: A23. Enabled flags queue scoped work. Missing and disabled flags do nothing. Duplicate, recursive, failed, cancelled, and concurrent-branch events preserve correct due state. Startup and compact events each produce one packet.

### U23: Add context-pressure checkpoints

- Phase: P5.
- Owner: Code specialist.
- Depends on: U3, U19, U22.
- Covers: R13, R14, R18.
- Files: scripts/hosts/, skills/project-memory/, hooks/, docs/host-support.md, tests/context-policy.test.mjs (new).
- Work: Read supported host signals. Install an optional status-line bridge only within explicit setup authority. Preserve existing settings and record owned fields for restore. If setup is declined, incompatible, or headless without telemetry, keep percentage unknown. Preserve current usage basis. Trial the 50% advisory crossing. Save bounded checkpoints before compaction without a long audit.
- Deliverable: Context-aware checkpointing with event/time fallbacks.
- Verify: A24. Opt-in setup and removal preserve and restore the user's status line. Declined, incompatible, and headless setups keep a useful fallback. Null, stale, cross-model, post-compaction, and unsupported signals cause no false percentage or repeat storm.

### U24: Add optional idle scheduling

- Phase: P5.
- Owner: Code specialist.
- Depends on: U3, U15, U22.
- Covers: R12, R15, R17, R22.
- Files: scripts/scheduling/ (new), docs/advanced.md, schemas/, tests/integrity-schedule.test.mjs (new).
- Work: Add one supported local scheduler path per host environment. Name the target snapshot and budget. Handle downtime, stale locks, paused jobs, and missing access. Keep repairs disabled.
- Deliverable: User-configured periodic reports with clear pause and remove controls.
- Verify: A25. A missed interval causes one catch-up run. The job can save its scoped runtime report but cannot edit canonical project files or report failed checks as healthy.

### U25: Complete the agreed workflow coverage

- Phase: P6.
- Owner: Lead and specialists by topic.
- Depends on: U2, U9, U13, U14, U18.
- Covers: R1, R19.
- Files: skills/plan/, skills/prototype/, skills/debug/, skills/ship/, skills/write/, skills/verify/, docs/coverage.md.
- Work: Use docs/coverage.md as the Phase 0 scope map. Add bounded research, guided setup, UI refinement, issue and recorded-feedback intake, product choices, launch briefs, migration, release, rollback, and support recipes. Keep each tied to its named A26 sample and tool needs. Formal proof, iOS adapters, vendor services, and managed PR stacks remain deferred or optional as recorded there. Do not import another library's hidden calls or fixed model choices.
- Deliverable: Coverage with named checks and explicit tool needs.
- Verify: A26. Each included use case reaches its stated result without loading another workflow library.

### U26: Keep lessons and preferences small

- Phase: P6.
- Owner: Lead.
- Depends on: U20, U21.
- Covers: R4, R11, R20.
- Files: skills/learn/, skills/write/, scripts/lessons.mjs, memory/guardrails.md, tests/learning-policy.test.mjs (new).
- Work: Find before writing. Convert repeated mechanical faults into checks. Retire stale lessons with evidence. Keep project lessons separate from user-wide preferences.
- Deliverable: A bounded learning path and plain report rules.
- Verify: A27. Repeated lessons merge. A one-time observation does not become a global rule. Unsupported certainty is rejected.

### U27: Add migration and disable paths

- Phase: P6.
- Owner: Code specialist.
- Depends on: U8, U19, U21, U24, U25, U26.
- Covers: R1, R18, R22.
- Files: docs/quickstart.md, docs/advanced.md, schemas/, scripts/migrate.mjs (new), tests/migration.test.mjs (new).
- Work: Preview format changes. Back up affected files. Preserve user settings and old memory. Disable only plugin-owned hooks and schedules. Trial replacement with overlapping skills disabled.
- Deliverable: Upgrade, rollback, disable, and removal instructions.
- Verify: A28. Upgrade and rollback preserve user data. Disable leaves the project readable and stops plugin-owned jobs.

### U28: Build the shared acceptance harness

- Phase: P7.
- Owner: Test specialist and code specialist.
- Depends on: U5, U6, U7, U12.
- Covers: R10, R21.
- Files: tests/fixtures/, tests/acceptance/, evals/, .github/workflows/.
- Work: Add seeded failures and clean controls for the companion cases. Test graders against wrong results. Keep model-backed tests opt-in. Strip inherited test-runner state from child runs.
- Deliverable: Repeatable local checks and a separate live-test suite.
- Verify: A29. Every grader rejects its seeded fault. Missing tools and skipped cases never count as passes.

### U29: Run live host and handoff trials

- Phase: P7.
- Owner: Test specialist.
- Depends on: U10, U11, U18, U19, U22, U23, U24, U25, U27, U28.
- Requires gates: G4, G5, G6.
- Covers: R1, R2, R3, R7, R8, R9, R12, R13, R15, R18, R21.
- Files: tests/acceptance/, evals/, memory/acceptance-criteria.md, docs/host-support.md.
- Work: Run the same scoped cases in both hosts. Include named commands, plain requests, strict review, parallel writes, scheduled reports, and cross-host resume. Record actual versions and model identities.
- Deliverable: A host-by-case report with pass, fail, skipped, and unsupported states.
- Verify: A30. Both handoff directions work. A capability claim is limited to the cases actually run.

### U30: Calibrate context and performance policy

- Phase: P7.
- Owner: Test specialist and memory integrity specialist.
- Depends on: U23, U28, U29.
- Covers: R4, R14, R17, R21.
- Files: evals/, scripts/measure.mjs, docs/context-policy.md (new), docs/host-support.md.
- Work: Compare no plugin, plugin without threshold checks, and plugin with trial thresholds. Use the same tasks and seeded relevant facts. Measure quality, latency, tokens, and unnecessary questions.
- Deliverable: Per-model results and a justified default or an explicit inconclusive result.
- Verify: A31. No 50% quality claim is published without evidence. Unknown usage and costs remain unknown.

### U31: Reconcile docs and prepare release

- Phase: P7.
- Owner: Lead.
- Depends on: U1, U2, U3, U4, U5, U6, U7, U8, U9, U10, U11, U12, U13, U14, U15, U16, U17, U18, U19, U20, U21, U22, U23, U24, U25, U26, U27, U28, U29, U30.
- Requires gates: G0, G1, G2, G3, G4, G5, G6.
- Covers: R1, R2, R21, R22.
- Files: README.md, CHANGELOG.md, docs/, memory/current-state.md, memory/next-actions.md, both host manifests.
- Work: Align advertised features with observed results. Publish version limits, fallback behavior, migration, and rollback. Resolve stale project notes. Prepare a release only within later release authority.
- Deliverable: A release candidate with a clear support matrix.
- Verify: A32. All required release checks pass. Every remaining gap is visible. No skipped case is described as verified.

## Verification

The companion file defines A01-A32.
Each case has a failure condition.
Tests of document shape are separate from tests of model behavior.

For this planning task, run only document checks:

    node scripts/plan-check.mjs docs/plans/2026-10-25-compound-memory-development-plan.md
    git diff --check

Also check local links, phase membership, and dependency cycles.
Read the plan against the user's scope.
Get an independent document review.
Do not start the future acceptance cases to validate a plan.

For implementation, use the existing repository checks at the required boundaries:

    node --test
    node scripts/memory-validate.mjs
    claude plugin validate . --strict

Inspect exit codes directly.
Add the new targeted tests named by each unit.
Keep live model runs separate from default tests.
Record skipped cases and their reasons.

The permission test must inspect actual tools, not only role instructions.
The parallel test must inspect the final combined result.
The memory test must seed incorrect claims, not only malformed files.
The context test must measure outcomes, not only a percentage crossing.

## Done when

- The agreed coverage works without another workflow skill library.
- Claude Code and Codex complete the shared required cases.
- A plain request reaches the right workflow without excess process.
- A plan has checked phase and task links.
- Workers cannot silently lose results or accept conflicting work.
- A blind critic receives a fixed target and no builder defence.
- Required proof matches the final code.
- Memory checks identify drift while preserving unknowns.
- Hooks and schedules do not form loops or silently change canonical memory.
- Missing context signals do not become invented percentages.
- A fresh session in the other host can continue from the saved handoff.
- Upgrade and disable tests preserve project work.
- Reported limits match the evidence.

## Risks and controls

| Risk | Control |
| --- | --- |
| Too much process for small work | Keep a single-agent path. Compare small tasks with and without the plugin. |
| More agents increase cost without improving results | Limit concurrent workers and context packets. Measure results before raising limits. |
| Host APIs change | Record tested versions. Test adapters. Keep manual fallbacks. |
| Read-only prose hides write-capable tools | Test actual grants and external tools. Use a restricted process where needed. |
| Memory edits race with an audit | Inspect a fixed snapshot. Reject stale findings before repair. |
| A scheduled job scans a changing checkout | Defer or use a stable copy. Never repair from that job. |
| Evidence disappears across machines | Carry a manifest. Bundle evidence explicitly or re-run checks. |
| Context checks add more context | Use bounded reports and event coalescing. Do not dump audit logs into the lead. |
| A broad skill set routes poorly | Test realistic plain requests and negative cases. Keep explicit commands. |
| New formats break old projects | Version formats. Preview migration. Keep rollback and old-format fixtures. |

## Open questions

- Answered: The original task was plan-only. The user later authorized all remaining development. Only isolated schedule fixtures ran. No production job was enabled.
- Answered: Both Claude Code and Codex are required targets.
- Answered: The memory integrity role is distinct from repair and from the existing deep audit evaluator.
- Assumed: The first practical target is local Windows use. Portable scripts and existing Linux checks remain required.
- Assumed: Start with up to three workers. Use a lower host limit when needed.
- Assumed: Use 60 minutes for an active-work probe and 24 hours for a changed-source integrity check during the trial.
- Assumed: A 50% measured context crossing is advisory during the trial.
- Deferred to U3: Exact minimum host versions and Codex plugin access to context usage. Require evidence before enabling dependent features.
- Answered in U24: Use an explicitly started local Node polling process for either CLI. It does not install an OS job.
- Answered in U30: The short matched trial was inconclusive. The user later chose 50% for passive saves. Usage unknowns stay unknown. Codex uses agent-led task boundaries until a measured feed is supported.
- Answered in U31: Prepare 2.1.0-rc.1 locally. Publication and persistent installation need later release/setup scope.

## Execution handoff

Phases 0 and 1 are complete. U1-U7 have the linked deliverables.
Phase 2 is complete. G2 passed for the named local CLI checks and explicit unsupported-surface limits.
Phase 3 is complete for the cases in its results. G3 passed within those limits.
U16-U31 are built as a local candidate. See the completion report for gate
results and unverified surfaces. No commit, push, persistent install,
production schedule, or public release was made.

For a later change or release:

1. Confirm this plan and the checkout revision.
2. Read the applicable repository rules.
3. Create the plan's run record.
4. Read the completion results and host matrix. Preserve the per-host tool, report, and runtime limits.
5. Use the dependency graph to select later work.
6. Preserve all user edits.
7. Stop at the approved scope boundary.

Do not treat this document as standing permission to run paid tests, alter global settings, schedule background work, or publish.
