# Plan

Write a plan another agent can implement unit by unit without asking what you
meant. When `brainstorm` wrote a plan file, enrich that file in place: keep the
requirements' wording, and add a line under Decisions for any requirement you
had to change, with the reason.

## Research

Scale research to the change. For anything past a few files, run these in
parallel subagents and keep only their conclusions:

- **Repository patterns:** how the code already does the nearest similar
  thing, which helpers exist, which tests cover the area.
- **Lessons:** `lessons.mjs --query "<terms>" --paths <dirs the work touches>`
  (see the router), then read the matches.
- **Outside docs:** only when the work leans on a framework or API whose
  behavior you would otherwise guess.

## Write

Follow the plan shape in `../../references/artifacts.md`.

- **Decisions** carry an ID, the choice, the reason, and who settled it (the
  user, or you, marked as a recommendation). Only a user's decision is settled.
- **Units** carry an ID, a goal, the files they touch, the approach, a
  `Verify` command, and the requirement IDs they cover. A unit is small enough
  to check on its own. Put prefactoring first: make the change easy, then make
  the easy change.
- **Verification** names the seams the tests will use (the public interfaces
  where behavior is observed, as few and as high as possible, preferring ones
  that already exist), the repository's own commands (test, lint, type check,
  build), and any `verify` feature that proves the behavior in the app.
- **Done when** is checkable by someone who did not write the plan.

For a small change, write the plan in the reply in the same shape, without a
file.

## Readiness check

- Every requirement is covered by at least one unit.
- Every unit has a `Verify` that could fail.
- No unit says "TBD"; each open question is answered or explicitly deferred.
- The plan names what is out of scope.

When it passes, offer `/project-memory grill` for a plan worth stress-testing,
`plan tickets` for work that several agents will share, or `build` to start.
