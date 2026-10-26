# Use the release candidate

Version: 2.1.0-rc.1. This is a local release candidate, not a published release.
Start with a plain request in Claude Code or Codex. Select the installed
Compound Memory skill when another library has the same name. Small edits do
not require a plan or a team. See [task selection](../references/task-routing.md).

## Plans and workers

For larger work, use the version 2 plan and run contracts in
[shared work rules](../references/work-contracts.md). The lead owns the run.
Workers receive only their task, file scope, resources, and checks.

The lead can use `scripts/agents/dispatch.mjs --request <json-file>` within the
user's build scope. The request includes `root`, the `plan` object, `runId`,
`ownerId`, `ownerVersion`, `host` (`claude` or `codex-cli`), an absolute native
`binary` or JavaScript CLI entry, `maxWorkers`, and `checkCommands`. Start with
two workers. The hard maximum is three. The request is an execution action;
it is not a pre-approved read-only helper.

Each worker gets an external copy of the current project files. The lead keeps
the base manifest under `.verify/workspaces/`. Private files, dependency trees,
Git data, and runtime output are excluded. A task that needs excluded input
must name that missing dependency; the worker does not silently copy it.
Worker changes outside ownership fail review. Source conflicts preserve the
worker copy for recovery. No worker stages or commits source work.

The lead inspects the actual diff, calls `acceptWorkerResult` with current
checks, and then calls `verifyIntegration` with a fixed current-tree review.
Required proof must match the combined result. A worker pass alone is not
completion. Failed or cancelled workers need confirmed stop evidence before
retry. A sequential callback is available when a host cannot launch children;
it does not count as native host proof.

## Handoffs

For an automatic save while the session stays open, use the
[passive continuity recipe](../references/continuity.md). It refreshes memory
and documentation links through the current lead. The local Claude bridge
queues it at 50% measured usage. Codex uses agent-led task boundaries.
The transfer commands below are for moving ownership to another session.

`scripts/handoff.mjs --help` gives the exact export, preview, and import inputs.
Export includes the run ledger and result records. Include each unfinished
file explicitly with `workPaths`. For changes that exist only in a worker copy,
include its checked `workspaceManifests` entry. Large proof files are optional.

The lead must stop its workers before export. Export fences the source owner.
Preview the bundle in the destination before import. Import rejects conflicting
work and a different plan. It restores selected bytes without staging them.
The original staged bytes remain in the bundle for inspection. Repeated import
of the same bundle does not repeat work. Missing or foreign-checkout proof stays
stale; the new lead reopens and checks affected accepted tasks.

Disconnected copies cannot prove that another machine stopped. Host stop
evidence and explicit ownership transfer remain required. A copied JSON file
is not a distributed lock.

## Active-session memory checks

The queue is off by default. Within explicit setup scope:

```text
node scripts/integrity-due.mjs enable <project-root>
node scripts/integrity-due.mjs status <project-root>
node scripts/integrity-due.mjs disable <project-root>
```

Claude hooks only mark due work. They do not launch a model or repair memory.
Codex hooks remain disabled. A Codex lead can mark and consume work at a task
boundary. A consume request names the host, branch, target, selected files,
claims, sources, and time limit. Use the same claim shape as the integrity role.
The lead consumes through the native read-only inspection adapter. Reports and
source coverage live under `.verify/integrity/`.

This local coverage is not canonical memory. A fresh checkout without that
store starts with unknown coverage. Before a handoff, save the needed bounded
facts and next step in the durable handoff or run note. Do not leave the only
copy of a needed fact in an ignored checkpoint or an absolute temp-file link.

A changed source marks its claims for review. Age alone does not make a claim
false. Unknown claims stay unknown. The lead checks meaning before accepting
a repair. `proposeMemoryUpdate` saves no canonical memory. `applyMemoryUpdate`
requires authorization and unchanged base hashes. One writer applies each
proposal once. Competing updates fail instead of overwriting newer facts.

## Optional timed reports

The supported local path is the Node polling process for either CLI. It runs
only while that process is open. It does not register an OS service or app job.
A restart makes at most one catch-up attempt. A report never repairs memory.

Create a configuration file with `id`, `host` (`claude` or `codex`), relative
`paths`, `claims`, `intervalMs`, `timeoutMs`, and `maxOutputBytes`. Each claim
contains `id`, `artifact`, `claim`, and `sources`. Select at most 80 files and
20 claims. The minimum interval is 60 seconds; use a longer interval for real
work. Start with one day. Then, within the user's schedule scope:

```text
node scripts/scheduling/local.mjs configure <project-root> <config.json>
node scripts/scheduling/local.mjs enable <project-root> <id>
node scripts/scheduling/local.mjs serve <project-root> <id>
node scripts/scheduling/local.mjs pause <project-root> <id>
node scripts/scheduling/local.mjs remove <project-root> <id>
```

Configuration starts paused. `tick` performs one due attempt. Reports are scoped
to a frozen copy and must still match their sources. A failed or partial run
does not claim project health. Missing credentials are a failed run, not a
clean audit. Pause affects future work; an active read-only check can finish.
The runner blocks retries when a stopped process cannot be confirmed.

## Upgrade, rollback, disable, and removal

Read `scripts/migrate.mjs --help`. Preview writes nothing. Save its `plan`
object, then apply that exact plan. Apply checks current bytes and saves backups
before writes. Rollback uses the saved receipt and refuses to erase later edits.
Legacy memory stays readable. No content migration is required for ordinary
Markdown memory; new versioned state is opt-in.

Disable stops plugin-owned local signals, pauses its jobs, and restores its
owned status-line field. Remove also removes inactive owned job definitions.
Neither operation deletes memory, user rules, reports, or unrelated settings.
Native host plugin install and uninstall remain separate host actions.

A changed user status line stays unchanged during disable. Active or fenced
jobs are paused and retained for inspection. Their ongoing process must stop
before its files can be removed. A metadata-lock conflict fails closed instead
of overwriting a concurrent result.

## Checks and limits

Run `node --test` for deterministic checks. Real model tests are separate:
set `COMPOUND_MEMORY_LIVE_V2=1` and run
`node --test tests/acceptance/live-v2.test.mjs`. These calls use the local signed-in
CLIs and may incur cost. Missing required tools fail an enabled trial.

Read [host support](host-support.md), [context policy](context-policy.md), and
[the completion report](plans/2026-10-26-completion-results.md) before making a
support claim. Local Windows CLI evidence does not certify desktop or cloud
behavior. Optional browser, service, and platform tools remain separate needs.
