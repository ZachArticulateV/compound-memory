# Code review

## 1. Pin the diff

Use the fixed point the user named (a commit, branch, tag, or PR). With none,
compare against the merge base with the default branch, and include
uncommitted changes. Capture the diff command once
(`git diff <fixed-point>...HEAD`) and the commit list. Confirm the ref resolves
and the diff is not empty before starting any subagent.

## 2. Gather what each lens needs

- **Intent** for the spec lens: the plan file, ticket, issue, PR body, or the
  user's words. With none, the spec lens reports "no spec available".
- **Standards** for the standards lens: every file that says how code here
  should be written, plus `memory/guardrails.md` and the lessons for the
  changed paths:

  ```bash
  node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --paths <dir>,<dir>
  ```

## 3. Run the lenses

Always run **spec**, **standards**, and **correctness** from
`references/lenses.md`. Add a conditional lens when the diff calls for it, and
say in one line why you added it.

Start one subagent per lens, all at once. Each gets the diff command, the
commit list, its lens text, and only its own inputs (the spec lens gets the
spec, the standards lens the standards). Each returns findings as JSON in the
shape `../../references/artifacts.md` gives, plus at most 400 words of prose.

When another model is available (for example the Codex CLI), run the
correctness lens on it as well and set `model` on its findings. Agreement
between two models raises confidence; agreement between two subagents on one
model does not.

## 4. Gate

Collect every lens's findings into one `.verify/review-findings.json` (keep
`.verify/` in `.gitignore`) and run it against a checkout of the reviewed head:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/findings-check.mjs" --input .verify/review-findings.json
```

It checks that each quote is really in the file near the cited line, merges
duplicates, and keeps findings at confidence 75 or more, or P0. It reads files
as they are on disk, so when the reviewed head is not the current tree (a PR you
have not checked out), add a worktree for it (`git worktree add`) and pass that
directory with `--cwd`. A finding about a deleted line quotes the code that
remains around it.

## 5. Try to disprove

For each kept P0 and P1, read the code yourself (or have a fresh subagent do
it) with one goal: show the finding is wrong. Drop what you disprove, with the
reason. Keep what survives. Mark what you cannot settle as unresolved: it stays
in the report, labelled, and counts toward the lens's worst finding.

## 6. Report

One section per lens, in this order: Spec, Standards, Correctness, then any
conditional lens. Under each, the findings by severity:

```markdown
**P1** `lib/queue.ts:42`: Retry runs a non-idempotent charge twice
> `retry(job)`
Why: <one or two sentences>. Fix: <one sentence>.
```

End with one line per lens: its count and its worst finding. Do not pick one
worst finding across lenses. Then the number of suppressed findings.

## 7. Fix, when asked

When the user asks to fix the findings, or `autopilot` runs review: apply the
findings at confidence 100, and those at 75 whose fix is mechanical. Run the
tests after each fix, and commit as `fix(review): <what>`. List the findings
you did not apply.
