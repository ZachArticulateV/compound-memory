# Bugs and Risks

Unresolved problems. Every entry keeps confirmed causes and suspected causes in
separate fields — this separation is the point of the file.

## Codex path verified only structurally

Status: open
Severity: medium
Reproducibility: not applicable

**Observed:**

The Codex manifest (including its hook opt-out),
`skills/project-memory/agents/openai.yaml`, the Outside Claude Code section,
and the Codex launch line are covered by structural tests and a reading of
Codex source at c248f6d. A live Claude Code run of `handoff for codex:`
printed a correct launch line; the Codex side has never run.

**Affected components:**

`.codex-plugin/plugin.json`, `skills/project-memory/SKILL.md`,
`skills/project-memory/references/handoff.md`.

**Confirmed root cause:**

Unknown.

**Current hypotheses:**

None; this is a verification gap, not a known failure.

**Attempted fixes:**

None.

**Verification status:**

Not run in a live Codex session.

**Next verification step:**

Install the plugin in Codex, run `status` and `handoff for codex:` in a sample
repository, and record the result here.

## Live harness runs leaked NODE_TEST_CONTEXT to spawned agents

Status: open
Severity: medium
Reproducibility: always, before the fix

**Observed:**

The first armed run of `tests/acceptance/live-engineering.test.mjs` reported
its red fixtures as green. A failing suite run with `NODE_TEST_CONTEXT`
inherited from `node --test` exits 0 (reproduced in a scratch directory,
2026-10-18). Both live harnesses spawned `claude` with the test runner's
environment, so an agent that ran `node --test` inside a fixture saw the same
false green.

**Affected components:**

`tests/acceptance/live-scenarios.test.mjs`,
`tests/acceptance/live-engineering.test.mjs`, `tests/fixtures/fake-gh.cjs`.

**Confirmed root cause:**

Node's test runner marks the files it runs with `NODE_TEST_CONTEXT`; a nested
`node --test` that inherits it reports to a parent that is not listening and
exits 0. Fixed with `childEnv()` in `tests/fixtures/build.mjs`, used by every
live spawn, and pinned by `tests/engineering-scripts.test.mjs`.

**Current hypotheses:**

- The 2026-09-29 memory live results in `acceptance-criteria.md` that depend on
  an agent observing a test run (for example `init` claiming only the observed
  run) may have been judged on a false green. Re-running that tier would settle
  it.

**Attempted fixes:**

`childEnv()` (this branch).

**Verification status:**

The guard tests pass; the engineering live tier is being re-run with the fix.
The memory live tier has not been re-run.
