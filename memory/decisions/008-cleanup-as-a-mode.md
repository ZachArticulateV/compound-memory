---
id: 008
status: accepted
date: 2026-10-17
---

# Cleanup is an eighth mode, separate from audit

## Context

Memory goes bad in ways `audit` was not built to see: two files that disagree
with each other, a finished task still on the punch list, a handoff for a
branch that merged, a snapshot file growing into a diary. `audit` checks claims
against the repository through an independent evaluator; it does not compare
memory files with each other, and its evaluator cannot write.

## Decision

`cleanup` is an eighth mode of `/project-memory`. It reads the whole tree,
makes three passes (contradictions inside memory, inaccuracies against the
checkout, rot), presents a plan, and applies only what the user accepts. Its
mechanical half is a separate read-only script, `scripts/memory-hygiene.mjs`.

## Why

As a mode it shares the router, the state probe, the validator, the finding
taxonomy, and the ownership table, as `grill` does (decision 005), and every
memory write stays a command the user issued. The rot shapes that code can find
are found by code, keeping deterministic facts under `scripts/`.

## Alternatives considered

- Extending `audit`: the auditor must not write and must not share the
  writer's context, and cleanup needs to do both.
- A separate model-invoked skill: would fire on casual use of "clean up" and
  could not share the references without cross-skill links.
- New validator checks: the validator runs on every memory edit through the
  hook, and rot candidates that need judgement would turn it into noise.

## Consequences

"Seven modes" became "eight" across docs, manifests, and tests. The ownership
table moved from `skills/project-memory/references/repair.md` into
`skills/project-memory/references/memory-schema.md`, because `repair`,
`handoff`, and `cleanup` all route by it. Cleanup's accuracy pass is not
independent, and the playbook says so.

## Evidence / implementation

`skills/project-memory/references/cleanup.md`, `scripts/memory-hygiene.mjs`,
`tests/cleanup.test.mjs`, `tests/memory-hygiene.test.mjs`.

## Supersedes

None.
