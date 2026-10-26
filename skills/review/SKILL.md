---
name: review
description: "Check code or a document against the request, project rules, and likely faults. Use when the user asks to review a diff, branch, PR, plan, or spec. A review request does not authorize edits."
argument-hint: "[code|doc] [branch, PR, commit, or path]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/findings-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/changes.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" *)
---

# Review

Keep the user's scope. A question stays read-only; plan-only work stops at the
plan. Use `../../references/task-routing.md` for task size and route choices.

Tell the author what would go wrong if this shipped, lens by lens, with each
finding tied to the line that causes it. A change can follow every standard and
build the wrong thing, or build the right thing badly; separate lenses keep one
from hiding the other.

**Done when:** the review covered every change in scope (committed, staged,
unstaged, and new files), every lens has reported or said why it was skipped,
the findings went through `findings-check.mjs --final` with every kept P0 and
P1 carrying a verdict, and unproved findings are reported as unproved.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `code` | Review a diff, branch, commit range, or PR | `references/code.md` |
| `doc` | Review a plan, spec, or document before work starts | `references/doc.md` |

Pick the mode from the target. With no mode word and nothing in the request to
decide it, use `code`. The lenses themselves are in `references/lenses.md`.

## How it works

1. **Pin the target** with `changes.mjs review` (see `references/code.md`),
   and find the intent behind it: the plan, ticket, issue, PR description, or
   the user's request.
2. **Find the standards:** `CODING_STANDARDS.md`, `CONTRIBUTING.md`, the agent
   instruction files, `memory/guardrails.md`, lint configuration, and the
   lessons for the changed paths.
3. **Size the review to the change.** A small, low-risk diff gets one careful
   pass through all three lenses yourself. A larger one gets one subagent per
   lens, in parallel. A risky one (security, data, money, a migration, a public
   interface) adds the conditional lenses and, when one is available, a
   reviewer on a different model.
4. **Gate the findings in code:** write them to `.verify/review-findings.json`
   and run `findings-check.mjs`. Quotes are checked against the files,
   duplicates merged, and only confidence 75 or more (or P0) is kept; a kept
   finding whose quote is not in the file is unproved.
5. **Try to disprove** each kept P0 and P1, record the verdict on it, and run
   `findings-check.mjs --final`. Only its safe-to-fix list may be fixed.
6. **Report each lens under its own heading.** Do not rerank across lenses.

For a specialist or blind review, use `../../references/agents.md` and
`references/isolated-review.md`. The lead prepares a fixed copy and a narrow
packet. A fresh critic gets the exact saved prompt, not the builder's chat.
The copy is evidence, not a tool permission boundary.

Review reports; it changes code only when the user asks it to fix the findings
(or `autopilot` does). A fix changes the code every earlier check ran on, so
the checks it touches run again before anyone claims the change works.

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
