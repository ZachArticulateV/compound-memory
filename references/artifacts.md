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
| Tickets | `docs/plans/<slug>/tickets/NN-<slug>.md` | `plan tickets` | `build`, `autopilot`, `catch-up` |
| Prototype | branch `prototype/<slug>` | `prototype` | `plan`, `build` |
| Verification skill | `.claude/skills/verify-<app>/` | `verify create` | `verify run`, `build`, `review`, `autopilot` |
| Run record | `.verify/evidence/<run-id>/record.json` (not committed) | the skill that starts the run (`build`, `verify`, `review`, `autopilot`) | every later stage of that run, `ship pr`, `catch-up` |
| Evidence | `.verify/evidence/<run-id>/` (not committed) | `verify run` | `review`, `ship pr`, `catch-up` |
| Review report | the reply, plus `.verify/review-findings.json` | `review` | `build`, `ship pr`, `autopilot` |
| Lessons | `memory/lessons/<slug>.md` | `learn capture` | `plan`, `debug`, `review`, `build` |
| Guardrails table | `memory/guardrails.md` | `learn correct` | `review`, `learn correct` |
| Writing standard | `skills/write/references/` | `write` | every skill that writes prose |

## Run record

The one shared result format. A run that hands work to another stage, or may
be resumed in another session, keeps one record; a small task finished and
reported in one sitting does not need one. `scripts/run-record.mjs` writes and
checks it:

```bash
node "<plugin>/scripts/run-record.mjs" start --task "<what>" --require tests,verify
<run the check> > .verify/evidence/<run-id>/tests.log 2>&1; echo "exit $?"
node "<plugin>/scripts/run-record.mjs" add --run <run-id> --check tests --exit <code> --output .verify/evidence/<run-id>/tests.log --command "npm test"
node "<plugin>/scripts/run-record.mjs" add --run <run-id> --check browser --status unchecked --reason "Playwright not installed" --optional
node "<plugin>/scripts/run-record.mjs" note --run <run-id> --open "P2 finding not applied" --next "re-run verify"
node "<plugin>/scripts/run-record.mjs" gate --run <run-id>
```

It holds the task and scope, the code version at the start (HEAD plus a
fingerprint of every uncommitted change), the environment, the required
checks, each check's command, result, saved output, and the code version it
ran on, and the open items and next action. `gate` exits 0 only when every
required check passed on the code and environment as they are now with its
output still on disk; a later edit makes a passed check stale. An optional
check that could not run is listed as unchecked and does not block. A failed
required check blocks any success claim, and three failures of one check mean
stop and report. A check named in `--require` stays required however it is
recorded, and an optional check that ran and failed blocks like any other.
`gate` takes an explicit `--run <id>` (or `--run latest` on purpose), and a
stage inside a larger run records into that run instead of starting its own.
The fingerprint covers tracked and new files; files Git ignores (`.env`) are
not in it, so name what matters there in `--env`. Lasting facts from a run go
to memory through their owners; the record itself stays in `.verify/`.

## Plan

One file grows from requirements to an implementation-ready plan. `plan
brainstorm` writes the first sections; `plan` fills the rest in place. Stable
IDs let later work cite the plan without copying it.

```markdown
# <Title>

## Goal
## Terms               only the words a reader could take two ways
## Requirements        R1, R2, ... (behavior, user's words)
## Out of scope
## Decisions           D1, D2, ... (choice, reason, who settled it)
## Units               U1, U2, ... each with Goal, Files, Approach, Verify, Covers (R ids), and Depends on (U ids) when order matters
## Verification        the commands that prove the whole plan
## Done when
## Open questions
```

A plan carries no status field and no checkboxes. Progress lives in Git and in
the tickets. `scripts/plan-check.mjs <plan>` checks the links: every
requirement covered by a unit, every unit with a Verify, every `Depends on` a
unit that exists, Out of scope present, open questions marked answered,
deferred, or assumed.

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
waves that can run in parallel, cycles, unknown blockers, duplicate numbers,
and frontier tickets that touch the same paths. Only numbers in list position
on the `Blocked by` line count; notes in parentheses are ignored.

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
updated: 2026-10-18
retire_when: The queue guarantees exactly-once delivery
---

# Retried jobs must be idempotent

## What happened
## Why
## Do this
## Evidence
```

`status` is `active`, `stale`, or `retired`. Lookup skips `stale` and `retired`
lessons unless asked for them. `paths`, `updated`, and `retire_when` are
optional; the rest are required. `scripts/lessons.mjs` takes changed paths as
`--paths a,b` or as bare arguments.

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

`review` writes findings as JSON to `.verify/review-findings.json` and gates
them through `scripts/findings-check.mjs`:

```json
{ "findings": [
  { "lens": "correctness", "severity": "P1", "confidence": 75,
    "file": "lib/queue.ts", "line": 42, "quote": "retry(job)",
    "title": "Retry runs a non-idempotent job twice", "model": "claude",
    "verdict": "confirmed" }
] }
```

A kept finding whose quote is not in the file is marked `unproved`, whatever
its severity. `verdict` (confirmed, disproved, or unresolved) is added by the
attempt to disprove each P0 and P1; `findings-check.mjs --final` exits 1
while one is missing, and lists the findings safe to fix. `model` is a label
the reviewer writes, not a proof of which model ran.
