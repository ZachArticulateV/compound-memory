---
id: 009
status: accepted
date: 2026-10-18
---

# The plugin ships engineering skills beside memory, and trusts the model to run them

## Context

The goal was one plugin that covers memory, planning, building, review,
verification, shipping, and learning on its own. Each skill had to work alone, together with the others,
and for different purposes, with a posture that trusts the model rather than
restricting it.

## Decision

The plugin keeps the name `project-memory` and ships twelve skills: the
existing `project-memory` skill (eight modes, unchanged in contract) and eleven
engineering skills (`plan`, `prototype`, `build`, `debug`, `review`, `verify`,
`ship`, `autopilot`, `learn`, `write`, `catch-up`). They compose through files,
not calls. `references/artifacts.md` at the plugin root is the one place that
names each artifact, its default path, its producer, and its readers.

The new skills state an outcome and a done check and leave the method to the
model. They carry no tool restrictions. Deterministic facts (finding quotes,
ticket graphs, lesson lookup, measurement noise) are bundled read-only scripts.

## Why

- Distinct trigger words (review, debug, prototype, verify) are separate
  skills so each fires on its own; related operations are modes of one skill so
  the always-loaded descriptions stay few.
- Composition through files means any skill runs without the others: a missing
  plan, memory tree, or verification skill changes what a skill reads, not
  whether it runs.
- Long prohibitions cost context and still leave guarantees in prose; short
  skills that rely on the model lose little. Checks that matter are code here,
  so the prose can stay short.

## Alternatives considered

- More modes on the one `project-memory` skill: one description cannot carry
  triggers for review, debugging, and memory without misfiring, and the memory
  skill's non-trigger clause exists to keep coding work out of it.
- Separate plugins per area: the goal was one plugin, and shared
  artifacts would cross plugin boundaries.
- Renaming the plugin: deferred here, then chosen in decision 010
  (`compound-memory`).

## Consequences

- Skills reference each other by literal relative path inside the plugin
  (decision 004 still holds: no `@`-imports).
- `memory/lessons/` and `memory/guardrails.md` join the memory schema, owned by
  `learn`. The validator gains a `lesson-format` check.
- Writes made by a skill the user invoked are part of that request, including
  the lesson `autopilot` captures. Memory's approval steps before writing
  (grill, repair, cleanup) are unchanged: those decisions are the user's.
- The same posture reaches `project-memory`: it infers its mode from a plain
  request instead of refusing to guess, and its standing rules are stated as
  outcomes. The accuracy rules themselves (observed verification only,
  hypotheses labelled, secrets by name) stay, because they are what makes
  memory worth reading.
- `tests/skills.test.mjs` pins the anatomy every skill shares.

## Evidence / implementation

`skills/*/SKILL.md`, `references/artifacts.md`, `references/principles.md`,
`scripts/lessons.mjs`, `scripts/findings-check.mjs`,
`scripts/tickets-check.mjs`, `scripts/measure.mjs`.

## Supersedes

None. Decision 005 stands: grilling stays a mode of `project-memory`.
