---
name: prototype
description: "Build a throwaway prototype that answers one design question before the real build: a single-file HTML demo for logic, state, or data shape, or switchable UI variants of a screen. Use when the user wants to try a layout, compare design options, or check that a state model or flow feels right."
argument-hint: "[logic|ui] [the question, and the page or module it is for]"
---

# Prototype

A prototype is throwaway code that answers one question. The question decides
its shape, and the answer, not the code, is what the project keeps.

**Done when:** the question is written at the top of the prototype, the user
(or the evidence) has answered it, and the verdict is recorded where the plan
or the next build will read it.

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

1. **Throwaway and marked as such.** Put it next to what it prototypes, and name
   it so nobody mistakes it for production code.
2. **One command, or one double-click, to run.**
3. **State lives in memory.** Persistence is what a prototype tests, not what it
   relies on. A question about storage gets a scratch database named to be
   wiped.
4. **Skip the polish:** no tests, no error handling past what keeps it running.
5. **Show the state** after every action or variant switch.
6. **Two options by default** for a UI comparison, up to five when asked. More
   than five stops being different and starts being noise.
7. **Capture the answer.** Write the verdict and the question it settled into
   the plan's Decisions (or the issue), commit the prototype to a
   `prototype/<slug>` branch, and keep only the validated decision on the main
   branch.

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
