# Current State

What is true about this project right now. A snapshot, not a journal — obsolete
state is replaced here rather than appended to. History lives in Git and in
`decisions/`.

Updated: 2026-10-19

## Skill and modes

Status: working, partially verified

### Current reality

One skill, `skills/project-memory/SKILL.md`, routes eight modes (`init`,
`status`, `sync`, `handoff`, `grill`, `audit`, `repair`, `cleanup`) to one
playbook each, with four shared references and ten templates. `handoff` covers
any kind of work, files durable facts into their owners before writing, and
retires a finished workstream with `handoff close`.

**Verified:**

- `node --test`: 654 passed, 0 failed, 15 skipped (669 tests), on branch
  claude/serene-faraday-shkcdn, 2026-10-18.
- `claude plugin validate . --strict` passed on the same tree.
- [Pull request #1](https://github.com/ZachArticulateV/project-memory/pull/1)
  (1.1.0) merged to main on 2026-09-29; its three CI checks (Ubuntu, Windows,
  manifests) passed, read from GitHub on 2026-10-17.
- Four audits ran on 2026-09-29 (Markdown system; code, hooks, packaging;
  an independent re-audit; a convergence audit of the re-audit's fixes). Every HIGH and MEDIUM
  finding is fixed with a test, except the release steps in `next-actions.md`
  and the items in `bugs-and-risks.md`.
- Live headless runs of the first seven modes on a sample project; results in
  `acceptance-criteria.md`.

**Not verified:**

- Model behavior under any playbook. The tests pin the instructions, not what a
  model does with them.
- `grill`, the handoff focus, and the Codex launch line in a live session.
- `cleanup`, `handoff close`, and the handoff's work-type and filing steps in
  any live session.

**Known limitations:**

See `docs/limitations.md`.

## Engineering skills

Status: working, partially verified

### Current reality

Eleven skills beside `project-memory` (decision 009): `plan`, `prototype`,
`build`, `debug`, `review`, `verify`, `ship`, `autopilot`, `learn`, `write`,
`catch-up`. Each has an outcome, a Done when line, a mode table, and a Works
with section, and composes through the artifacts in `references/artifacts.md`.
`docs/coverage.md` maps every adopted upstream skill to its home here.

**Verified:**

- `tests/skills.test.mjs` and `tests/coverage.test.mjs` pass in the suite
  above: anatomy, paths, script pre-approvals, Codex metadata, hand-off
  targets, and coverage targets.
- `claude plugin validate . --strict` passed with the twelve skills and the
  plugin-root `references/` directory, 2026-10-18.
- The layout check in `skills/verify/references/checks.md` was run with
  Playwright against two fixture pages: it reported the clipped field and
  button on the broken page and passed the clean one, 2026-10-18.

- Every engineering mode met its Done when line in live headless runs,
  2026-10-18 and 2026-10-19: on a Node sample, on a Python sample and a web
  form (`autopilot`), across three resumed turns with a human answering
  (`plan brainstorm`), and for `ship watch` and `ship feedback` against a
  scripted `gh`. Results, and the four fixes the runs drove, are in
  `acceptance-criteria.md` (Engineering skills, live).
- `tests/acceptance/live-engineering.test.mjs` re-runs six of those scenarios
  and checks their artifacts with the plugin's scripts; off by default. It
  passed 6 of 6, and the memory live tier passed every scenario this machine
  can run, both on 2026-10-18 (`acceptance-criteria.md`).

**Not verified:**

- `ship watch`'s fix path and `ship feedback`'s reply path against real GitHub
  (pull request #3 had nothing to fix or answer; both read it correctly), and
  any run under Codex (no Codex CLI here).
- The console and component-provenance checks in
  `skills/verify/references/checks.md` (not executed by this repository's
  tests; the generated verification skill's layout check ran).

## Deterministic core

Status: working

### Current reality

`scripts/project-state.mjs` (state probe, now with a `contract` block for the
three governed contract files), `scripts/memory-validate.mjs` (twelve
checks, including `avoided-term`, `glossary-format`, and `lesson-format`), `scripts/auditor-bridge.mjs` (Codex tier, subagent
fallback), `scripts/memory-hygiene.mjs` (eight rot signals for `cleanup`;
always exits 0), four engineering scripts (`scripts/lessons.mjs`,
`scripts/findings-check.mjs`, `scripts/tickets-check.mjs`,
`scripts/measure.mjs`), and two Claude Code
hooks. `AGENTS.md` is governed alongside the
two `CLAUDE.md` forms by every component. The Codex manifest opts out of the
hooks (decision 007).

**Verified:**

- Covered by the suite above, on Linux. CI runs Ubuntu and Windows.

**Not verified:**

- The live Codex tier (gated off in tests).

**Known limitations:**

- Filesystem case detection is untested on a real case-insensitive macOS disk.

## Active workstreams

- Branch claude/serene-faraday-shkcdn: the eleven engineering skills, four
  scripts, lessons and guardrails in the schema, coverage map, benchmark notes,
  and the rename to `compound-memory`. Open as
  [pull request #3](https://github.com/ZachArticulateV/project-memory/pull/3);
  CI green on `a439190` (Ubuntu, Windows, manifests), 2026-10-19. Waiting on the
  owner's review. Listed under Unreleased in `CHANGELOG.md`.
- Branch claude/kind-ride-kiczmp (code-review fixes, the `cleanup` mode, the
  handoff upgrade) merged to main as pull request #2 (`6d5d858`); still listed
  under Unreleased in `CHANGELOG.md`.
- Version 1.1.0 is merged to main but not tagged or published.

## Intentionally deferred

- Multi-context glossaries (upstream CONTEXT-MAP), until a multi-context
  repository adopts the plugin (see `docs/benchmark/mattpocock-skills.md`).
- A behavioral eval harness for the skills (Compound Engineering's
  `skill-eval-cell`, `ce-retune`): needed before claiming any skill's behavior
  improved. See `docs/benchmark/compound-engineering.md`.
- The marketplace entry still names `project-memory`; renaming it to
  `compound-memory` (decision 010) is a change in another repository.

## Before modifying this project

- Run `node --test` before and after. Doc-drift tests pin counts stated in
  prose (modes, checks, patterns), so a change to a count is a change to prose.
- Gate every commit on the tests, `claude plugin validate . --strict`, and the
  memory validator together, checking each exit code explicitly. Twice in this
  workstream a chain looked gated and was not: piping through `tail` hid a
  failure, and `set -e` did not stop a failing pipeline in the agent shell, so
  commit `205cedd` shipped with one failing test (fixed in the next commit).
- `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` must keep
  identical shared metadata.
- This repository's own instructions live at `.claude/CLAUDE.md`, never a root
  `CLAUDE.md`, which fails strict plugin validation.
