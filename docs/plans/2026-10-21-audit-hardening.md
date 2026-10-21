# Audit hardening: reliable results across the engineering loop

Source: the 2026-10-21 source-level audit of 60 skills (owner-supplied). Each
finding below was re-checked against this checkout (`6d2b5f8`) before work
started. "Confirmed" means reproduced or read off the current file.

## Goal

The skills finish work with less user effort and never report success that a
check did not show: review sees every intended change, commits hold only the
intended work, a failed or stale check blocks a success claim, and small tasks
stay small.

## Terms

- **Run record:** the temporary JSON file a run keeps under
  `.verify/evidence/<run-id>/record.json`: task, scope, code version, checks,
  saved output, open items. Not project memory.
- **Fresh:** a check whose recorded code and environment fingerprints equal the
  current ones.
- **Unproved finding:** a kept review finding whose quoted evidence did not
  check out against the file.

## Requirements

- R1. Review covers committed, staged, unstaged, and new files by default.
- R2. A commit cannot silently include staged work the agent did not intend,
  including other hunks of a file it changed.
- R3. A supplied noise value never hides larger spread in the samples.
- R4. The verification helpers run as shipped, save their output, and do not
  flag a scrollable container as clipping.
- R5. A code change after a check makes that check stale, so review fixes force
  the affected checks to run again.
- R6. "PR created", "checks passed", and "ready to merge" are separate states,
  checked against the PR's current head.
- R7. A kept finding whose evidence did not check out is labelled unproved, and
  a serious finding is challenged before its fix is applied.
- R8. No claim that the Codex tier is a different model, and no unsourced host
  limit.
- R9. One shared run-record format, checked by a helper, with required and
  optional checks; a failed or missing required check blocks a success claim.
- R10. Each skill scales its process to the task; a one-line change needs no
  plan file, no subagents, and no run record.
- R11. Integration tests for the hand-offs, and a repeatable agent-task eval
  comparing no plugin, the previous plugin, and this one.

## Out of scope

- A durable external scheduler for autopilot (the audit's "no source handles
  well" gap).
- Rewriting decision records; they are history.
- Running any skill under Codex (no OpenAI credentials in this environment).

## Decisions

- D1. The run record lives in `.verify/` (ignored by Git), never in `memory/`.
  Lasting facts still go to memory through their owners. (Recommendation.)
- D2. The commit guard checks the index and reports; it does not stage or
  commit. The agent keeps the method. (Recommendation; decision 009.)
- D3. Helpers that a pre-approved `allowed-tools` rule covers never execute an
  arbitrary command, so a pre-approval cannot widen into a shell grant.
- D4. Verify helpers resolve Playwright from the project, not the plugin, and
  exit 3 ("not checked") when it is missing.

## Units

| Unit | Confirmed gap | Fix | Verify | Covers |
| --- | --- | --- | --- | --- |
| U1 | `review/references/code.md` prescribes `git diff <base>...HEAD`; empty with only uncommitted work (reproduced) | `scripts/changes.mjs review` lists and writes the full diff, untracked files included | regression test: staged, unstaged, untracked, no commit → non-empty | R1 |
| U2 | `ship/references/commit.md` stages with `git add -p` and commits whatever is staged | `scripts/changes.mjs snapshot` and `staged` flag unintended and pre-staged hunks | regression test: pre-staged unrelated file and pre-staged hunk in an intended file both fail | R2 |
| U3 | `measure.mjs` uses `noise ?? spread` (reproduced: `--noise 0` turns inconclusive into keep) | floor is the largest of supplied noise, observed spread, minimum effect | regression test on the audit's samples | R3 |
| U4 | `verify/references/checks.md`: console check never writes evidence and leaves the journey a comment; layout check flags `overflow: auto` | shipped helpers under `scripts/verify/`, journey module, evidence files, scroll-aware clipping | Playwright tests (skip when Playwright is absent) | R4 |
| U5 | autopilot verifies before review fixes and never re-verifies | run record fingerprints; `gate` reports stale checks | integration test: fix after verify → gate fails until re-run | R5, R9 |
| U6 | ship Done when accepts "each red check explained"; no head check | `scripts/pr-state.mjs` classifies from `gh pr view --json` | tests: no checks ≠ green, old head, pending, unresolved threads | R6 |
| U7 | `findings-check.mjs` keeps a P0 with a missing file at confidence 25, unlabelled (reproduced) | `evidence: unproved` field and section; `--final` requires a verdict on kept P0/P1 | regression tests | R7 |
| U8 | Codex tier called "a different model architecture" in five files; "8,000 bytes (Codex's limit)" unsourced | reword to what is true; tie limits to sources | doc test forbidding the phrases | R8 |
| U9 | Skill prose gaps per job (plan terms, prototype question, build red-first rule, debug rare bugs and cleanup, review depth, verify identity and cleanup, ship resume and attempt limits, learn stale lessons, catch-up word limit, write preservation, decide's outside-evidence floor) | targeted edits; `plan-check.mjs`, `rewrite-check.mjs`, lesson staleness in `lessons.mjs` | unit tests per script; anatomy tests | R10 |
| U10 | No hand-off integration tests; no agent-task comparison | `tests/handoffs.test.mjs`; `evals/` with runner and graders | `node --test`; eval run recorded in `docs/evals/` | R11 |

## Verification

- `node --test` (whole suite), `claude plugin validate . --strict`,
  `node scripts/memory-validate.mjs`, each exit code checked.
- The eval runner's report, kept separate from the script tests.

## Done when

Every unit's Verify passes on the final commit, the eval report states what ran
and what could not, and memory records the new state.

## Open questions

- Codex support facts: answered from primary sources during U8 (see
  `docs/limitations.md`).
