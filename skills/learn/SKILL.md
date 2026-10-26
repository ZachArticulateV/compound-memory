---
name: learn
description: "Save and maintain lessons from experience. Use when the user asks to capture a lesson, address a repeated mistake, run a retrospective, refresh lessons, or update their working profile."
argument-hint: "[capture|correct|retro|refresh|profile] [topic or session]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *)
---

# Learn

Keep the user's scope. A question stays read-only; plan-only work stops at the
plan. Use `../../references/task-routing.md` for task size and route choices.

Make each unit of work leave the next one easier: knowledge that the code
cannot carry becomes a lesson the next task finds, and a mistake that happens
twice becomes a check that stops a third.

**Done when:** each thing learned has one home (a check, a lesson, a
guardrail row, or the user's profile), that home exists, and the validator
reports nothing new on any memory file you wrote.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `capture` | Write or update one lesson from work just done | `references/capture.md` |
| `correct` | Make a repeated mistake impossible, then record what enforces it | `references/correct.md` |
| `retro` | Find what to improve in the agent's environment after a session | `references/retro.md` |
| `refresh` | Re-check lessons against the code; update, merge, or retire them | `references/refresh.md` |
| `profile` | Update the user's working rules from their history | `references/profile.md` |

Pick the mode the request describes. A correction from the user ("you did X
again") runs `correct`. Templates for a lesson and the guardrails table are in
`templates/lesson.md` and `templates/guardrails.md`.

## Prefer structure to prose

Ask in this order, and stop at the first that works: can architecture make the
mistake impossible, can a type, can a lint or check, can a test? A written
lesson is for knowledge that needs judgment or that no check can hold. See
"Encode lessons in structure" in `../../references/principles.md`.

## Find before you write

Search existing lessons first, including stale ones, so one meaning keeps one
home:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --query "<topic>" --all
```

After writing in `memory/`, run the validator:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" --json
```

## Works with

- **Reads:** the session, the diff, review findings, debug reports, CI history,
  and the existing lessons and guardrails.
- **Hands off:** lessons to `plan`, `build`, `debug`, and `review`, which look
  them up per task; guardrails to `review`'s standards lens.
- **Alone:** without a memory tree, lessons go in `memory/lessons/` anyway (the
  directory is created on first use) and checks go in the repository's own
  tooling.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.
