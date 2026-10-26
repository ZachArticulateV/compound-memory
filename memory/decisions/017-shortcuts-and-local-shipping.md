---
id: 017
status: accepted
date: 2026-10-26
---

# Keep explicit shortcuts and allow finished local work

## Context

The [Claude branch](https://github.com/ZachArticulateV/compound-memory/tree/claude/ecstatic-archimedes-gtg5hf) gained commit `9a255b5`
after its pull request merged. The later development work added shortcuts
separately, but omitted parts of that commit. The user requested a full branch
check and recovery of missing changes without replacing newer work.

## Decision

Keep twelve core skills and five explicit shortcuts: handoff, sync, grill,
cleanup, and repair. Each shortcut reads its existing memory playbook.
Keep current script grants, template paths, task scope, and host routing.
Do not restore blanket grants or claim zero context use in every host.

Skill descriptions use at most two sentences and 300 characters. Manifest
descriptions use at most two sentences and count core skills and shortcuts
separately. Scope and routing rules must survive shorter wording.

Ship and autopilot can finish at reviewed, verified local Git commits.
GitHub PR, CI, and feedback steps apply when publishing is in scope and the
host is available. An existing remote alone does not authorize publishing.
If publishing was requested but is blocked, report it as blocked.
Preserve the existing meaning of a plain "ship it" or explicit end-to-end
request: commits plus a PR when GitHub is configured, local commits otherwise.
Explicit local-only scope wins. An explicit push, PR, or publish request needs
that step or a blocked report even when no remote exists.

## Why

The user needs short commands, clear task selection, and local development
without a hosted account. Branch recovery must keep newer controls and proof.

## Alternatives considered

- Merge the old branch unchanged: it would conflict with newer routes and
  reuse decision id 012, already assigned to shared work contracts.
- Leave the branch alone: the local completion rules would remain missing.

## Consequences

The earlier branch's shortcut decision is recorded here under id 017.
Decision 012 and all newer phase records remain intact. The branch audit
records each branch and each file from the missing commit. Shipping across
sessions now requires that inventory before an all-work-shipped claim.

## Evidence / implementation

See [the branch audit](../../docs/plans/2026-10-26-claude-branch-reconciliation.md),
`skills/ship/`, `skills/autopilot/`, `tests/skills.test.mjs`, and
`tests/manifest.test.mjs`.

## Supersedes

None. The shortcuts preserve the memory modes and the current host controls.
