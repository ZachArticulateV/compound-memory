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
| Version 2 plan | `docs/plans/<slug>.plan.json` | `plan` through the lead | graph check, run manager, assigned workers |
| Version 2 run ledger | `.verify/runs/<run-id>/ledger.json` (not committed) | one current lead through checked writes | status views, workers, later sessions |
| Assignment | the run ledger's task entry | current lead | assigned worker |
| Worker submission | `.verify/runs/<run-id>/inbox/<result-id>.json` (not committed) | submit tool stores the worker result plus its receive receipt | current lead |
| Captured proof | `.verify/proofs/<proof-id>/` (not committed) | explicit capture process | run manager, lead, review |
| Frozen review packet | lead-owned work area with a new snapshot directory | lead through review-packet helper | fresh reviewer receives neutral prompt and targets only |
| Review snapshot manifest | lead-owned work area, outside reviewer context | lead through snapshot helper | lead checks original and copied bytes |
| Integrity bundle and report | lead-owned work area; selected copy contains captured checks | lead prepares; integrity reviewer reports | lead verifies findings and any permitted repair |
| Worker copy and base manifest | external temp copy; `.verify/workspaces/` manifest | explicit dispatcher | worker and lead integration checks |
| Portable handoff | explicit bundle path selected by the lead | sealed run export | destination preview and import |
| Integrity queue and coverage | `.verify/integrity/` | enabled cheap signals and one lead consumer | lead, status, memory writer |
| Context checkpoint | `.verify/integrity/checkpoints/` | optional bounded context policy | next lead and handoff |
| Passive save request and receipt | `.verify/integrity/continuity.json` | local context signal or lead boundary | current lead; saved receipt is not proof of prose truth |
| Prepared continuity save | `.verify/integrity/continuity-proposals/` | current lead through prepare | checked memory writer, then continuing session |
| Schedule config and report | `.verify/schedules/` | explicit local polling runner | lead, pause/remove controls |
| Memory update proposal | caller-selected local proposal | lead inspection | one authorized compare-and-swap writer |
| Migration backup and receipt | `.verify/migrations/` | explicit migration apply | rollback and later setup |
| Learning proposal | reply or caller-selected file | evidence policy after lesson lookup | authorized project or user-scope writer |

Version 2 rules and ownership are defined in [work-contracts.md](work-contracts.md).
The plan JSON owns static task fields. The ledger owns progress.
The legacy plan, ticket, and receipt formats below remain available.
Do not use both legacy ticket status and a version 2 ledger as editable progress sources for one run.

## Run record

The legacy shared receipt format. A run that hands work to another stage, or may
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

An `add` result is reported by its caller. It does not prove process execution.
A version 1 entry without a basis field also means reported.
The separate proof capture command records actual execution.
`run-record add-proof` links that proof without running its command.
`run-record gate --require-captured` rejects reported-only checks.
It checks the saved proof structure and freshness. It does not authenticate the process that wrote it.
A lead model with file-write access can also fabricate a full proof file.
The host's observed capture invocation is the execution evidence.
See [shared proof rules](work-contracts.md#reported-and-captured-proof).

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

A legacy plan carries no status field and no checkboxes. Its progress lives in Git and
legacy tickets. Version 2 progress lives only in the run ledger.
`scripts/plan-check.mjs <plan>` checks the links: every
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

Specialist work uses the role contracts in `agents.md`. A Phase 3 frozen review
packet is separate from the version 2 task assignment. Its actual sent prompt,
private source mapping, snapshot manifest, and report stay in the lead's work
area. The critic receives only the neutral prompt and fixed targets.
The memory integrity bundle carries selected claims and captured checks.
Its report uses `schemas/integrity-report.schema.json`. When a version 2 task
assignment exists, encode that report as a JSON finding in the shared result.
Neither review format is task acceptance or a second writable run ledger.

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
