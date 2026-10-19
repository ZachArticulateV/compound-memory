# Benchmark: EveryInc/compound-engineering-plugin

How Compound Engineering (CE) works, what it does well, where it falls short,
and which of its patterns this plugin should consider.

Reviewed at upstream `main` commit `2e41b44` (v3.31.0, 2026-10-17), on
2026-10-18. Every claim below was read from source; the ones marked
**checked** were re-verified against the file after the first review.

## What it is

A plugin of 36 skills that runs one loop: brainstorm, plan, work, simplify,
review, compound. The compound step writes a learning to `docs/solutions/`,
and later plan and review runs read it. One `skills/` tree ships to 14 agent
hosts through thin per-host manifests.

The shape matches this plugin's architecture: each `SKILL.md` is a short
router (22 to 122 lines) that says which `references/*.md` file to read at each
step, and deterministic work lives in bundled scripts (about 50k lines of
Python, bash, and Node). Subagents are generic agents seeded with a persona
file, which is how the same skills run on every host.

Test suite: 4,601 tests, 4,588 passed, 12 skipped, 1 failed. The failure needs
full Git history and the clone was shallow. CI fetches full history.

## How the multi-agent workflows work

### `ce-code-review`

1. `review-scope.py` sets a floor: migrations or 200 or more changed
   executable lines force a full review. Below the floor the model picks lite
   (no subagents), focused (one adversarial read), or full. The floor can only
   raise depth.
2. Correctness always runs. Up to 15 more reviewers are picked by the model from
   the diff, then launched as one concurrent batch.
3. Each reviewer returns fixed JSON: severity P0 to P3, confidence in
   {0, 25, 50, 75, 100}, and a quoted line for any finding at 75 or higher.
4. `findings-mechanics.py` merges (**checked**, lines 124-130 and 218-229):
   a finding at 75 or higher without a quote drops to 50; a finding below 75 is
   suppressed unless it is P0; agreement raises confidence only when a verified
   cross-model peer is among the agreeing reviewers. Same-model agreement never
   promotes.
5. One validator subagent re-checks every P0 and P1 finding. In eight
   protected subjects (memory safety, concurrency, auth, injection, and others)
   a rejection must cite evidence, otherwise the finding stays as unresolved.
6. Merge and report run in two separate leaf subagents that read one JSON
   handoff file, because a six-reviewer round was exhausting the dispatch
   context.
7. Report-only by default. Applying needs `apply:local`. It never pushes.

Typical full run: 7 to 9 subagents plus one external model. Maximum: about 20.

### `ce-work`

- Independent plan units run as parallel waves of 3 to 5 workers after an
  8-point safety check (shared files, hidden write surfaces, environment
  singletons, merge cost). The check is prose.
- Each worker gets a bounded packet: goal, done criteria, one unit, and only
  the requirements and decisions it cites. The orchestrator inspects the real
  tree and does not trust worker summaries.
- A cross-model author is run through a Python transaction controller
  (`unit-workspace.py`): it records what leaves the machine before dispatch,
  applies the worker's diff, fails if verification changes tracked state,
  restores exactly on failure, and allows one fallback, enforced in code.

### `lfg`

Routes the request (plan, defect, judgment, product shape, non-code result),
refuses to build without a plan verified this run or a `fixed` return from
`ce-debug`, then chains work, simplify, review, apply the most confident
mechanical fixes, compound, browser test, open a PR, and watch CI. It never
merges unless granted. A stop leaves nothing pushed that was not already
pushed.

## What makes it good

- **Deterministic facts are code.** Confidence gates, merges, transactions,
  timeouts, and fallback limits are tested scripts.
- **Distrust of its own model.** Same-model agreement does not count,
  worker summaries are not trusted, and verification that mutates tracked
  state fails.
- **One plan artifact.** Brainstorm writes requirements; plan enriches the same
  file. Stable IDs (R, U, KTD). No status field and no checkboxes: progress
  comes from Git.
- **Settled decisions.** Only decisions the user made or approved count as
  settled. Code review hides them from reviewers, then drops findings that
  only argue for the rejected option.
- **Honest limits.** The cross-model author's restrictions are documented as
  "cooperative, not a sandbox". `ce-retune` refuses to run without a
  benchmark harness.
- **Test infrastructure.** A ratcheted prompt-size budget tied to Codex's
  8000-byte limit; convention tests derived from the written authoring rules;
  byte-parity tests for duplicated scripts; an A/B behavior harness
  (`tests/skill-eval-cell/`, 206 scenarios) graded on artifacts the model
  cannot author.

## Strongest skills

| Skill | Why |
| --- | --- |
| `ce-code-review` | Discrete confidence, quote-the-line, cross-model-only promotion, evidence-gated validator, code-enforced thresholds |
| `ce-debug` | Reproduced means a named check failed; assumption audit; a competing hypothesis is required; three failed fixes escalate |
| `ce-pov` | The host freezes its position before peers answer; peers get identical evidence; two evidence floors, or the answer is "Hold" |
| `ce-work` (cross-model) | A real transaction controller with exact restore and one fallback |
| `ce-optimize` | Keep or revert is decided by `decide.mjs` with noise thresholds; it returns `inconclusive` instead of reverting silently |
| `ce-compound-refresh` | "Unverifiable is not false"; age alone is not staleness; delete needs three conditions plus an inbound-link check |
| `ce-retune` | Noise floor first, success bar registered before any change |

## Where it falls short

### Retrieval is the weak half of "compound"

- **Tag search misses block-list tags (checked).** The prescribed pattern
  `tags:.*(kw)` matches only tags on the key's line. For "subagent" it found 4
  notes; at least 7 more carry it as a list item. Four hits is above the
  "fewer than 3, broaden" fallback, so the fallback never fires.
- **The four `learnings-researcher` copies have drifted (checked).** The
  `ce-ideate` and `ce-optimize` copies never mention `applies_when`; about 75%
  of notes carry it. No parity test covers these copies.
- **`ce-debug` never reads `docs/solutions/` (checked)**, though it offers to
  write a learning.
- **Stale marks are invisible.** No reader filters `status: stale`. Refresh
  runs only on request. 0 of the repo's own 68 notes are stale-marked.
- **Notes accumulate.** Lightweight capture skips overlap detection, moderate
  overlap always creates a new note, and the taxonomy has drifted
  (`integrations/` and `integration-issues/` both exist).

### Prompt-only guarantees

Parallel-worker isolation, the 3-round CI cap, reviewer selection, most
deduplication, and auto-apply thresholds are prose. The quote gate checks
that a quote exists, not that it matches the source. The model writes the
file the merge script reads. External workers run with `--approve-all`, and
the "read-only" peer can write on some routes.

### Cost and contradictions

- Each step re-reads its reference "even when already in context"; a code
  review reads about 1,400 lines of instructions before the diff. "When
  unsure, take the heavier tier" pushes small tasks toward ceremony.
- `lfg` skips simplify below about 10 lines; `ce-work` uses 30.
- `lfg` picks any configured remote; `ce-commit-push-pr` hard-codes
  `git push -u origin HEAD` (**checked**).
- The CI budget reads "about 30-45 minutes" in prose and 8 hours in the
  script.

### Tests pin wording, not behavior

About 6,000 `toContain` and `toMatch` assertions pin phrases in prose. The
behavior harness is manual, billed, and not in CI. Judged evals cover
essentially one skill. Activation and 10 of the 14 hosts are untested.

## Candidates for this plugin

| Pattern | Fit here | Note |
| --- | --- | --- |
| Discrete confidence plus a required quote, gated in code | `audit` findings | Deterministic facts are code under `scripts/` |
| A frontmatter index built by a script, both YAML list styles | Memory lookup | Avoids CE's tag-grep miss |
| Parity tests for any prompt text copied across files | Any duplicated reference text | CE's drift happened exactly where parity tests were missing |
| Prompt budget tied to a real host limit, ratchet-only exemptions | `SKILL.md` size test | Already pinned; tie it to the 8000-byte Codex limit |
| Readers that skip stale-marked records | `status`, `handoff` | CE marks stale but never filters |

Not adopted: 14-host spread, six byte-copies of one 2,465-line runner, and
cross-model peers. Their cost pays only at CE's scale.
