# Work

Implement a plan, a set of tickets, or a plain request, one verifiable unit at
a time.

## Order the work

- **Tickets:** run the graph check and work the frontier.

  ```bash
  node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" --dir <tickets dir>
  ```

- **A plan:** take its units in dependency order; prefactoring first.
- **A plain request:** write the units in the reply first, each with the check
  that will prove it.

## Run independent units in parallel

When a wave holds units that touch disjoint paths, give each one to a
subagent. For tickets, `tickets-check` reports the collisions among ready
tickets; for plan units, compare their Files lists yourself. Each worker gets a
packet, not the whole plan:

- the goal and Done when of the plan;
- its one unit or ticket, with the requirements and decisions it cites;
- the paths it owns, and the verify command;
- where it works: its own worktree, or the shared tree with no Git commands.

Read each worker's diff yourself before accepting it; a worker's summary is a
claim, the diff is the evidence. Commit the wave in dependency order. Units
that share paths run one after another.

## The unit loop

1. **Pick the check.** For new or changed behavior, write or name the check
   that proves it (a test, a script, a `verify` feature) and watch it fail for
   the right reason first. For a refactor or other change that must keep
   behavior, run the existing tests that cover it first; when they are thin,
   add a characterization test that pins today's output, and see it pass
   before you change anything. For configuration, build files, or documents,
   the check is the tool that reads them (the parser, the build, the linter,
   a link check).
2. **Build** the smallest change that makes it pass. Reuse what the codebase
   already has.
3. **Green.** Run the check, then the broader suite around it. Save the output
   of the checks you will report.
4. **Clean up.** Remove temporary logging, debug flags, and scratch files you
   added. Mark any you add with `DEBUG-TEMP` so `git diff | grep DEBUG-TEMP`
   finds them.
5. **Commit** with a message that names the unit or ticket ID, following
   `../ship/references/commit.md` when the index already held staged work
   before you began: that work is not yours to commit. Mark a ticket done when
   its `Verify with` passes.

A failing check you cannot explain sends you to `debug`, not to a second
guess.

## Tests worth keeping

Test behavior through public interfaces, at the seams the plan names: a test
reads like a specification and survives a refactor. Three kinds of test pass
while proving nothing:

- **Coupled to internals:** it mocks the code's own collaborators, calls
  private functions, or checks through a side channel; it breaks on a refactor
  that kept the behavior.
- **Tautological:** the expected value is computed the way the code computes
  it, so the test cannot disagree with the code. Expected values come from a
  literal, a worked example, or the spec.
- **Written in bulk first:** all tests, then all code, tests imagined behavior.
  One test, one change, repeat.

## Finish

Run the plan's Verification commands. For user-facing behavior, run `verify`
and keep the evidence path. Then hand the branch to `simplify` or `review`.

Report each unit as built and verified (the check, and its output's path),
built and unverified (say why), or not built.
