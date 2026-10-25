---
name: grill
description: "Interviews you about a plan one round at a time, checking each answer against memory and the code, then records what it settled. Use when you type /grill with a plan or idea to stress-test."
argument-hint: "[plan path, or the idea to stress-test]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/auditor-bridge.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" *)
---

# Grill

A shortcut for the `grill` mode of the project memory skill. Words after
`/grill` are the plan or idea to test (`$ARGUMENTS`).

Read `../project-memory/SKILL.md` and follow it with `grill` as the mode:
run the state probe, load only `../project-memory/references/grill.md`, keep
the standing rules, and validate what you wrote. Every `references/` and
`templates/` path those files name is relative to `../project-memory/`; the
scripts are at `../../scripts/` from either directory.

Paths in this skill are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$ARGUMENTS` is everything after the skill name.
