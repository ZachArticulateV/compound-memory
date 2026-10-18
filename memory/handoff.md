# Active Handoff

Updated: 2026-10-18
Branch: claude/serene-faraday-shkcdn
HEAD: 5f6e8e2
Working tree: the live-run commit, made directly on top of HEAD
Work type: code change
Next session focus: run the remaining engineering modes live

## Objective

Grow the plugin from memory alone into memory plus engineering: eleven skills
that do what the reviewed upstream skills do (Compound Engineering,
mattpocock/skills, pstack), each usable alone or with the others, written to
trust the model, with deterministic scripts for what must be exact.

## Completed

- Eleven engineering skills under `skills/`, the shared
  `references/artifacts.md` and `references/principles.md`, decision 009.
- Four read-only scripts: `scripts/lessons.mjs`, `scripts/findings-check.mjs`,
  `scripts/tickets-check.mjs`, `scripts/measure.mjs`, with
  `tests/engineering-scripts.test.mjs`.
- Lessons and guardrails in the memory schema, the `lesson-format` check, and
  the hygiene exemption for lessons.
- `docs/coverage.md`, two benchmark notes, README, architecture, limitations,
  and quickstart updates; the first lesson in `memory/lessons/`.
- A two-lens review of the branch (scripts; skill coherence) found 21 issues,
  all fixed: 10 script bugs, each pinned by a regression test, and 11
  instruction gaps (path lists, default-branch commits, the findings file's
  location and checkout, the noise ratio, transcript redaction, artifact
  readers, coverage wording).
- The previous handoff (claude/kind-ride-kiczmp) is retired: pull request #2
  merged it to main (`6d5d858`), recorded in `current-state.md`.

## Verified

- `node --test`: 654 passed, 0 failed, 15 skipped (669 tests), 2026-10-18.
- The 11 regression tests fail on `277e8f2` and pass with the fixes.
- `claude plugin validate . --strict` passed on the same tree.
- The verify layout check ran under Playwright on two fixture pages and told
  the clipped page from the clean one.
- `scripts/tickets-check.mjs` caught its own bug in a test (an empty field
  read the next line); fixed and recorded as a lesson.

- Live headless runs of `debug`, `learn capture`, `plan tickets`, `build`,
  `review`, `verify run`, `autopilot` (twice), and `catch-up work` on a sample
  repository met their Done when lines. The first `autopilot` run skipped verify
  and review silently, which led to the stage-sizing rule in
  `skills/autopilot/SKILL.md`. Details: `acceptance-criteria.md`.

## Unverified

- The other engineering modes live, interactive sessions, and Codex.
- CI on GitHub for this branch: no pull request is open.

## Current problem

None blocking. The engineering skills are instruction-only until a live run
exercises them.

## Evidence collected

- Upstream reviews: `docs/benchmark/compound-engineering.md`,
  `docs/benchmark/skill-candidates-2026-10.md`.

## Unverified hypotheses

- None open.

## Pointers

- `memory/decisions/009-engineering-skills.md`: why separate skills, and the
  trust posture.
- `references/artifacts.md`: the files the skills hand to each other.
- `docs/coverage.md`: each upstream skill and where it lives here.
- `CHANGELOG.md`, Unreleased: everything this branch adds.

## Continue here

1. Do the first Now item in `memory/next-actions.md`: live runs of the modes
   not yet exercised, recorded in `acceptance-criteria.md`.
2. Ask the owner the naming question in `memory/next-actions.md`, and open a
   pull request when they ask for one.

## Suggested commands

- `node scripts/lessons.mjs` to list this repository's lessons.
- `/project-memory:review code` on this branch once the plugin is installed
  from it.

## Do not assume

- That any engineering skill behaves as written: no live run yet.
- That CI passes for this branch until a run is observed.
