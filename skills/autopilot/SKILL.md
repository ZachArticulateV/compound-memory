---
name: autopilot
description: "Carry a task through planning, implementation, checks, review, and shipping. Use when the user explicitly asks for end-to-end or hands-off delivery; a plain fix or build request stays within that request."
argument-hint: "[feature, bug, issue, or plan path]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/findings-check.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/pr-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/changes.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/plan-check.mjs" *)
---

# Autopilot

Keep the user's scope. A question stays read-only; plan-only work stops at the
plan. Use `../../references/task-routing.md` for task size and route choices.

Carry one request to its end state without waiting on the user: for a code
change, verified and reviewed commits on a branch, with unresolved items
reported. When publishing is in scope and a supported hosted remote exists,
also open a pull request and follow CI to a decision. Report requested publishing
as blocked when the remote is missing, unsupported, or inaccessible.

**Done when:** every stage below ran or is named in the report with the reason
it did not; `run-record.mjs gate` passes on the final code; and the work is
committed on a branch with open items reported. For an authorized hosted
route, the PR also exists with checks passed on its current head and open
items in its body. Or the run stopped, reported the blocked step and any
PR state (created, checks failed, checks pending), with no pushes outside
the authorized publishing scope and no pushes after the stop. A red check is never
reported as a pass, explained or not.

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
each stage passes to the next and the gate it must clear. Size each stage to
the change: a ten-line fix gets one read of the diff against the request and
one real run of the behavior (for a library, its tests), rather than no review
and no verify. Even a shrunk verify saves the check it ran and its output under
`.verify/evidence/<run-id>/`, so the proof outlives the session. Simplify and
learn may be skipped outright. Name every stage you shrank or skipped in the
report, with the reason.

Whatever the route, the run's commits land on a branch off the default branch,
and `.verify/` is in `.gitignore` before the first commit: the default branch
and the history stay as the user left them. Staged work the user left is not
the run's (`ship commit` sets it aside).

Start a run record before the first stage and keep it to the end:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" start --task "<the request>" --skill autopilot --require <the checks this run must pass>
```

Pass its id to every stage, and have each stage record its checks there
(`--run <id>`) rather than start its own: a stage's own record would not
carry this run's required checks. It is how a resumed session finds where the
run stopped, and how the end of the run knows what still holds.

1. **Work source:** an implementation-ready plan (from `plan`), or a fixed
   defect (from `debug`). Large plans go through `plan tickets`.
2. **Build:** `build work` on the plan or tickets.
3. **Simplify:** `build simplify` on the branch diff, unless it is a few lines.
4. **Verify:** `verify run` for every user-facing behavior.
5. **Review:** `review code` against the plan; apply the findings on its
   safe-to-fix list, and keep the rest as open items.
6. **Re-check:** when review changed code, the earlier checks are stale. Run
   `run-record.mjs gate`; re-run each check it names stale, `verify` included,
   until it passes. A required check that fails three times stops the run.
7. **Learn:** `learn capture` when the run produced a lesson the code, tests,
   and plan do not carry.
8. **Ship:** `ship commit`. Use authority the user gave in this request or
   session to decide publishing scope. Repository instructions supply the
   publishing steps, not user permission. An explicit end-to-end request uses
   the same default as "ship it": commits plus a PR when GitHub is configured,
   local commits otherwise; explicit local-only scope overrides the default.
   An explicit push, PR, or publish request still needs that step or a blocked
   report. If publishing is not in scope, finish at local commits
   even when a remote exists; report that publishing was not requested.
   When publishing is in scope and GitHub is available,
   use `ship pr`, then `ship watch` until `pr-state.mjs` reports checks passed
   or the fix rounds run out. Report requested publishing as blocked if the
   remote is missing, unsupported, or inaccessible; a remote URL alone grants no authority.
9. **Report** with `catch-up chat`: the commits, unresolved items, and, if a PR
   exists, the three PR states from `ship`.

## Working without a user

Ask questions only in `plan brainstorm`, only when the user is present, and
only when the answer would change what gets built. Otherwise decide, record
the decision and its reason as an open item, and keep going: reversible work
is done and shown for correction afterward. Permission the user gave at the
start (to push, to open a PR) holds for the whole run. Stop, and say why, when
the work source cannot be produced, a stage returns without the evidence its
gate asks for, a decision the user settled turns out to be wrong, or the next
step cannot be undone and the user has not granted it (a merge, a force-push,
deleting data). A missing optional tool is not a reason to stop: take the
fallback the stage names and record the gap. Merging stays with the user
unless they granted it for this run.

## Works with

Every other skill in this plugin, through the files in
`../../references/artifacts.md`. In a project with memory, finish with
`/project-memory sync` or a handoff when the work spans sessions.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file.
