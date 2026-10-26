---
name: grill
description: "Question a plan against memory and code. Use when the user explicitly selects this grill shortcut; plain requests use project-memory."
argument-hint: "[focus, plan, or finding list]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" *)
---

# Grill

Question a plan against memory and code.

This is an explicit shortcut for one shared playbook. Keep the user's scope
and prior authority. A question or read-only request produces no file edits.
Use `../../references/task-routing.md` for scope and name collisions.

1. Run the state probe from the target project:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" --json
   ```

2. Read `../project-memory/references/grill.md`. Follow that playbook with
   the text after this shortcut as its argument. Do not call another skill.
3. The canonical base for the playbook's templates and references is
   `../project-memory/`, relative to this skill's directory.
   Keep `${CLAUDE_SKILL_DIR}` bound to this shortcut's directory for commands.
   Its `../../scripts/` path reaches the same shared scripts and matches this
   shortcut's tool grants. Do not rewrite that command prefix to project-memory.
4. Complete only the requested work. If it writes memory, run the playbook's
   closing validation and report its result.

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" --json
   ```

Outside Claude Code, substitute this skill's real directory in the probe
command. All paths above are relative to this skill's directory.
The shared playbook contains the mode's full rules and completion check.
