---
id: 011
status: accepted
date: 2026-10-21
---

# Runs share one temporary result record, checked by code

## Context

The 2026-10-21 source audit found the engineering skills handing results to
each other in prose: a verify pass that ran before review's fixes still read
as proof afterwards, "CI green or each red check explained" let a red check
count as done, and a missing tool and a failed check looked the same. The
owner asked for one small shared result format, checked by helpers, that keeps
temporary run state apart from lasting memory and blocks a success claim on a
failed required check.

## Decision

A run that crosses skills or sessions keeps one record at
`.verify/evidence/<run-id>/record.json`, written and checked by
`scripts/run-record.mjs`: the task and scope, the code version (HEAD plus a
fingerprint of every uncommitted change), the environment, the required
checks, each check's result with its saved output and the code version it ran
on, and the open items and next action. `gate` exits 0 only when every
required check passed on the current code and environment with its output
still on disk. An optional check that could not run is recorded as unchecked
and does not block. The script never runs a command; the agent runs the check
and records its exit code.

## Why

Freshness is a fact code can decide (has the code changed since this check
ran?), and the audit's worst cross-stage failures were exactly that fact left
to the model. Keeping the record in the ignored .verify directory keeps run
state out of memory, which holds what stays true. A helper pre-approved in
`allowed-tools` that executed commands would be a shell grant, so recording is
separate from running.

## Alternatives considered

- Results in the PR body or the reply only: gone or unparseable for the next
  stage.
- Results in `memory/`: run state is temporary; memory would fill with it.
- A helper that runs each check itself: exact exit codes, but a pre-approved
  arbitrary-command runner.

## Consequences

Small one-sitting tasks keep no record (principles: scale the process). A
recorded exit code is the agent's word; the saved output and the recorded
command are what make it re-checkable.

## Evidence / implementation

`scripts/run-record.mjs`, `scripts/lib/changes.mjs`,
`references/artifacts.md` (Run record), `tests/handoffs.test.mjs`,
`tests/result-helpers.test.mjs`.

## Supersedes

None.
