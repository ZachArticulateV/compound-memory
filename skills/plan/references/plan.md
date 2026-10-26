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
- **Lessons:** `lessons.mjs --query "<terms>" --paths <dir>,<dir>`
  (see the router), then read the matches.
- **Outside docs:** only when the work leans on a framework or API whose
  behavior you would otherwise guess.

For the repository-pattern question, give the code scout a bounded source map:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/repo-map.mjs" --scope src --exclude src/private --max-files 100 --json # not pre-approved
```

Choose literal scope and exclusion paths for this project. The map reads no
links or known private/generated paths. It reports source hashes, omissions,
and partial coverage. JavaScript import and call entries are static candidates;
the scout must check their cited lines before claiming a call path. Other
languages receive an inventory only. Rerun the map when source changes. A
saved map is evidence for its source version, not a current full code audit.

For user-facing behavior, walk each flow (the normal path, empty input, an
error, an interruption, a repeat) and add what is missing as a requirement or
an open question.

## Write

Follow the plan shape in `../../references/artifacts.md`.

For work that needs saved task state, shared resources, or phase gates, use the
version 2 JSON contract in `../../references/work-contracts.md` and
`../../schemas/plan.schema.json`. The examples in `../../examples/contracts/`
show a small plan and a plan with phases. Keep scope, requirements, task IDs,
and check IDs in that one static file. Narrative notes point to those IDs.
The run ledger owns progress. Do not add task status to the plan or maintain
a second set of checkboxes in tickets.

For a small legacy plan, keep the Markdown form below. An unmarked Markdown
file is version 1. Phase or gate prose in it does not create a checked version
2 execution graph. An unknown explicit version is rejected.

- **Terms** define only the words a reader could take two ways ("active
  ticket", "reply due"), in the project's glossary words when
  `memory/glossary.md` has them. Skip the section when no word is ambiguous.
- **Requirements** say what is true when the work is done, each one
  observable ("the list shows only tickets due today"), not an activity
  ("improve the list").
- **Decisions** carry an ID, the choice, the reason, and who settled it (the
  user, or you, marked as a recommendation). Only a user's decision is settled.
  When a prototype settled one, the decision names the prototype branch and may
  quote the trimmed fragment that carries it (a transition table, a type
  shape) when that says it more exactly than prose.
- **Units** carry an ID, a goal, the files they touch, the approach, a
  `Verify` command, and the requirement IDs they cover, plus `Depends on`
  (unit IDs) when order matters. A unit that adds behavior names, in a line or
  two, the cases its tests cover: normal, edge, failure, and the cross-layer
  case when it crosses one. A unit is small enough to check on its own. Put
  prefactoring first: make the change easy, then make the easy change. Never
  renumber a unit; gaps in the IDs are fine.
- **Verification** names the seams the tests will use (the public interfaces
  where behavior is observed, as few and as high as possible, preferring ones
  that already exist), the existing tests nearest in kind as the pattern to
  follow, the repository's own commands (test, lint, type check, build), and
  any `verify` feature that proves the behavior in the app. When a person is
  present, put the seams to them as one interview question, each with what it
  catches and what it misses.
- **Done when** is checkable by someone who did not write the plan.

For a small change, write the plan in the reply in the same shape, without a
file.

## Deepen

When asked to deepen or strengthen an existing plan, find its thin parts: a
decision with no reason or no rejected option, a unit with no test cases or a
`Verify` that cannot fail, a named risk no decision answers, research cited and
used nowhere. Research only those, show the proposed changes, and apply what
the user accepts. Keep every ID, and run the readiness check again.

## Readiness check

Run the part code can check:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/plan-check.mjs" <plan file>
```

Use the same command with `<plan.json>` for version 2. It checks the combined
task and gate graph, phase links, required checks, and literal path and
resource claims. Valid shared claims wait in order. Phase numbers do not
create hidden dependencies. Invalid graphs expose no ready tasks.

It exits 1 when a requirement has no unit, a unit has no `Verify` or still says
TBD, a `Depends on` names a unit that does not exist, Out of scope is missing,
an open question is not marked answered, deferred, or assumed, or two IDs
collide, or unit dependencies form a cycle. Then judge the rest yourself:

- Every unit's `Verify` could fail (a command that always passes proves
  nothing).
- No two decisions contradict each other.
- Every claim that existing behavior "does not change" has a unit whose
  `Verify` compares the old and the new code across many inputs (a property or
  equivalence test against the code as it is today). One example does not show
  that a formula is unchanged.

A plan past a few units, or one that touches stored data, money, security, or
a public interface, goes through `review doc` before `build`; a small plan
skips it. When it passes, offer `/project-memory grill` for a plan worth
stress-testing, `plan tickets` for work that several agents will share, or
`build` to start.
