---
name: handoff
description: "Writes where the work stopped, what was verified, and the exact next step, so the next session picks it up. Use when you type /handoff before clearing context, switching tasks, or stopping."
argument-hint: "[focus for the next session, or close]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/auditor-bridge.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" *)
---

# Handoff

A shortcut for the `handoff` mode of the project memory skill. Words after
`/handoff` are the next session's focus, or `close` to close a finished
workstream (`$ARGUMENTS`).

Read `../project-memory/SKILL.md` and follow it with `handoff` as the mode:
run the state probe, load only `../project-memory/references/handoff.md`, keep
the standing rules, and validate what you wrote. Every `references/` and
`templates/` path those files name is relative to `../project-memory/`; the
scripts are at `../../scripts/` from either directory.

Paths in this skill are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$ARGUMENTS` is everything after the skill name.
