# Resolved bugs, 2026-10

Retired from `bugs-and-risks.md` once resolved. Rarely read.

## Live harness runs leaked NODE_TEST_CONTEXT to spawned agents

Status: resolved 2026-10-18
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

The guard tests pass. With the fix, the engineering live tier passed 6 of 6 and
the memory live tier passed every scenario this machine can run (the two Codex
scenarios skip: no Codex CLI), 2026-10-18. The hypothesis about the 2026-09-29
results was not confirmed or refuted directly; the scenarios pass now.
