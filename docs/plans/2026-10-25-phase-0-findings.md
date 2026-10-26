# Phase 0 findings

Date: 2026-10-25, America/Denver.
Plan: [Compound Memory development plan](2026-10-25-compound-memory-development-plan.md).
Scope: U1 baseline, U2 coverage, U3 host support.

## Result

The Phase 0 records are complete.
G0 is met for shared contract design.
Host runtime checks remain partial or blocked where stated below.
No Phase 1 feature was built.
No install, global setting, schedule, commit, push, or release was made.

Use the [coverage map](../coverage.md) for replacement scope.
Use the [host matrix](../host-support.md) for support claims.
These findings qualify the older claims in repository memory and limitations.
They do not silently turn those older claims into current proof.

## U1: Baseline

| Item | Observed result |
| --- | --- |
| Source | e47e021ad51b3a08cde6576749161c94132b5e13, branch main, tracking origin/main. No fetch or pull was used to alter it. |
| Starting work | Only the existing untracked docs/plans/ files. They were preserved and updated. |
| Versions | Node v24.20.0; Claude Code 2.1.310; Codex CLI 0.162.1. |
| Whole script suite | node --test: 757 total; 732 passed; 0 failed; 25 skipped. Exit 0. About 170 seconds. |
| Skipped checks | 19 live model acceptance cases were gated off. Six browser checks lacked local Playwright. No package was installed. |
| Claude manifest | Strict validation passed. A missing listing icon was a non-blocking directory warning. It was not a manifest error. |
| Memory format | 23 files scanned. No structural findings. Exit 0. This does not establish truth. |
| Memory hygiene | Eight signal types checked. No candidates. This does not establish truth. |
| State probe | All five core memory files. Eleven decision records. No active handoff. Four source-change signals. |

The source-change signals name memory/acceptance-criteria.md, memory/bugs-and-risks.md,
memory/lessons/field-regex-crosses-lines.md, and memory/lessons/nested-node-test-context.md.
A source change is a reason to inspect a claim.
It is not proof that the claim is false.

### Conflicting and stale claims

| Source claim | Phase 0 disposition | Follow-up owner |
| --- | --- | --- |
| memory/current-state.md says the live Codex auditor is unverified. docs/limitations.md describes a successful 0.147.0 run. | Keep the latter as a historical reported sample. The raw run was not recovered in this checkout. Neither proves current host behavior. | U11/U29: current controlled auditor test. U31: align release and memory text. |
| memory/acceptance-criteria.md reports twelve skills discovered with Codex 0.163.0. | Historical report only. Installed CLI is 0.162.1. No install or discovery claim is promoted from that note. | U8/U11: version-bound install and discovery check. |
| memory/next-actions.md says Codex verification is blocked by no model access. | A model answered now. File reads are blocked by Windows process setup instead. Full skill verification remains open. | U11: diagnose local setup and repeat the bounded probe. |
| docs/limitations.md says -s read-only makes the Codex tier unable to write. | Too broad. Filesystem limits do not alone remove external action tools. Current child read did not succeed, so isolation is not validated. | U10-U12 and A10-A14: inspect actual tools and test denied actions. |
| Manifest description calls the auditor a separate read-only process. | Applies only to a properly restricted CLI path. A same-host subagent fallback is a different tier. | U8/U31: state the tier and observed limits. |
| project-memory says to approve bundled script prompts because the scripts are read-only inspectors. | Inaccurate as a blanket rule. auditor-bridge launches a model process and writes temporary output. A skill cannot grant user authority. | U9: classify script effects and remove the blanket approval instruction. |
| build's done rule includes commits and a feature branch. | Conflicts with shared-tree workers that may not mutate Git. | U12/U16: worker completion means result plus proof. Only the lead owns shared-tree Git changes. |
| Old Linux test counts differ from this Windows run. | Keep dates and platforms distinct. The six missing browser cases explain part of the skip count. A count is not a cross-platform support claim. | U29/U31: retain a host matrix. |
| Plain request routing is complete. | Not established. Saved acceptance notes report 0/24 plain-prompt skill uses. Invoked-skill evals answer a different question. | U9/A09 and U29/A30. Preserve small-task controls. |

The whole suite is useful evidence for the current script contracts.
It does not prove the planned roles, parallel runner, timer, or context policy exist.
All those features remain planned.

## U2: Full catalog coverage

All 132 catalog entries have a row in docs/coverage.md.
The scope includes installed Compound Engineering 3.32.2, Matt Pocock skills, and Cursor pstack.
The map records fixed remote revisions and draft entry states.

There are 60 covered outcomes, 49 partial outcomes, 13 gaps, and 10 outside-core entries.
Covered means current instruction coverage.
No whole-library runtime replacement claim is made.

The main additions are durable work state, specialist roles, safe parallel work,
blind review, code maps, guided setup, issue and feedback intake, and source-backed product choices.
Formal proof, iOS tooling, and vendor-specific services stay optional.
U25 now has a concrete scope map and acceptance samples.

## U3: Host checks

Claude plugin load and the twelve skill names were observed in the init event.
The review session used only Glob, Grep, and Read.
No MCP tool appeared in that tool list.
The human-requested review completed and returned eight findings.

The status smoke invoked the real namespaced skill.
Initial attempts exposed test-fixture and command-form limits.
The final probe loaded the skill and read its status playbook.
Both permitted Node checks exited 0. No action was denied.
The probe selected the fixture root and found no memory directory.
The validator reported memory-missing as information, with no files to scan.
The README marker stayed unchanged. No memory files were created.
This passes the bounded empty-fixture status smoke, not all status cases.
Do not count an earlier partial attempt as a pass.

The Codex model session completed, but its first file read failed.
Windows denied access during setup of the local read-only process.
The model reported zero mcp__ tools.
The lesson's combined check needs both tool exclusion and a working read.
That check is incomplete.
No plugin status result or auditor result is claimed for Codex.

Claude hooks were disabled in the live probes.
Codex hooks remain disabled in the package manifest.
No new role, scheduler, percentage signal, cancellation path, or cross-host resume was exercised.
See docs/host-support.md for the source and next check for each row.

## Claude review decisions

The review used Claude Code 2.1.310.
The init event identified claude-opus-5-5.
It was a fresh restricted process, with no shell, agent, or write tool.
Its findings were checked against source before plan changes.

| Finding | Decision | Plan change |
| --- | --- | --- |
| Integrity roles that need shell commands cannot claim a read-only tool grant. | Accept. | Lead runs deterministic checks. Integrity reviewer receives outputs and read-only files. Mark enforced and instructed limits per host. U10-U12, U15. |
| A read-only critic cannot inspect a Git commit with file tools alone. | Accept. | Lead prepares a frozen worktree or copy. Save fingerprints before and after. A14 tests a changing target. |
| The lead can leak builder bias through the critic prompt. | Accept. | Build packets from approved source fields. Capture and inspect the actual sent prompt. U14/A14. |
| Bundled-script approval prose is too broad. | Accept. | Add the baseline gap and U9 correction. Keep existing user authority intact. |
| build's commit rule conflicts with shared-tree workers. | Accept. | Add a worker-specific completion rule to U12/U16. |
| Context signal setup could change a user's status line. | Accept. | Make bridge setup explicit and opt-in. Preserve and restore owned fields. Headless fallback is unknown percentage. U10/U23. |
| Queue hook switch and startup packet overlap are unclear. | Accept. | Define a project-local enable flag. Default is off. One SessionStart output owner. Test enabled, disabled, and compact sources. U10/U22/U23. |
| External lesson source is missing; release wording is too broad. | Accept with source correction. | The lesson is in the owner's AI OS, not this package. Record its source and self-contained check. Keep release corrections in U31. |

The reviewer said it could not see skills.
The actual init event listed all twelve.
Discovery is therefore observed, even though the review had no Skill tool.
The later smoke separately tested a Skill call.

Claude then reread the changed plan in a second restricted review.
It found four task-level details and one planned-versus-shipped wording gap.
The plan now assigns the build skill files, changing-target check, status-line restore,
and both queue-flag states to named tasks.
The host document now labels the hook design as future work.
These are document corrections. They are not runtime passes.

## Lesson use

External lesson: lesson-2026-09-30-codex-read-only-not-app-safe.
Source: the owner's AI OS Wiki/Lessons/2026-09-30 - Codex read-only sandbox does not stop app and MCP actions.md.
This private workspace note is not a plugin dependency.
Its portable rule is to inspect real tool access and prove a file read.

Claude review check: exact tool list had only Read, Grep, and Glob; file reads succeeded.
Codex check: reported zero mcp__ tools; file read failed before launch.
Codex result: incomplete, not passed.
Do not copy old flags as a universal host guarantee.

The repository lesson nested-node-test-context applies to nested test harness work.
No new nested test or child model process was started inside node --test here.
The baseline suite passed. Its future harness control remains A29.

## Evidence and limits

Raw output is local and ignored under .verify/phase0-2026-10-25/.
Do not commit model transcripts or machine-specific output.

| Evidence file | Purpose |
| --- | --- |
| baseline-tests.tap and baseline-tests.exit.txt | Current whole-suite result and skips. |
| claude-manifest.txt and claude-manifest.exit.txt | Parsed strict manifest result. |
| memory-validation.txt, project-state.txt, memory-hygiene.txt | Current deterministic inspections. |
| ce-map.json, matt-pstack-map.json | Source inventory used to write the durable coverage map. |
| claude-review.jsonl | Actual init tools, plugin names, model, file reads, and review result. |
| claude-recheck.jsonl | Claude's second document review and its remaining task-detail findings. |
| claude-status.jsonl, claude-status-corrected.jsonl, claude-status-final.jsonl | Failed setup, partial command grant, and final status probe. |
| codex-smoke.jsonl | Model reply and failed local file-read process. |

The CLI exit code is not the workflow result.
A model can return exit 0 while reporting denied or blocked work.
An early validation capture returned prose instead of a validation object.
It was rejected as evidence and replaced with direct strict JSON validation.

These probes are small observations, not reliability trials.
Future A30 and A31 checks still need controlled repeated runs.
The existing broad live acceptance suite was not enabled.
No baseline source code changed.

## Document checks

- Plan checker: passed. All 22 requirements have task coverage.
- Task graph: 31 tasks and eight gates. No cycles or unknown targets.
- Acceptance links: all task references resolve to the 32 cases.
- Coverage map: 132 rows. The four coverage counts total 132.
- Local links: 73 resolved across the six documents.
- Whitespace: no trailing whitespace in the six documents.
- Existing document and manifest tests: 21 passed, none failed or skipped.
- Working tree: only the six documentation files are new or changed. Runtime code is unchanged.

## Gate and next step

U1, U2, and U3 now have durable deliverables.
A01 and A02 have source-backed records.
A03 has a completed truth matrix with partial and blocked runtime cases.
G0 requires explicit source conflicts and host unknowns. That condition is met.
G2, G3, G4, G5, G6, and G7 are not passed by Phase 0.

Next: authorize Phase 1, then start U4.
Define the shared plan, task, result, proof, and ownership contracts first.
U11 owns the Codex environment retest before Codex runtime support is claimed.
Do not start production build work from this Phase 0 report alone.
