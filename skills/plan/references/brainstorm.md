# Brainstorm

Settle what to build before anyone plans how. The result is the first half of
a plan file: Goal, Requirements, Out of scope, and Open questions.

## Size the work first

- **Small** (one behavior, obvious shape): write the goal and requirements in
  the reply and go straight to `plan`. No file.
- **Standard:** a plan file with the sections below.
- **Large** (several features or teams): a plan file per feature, with a short
  parent note that links them.

## Interview

Follow the interview discipline in
`${CLAUDE_SKILL_DIR}/../project-memory/references/interview.md`: build the
design tree, ask in frontier rounds, attach your recommended answer to each
question, look facts up yourself, and put only decisions to the user.

Keep two branches on the tree from the start: **Done** (how the user will know
it works) and **Out of scope** (what this is not).

Questions worth asking cover: who uses it and what they do today; what someone
has already done about the need (a workaround, money, time spent); the one
behavior that must work; the smallest version that still delivers it; what
failure looks like to them; for a new product, what would have to be true for
it to fail; data the feature touches (personal or health data changes what is
allowed); what already exists that this replaces or must not break.

When no human is present (an `autopilot` run), answer each open question with
your recommendation, record it under Open questions marked `assumed`, and go
on.

## Shape

When more than one product shape could meet the goal, show two or three that
differ in mechanism, not detail (one of them not the obvious one), each with
its cost and risk, then recommend the one that meets the goal with the least
added scope. Record the choice under Decisions. Skip this when one shape is
plainly right. When a decision turns on how something looks or feels and is
costly to reverse, offer `prototype` with that question and record its verdict
under Decisions.

## Write

Requirements are behaviors in the user's words, each one testable:

```markdown
## Requirements

- R1. A support agent sees every ticket whose reply is due today.
- R2. Answering a ticket removes it from the list for everyone.
- R3. When a ticket is reassigned, it moves to the new agent's list.
  Example: ticket 42, due today, reassigned from Ana to Ben, leaves Ana's list
  and appears in Ben's.
```

A requirement shaped "when X, Y" gets one concrete example line under it
(input, state, expected result). A requirement or decision that says something
exists or is missing in the code is checked against the code first, or marked
assumed.

Write Out of scope as plainly as the requirements. Leave Units, Decisions
beyond the shape, and Verification to `plan`; an empty heading that looks
executable misleads the next reader.

A term the interview pinned down goes into the plan's Terms. When the project
keeps a glossary, offer to add it there too through `/project-memory sync`,
with the rejected words under `_Avoid_`.

## Done check

- `plan-check.mjs <plan file> --stage brainstorm` passes, for a plan file.
- The frontier is empty, or every remaining question is recorded as assumed.
- The user confirmed the requirements, when a human is present.
- Every requirement can fail a check someone could write.
