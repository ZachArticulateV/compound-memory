# Acceptance Criteria

What "done" means for this project's features, and what evidence supports each
claim. This file exists so a partially functional project is not read as
finished because the files exist.

Status values: `unverified`, `verified`, `failing`, `not-applicable`.

A criterion moves to `verified` only with cited evidence — a test that ran, a
behavior observed, an artifact checked. Existence of code is not evidence.

Updated: 2026-10-18

## Structural core

The probe, validator, and hooks behave as `docs/architecture.md` describes.

| Criterion | Status | Evidence |
| --- | --- | --- |
| Validator checks match the documented list | verified | `tests/doc-drift.test.mjs`, 459 passed on 2026-09-29 |
| Hooks fire for every governed contract file | verified | `tests/hooks.test.mjs`, same run |
| A memory tree rendered from the templates validates clean | verified | This repository's `memory/`, validated with no findings on 2026-09-29 |
| The probe reports every governed contract file | verified | `tests/contract.test.mjs`, 459 passed on 2026-09-29 |

## Codex support

| Criterion | Status | Evidence |
| --- | --- | --- |
| The skill runs `status` in a live Codex session | unverified | — |
| `handoff for codex:` output launches a Codex session that finds memory | unverified | — |

## Onboarding

| Criterion | Status | Evidence |
| --- | --- | --- |
| The quickstart shows every mode | verified | `tests/doc-drift.test.mjs`, 459 passed on 2026-09-29 |
| Following the quickstart alone produces a committed memory tree and a handoff | unverified | — |

## Live model behavior

Headless `claude -p` runs with `--plugin-dir` on a three-commit sample CLI
project, 2026-09-29. Headless runs cannot answer questions or approve
protected writes, so interactive behavior is not covered.

| Criterion | Status | Evidence |
| --- | --- | --- |
| `init` reconstructs a brief, keeps hypotheses as hypotheses, and claims only observed runs | verified | Live run: brief marked reconstructed; bounds bug recorded with root cause Unknown; only the observed test run claimed |
| `sync` does not resolve a bug whose fix is uncommitted and unexercised | verified | Live run: attempted fix recorded, entry left open, criterion left unverified |
| `handoff for codex:` names memory files explicitly when there is no `AGENTS.md`, and prints rather than runs the launch line | verified | Live run output |
| `status` writes nothing | verified | Live run: working tree unchanged afterwards; report carried a coverage line |
| `audit` without Codex falls back to the bundled auditor, names the tier, and writes nothing | verified | Live run: subagent tier named, weaker evidence stated, working tree unchanged; findings were real |
| `repair` edits only accepted findings and leaves declined ones untouched | verified | Live run: 5 files, 33 lines added and 32 removed; declined brief finding left byte-identical; user-reported test run labelled as such |
| `grill` runs a round, waits, and writes only after confirmation | verified | Live three-round run via `--resume`: eight frontier questions with recommendations, a write proposal, and writes only after approval; working tree unchanged until then; one decision record, not one per answer |
| Modes find the skill's templates rather than composing from prose | verified | After `8fa999f`, a live handoff's tool calls read `skills/project-memory/templates/handoff.md` from the plugin; the result validated clean |
| `cleanup` reports seeded rot and writes nothing before approval | unverified | — |
| `handoff` files durable facts into their owners and `handoff close` retires a merged workstream | unverified | — |
| `init` installs the writing rule | failing | Protected `.claude/` write refused in a headless run; `init` now prints the copy command |

### Memory live tier re-run, 2026-10-18

`PROJECT_MEMORY_LIVE_ACCEPTANCE=1 node --test tests/acceptance/live-scenarios.test.mjs`
on Claude Code 2.1.302, after four harness fixes: the inherited
`NODE_TEST_CONTEXT`, `--add-dir` for the plugin directory (newer headless runs
refuse reads outside the fixture), an unattended prompt for scenarios H and J
whose one-commit fixtures read as new projects, and a worktree with real work
for scenario G (with none, the model asked what the work was in 3 of 9 runs).
Scenarios A, B, C, D, E, F, G, H, I, J, and K passed; G passed 4 of 4 after its
fixture fix. The two Codex scenarios skipped: no Codex CLI on this machine.

## Engineering skills, live

Headless `claude -p` runs with `--plugin-dir` and `--permission-mode
bypassPermissions` on a sample Node invoice repository with a seeded
off-by-one bug and no Git remote or memory tree, 2026-10-18. The sample lived
in a scratch directory and was not kept.

| Criterion | Status | Evidence |
| --- | --- | --- |
| `debug` reproduces, traces the cause, and fixes behind a regression test | verified | Live run: report in the skill's six-part shape; regression test failed before the fix (0 of 2) and passed after (2 of 2); committed |
| `learn capture` writes nothing when a test already carries the lesson | verified | Live run: "Nothing durable", no files written |
| `plan tickets` writes the plan and tickets in the artifact contract's shape | verified | Plan with R, D (with "settled by"), and U IDs; two tickets with every line the ticket check reads; `scripts/tickets-check.mjs` exited 0 |
| `build` works the frontier red first, branches off the default branch, and marks tickets done | verified | Live run: branch `invoice-line-tax` created; one commit per ticket; tightened two checks that passed vacuously; both tickets marked done |
| `review` runs the three lenses and gates findings through `scripts/findings-check.mjs` | verified | Live run: two real P2 findings, one confirmed against 200,000 random invoices; the sample's findings file passed the script with both kept |
| `verify run` drives the real CLI and keeps evidence out of Git | verified | Live run: one evidence file per behavior in the sample's evidence directory, which was added to its `.gitignore` |
| `autopilot` runs every stage or names the ones it skipped, and stops at local commits without a remote | verified | The first run skipped verify and review without saying so; after the stage-sizing rule, a second run drove the CLI, listed its assumptions, and named each skipped stage with a reason |
| `catch-up work` rebuilds state from Git and tickets when there is no memory | verified | Live run: every thread tagged; caught a change outside the plan and put it to the user as a decision |
| `plan brainstorm` writes testable requirements and records unanswered questions as assumed | verified | Live run: eleven requirements, ten open questions each with a recommended answer marked `assumed` |
| `plan decide` meets both evidence floors | verified | Live run: 2,500 cases measured in the repository (13% misrounded) plus cited outside practice, with a dissent; confidence and reversal cost stated |
| `plan` readiness catches an unproven "does not change" claim | verified | `review doc` and `learn retro` both found the plan claimed unchanged totals with no proof; after the readiness rule, a re-run plan added an equivalence test over thousands of seeded invoices and a formula that cannot drift |
| `prototype logic` records a verdict and keeps the demo off the main branch | verified | Live run: verdict as D6 in the plan; demo on a prototype branch; found a refund rounding edge |
| `prototype ui` builds two switchable variants | verified | Live run: two structurally different variants behind `?variant=`; rendered with Playwright, no console errors, arrow-key switching worked; the bar showed no variant name, which the skill asks for |
| `build simplify` removes only what earns removal | verified | Live run: no change made, with a reason for each kept guard; suite unchanged |
| `build optimize` keeps a change only past the noise floor | verified | Live run: benchmark written, seven-process samples, `scripts/measure.mjs` verdict keep at 51% faster with identical output |
| `review doc` reviews a plan with the findings gate | verified | Live run: a P1 contradiction between two decisions, confirmed by 871 differing cases; six findings kept by the script |
| `verify create` generates a skill and proves it end to end | verified | Live run: Launch, Doctor, Drive, Evidence, Cleanup, Helpers, a three-feature map; evidence survived cleanup; its layout check found the page overflows at 375 and 768 px |
| `verify maintain` corrects the map only and reports an outcome | verified | Live run: outcome "changed", three map corrections committed, app code untouched |
| `write docs`, `write agents`, and `write plain` | verified | Live runs: a task-named how-to with real outputs; an `AGENTS.md` holding only what the files cannot show; an explanation that leads with the decision |
| `learn capture` writes a lesson lookup finds | verified | Live run: one lesson, validator clean, `scripts/lessons.mjs` returns it first |
| `learn correct` fixes a repeated mistake structurally and proves the check | verified | Live run: one input module, a check whose errors name the fix, shown failing on both past commits and passing now, expiring exceptions, a guardrails row |
| `learn retro` ranks candidates with evidence and a home, applying none | verified | Live run on real transcripts: four ranked candidates, nothing applied |
| `learn refresh` retires false lessons and merges duplicates | verified | Live run on seeded lessons: the false one retired, the duplicate merged, deletion left to the user; lookup then skipped both |
| `learn profile` refuses rules history does not support | verified | Live run: one transcript, so no pattern qualified; proposed candidates and structured questions in a file, created no skill |
| `ship pr` pushes to the upstream remote and writes the PR body in its shape | verified | Live run against a bare remote: branch pushed, body drafted, stopped where `gh` had no GitHub host |
| `catch-up chat` reports in the update shape | verified | Live run resumed in an autopilot session: decisions first, each with a recommendation and what happens without an answer |
| `project-memory` infers a mode from a plain request | verified | Live run: "is memory still accurate here?" ran `status` |
| `ship watch` fixes CI at its cause and pushes | verified, scripted forge | Live run with a scripted `gh` whose CI is the fixture's real test run: traced the failure to the bad commit from the log, reverted, pushed, re-checked; it also flagged that the scripted check reused the failed run's URL |
| `ship feedback` answers every thread by verifying each claim | verified, scripted forge | Same scripted `gh`: fixed and resolved the rename, disproved the NaN claim with evidence and a pinning test, proposed rather than built the integer-cents redesign; it did not re-request review, which the skill asks for |
| A plain coding request in a repo with memory runs no memory mode | verified | Live run with stream output: no Skill call to `project-memory`; the change made and tested, kept inside the plan's scope |
| `plan brainstorm` with a human answering across turns | verified | Three resumed turns: a seven-question frontier round with recommendations, a second round raised by a constraint the user added (it kept that constraint in the requirements), and the plan file written only after confirmation |
| `autopilot` on a second stack (Python, `unittest`) | verified | Live run: routed to debug, failing tests first, fixed on a branch, every skipped stage named |
| `autopilot` on a third stack (static web form clipped on phones) keeps its evidence, branches, and keeps its evidence directory out of Git | verified | Four live runs, 2026-10-19, under `acceptEdits` with listed commands. Every run fixed the clipping, but the first three exposed gaps, each fixed and re-run: the first two kept no evidence (tightening the verify gate alone did not help; the shrunk-verify rule a small fix follows never said to save it; `bb28433`); the third committed to `main` and put its screenshots in Git (the debug route reaches neither `build work`'s branch nor `ship commit`'s exclusion; `e065254`). The fourth met all three: a fix branch with `main` untouched, the evidence directory ignored before the commit, evidence and output saved, and a layout regression test that fails 4 times on the old CSS and passes 6 of 6 on the fix. The plugin's layout check from `skills/verify/references/checks.md` failed on the original (688px page at 375px) and passed on the fix at 320, 375, 414, and 1024px |
| `ship watch` and `ship feedback` against real GitHub | verified | Read path on [pull request #3](https://github.com/ZachArticulateV/compound-memory/pull/3), 2026-10-19: watch read the three real checks, the clean merge state, and set aside an empty legacy status; feedback found no threads. Fix and reply paths on a test [pull request #4](https://github.com/ZachArticulateV/compound-memory/pull/4), 2026-10-19, under `acceptEdits` with listed commands: a seeded swap of the noise floor from the larger to the smaller value in `scripts/measure.mjs` turned the Ubuntu test check red. `ship watch` traced the failure from the check annotations when the proxy refused the logs, reproduced it locally, reverted the commit, pushed, and waited until all three checks were green, merging nothing. `ship feedback` replied to both review threads and resolved them: it agreed with the valid concern and pointed to the revert, and disproved the false `median()` claim by citing the line and the existing test, with no code change. The pull request was closed unmerged |
| The plugin installs and its skills are discovered under Codex | verified | Codex CLI 0.163.0, 2026-10-19: `codex plugin marketplace add` read the zacharticulatev marketplace, `codex plugin add compound-memory@zacharticulatev` installed 2.0.0 from GitHub at the pinned commit, and `codex debug prompt-input` listed all twelve skills with their full descriptions in the model-visible prompt |
| Any skill run under Codex | unverified | no Codex model access, so no Codex model ran |
| Live scenarios re-runnable from the suite | verified | `PROJECT_MEMORY_LIVE_ACCEPTANCE=1 node --test tests/acceptance/live-engineering.test.mjs`: 6 of 6 passed in three consecutive full runs (18 of 18), 2026-10-18, after two harness fixes (the inherited `NODE_TEST_CONTEXT`, and a fixture change that did not break its test). The review scenario passed 8 of 9 runs; the miss wrote no findings file, and the skill now says the gate applies when the lenses run inline |

## Out of scope for completion

- Live model-behavior evaluation of every playbook.
