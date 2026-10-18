---
name: review
description: "Review a change or a document through separate lenses that cannot mask each other: does it do what was asked (spec), does it follow the project's standards, and is it correct (bugs, security, data loss), with every finding tied to a quoted line. Use when the user asks to review code, a diff, a branch, a PR, or a plan or spec."
argument-hint: "[code|doc] [branch, PR, commit, or path]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/findings-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *)
---

# Review

Tell the author what would go wrong if this shipped, lens by lens, with each
finding tied to the line that causes it. A change can follow every standard and
build the wrong thing, or build the right thing badly; separate lenses keep one
from hiding the other.

**Done when:** every lens has reported or said why it was skipped, the findings
went through `findings-check.mjs`, and every kept P0 and P1 survived an attempt
to disprove it.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `code` | Review a diff, branch, commit range, or PR | `references/code.md` |
| `doc` | Review a plan, spec, or document before work starts | `references/doc.md` |

Pick the mode from the target. With no mode word and nothing in the request to
decide it, use `code`. The lenses themselves are in `references/lenses.md`.

## How it works

1. **Pin the target** and find the intent behind it: the plan, ticket, issue,
   PR description, or the user's request.
2. **Find the standards:** `CODING_STANDARDS.md`, `CONTRIBUTING.md`, the agent
   instruction files, `memory/guardrails.md`, lint configuration, and the
   lessons for the changed paths.
3. **Run the lenses in parallel subagents**, each with only what it needs. Each
   returns findings in the shape in `../../references/artifacts.md`.
4. **Gate the findings in code:** quotes are checked against the files,
   duplicates merged, and only confidence 75 or more (or P0) is kept.
5. **Try to disprove** each kept P0 and P1 before reporting it.
6. **Report each lens under its own heading.** Do not rerank across lenses.

Review reports; it changes code only when the user asks it to fix the findings
(or `autopilot` does).

## Works with

- **Reads:** the plan (for the spec lens), guardrails, lessons, and evidence
  from `verify`.
- **Hands off:** findings to `build` or to the author; unapplied findings to
  `ship pr` as residuals; a repeated finding to `learn correct`.
- **Alone:** reviews any diff in any repository. With no spec, the spec lens
  says so and the others still run.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.

Draws on mattpocock/skills `code-review` and Compound Engineering
`ce-code-review` and `ce-doc-review`.
