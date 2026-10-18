# Artifacts

The files the skills in this plugin hand to each other. Each artifact has one
producer and any number of readers. A skill reads an artifact when it exists
and works without it when it does not.

The paths are defaults. When the project already keeps the same thing
somewhere else (an issue tracker for tickets, `.agents/skills/` for project
skills, `docs/adr/` for decisions), use the project's location and say so in the
artifact you write.

| Artifact | Default path | Producer | Readers |
| --- | --- | --- | --- |
| Memory tree | `memory/` | `project-memory` | every skill, at the start of substantial work |
| Plan | `docs/plans/YYYY-MM-DD-<slug>.md` | `plan` | `build`, `review`, `autopilot`, `verify` |
| Tickets | `docs/plans/<slug>/tickets/NN-<slug>.md` | `plan tickets` | `build`, `autopilot`, `project-memory sync` |
| Prototype | branch `prototype/<slug>` | `prototype` | `plan`, `build` |
| Verification skill | `.claude/skills/verify-<app>/` | `verify create` | `verify run`, `build`, `review`, `autopilot` |
| Evidence | `.verify/evidence/<run-id>/` (not committed) | `verify run` | `review`, `ship pr`, `catch-up` |
| Review report | the reply, plus `review-findings.json` when gated | `review` | `build`, `ship feedback`, `autopilot` |
| Lessons | `memory/lessons/<slug>.md` | `learn capture` | `plan`, `debug`, `review`, `build` |
| Guardrails table | `memory/guardrails.md` | `learn correct` | `review`, `learn retro` |
| Writing standard | `skills/write/references/` | `write` | every skill that writes prose |

## Plan

One file grows from requirements to an implementation-ready plan. `plan
brainstorm` writes the first sections; `plan` fills the rest in place. Stable
IDs let later work cite the plan without copying it.

```markdown
# <Title>

## Goal
## Requirements        R1, R2, ... (behavior, user's words)
## Out of scope
## Decisions           D1, D2, ... (choice, reason, who settled it)
## Units               U1, U2, ... each with Goal, Files, Approach, Verify, Covers (R ids)
## Verification        the commands that prove the whole plan
## Done when
## Open questions
```

A plan carries no status field and no checkboxes. Progress lives in Git and in
the tickets.

## Tickets

One file per ticket, numbered in dependency order.

```markdown
# NN: <Title>

**What to build:** the end-to-end behavior, from the user's side.
**Blocked by:** 01, 03 (or "None")
**Touches:** `app/jobs/`, `lib/queue.ts`
**Verify with:** `npm test -- jobs` (a command, or a `verify` feature)
**Status:** ready | in-progress | done

- [ ] Acceptance criterion
```

`scripts/tickets-check.mjs` reads these lines. It reports the frontier, the
waves that can run in parallel, cycles, unknown blockers, and frontier tickets
that touch the same paths.

## Lessons

One lesson per file. The frontmatter is flat YAML with lists in brackets, so
the validator and `scripts/lessons.mjs` read every file the same way.

```markdown
---
title: Retried jobs must be idempotent
tags: [jobs, retries, idempotency]
applies_when: Changing a background job that the queue can retry
paths: [app/jobs/, lib/queue.ts]
status: active
created: 2026-10-18
retire_when: The queue guarantees exactly-once delivery
---

# Retried jobs must be idempotent

## What happened
## Why
## Do this
## Evidence
```

`status` is `active`, `stale`, or `retired`. Lookup skips `stale` and `retired`
lessons unless asked for them.

## Guardrails table

`memory/guardrails.md` pairs each rule an agent was corrected on with what
enforces it.

```markdown
| Rule | Enforced by | Evidence |
| --- | --- | --- |
| Jobs are idempotent | `test/jobs/retry.test.ts` | fails on 3f2a1c9 (the double charge) |
| Prefer the design system's Button | judgment, in review | corrected twice, 2026-10 |
```

A rule whose enforcer says "judgment" is a candidate for a check the next time
it is broken.

## Findings file

`review` writes findings as JSON when it gates them through
`scripts/findings-check.mjs`:

```json
{ "findings": [
  { "lens": "correctness", "severity": "P1", "confidence": 75,
    "file": "lib/queue.ts", "line": 42, "quote": "retry(job)",
    "title": "Retry runs a non-idempotent job twice", "model": "claude" }
] }
```
