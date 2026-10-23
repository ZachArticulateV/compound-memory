# Current State

What is true about this project right now. A snapshot, not a journal — obsolete
state is replaced here rather than appended to. History lives in Git and in
`decisions/`.

Updated: 2026-10-23

## Release

Version 2.0.0 in both manifests. The plugin installs from the
`zacharticulatev` marketplace as `compound-memory@zacharticulatev`.

## Memory skill and modes

Status: working, partially verified

### Current reality

One skill, `skills/project-memory/SKILL.md`, routes eight modes (`init`,
`status`, `sync`, `handoff`, `grill`, `audit`, `repair`, `cleanup`) to one
playbook each, with four shared references and ten templates.

**Verified:**

- The suite and strict plugin validation (see Deterministic core).
- Live headless runs of every mode except `cleanup` and `handoff close` on a
  sample project; results in `acceptance-criteria.md`.

**Not verified:**

- Model behavior under any playbook beyond those runs. The tests pin the
  instructions, not what a model does with them.
- `cleanup` and `handoff close` in a live session.

## Engineering skills

Status: working, partially verified

### Current reality

Eleven skills beside `project-memory` (decision 009): `plan`, `prototype`,
`build`, `debug`, `review`, `verify`, `ship`, `autopilot`, `learn`, `write`,
`catch-up`. Each has an outcome, a Done when line, a mode table, and a Works
with section, and composes through the artifacts in `references/artifacts.md`.
`docs/coverage.md` maps every adopted upstream skill to its home here.

**Verified:**

- `tests/skills.test.mjs` and `tests/coverage.test.mjs`: anatomy, paths,
  script pre-approvals, Codex metadata, hand-off targets, coverage targets.
- Every engineering mode met its Done when line in live headless runs on sample
  repositories (`acceptance-criteria.md`, Engineering skills, live).
- With the skill invoked, the agent-task eval scored 12 of 12 correct with no
  false success (`evals/README.md`, Last measured).

**Not verified:**

- Any skill run under Codex. The plugin installs there and all twelve skills
  reach the model's prompt.
- The console and component-provenance checks in
  `skills/verify/references/checks.md`.

## Deterministic core

Status: working

### Current reality

`scripts/project-state.mjs` (state probe), `scripts/memory-validate.mjs`
(twelve checks), `scripts/auditor-bridge.mjs` (Codex tier, subagent fallback),
`scripts/memory-hygiene.mjs` (eight rot signals), the engineering scripts
(`scripts/lessons.mjs`, `scripts/findings-check.mjs`,
`scripts/tickets-check.mjs`, `scripts/measure.mjs`, `scripts/changes.mjs`,
`scripts/run-record.mjs`, `scripts/pr-state.mjs`, `scripts/plan-check.mjs`,
`scripts/rewrite-check.mjs`, and the `scripts/verify/` helpers; decision 011),
and two Claude Code hooks. The Codex manifest opts out of the hooks
(decision 007).

**Verified:**

- `node --test`: 748 tests, 727 passed, 0 failed, 21 skipped, on Linux,
  2026-10-23. CI runs Ubuntu and Windows.
- `claude plugin validate . --strict` passed on the same tree.

**Not verified:**

- The live Codex auditor tier (gated off in tests).

**Known limitations:**

- Filesystem case detection is untested on a real case-insensitive macOS disk.
- See `docs/limitations.md`.

## Active workstreams

None.

## Intentionally deferred

- Multi-context glossaries (upstream CONTEXT-MAP), until a multi-context
  repository adopts the plugin (see `docs/benchmark/mattpocock-skills.md`).

## Before modifying this project

- Run `node --test` before and after. Doc-drift tests pin counts stated in
  prose (modes, checks, patterns), so a change to a count is a change to prose.
- Gate every commit on the tests, `claude plugin validate . --strict`, and the
  memory validator together, checking each exit code explicitly. Piping a
  check through `tail` hides its exit code.
- `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` must keep
  identical shared metadata.
- This repository's own instructions live at `.claude/CLAUDE.md`, never a root
  `CLAUDE.md`, which fails strict plugin validation.
- Never commit run output (the .verify and evals/results directories): it
  holds agent replies and session-specific results. `.gitignore` covers both.
