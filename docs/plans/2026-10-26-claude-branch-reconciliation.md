# Claude branch reconciliation

Date: 2026-10-26. Scope: all seven remote Claude branches and all local branches/worktrees.

## Cause and method

The source shipped in PR 11 matches the current local main. But PR 10 merged before
the Claude branch gained commit 9a255b5. The later build started from main and
reimplemented some of that work without reconciling the remaining branch delta.
The prior all-work-shipped report therefore overstated the checked scope.

Starting main: df91f506f8a22c55195ef2a3594a8a52bb282fa4. The working tree was clean.
The remote inventory was fetched and compared with GitHub. This checkout has one
worktree; its local phase and completion branches contain no further missing work.
Old Claude histories differ from sanitized main, so commit counts alone are not
proof of missing changes. Each older branch was compared with its main merge result.

The user authorized missing-change recovery, checks, Claude review, push, and merge.
This is a content port, not a wholesale merge of old histories. No runtime script,
hook, worker, schema, or current proof control is replaced. No install or timer runs.

## Branch inventory

| Branch | Checked head | Main merge or comparison | Disposition |
| --- | --- | --- | --- |
| claude/dazzling-cori-d3zw4n | 655d9ee | 12e6b0a | Only old prompt/plan/handoff files and sanitized historical memory differ; preserve their deliberate removal. |
| claude/kind-ride-kiczmp | ef99038 | a67402e | Only old prompt/plan/handoff files and sanitized historical memory differ; no missing runtime or skill change. |
| claude/serene-faraday-shkcdn | 63ab203 | 1afcaf2 | Only removed development records and sanitized historical prose differ; no missing runtime or skill change. |
| claude/busy-fermat-zzwb7r | 661ef40 | e1c995c | Only removed prompt/plan/eval/handoff records and sanitized historical prose differ; no missing runtime or skill change. |
| claude/ecstatic-archimedes-gtg5hf | 9a255b5 | 84c9362 | One post-merge commit: recover missing outcomes while retaining newer implementations; see the complete file inventory below. |
| claude/scratch-ship-check | 9ddad21 | 1d17823 | The two scratch commits are a noise-floor change and its exact revert; net source diff is empty and PR 4 was closed unmerged. |
| claude/sharp-sagan-qrgdv1 | 0783a7b | 0783a7b | Already an ancestor of main; preserve its deliberate removal of original prompts, old plans, evaluation output, and old handoff. |

PR 10 merged at 2026-10-25 00:00:04 UTC. Its later branch commit was made at
2026-10-25 19:05:37 UTC. PR 4 was an intentional scratch check, not unfinished work.

## Complete inventory of the 42-file missing commit

| Source file | Disposition |
| --- | --- |
| .claude-plugin/plugin.json | Recover concise description and separate counts in all three manifests; keep current version and metadata. |
| .claude/CLAUDE.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| .codex-plugin/plugin.json | Recover concise description and separate counts in all three manifests; keep current version and metadata. |
| CHANGELOG.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| README.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| docs/advanced.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| docs/architecture.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| docs/limitations.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| docs/quickstart.md | Recover relevant user guidance and description/local-work rules; keep current support limits, explicit host names and newer docs. |
| memory/current-state.md | Record current reconciled state and decision 017; do not restore stale branch claims. |
| memory/decisions/012-typed-shortcuts.md | Recover intent as decision 017; keep existing decision 012 and avoid unsupported zero-context claims. |
| memory/decisions/INDEX.md | Record current reconciled state and decision 017; do not restore stale branch claims. |
| memory/glossary.md | Record current reconciled state and decision 017; do not restore stale branch claims. |
| skills/autopilot/SKILL.md | Recover local completion and conditional hosted steps; keep newer scope, proof, and worker controls. |
| skills/autopilot/references/stages.md | Recover local completion and conditional hosted steps; keep newer scope, proof, and worker controls. |
| skills/build/SKILL.md | Shorten description without changing newer body or scope rules. |
| skills/catch-up/SKILL.md | Shorten description without changing newer body or scope rules. |
| skills/catch-up/references/work.md | Recover Windows path guidance; verify actual session metadata and retain newer handoff rules. |
| skills/cleanup/SKILL.md | Keep newer shortcut body, scoped grants and template-path fixes; shorten description. |
| skills/cleanup/agents/openai.yaml | Already present: keep both-host explicit invocation metadata. |
| skills/debug/SKILL.md | Shorten description without changing newer body or scope rules. |
| skills/grill/SKILL.md | Keep newer shortcut body, scoped grants and template-path fixes; shorten description. |
| skills/grill/agents/openai.yaml | Already present: keep both-host explicit invocation metadata. |
| skills/handoff/SKILL.md | Keep newer shortcut body, scoped grants and template-path fixes; shorten description. |
| skills/handoff/agents/openai.yaml | Already present: keep both-host explicit invocation metadata. |
| skills/learn/SKILL.md | Already meets short-description intent; keep newer wording and body. |
| skills/learn/references/retro.md | Recover Windows path guidance; verify actual session metadata and retain newer handoff rules. |
| skills/plan/SKILL.md | Shorten description without changing newer body or scope rules. |
| skills/project-memory/SKILL.md | Shorten description without changing newer body or scope rules. |
| skills/prototype/SKILL.md | Already meets short-description intent; keep newer wording and body. |
| skills/repair/SKILL.md | Keep newer shortcut body, scoped grants and template-path fixes; shorten description. |
| skills/repair/agents/openai.yaml | Already present: keep both-host explicit invocation metadata. |
| skills/review/SKILL.md | Shorten description without changing newer body or scope rules. |
| skills/ship/SKILL.md | Recover local completion and conditional hosted steps; keep newer scope, proof, and worker controls. |
| skills/sync/SKILL.md | Keep newer shortcut body, scoped grants and template-path fixes; shorten description. |
| skills/sync/agents/openai.yaml | Already present: keep both-host explicit invocation metadata. |
| skills/verify/SKILL.md | Already meets short-description intent; keep newer wording and body. |
| skills/write/SKILL.md | Shorten description without changing newer body or scope rules. |
| tests/doc-drift.test.mjs | Keep stricter existing mode-command checks; guides retain long commands and add prefixed shortcut examples. |
| tests/manifest.test.mjs | Recover separate counts and two-sentence limit; retain portable manifest and host-overlay tests. |
| tests/skill-frontmatter.test.mjs | Keep stronger existing coding-route assertions; shorter memory description still passes them. |
| tests/skills.test.mjs | Recover 300-character/two-sentence checks and explicit-shortcut/playbook checks; keep newer scoped-grant and host tests. |

## Checks

- Baseline suite: 1,056 tests, 1,029 passed, 0 failed, 27 skipped.
- Restored description/count checks failed on the old text in 15 cases.
- Focused skill, manifest, frontmatter, and doc-drift checks: 184 passed.
- Final full suite: 1,061 tests, 1,034 passed, 0 failed, 27 skipped. Exit 0.
- Strict Claude manifest validation passed. The existing listing-icon notice
  remains informational and does not change the validation result.
- Memory validation passed with no findings. Whitespace checks passed.
- Claude Opus 5.5 reviewed fixed source copies with Read, Grep, and Glob only.
  The full review and follow-ups checked descriptions, shortcut bodies and host
  flags, path guidance, local/hosted outcomes, and preserved proof controls.
  Findings were fixed. The final scoped recheck returned no findings and its
  snapshot check passed. This is a source review, not a live shipping trial.
- The final rules keep the original plain "ship it" and explicit end-to-end
  default: commits plus a PR with configured GitHub, local commits otherwise.
  Explicit local-only scope wins. Explicit publishing with no usable remote is
  blocked, not complete. CI fix pushes may occur within scope before a stop;
  no push may occur outside scope or after the stop.
- Runtime scripts, hooks, schemas, worker definitions, task routing, and passive
  continuity instructions are unchanged from the starting main.
- Lesson lookup found no matching active repository lesson. No lesson ids were
  used, so no lesson-specific check applied.

Raw local evidence: .verify/claude-branch-audit.json, .verify/claude-reconcile-baseline.txt,
.verify/claude-reconcile-red.txt, and .verify/claude-reconcile-focused.txt.
Final checks are in .verify/claude-reconcile-final-suite.txt,
.verify/claude-reconcile-manifest.txt, and .verify/claude-reconcile-memory.json.
Claude review rounds are in .verify/claude-reconcile-review.json,
.verify/claude-reconcile-recheck.json, .verify/claude-reconcile-final-review.json,
.verify/claude-reconcile-approval.json, and .verify/claude-reconcile-closure.json.
Raw model output stays under .verify and is excluded from Git.

## Completion and next step

Keep the candidate version at 2.1.0-rc.1. The local checks and source reviews are
complete. Shipping must still check the exact PR head and GitHub checks before
merge. GitHub records the final merge state. The next product step remains an
explicitly requested host setup.
