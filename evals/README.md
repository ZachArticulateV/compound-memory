# Agent-task evals

Runs real agents on small repositories and grades what they leave behind. The
script tests under `tests/` check what the code decides; these runs check what
a model does with the skills. Keep the two apart: a green suite says nothing
broke, not that behavior held.

```bash
node evals/run.mjs                                   # all tasks, none/baseline/revised, 2 trials, sonnet
node evals/run.mjs --tasks typo,debug --trials 3     # a subset
node evals/run.mjs --configs none,revised --model opus
```

It needs `claude` on PATH and spends model tokens (about $0.02 to $0.60 a run
on `sonnet`). Results go to `evals/results/<date>-<model>.json` (one row per
run) and `.md` (the summary). That directory is ignored by Git: the rows hold
the agents' replies, so they stay on the machine that ran them.

## What is held equal

Every run gets a fresh fixture, the same prompt with the same closing line
(`RESULT: success|partial|failed`), the same model, `--permission-mode
bypassPermissions`, the same turn and budget limits, and no user settings or
MCP servers (`--setting-sources project,local --strict-mcp-config`). The only
difference is `--plugin-dir`: none, the plugin at `--baseline-ref` (default
`origin/main`, extracted with `git archive`), or this checkout.

## What is measured

| Metric | How |
| --- | --- |
| Correct | the task's grader, on files, commits, the index, or the reply's first word |
| False success | the reply ends `RESULT: success` and the grader says incorrect |
| Missed fault | tasks with a seeded fault: the fault was not caught |
| Needless question | an `AskUserQuestion` call, or the reply ends by asking the user to choose; every task gives what it needs |
| Time, cost, tokens | from the run's result event |
| Skills used | `Skill` tool calls in the stream |

## Tasks

| Task | Size | What it tests |
| --- | --- | --- |
| `typo` | small | One fix, nothing else touched: the cost of structure on a trivial task |
| `measure` | small | Zero supplied noise must not hide a 180% spread |
| `pr-ready` | small | Green checks on an old head plus an unresolved thread is not ready |
| `debug` | medium | A seeded off-by-one, fixed behind a test, committed |
| `review-uncommitted` | medium | The bug is in a new, untracked file |
| `commit-staged` | medium | The user's staged note must stay staged and out of the commit |

`tests/evals.test.mjs` checks each grader rejects the untouched fixture or a
wrong reply and accepts the reference outcome, so a grader cannot pass
everything.

## Last measured

2026-10-24, `sonnet`, 2 trials per task and configuration, skill invoked
(`node evals/run.mjs --invoke`), after the changes listed under Unreleased
in `CHANGELOG.md`.

| Arm | Plugin | Correct | False success |
| --- | --- | --- | --- |
| Skill invoked | previous (`origin/main`) | 10/12 | 2/12 |
| Skill invoked | current | 12/12 | 0/12 |

The current skills held the 12 of 12 measured on 2026-10-21; the previous
plugin missed `measure` in both trials this time. The small tasks stayed small:
10 seconds and $0.056 a run on average, against 9.3 seconds and $0.053 for the
previous plugin.

### 2026-10-21

`sonnet`, 2 trials per task and configuration.

| Arm | Plugin | Correct | False success |
| --- | --- | --- | --- |
| Plain prompts | none, previous, current | 6/12 each | 6/12 each |
| Skill invoked | previous | 7/12 | 5/12 |
| Skill invoked | current | 12/12 | 0/12 |

With plain prompts no run called a plugin skill, so the three configurations
scored the same. With the skill invoked, the current skills fixed the
`pr-ready`, `measure`, and `commit-staged` misses, and `typo` stayed small.

## Limits

Two trials per cell is enough to see large differences, not small ones. The
tasks are short and in one language. A model that skips the plugin's skills
gets the same score with or without them; the Skills used column shows when
that happened.
