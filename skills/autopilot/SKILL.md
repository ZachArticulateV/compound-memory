---
name: autopilot
description: "Take a request from idea or bug report to a reviewed, verified pull request without stopping, by running this plugin's skills in order: plan or debug, build, simplify, verify, review, learn, and ship. Use when the user asks for hands-off, end-to-end, or autonomous work, such as \"take it all the way\", \"just do it\", or \"lfg\"."
argument-hint: "[feature, bug, issue, or plan path]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/findings-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *)
---

# Autopilot

Carry one request to its end state without waiting on the user: for a code
change, an open pull request with CI decided, the change verified and
reviewed, and everything unresolved written where the user will see it.

**Done when:** the PR is open with its URL in hand, CI is green or each red
check is explained, and open items are in the PR body; or the run stopped,
said why, and pushed nothing that was not already pushed.

## Route by what the request is

| The request is | Start with |
| --- | --- |
| A plan path, or a plan written this session | `build work` on that plan |
| A report of broken or wrong behavior | `debug` |
| A choice the user has not settled | `plan decide`, then continue only if the verdict supports a change |
| A feature whose shape is unclear, with the user present | `plan brainstorm`, then `plan` |
| A feature whose shape is unclear, unattended | `plan`, recording assumptions as open questions |
| A result that is not a code change (an explanation, a prototype, a review) | that skill alone; its result ends the run |
| Any other code change | `plan` |

When unsure, take the route that asks more of the evidence.

## The run

Each stage's reference is the skill it names; `references/stages.md` gives what
each stage passes to the next and the gate it must clear.

1. **Work source:** an implementation-ready plan (from `plan`), or a fixed
   defect (from `debug`). Large plans go through `plan tickets`.
2. **Build:** `build work` on the plan or tickets.
3. **Simplify:** `build simplify` on the branch diff, unless it is a few lines.
4. **Verify:** `verify run` for every user-facing behavior.
5. **Review:** `review code` against the plan; apply the findings its fix rule
   allows, and keep the rest as open items.
6. **Learn:** `learn capture` when the run produced a lesson the code, tests,
   and plan do not carry.
7. **Ship:** `ship commit`, `ship pr`, then `ship watch` until CI is decided.
   With no Git remote, stop at local commits.
8. **Report** with `catch-up chat`.

## Working without a user

Ask questions only in `plan brainstorm`, and only when the user is present.
Otherwise decide, record the decision and its reason as an open item, and keep
going: reversible work is done and shown for correction afterward. Stop, and
say why, when the work source cannot be produced, a stage returns without the
evidence its gate asks for, a decision the user settled turns out to be wrong,
or the next step cannot be undone and the user has not granted it (a merge, a
force-push, deleting data). Merging stays with the user unless they granted it
for this run.

## Works with

Every other skill in this plugin, through the files in
`../../references/artifacts.md`. In a project with memory, finish with
`/project-memory sync` or a handoff when the work spans sessions.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file.

Draws on Compound Engineering `lfg`.
