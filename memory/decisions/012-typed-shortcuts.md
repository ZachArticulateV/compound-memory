---
id: 012
status: accepted
date: 2026-10-25
---

# The memory modes typed most get their own shortcuts

## Context

Every memory operation was a mode word after `/project-memory`, so a handoff
was `/project-memory handoff`. The mode words kept the always-loaded skill
list short, but users had to remember which of twelve skills held which of 36
modes, and typed the longest commands for the most frequent operations.

## Decision

`grill`, `handoff`, `sync`, `cleanup`, and `repair` each get a skill directory
of their own that runs that one mode: `/handoff`, `/sync`, and so on. Each is
user-invoked in both hosts, so it adds nothing to the model's context. The
instructions stay in `skills/project-memory/`; a shortcut only points at the
router and the one playbook. Every skill description is two sentences at most.

## Why

- The operations a user types every day deserve the shortest command.
- User-invoked skills cost no context, which was the reason for the mode words.
- One copy of each playbook means a shortcut cannot drift from its mode.

## Alternatives considered

- Shortcuts for all 36 modes: the slash menu would bury the useful ones.
- Splitting `project-memory` into eight skills: eight model-invoked
  descriptions, and the shared probe, standing rules, and validation step
  copied eight times.

## Consequences

- `/project-memory <mode>` still works, and `status`, `init`, and `audit` stay
  there.
- `tests/skills.test.mjs` pins each shortcut as user-invoked, pointing at a
  mode the router routes, with the router's script pre-approvals; the manifest
  test counts skills and shortcuts apart.

## Evidence / implementation

`skills/grill/`, `skills/handoff/`, `skills/sync/`, `skills/cleanup/`,
`skills/repair/`, `tests/skills.test.mjs`, `tests/manifest.test.mjs`.

## Supersedes

None. Decision 005 stands: `grill` is still reached only when the user types it.
