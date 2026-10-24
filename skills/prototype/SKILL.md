---
name: prototype
description: "Build a throwaway prototype that answers one design question before the real build: a single-file HTML demo for logic, state, or data shape, or switchable UI variants of a screen. Use when the user wants to try a layout, compare design options, or check that a state model or flow feels right."
argument-hint: "[logic|ui] [the question, and the page or module it is for]"
---

# Prototype

A prototype is throwaway code that answers one question. The question decides
its shape, and the answer, not the code, is what the project keeps.

**Done when:** the one question it answers is written at the top of the
prototype, the user (or the evidence) has answered it, the verdict is recorded
where the plan or the next build will read it, and every plan section the
answer changes has been updated.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `logic` | Push a state model or business rule through hard cases | `references/logic.md` |
| `ui` | Compare structurally different versions of a screen | `references/ui.md` |

Pick the mode from the question: "does this logic feel right?" is `logic`;
"what should this look like?" is `ui`. A backend module points to `logic`, a
page or component to `ui`. When it is still unclear and nobody is around to
ask, pick one, and state the assumption at the top of the prototype.

## Rules for both

1. **Name the question first,** as one sentence that can be answered ("Does a
   two-step signup form lose fewer fields than one long page?"), and what
   answer would change the plan. No question, no prototype; a prototype that
   tests something else (real persistence when the question is layout) fakes
   its answer.
2. **Throwaway and marked as such.** Put it next to what it prototypes, and name
   it so nobody mistakes it for production code.
3. **One command, or one double-click, to run,** in the medium that shows the
   thing being judged: when a browser would fake it (a native gesture, a
   sound, a printed page), build it where it is real, and say so.
4. **State lives in memory.** Persistence is what a prototype tests, not what it
   relies on. A question about storage gets a scratch database named to be
   wiped.
5. **Skip the polish:** no tests, no error handling past what keeps it running.
6. **Show the state** after every action or variant switch.
7. **Two options by default** for a UI comparison, up to five when asked. More
   than five stops being different and starts being noise.
8. **Capture the answer.** Write the verdict and the question it settled into
   the plan's Decisions (or the issue), commit the prototype to a
   `prototype/<slug>` branch, name that branch in the decision so the source
   can be found again, and keep only the validated decision on the main
   branch.
9. **Update what the answer changed.** When the verdict changes direction,
   edit the plan sections it touches (Requirements, Decisions, Units, Out of
   scope) in the same change, mark the replaced decision as superseded, and
   run `plan-check.mjs` on the plan. When it confirms the plan, say so in the
   decision.

## Works with

- **Reads:** a plan's open questions, the real page and data it will live in.
- **Hands off:** the verdict to `plan` as a decision; a validated logic module
  to `build`, which lifts it into the real code with tests.
- **Alone:** answers a design question in any repository, or as a standalone
  HTML file with no repository at all.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.

Draws on mattpocock/skills `prototype` and Compound Engineering `ce-prototype`.
