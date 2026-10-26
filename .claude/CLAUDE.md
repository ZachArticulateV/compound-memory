# Compound Memory (the plugin)

## Purpose

A Claude Code and Codex plugin of twelve core skills and five explicit shortcuts: `project-memory`, which keeps a
project's canonical memory under `memory/` accurate, minimal, and
evidence-backed, and eleven engineering skills (plan, prototype, build, debug,
review, verify, ship, autopilot, learn, write, catch-up) that hand work to each
other through the files in `references/artifacts.md`. This repository ships the
plugin and tracks its own development in its own `memory/` tree.

## Critical Commands

- Test: `node --test` (from the repository root; never `node --test tests/`,
  which breaks on Windows)
- Validate the Claude manifest: `claude plugin validate . --strict`
- Validate this repository's memory: `node scripts/memory-validate.mjs`
- Probe this repository's memory state: `node scripts/project-state.mjs`

## Architectural Invariants

- Deterministic facts are code under `scripts/`; judgement is Markdown under
  `skills/`. Read `docs/architecture.md` before moving a responsibility across
  that line.
- Skills compose through files, never by calling each other. A new artifact
  gets a row in `references/artifacts.md`; a new skill or mode keeps the
  anatomy `tests/skills.test.mjs` pins.
- The skills are this plugin's own: they name no other skill set, project, or
  author, and carry no attribution lines.
- The engineering skills state outcomes and trust the model (decision 009).
  Add a script for a fact that must be exact rather than a prohibition.
- `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` keep identical
  shared metadata; `tests/manifest.test.mjs` enforces it.
- Counts stated in prose (modes, checks, templates, secret patterns) are pinned
  by `tests/doc-drift.test.mjs`. Changing a count means changing the prose.
- The router `skills/project-memory/SKILL.md` stays a thin table; its size is
  tested.

## Verification Rules

- Do not claim a mode works from its playbook alone. Playbooks are
  instructions; `docs/limitations.md` lists what code actually enforces.
- Run `node --test` after every behavioral change and cite the counts.
- Distinguish confirmed root causes from hypotheses in `memory/bugs-and-risks.md`.

## Project Memory

Canonical project context lives under `memory/`.

Before substantial project work, read:

- `memory/INDEX.md`
- `memory/current-state.md`
- the active handoff listed in `memory/INDEX.md`, when one exists
- `memory/next-actions.md`

Read decisions, bugs, lessons (`memory/lessons/`), and deeper memory only when
relevant to the current task.

Project memory is context, not proof. Verify behavior against code, tests,
runtime evidence, configuration, and Git when accuracy matters.
