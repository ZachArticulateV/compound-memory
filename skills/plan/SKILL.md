---
name: plan
description: "Shape and plan software work: settle requirements through an interview, make a judgment call with evidence, write an implementation-ready plan, or split a plan into dependency-ordered tickets. Use when the user wants to plan a feature, think through requirements, choose between approaches, or break work into tasks or tickets."
argument-hint: "[brainstorm|decide|plan|tickets] [idea, question, plan path, or issue]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/plan-check.mjs" *)
---

# Plan

Turn an idea into work another agent can build without guessing: requirements
in the user's words, decisions with their reasons, units that each end in a
check, and tickets whose order is checked rather than assumed.

**Done when:** the artifact the mode produces exists at the path in
`../../references/artifacts.md` and passes that mode's done check.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `brainstorm` | Settle what to build through an interview | `references/brainstorm.md` |
| `decide` | Recommend one option for a judgment call, with evidence | `references/decide.md` |
| `plan` | Write or enrich an implementation-ready plan | `references/plan.md` |
| `tickets` | Split a plan into tracer-bullet tickets with blocking edges | `references/tickets.md` |

Pick the mode the request describes. With no mode word and nothing in the
request to decide it, use `plan`. Read only the reference for the mode you run.

## How it works

1. **Ground.** Read `memory/` when it exists (`INDEX.md`, `current-state.md`,
   relevant decisions), the code the work touches, and the lessons that match:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --query "<the feature in a few words>"
   ```

2. **Run the mode** from its reference. Ask the user only what the repository
   cannot answer and what would change the plan, with your recommended answer
   attached. A small change gets its plan in the reply, not a file.
3. **Write the artifact** in the shape `../../references/artifacts.md` gives.
   One plan file grows from brainstorm to plan; edit it in place.
4. **Check it** against the mode's done check before handing it on.

The habits in `../../references/principles.md` apply throughout.

## Works with

- **Reads:** the memory tree, lessons, a prototype's verdict, an issue or spec.
- **Hands off:** the plan to `build`, `review` (the spec lens), and `verify`;
  tickets to `build` and to `project-memory` next actions. To stress-test a
  plan against memory, run `/project-memory grill <plan>`.
- **Alone:** works in any repository. Without memory, ground in the code and
  Git history.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.
