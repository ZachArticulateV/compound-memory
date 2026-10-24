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

Questions worth asking cover: who uses it and what they do today; the one
behavior that must work; what failure looks like to them; data the feature
touches (personal or health data changes what is allowed); what already exists
that this replaces or must not break.

When no human is present (an `autopilot` run), answer each open question with
your recommendation, record it under Open questions marked `assumed`, and go
on.

## Write

Requirements are behaviors in the user's words, each one testable:

```markdown
## Requirements

- R1. A support agent sees every ticket whose reply is due today.
- R2. Answering a ticket removes it from the list for everyone.
```

Write Out of scope as plainly as the requirements. Leave Units, Decisions, and
Verification to `plan`; an empty heading that looks executable misleads the
next reader.

## Done check

- `plan-check.mjs <plan file> --stage brainstorm` passes, for a plan file.
- The frontier is empty, or every remaining question is recorded as assumed.
- The user confirmed the requirements, when a human is present.
- Every requirement can fail a check someone could write.
