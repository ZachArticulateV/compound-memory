# Acceptance Criteria

What "done" means for this project's features, and what evidence supports each
claim. This file exists so a partially functional project is not read as
finished because the files exist.

Status values: `unverified`, `verified`, `failing`, `not-applicable`.

A criterion moves to `verified` only with cited evidence — a test that ran, a
behavior observed, an artifact checked. Existence of code is not evidence.

Updated: 2026-10-18

## Structural core

The probe, validator, and hooks behave as `docs/architecture.md` describes.

| Criterion | Status | Evidence |
| --- | --- | --- |
| Validator checks match the documented list | verified | `tests/doc-drift.test.mjs`, 459 passed on 2026-09-29 |
| Hooks fire for every governed contract file | verified | `tests/hooks.test.mjs`, same run |
| A memory tree rendered from the templates validates clean | verified | This repository's `memory/`, validated with no findings on 2026-09-29 |
| The probe reports every governed contract file | verified | `tests/contract.test.mjs`, 459 passed on 2026-09-29 |

## Codex support

| Criterion | Status | Evidence |
| --- | --- | --- |
| The skill runs `status` in a live Codex session | unverified | — |
| `handoff for codex:` output launches a Codex session that finds memory | unverified | — |

## Onboarding

| Criterion | Status | Evidence |
| --- | --- | --- |
| The quickstart shows every mode | verified | `tests/doc-drift.test.mjs`, 459 passed on 2026-09-29 |
| Following the quickstart alone produces a committed memory tree and a handoff | unverified | — |

## Live model behavior

Headless `claude -p` runs with `--plugin-dir` on a three-commit sample CLI
project, 2026-09-29. Headless runs cannot answer questions or approve
protected writes, so interactive behavior is not covered.

| Criterion | Status | Evidence |
| --- | --- | --- |
| `init` reconstructs a brief, keeps hypotheses as hypotheses, and claims only observed runs | verified | Live run: brief marked reconstructed; bounds bug recorded with root cause Unknown; only the observed test run claimed |
| `sync` does not resolve a bug whose fix is uncommitted and unexercised | verified | Live run: attempted fix recorded, entry left open, criterion left unverified |
| `handoff for codex:` names memory files explicitly when there is no `AGENTS.md`, and prints rather than runs the launch line | verified | Live run output |
| `status` writes nothing | verified | Live run: working tree unchanged afterwards; report carried a coverage line |
| `audit` without Codex falls back to the bundled auditor, names the tier, and writes nothing | verified | Live run: subagent tier named, weaker evidence stated, working tree unchanged; findings were real |
| `repair` edits only accepted findings and leaves declined ones untouched | verified | Live run: 5 files, 33 lines added and 32 removed; declined brief finding left byte-identical; user-reported test run labelled as such |
| `grill` runs a round, waits, and writes only after confirmation | verified | Live three-round run via `--resume`: eight frontier questions with recommendations, a write proposal, and writes only after approval; working tree unchanged until then; one decision record, not one per answer |
| Modes find the skill's templates rather than composing from prose | verified | After `8fa999f`, a live handoff's tool calls read `skills/project-memory/templates/handoff.md` from the plugin; the result validated clean |
| `cleanup` reports seeded rot and writes nothing before approval | unverified | — |
| `handoff` files durable facts into their owners and `handoff close` retires a merged workstream | unverified | — |
| `init` installs the writing rule | failing | Protected `.claude/` write refused in a headless run; `init` now prints the copy command |

## Engineering skills, live

Headless `claude -p` runs with `--plugin-dir` and `--permission-mode
bypassPermissions` on a sample Node invoice repository with a seeded
off-by-one bug and no Git remote or memory tree, 2026-10-18. The sample lived
in a scratch directory and was not kept.

| Criterion | Status | Evidence |
| --- | --- | --- |
| `debug` reproduces, traces the cause, and fixes behind a regression test | verified | Live run: report in the skill's six-part shape; regression test failed before the fix (0 of 2) and passed after (2 of 2); committed |
| `learn capture` writes nothing when a test already carries the lesson | verified | Live run: "Nothing durable", no files written |
| `plan tickets` writes the plan and tickets in the artifact contract's shape | verified | Plan with R, D (with "settled by"), and U IDs; two tickets with every line the ticket check reads; `scripts/tickets-check.mjs` exited 0 |
| `build` works the frontier red first, branches off the default branch, and marks tickets done | verified | Live run: branch `invoice-line-tax` created; one commit per ticket; tightened two checks that passed vacuously; both tickets marked done |
| `review` runs the three lenses and gates findings through `scripts/findings-check.mjs` | verified | Live run: two real P2 findings, one confirmed against 200,000 random invoices; the sample's findings file passed the script with both kept |
| `verify run` drives the real CLI and keeps evidence out of Git | verified | Live run: one evidence file per behavior in the sample's evidence directory, which was added to its `.gitignore` |
| `autopilot` runs every stage or names the ones it skipped, and stops at local commits without a remote | verified | The first run skipped verify and review without saying so; after the stage-sizing rule, a second run drove the CLI, listed its assumptions, and named each skipped stage with a reason |
| `catch-up work` rebuilds state from Git and tickets when there is no memory | verified | Live run: every thread tagged; caught a change outside the plan and put it to the user as a decision |
| Any engineering skill in an interactive session, or under Codex | unverified | — |
| `prototype`, `ship`, `write`, `learn correct`, `learn retro`, `learn refresh`, `learn profile`, `verify create` live | unverified | — |

## Out of scope for completion

- Live model-behavior evaluation of every playbook.
