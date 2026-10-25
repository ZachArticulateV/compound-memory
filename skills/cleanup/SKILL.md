---
name: cleanup
description: "Finds contradictions, claims the code disproves, and stale content across the memory tree, then fixes what you accept. Use when you type /cleanup because memory feels heavy, repetitive, or wrong."
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/auditor-bridge.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" *)
---

# Cleanup

A shortcut for the `cleanup` mode of the project memory skill. `/cleanup` takes
no argument.

Read `../project-memory/SKILL.md` and follow it with `cleanup` as the mode:
run the state probe, load only `../project-memory/references/cleanup.md`, keep
the standing rules, and validate what you wrote. Every `references/` and
`templates/` path those files name is relative to `../project-memory/`; the
scripts are at `../../scripts/` from either directory.

Paths in this skill are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$ARGUMENTS` is everything after the skill name.
