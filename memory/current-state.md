# Current State

What is true about this project right now. A snapshot, not a journal — obsolete
state is replaced here rather than appended to. History lives in Git and in
`decisions/`.

Updated: 2026-10-26

## Release

Version 2.1.0-rc.1 is prepared in the portable and both host manifests. It is a
release candidate. The prior published plugin installs from the
`zacharticulatev` marketplace as `compound-memory@zacharticulatev`.

The user authorized source push and merge to the
[ZachArticulateV repository](https://github.com/ZachArticulateV/compound-memory)
on 2026-10-26. The repository owner and commit identity are `ZachArticulateV`.
GitHub records the current merge and CI state. This does not install the plugin
or enable project jobs.

## Memory skill and modes

Status: working, partially verified

### Current reality

One skill, `skills/project-memory/SKILL.md`, routes eight modes (`init`,
`status`, `sync`, `handoff`, `grill`, `audit`, `repair`, `cleanup`) to one
playbook each, with four shared references and ten templates.

**Verified:**

- The suite and strict plugin validation (see Deterministic core).
- Live headless runs of every mode except `cleanup` and `handoff close` on a
  sample project; results in `acceptance-criteria.md`.

**Not verified:**

- Model behavior under any playbook beyond those runs. The tests pin the
  instructions, not what a model does with them.
- Full seeded-rot cleanup and `handoff close` in a live session. Phase 2 did verify
  removal of an accepted duplicate through the cleanup shortcut.

## Engineering skills

Status: working, partially verified

### Current reality

Eleven skills beside `project-memory` (decision 009): `plan`, `prototype`,
`build`, `debug`, `review`, `verify`, `ship`, `autopilot`, `learn`, `write`,
`catch-up`. Each has an outcome, a Done when line, a mode table, and a Works
with section, and composes through the artifacts in `references/artifacts.md`.
The skills are the plugin's own: they name no other skill set or author.
Five explicit shortcuts now read the existing memory playbooks: handoff, sync,
grill, cleanup, and repair. They do not select themselves from plain requests.
Task scope rules keep questions and plan-only requests from starting writes.

**Verified:**

- `tests/skills.test.mjs`: anatomy, paths, script pre-approvals, Codex
  metadata, hand-off targets.
- Every engineering mode met its Done when line in live headless runs on sample
  repositories (`acceptance-criteria.md`, Engineering skills, live).
- With the skill invoked, the agent-task eval scored 12 of 12 correct with no
  false success on 2026-10-21 and again on 2026-10-24, after the changes
  listed under Unreleased in `CHANGELOG.md` (`evals/README.md`, Last measured).

**Not verified:**

- The full engineering workflow set under Codex. Phase 2 verified native package
  loading, installed status, a live audit, and a shared task packet on Windows CLI.
  Desktop UI and cloud execution remain unverified.
- The guidance added on 2026-10-24 (new lenses, interview moves, loop rules)
  beyond the six eval tasks. The tests pin the text and the scripts,
  not what a model does with the new prose.
- The console and component-provenance checks in
  `skills/verify/references/checks.md`.

## Deterministic core

Status: working

### Current reality

`scripts/project-state.mjs` (state probe), `scripts/memory-validate.mjs`
(twelve checks), `scripts/auditor-bridge.mjs` (Codex tier, subagent fallback),
`scripts/memory-hygiene.mjs` (eight rot signals), the engineering scripts
(`scripts/lessons.mjs`, `scripts/findings-check.mjs`,
`scripts/tickets-check.mjs`, `scripts/measure.mjs`, `scripts/changes.mjs`,
`scripts/run-record.mjs`, `scripts/pr-state.mjs`, `scripts/plan-check.mjs`,
`scripts/rewrite-check.mjs`, and the `scripts/verify/` helpers, including
`scripts/verify/feature-map-check.mjs`; decision 011),
and three Claude Code hook events. The Codex manifest opts out of the hooks
(decision 007).

**Verified:**

- Passive continuity follow-up, 2026-10-26: 1,056 tests, 1,029 passed, 0 failed,
  27 skipped. A real Claude CLI session saved memory and a handoff from a
  supplied 50% trigger, then continued. The final memory check passed. See
  [the follow-up record](../docs/plans/2026-10-26-passive-continuity.md).
- Phase 3 Windows source check, 2026-10-26: 911 tests, 886 passed, 0 failed,
  25 skipped. The separate capture tool recorded the full run. See the Phase 3 results.
- Earlier Linux record, 2026-10-24: 757 tests, 736 passed, 0 failed,
  21 skipped. CI covers Ubuntu and Windows; CI was not rerun in this task.
- `claude plugin validate . --strict` and `node scripts/memory-validate.mjs`
  passed on the same tree.

- The live Codex auditor found a seeded memory/source contradiction. A separate
  read-only write control failed without creating a file. Model cases stay gated
  off in the ordinary suite; these live checks have separate records.

**Known limitations:**

- Filesystem case detection is untested on a real case-insensitive macOS disk.
- See `docs/limitations.md`.

## Active workstreams

Phase 1 shared work rules are built and checked in the working tree on the Phase 1 branch.
G1 passed. Claude's final recheck found no remaining P1 or P2 issue in the recovery fixes.
See [the Phase 1 record](../docs/plans/2026-10-25-phase-1-results.md).
The version 2 path adds plan graphs, lead-owned run state, immutable worker results,
and a separate command capture tool. No tool grant or release version changed.
Phase 2 setup and routing is complete for the named Windows CLI checks. G2 passed.
See [the Phase 2 closure](../docs/plans/2026-10-25-phase-2-closure.md).
Setup inspection is read-only. Explicit packets carry the same assignment and result
rules for both hosts. Packets do not enforce tools or prove current code freshness.
The external audit bridge no longer has a wildcard skill grant.
Claude hooks use script-side filtering and an off switch. Codex hooks remain off.
Worker launch, the persistent integrity queue, context bridge, and schedules
were later built in the completion pass below.

Both hosts loaded all 17 entries and passed install, upgrade, and disable checks.
The temporary Codex install was removed. Its user settings match their initial hash.
Claude's auditor had only Read, Grep, and Glob and read a real file.
Claude passed typo, build, all five shortcuts, and representative plain review cases.
Write fixtures must be outside the loaded plugin tree for normal edit checks.
Trust decline/accept, real compaction, and disabled-hook cases passed.
The earlier tiny review chose direct work; perfect routing is not claimed.
Claude reviewed a fixed source copy. Its three low findings were fixed.
The final full suite passed after those fixes.

The [Phase 0 report](../docs/plans/2026-10-25-phase-0-findings.md) qualifies older host claims.
Claude loaded the skills and passed a bounded empty-project status check.
Codex file reads now work through Windows MXC mode. The bridge selects it per call.
No ACL or global mode setting changed. Unsupported hosts fail or use the existing fallback.
The live shared task result passed submission validation; it was not lead acceptance.
Codex no-delegation is instructed, not proven by tool removal. Strict tool isolation uses Claude.
The old historical acceptance notes do not prove current full host support.
Phase 3 is complete for its bounded role and review checks. G3 passed.
See [Phase 3 results](../docs/plans/2026-10-26-phase-3-results.md) and decision 015.
Seven worker roles share a catalog. The lead stays in the main session.
Claude CLI cases ran every worker role. Codex ran an explicit scout packet.
Code work stayed within its owned file. Test review preserved a real failure.
The blind critic found a seeded bug and passed the clean control.
UI checks used real local browser evidence with app/version/origin controls.
Integrity found false and duplicate claims, supported a source-backed claim,
and kept unsupported runtime claims unknown. Canonical files stayed unchanged.

The code map excludes private/generated paths and reports coverage gaps.
It traces static import candidates, not runtime behavior.
Frozen review helpers check copied and original bytes plus actual sent prompts.
The integrity helper runs fixed captured checks on a selected copy.
Blind and integrity prompts stay separate from generic task packets.
The lead validates and wraps native reports into shared results. Submission is not acceptance.
A report alone never repairs memory. The new checked consumer records scoped
source coverage. An authorized single writer applies separate memory proposals.
Claude reviewed the source. Its material findings were fixed and checked.
The remaining units are built as a local candidate. The
[completion report](../docs/plans/2026-10-26-completion-results.md) carries final
checks and support bounds. Bounded workers, portable handoffs, opt-in due checks,
context checkpoints, local reports, lesson policy, and migration are present.
Queues and jobs remain off in this project. No commit, push, global install,
production schedule, or public release was made.

The user then chose passive continuity saves. After local Claude bridge setup,
50% measured use queues an update for the current lead. The lead saves verified
memory, a handoff, and plan/proof links, then keeps working. Pending requests
remain pending after a failed save. Codex uses the same recipe at task boundaries;
its context percentage remains unknown. See the
[follow-up record](../docs/plans/2026-10-26-passive-continuity.md).

## Intentionally deferred

- A glossary per context kept under `memory/` itself. The validator already
  reads a root glossary map and the context glossaries it links.

## Before modifying this project

- Run `node --test` before and after. Doc-drift tests pin counts stated in
  prose (modes, checks, patterns), so a change to a count is a change to prose.
- Gate every commit on the tests, `claude plugin validate . --strict`, and the
  memory validator together, checking each exit code explicitly. Piping a
  check through `tail` hides its exit code.
- `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` must keep
  identical shared metadata.
- This repository's own instructions live at `.claude/CLAUDE.md`, never a root
  `CLAUDE.md`, which fails strict plugin validation.
- Never commit run output (the .verify and evals/results directories): it
  holds agent replies and session-specific results. `.gitignore` covers both.
- A content scan for personal or session-specific text expects exactly one
  identity: the publisher's, in the manifests' author fields, the LICENSE
  copyright line, the repository URLs and install commands, and GitHub's
  merge-commit messages. The owner chose to keep it; anything else is a
  finding.
