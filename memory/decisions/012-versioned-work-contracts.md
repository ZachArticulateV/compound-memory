---
id: 012
status: accepted
date: 2026-10-25
---

# Version 2 separates scope, task state, results, and proof

## Context

The Phase 0 review found missing graph and ownership checks.
The existing receipt helper records exit codes reported by the caller.
It must not gain arbitrary command execution through an existing tool grant.

## Decision

Add an opt-in version 2 plan and run path.
The user authorized Phase 1 implementation of the shared rules.
The implementation keeps one file owner for each kind of fact.

- The plan owns scope and required checks.
- The run ledger owns progress, assignments, attempts, and lead ownership.
- A worker owns its immutable result file.
- A separate capture command records command observations.
- Memory records lasting facts and points to the source files.

Keep ledger writes in scripts/run-state.mjs.
Keep process execution in scripts/verify/capture.mjs.
Neither command is added to an existing wildcard skill grant.
The old run-record helper can link and check proof. It never runs its command.

## Why

One lead can accept results without competing writes from workers.
Revision checks reject old state updates.
Captured output can be checked against current files.
Reported exit codes remain useful but cannot become captured observations by a helper flag.

These local records coordinate trusted tools.
They do not authenticate a writer who can change all the files.
The host's observed capture call remains the source for execution origin.

## Consequences

Legacy Markdown plans, tickets, and version 1 receipts remain available.
Version 2 tasks do not duplicate their status into ticket files.
Plan revision changes currently need a new run.
Cross-host migration, worker launch, hooks, and schedules stay in later phases.
Method and model choice remain flexible.

## Evidence / implementation

references/work-contracts.md, schemas/, examples/contracts/,
scripts/lib/plan-contract.mjs, scripts/run-state.mjs, scripts/lib/run-state.mjs,
scripts/verify/capture.mjs, scripts/lib/proof.mjs, and their focused tests.
The Phase 1 report records test and review results.

## Supersedes

Extends decision 011 for opt-in version 2 work.
It preserves the legacy receipt path and its limit on command execution.
