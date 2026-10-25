---
name: repair
description: "Corrects the problems an audit or the validator found in memory, keeping valid hand-written context. Use when you type /repair after an audit or a failed validation."
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/auditor-bridge.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" *)
---

# Repair

A shortcut for the `repair` mode of the project memory skill. `/repair` takes no
argument.

Read `../project-memory/SKILL.md` and follow it with `repair` as the mode:
run the state probe, load only `../project-memory/references/repair.md`, keep
the standing rules, and validate what you wrote. Every `references/` and
`templates/` path those files name is relative to `../project-memory/`; the
scripts are at `../../scripts/` from either directory.

Paths in this skill are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$ARGUMENTS` is everything after the skill name.
