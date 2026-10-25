---
name: sync
description: "Brings memory up to date with what actually changed in the code, tests, and Git. Use when you type /sync after finishing a piece of work."
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/auditor-bridge.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" *)
---

# Sync

A shortcut for the `sync` mode of the project memory skill. `/sync` takes no
argument.

Read `../project-memory/SKILL.md` and follow it with `sync` as the mode:
run the state probe, load only `../project-memory/references/sync.md`, keep
the standing rules, and validate what you wrote. Every `references/` and
`templates/` path those files name is relative to `../project-memory/`; the
scripts are at `../../scripts/` from either directory.

Paths in this skill are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$ARGUMENTS` is everything after the skill name.
