# Current State

What is true about this project right now. A snapshot, not a journal — obsolete
state is replaced here rather than appended to. History lives in Git and in
`decisions/`.

Updated: 2026-10-17

## Skill and modes

Status: working, partially verified

### Current reality

One skill, `skills/project-memory/SKILL.md`, routes eight modes (`init`,
`status`, `sync`, `handoff`, `grill`, `audit`, `repair`, `cleanup`) to one
playbook each, with four shared references and ten templates. `handoff` covers
any kind of work, files durable facts into their owners before writing, and
retires a finished workstream with `handoff close`.

**Verified:**

- `node --test`: 506 passed, 0 failed, 15 skipped, on branch
  feature-branch, 2026-10-17.
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

## Deterministic core

Status: working

### Current reality

`scripts/project-state.mjs` (state probe, now with a `contract` block for the
three governed contract files), `scripts/memory-validate.mjs` (eleven
checks, including `avoided-term` and `glossary-format`), `scripts/auditor-bridge.mjs` (Codex tier, subagent
fallback), `scripts/memory-hygiene.mjs` (eight rot signals for `cleanup`;
always exits 0), and two Claude Code hooks. `AGENTS.md` is governed alongside the
two `CLAUDE.md` forms by every component. The Codex manifest opts out of the
hooks (decision 007).

**Verified:**

- Covered by the suite above, on Linux. CI runs Ubuntu and Windows.

**Not verified:**

- The live Codex tier (gated off in tests).

**Known limitations:**

- Filesystem case detection is untested on a real case-insensitive macOS disk.

## Active workstreams

- Branch feature-branch: code-review fixes with regression tests, the
  `cleanup` mode and rot check, and the handoff upgrade. Pushed; no pull
  request opened. Listed under Unreleased in `CHANGELOG.md`.
- Version 1.1.0 is merged to main but not tagged or published.

## Intentionally deferred

- multi-context glossaries (upstream CONTEXT-MAP); `wait-what` and `retro` patterns
  (see `docs/benchmark/mattpocock-skills.md`, Result).
- Candidate patterns from Compound Engineering and pstack, not yet adopted
  (see `docs/benchmark/compound-engineering.md` and
  `docs/benchmark/skill-candidates-2026-10.md`, Candidates for this plugin).

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
