# Techniques

## Building the loop

Roughly in this order, take the first that reaches the bug's code path:

1. a failing test at whatever level reaches it (unit, integration, end to end);
2. a curl or HTTP script against a running dev server;
3. a CLI run on a fixture input, diffed against known-good output;
4. a headless browser script that drives the UI and asserts on the page,
   console, or network (the `verify` skill's harness, when the project has one);
5. a replay of a captured request, payload, or event log through the code path;
6. a throwaway harness that runs the smallest part of the system that fails;
7. a property or fuzz loop for "sometimes wrong";
8. a differential loop: the same input through the old and new version;
9. a person in the loop, when only someone at a real device, account, or
   screen can trigger it: give them a numbered script of steps, each ending in
   one observation to report (yes or no, or the error pasted), and collect the
   answers as `KEY=value` lines you can compare across runs.

Then tighten it: cache setup, narrow the scope, assert on the exact symptom,
pin time and random seeds, isolate the file system and network. A
two-second deterministic loop beats a thirty-second flaky one.

## Narrowing

Ways to shrink the search when the cause is not obvious. Pick the one that
splits the remaining possibilities most evenly.

- **Bisect history.** When it used to work: `git bisect run <check>` with the
  reproduction as the check.
- **Bisect the input.** Halve the failing input until the smallest case that
  still fails remains.
- **Bisect the path.** Log or assert at the midpoint of the code path; the
  half where the value goes wrong holds the bug.
- **Diff environments.** When it fails in one place only (CI, production, one
  machine): compare versions, dependencies and the lockfile, the runtime
  version, environment variables, local services, configuration, data, time
  zone, locale, and concurrency between where it works and where it fails.
- **Your own tree.** When uncommitted files could reach the failure, reproduce
  with them set aside (`git stash push -u`), then restore exactly the entry
  that created (none, if it printed "No local changes to save"). A cause in
  that work in progress is reported to its owner, never committed as the
  fix.
- **Flaky failures.** Run the check in a loop (50 to 200 times) to measure the
  failure rate before and after a fix. A "fixed" flake that was never measured
  is not fixed. Suspect shared state, ordering, time, and network.
- **Performance regressions.** Measure first, with `build optimize`'s
  measurement script for the before and after numbers. Profile, then read the
  hottest frame's code.
- **Production-only failures.** Read the logs and traces around the first
  occurrence; add the instrumentation you wish you had, ship it, and wait for
  the next occurrence rather than guessing. Say in the report that the cause
  is a hypothesis until that occurrence confirms it.
- **Rare or slow failures.** Raise the rate before chasing the cause: run in
  parallel, add load, shorten timeouts, repeat the suspect operation, or pin
  the seed that failed. Record runs and failures (12 of 200) so the after-fix
  number has a before to compare with. Run enough after the fix that the old
  rate would almost surely have shown a failure (at 1 in 20, about 60 clean
  runs).
- **Fails only after a restart.** Suspect persisted state first: configuration
  files, caches, lock files, serialized state.
- **Suspect the observation.** When the evidence contradicts the code, check
  how you observed it first: a stale build, a cached response, the wrong
  environment, a log from another process.
- **Leave a signal behind.** When the deciding fact took a deep dig, propose
  the cheap, always-on log line or metric that would have shown it at once.
