# Shared work rules, version 2

Use these rules when work needs a durable plan and task state.
A small change can still use a short plan in the reply.
These files do not choose a model or force a method.

## One source for each fact

| Record | Source of truth | Writer | Readers |
| --- | --- | --- | --- |
| Project brief and project rules | Existing project memory and rule files | Lead within user scope | All workers |
| Plan scope and acceptance checks | Version 2 plan JSON | Plan author, normally the lead | Plan checker, run manager, workers |
| Decision and decision owner | Plan decisions | Lead records who made the choice | All workers |
| Task progress, attempts, and lead ownership | Run ledger | One current lead through revision-checked writes | Status views, workers, later sessions |
| Assignment | Run ledger task entry | Lead when it claims a task | Assigned worker |
| Worker result | Result payload in one immutable inbox submission | Worker supplies payload; submit tool adds receipt | Lead |
| Command observation | Captured proof file and output | Separate capture process | Lead, result checks, reviews |
| Lasting project fact | Its existing memory owner | Lead after checking evidence | Later sessions |
| Personal preference | User-owned profile outside this run | Only within explicit user authority | Applicable agents |

Do not put task status in the version 2 plan or in another ticket file.
A status display reads the ledger.
A summary can record what was observed at a named revision.
It does not become a second writable state store.

## Plan hierarchy

The hierarchy is project, feature plan, phase, task, assignment, result, and proof.
Memory links to the current plan and run.
The JSON plan is the machine-readable scope source.
Long research or design notes can live beside it and link to stable IDs.
Do not maintain a second editable copy of its task fields in Markdown.

Each plan has schemaVersion 2 and kind plan.
Its planId stays fixed. Its revision increases when scope or checks change.
Requirements, decisions, phases, tasks, gates, and checks keep their IDs.
Never reuse an ID for a different meaning.

The plan owns requirements, decisions and their owner, exclusions, risks,
phase titles, task scopes, resource names, and required checks.
A task names its phase, covered requirements, dependencies, required gates,
allowed paths, shared resources, and required checks.
Checks describe the observation needed. They are not executable permission grants.
The common result schema defines the result shape for every task.

A phase groups work. Its number does not make an execution barrier.
Named dependencies and required gates determine order.
A gate names its phase, task or gate prerequisites, and required proof checks.
Final checks apply to the combined result.

See [the plan schema](../schemas/plan.schema.json),
[small example](../examples/contracts/small.plan.json), and
[phase example](../examples/contracts/phases.plan.json).

## Ready work and resource claims

Validate the whole graph before offering any ready task.
Unknown IDs, cycles, invalid paths, and missing checks stop dispatch.
Do not turn an unknown blocker into a completed blocker.

Paths are literal repository-relative file or directory prefixes.
Use a dot for the whole repository.
Do not use absolute paths, parent traversal, or glob patterns.
Shared resources name things such as a port, database, or generated output.
Path comparison is conservative across case differences.
Two paths conflict if one contains the other.
Two tasks also conflict when they name the same shared resource.

Conflicting valid tasks wait in plan order.
An active assignment keeps its claims until the lead closes it.
A lease expiry alone does not free a resource.
Independent tasks may run together after their named prerequisites pass.
Phase 1 supplies state and checks. It does not launch workers.

## Run and assignment

A run stores the validated plan snapshot and its fingerprint.
It refuses a changed plan ID, revision, or body.
For now, changed scope needs a new run.
Phase 1 does not migrate accepted work to a new plan revision.
Later migration work must name what remains valid and what needs new proof.

The lead has an ID, an increasing owner version, and an expiry time.
Each write carries that identity and the expected ledger revision.
A stale revision is a conflict. Read the ledger again before retrying.
Do not overwrite a newer file from an old in-memory copy.
The same lead can renew an expired lease if its exact owner version and ledger revision still match.
A successor changes those values, so the old lead cannot renew through it.
This allows local recovery without a forced takeover or an abandoned worker claim.

Assignments name the run, plan revision, task, attempt, worker, role,
workspace, code fingerprint, lease, time limit, and output limit.
A worker gets that packet and only the source files it needs.
The host still controls its actual tool access.
These limits in a record do not themselves restrict a process.

Task states are planned, ready, claimed, running, blocked, failed,
awaiting-review, accepted, and cancelled.
Only the allowed transition path can change state.
Only lead acceptance can mark a task accepted.
Integration state is separate from task state.
Passing all worker checks does not prove the combined result.

## Write and recovery rules

The ledger uses an exclusive local lock and an atomic file replacement.
Temporary files do not become authoritative before replacement succeeds.
The result inbox uses one immutable file per result ID.
That file contains the result and a submission receipt in one atomic write.
The submit tool records the receive time and the lease limits in that receipt.
The worker supplies no receipt time. The public CLI rejects a supplied clock.
The same result can be submitted again without creating a second result.
The same ID with different contents is rejected.
Separate workers can submit separate results without editing the ledger.

Never break a lock based only on age.
An old lock may belong to a slow live writer.
If a process died, first establish that it stopped.
Preserve the ledger and orphan temporary files for inspection.
Only the valid ledger file is current state.
Lock removal is a host recovery action, not an automatic timeout side effect.

A retry needs recorded evidence that the old assignment stopped.
It gets a new attempt and assignment ID.
Old results cannot satisfy that assignment.
Reopen a stale accepted task with a reason after dependent workers are reconciled.
Keep its prior result in history. Require fresh checks for affected dependents.
Rechecking does not require rebuilding unchanged code.
The attempt number always increases, so old results stay old.
The separate per-work attempt budget resets only when stale accepted work is reopened.
An ordinary failed retry cannot reset that budget.
Owner transfer also needs evidence that the old lead stopped.
An owner string or an evidence note is not proof of process death.
The lead must check host liveness before it supplies that record.

This is coordination on one local state store.
It cannot fence disconnected clones or a person who edits the ledger by hand.
It does not supply user authentication or an operating-system access boundary.
Cross-machine resume remains later work.

## Results and acceptance

A result names its exact assignment context.
It reports actual changed paths, proof paths, blockers, findings, and a summary.
Worker-completed is a report. It is not lead-accepted.

The lead checks current assignment identity, path scope, required checks,
proof freshness, and unresolved blockers before acceptance.
It can review a timely submission after the worker lease ends.
The saved receipt must show that the result arrived within both leases.
The assignment and owner must still match. Reassignment or transfer rejects the old result.
Proof from a different attempt, owner, task, or plan revision cannot count.
Unknown, missing, failed, or stale required proof blocks acceptance.
The host or lead must inspect the actual diff as well.
A worker's changedPaths list does not prove there were no other writes.

Gate and final checks also need captured proof on the current input scope.
Inspect current freshness before using a prior accepted state.
A source change can make a past accepted result unusable for current readiness.
Do not erase the historical result. Report the need for new proof.

## Reported and captured proof

Legacy run-record add stores a reported result.
The caller supplies its exit code.
It can be a useful receipt, but it is not direct proof that a process ran.
An old record with no basis field also means reported.

The separate capture command starts a process without a shell.
It records the command and arguments, working directory, actual exit or signal,
bounded output, start and end file fingerprints, and environment basis.
It saves hashes of the output beside the proof file.
A failed start or failed capture is distinct from a failing test.
A changed source makes the proof stale.
Missing or changed output cannot count as a pass.
Timeout limits the direct child. It is not a process-tree stop service.
On Windows, use an executable or an explicit host-authorized interpreter.
The capture tool does not silently turn a command file into a shell grant.

Observed environment facts include Node, platform, and architecture.
Caller-named environment values are declarations, not measurements.
Do not record secrets in them.
Ignored config or external services need explicit input values and a suitable check.
A local source fingerprint alone cannot prove their state.
Whole-repository capture follows the existing Git fingerprint and omits ignored files.
An explicit path scope is rejected if it includes ignored inputs.
This prevents an ignored-only scope from producing a false source match.

The new state manager accepts captured proof for required checks.
The legacy receipt gate stays compatible by default.
Use its require-captured mode for a stronger gate.
Linking a captured proof does not run a command.

The proof files are local, tamper-evident records.
They are not signed attestations against a hostile writer who can replace all files.
That writer could be the lead model itself if it has file-write access.
The gate cannot prove who created a valid-looking proof file.
Use the host's observed capture call as the origin evidence.
Inspect their origin and scope before trusting an imported bundle.

## Claude and Codex boundary

The shared JSON files have no Claude-only variable or model name.
Both hosts use the same checker and state files.
Use absolute plugin script paths when the host does not substitute skill variables.
Keep shell paths quoted on Windows.

Do not add the capture command to a broad pre-approved helper pattern.
The new ledger command also stays separate from wildcard-granted helpers.
Do not add claim, accept, retry, or owner-transfer actions to run-record.mjs.
The existing run-record helper never executes the command stored in a receipt.
The host must authorize each capture invocation within the user's task scope.
A field named approved or a flag passed by a model is not host authority.

A file-only Claude reviewer cannot run these scripts.
The lead runs them and gives the reviewer their outputs and a fixed source copy.
Claude plugin-agent permission fields do not replace actual tool checks.
Codex filesystem read-only mode does not remove external action tools by itself.
See [host support](../docs/host-support.md) for current tested limits.

## Legacy use

Unversioned Markdown plans and existing ticket files remain version 1 inputs.
They keep their existing paths and legacy ticket status fields.
They do not acquire the version 2 ownership and proof rules by implication.
The checker rejects unsupported explicit versions.
Choose one mode for a run. Do not combine editable legacy ticket status with a version 2 ledger.

No automatic migration runs when a skill loads.
Keep the old files intact until a later migration task checks the transfer.
