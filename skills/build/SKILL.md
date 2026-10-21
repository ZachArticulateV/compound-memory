---
name: build
description: "Implement planned work with proof at every step: execute a plan or tickets unit by unit, running independent units in parallel; refine code just written; or improve a measured metric, keeping only the wins that clear the noise. Use when the user asks to implement, build, execute a plan or ticket, clean up freshly written code, or make something faster or smaller."
argument-hint: "[work|simplify|optimize] [plan path, ticket, or goal]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/measure.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/changes.mjs" *)
---

# Build

Make the change the plan describes, prove each piece as it lands, and leave a
history someone can follow commit by commit.

**Done when:** every unit you built has a check suited to it that you ran and
saw give the right answer (new behavior: it failed before the change and
passes after; cleanup: the same results before and after; configuration or
documents: they parse, build, or lint), the project's own suite passes, no
temporary debug code is left, and the work is committed.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `work` | Implement a plan, tickets, or a request, unit by unit | `references/work.md` |
| `simplify` | Refine code just written before it goes to review | `references/simplify.md` |
| `optimize` | Improve one metric through measured experiments | `references/optimize.md` |

Pick the mode the request describes. With no mode word and nothing in the
request to decide it, use `work`. Read only the reference for the mode you run.

## How it works

1. **Ground.** Read the plan or ticket, `memory/` when it exists, and the
   lessons for the paths you will touch:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --paths <dir>,<dir>
   ```

   On the repository's default branch, create a feature branch before the first
   commit.

   When the project has a verification skill (`.claude/skills/verify-*` or
   `.agents/skills/verify-*`), note it: `verify` uses it to prove user-facing
   changes.
2. **Run the mode** from its reference.
3. **Keep the plan true.** When the plan turns out wrong, fix the plan file and
   say what changed, rather than quietly building something else.
4. **Hand off.** Run `verify` for user-facing changes and `review` before
   shipping. When the work crosses skills or sessions, keep the check results
   in a run record (`../../references/artifacts.md`) so the next stage reads
   them instead of re-running them blind; a one-sitting change does not need
   one.

The habits in `../../references/principles.md` apply throughout, especially
building what was asked and proving it works.

## Works with

- **Reads:** a plan or tickets from `plan`, lessons, a prototype's validated
  module, the project's verification skill.
- **Hands off:** commits to `review` and `ship`; finished tickets marked done;
  a lesson worth keeping to `learn capture`.
- **Alone:** given a plain request and no plan, write a short plan in the reply
  (units, each with a check) and build from that.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.

Draws on Compound Engineering `ce-work`, `ce-simplify-code`, and `ce-optimize`,
mattpocock/skills `tdd` and `implement`, and pstack's
`principle-prove-it-works`.
