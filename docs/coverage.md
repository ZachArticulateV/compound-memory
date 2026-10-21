# Coverage

Where each upstream skill this plugin learned from now lives, and what changed
on the way in. The reviews behind it are in `docs/benchmark/`.

`tests/coverage.test.mjs` reads the **Here** column: each target is a skill, a
skill and mode (resolved to that mode's reference), or a shared reference, and
the test fails when a target does not exist.

## mattpocock/skills

Reviewed at `49dd158` (2026-10-09). The earlier memory-focused adoption is in
`docs/benchmark/mattpocock-skills.md`.

| Upstream | Here | What changed |
| --- | --- | --- |
| `writing-for-agents` | `write agents` | Merged with the skill-mechanics notes and Compound Engineering's size and path rules |
| `to-tickets` | `plan tickets` | Adds `Touches` and `Verify with` lines and a script that checks the graph and parallel collisions |
| `code-review` | `review code` | Keeps the separate spec and standards lenses and the smell baseline; adds a correctness lens, quote-checked findings, and a disprove pass |
| `prototype` | `prototype` | Two variants by default; standalone mockups for sites with no code router |
| `retro` | `learn retro` | Adds transcript locations and a home for every candidate |
| `tdd` | `build work` | The test anti-patterns and seams, inside the unit loop |
| `diagnosing-bugs` | `debug` | The tight, red-capable loop standard and the ways to build one |
| `implement` | `build work` | Folded into the unit loop |
| `to-spec` | `plan plan` | Testing seams in the plan's Verification section |
| `pr` | `ship pr` | Before-and-after evidence and a merge-danger section in the PR body |
| `handoff` | `project-memory handoff` | Adopted in 1.1.0 |
| `grilling` | `project-memory grill` | Adopted in 1.1.0, as a mode |
| `grill-with-docs` | `project-memory grill` | Adopted in 1.1.0, evidence-gated |
| `domain-modeling` | `project-memory init` | The glossary with `_Avoid_` aliases, checked by the validator |
| `wait-what` | `write plain` | Re-explaining a message plainly, in the project's glossary terms |

## cursor/plugins (pstack)

Reviewed at `d1715e0` (2026-10-17).

| Upstream | Here | What changed |
| --- | --- | --- |
| `create-verification-skill` | `verify create` | Writes to `.claude/skills/` or `.agents/skills/`; requires synthetic data where personal or health data is possible |
| `maintain-verification-skill` | `verify maintain` | Keeps the per-feature source wave, the required live pass, and the clean, changed, or blocked outcome |
| `principle-prove-it-works` | `verify run` | Backed by shipped helpers (clipped layout, console errors during a journey) under `scripts/verify/`, and results kept in the run record |
| `principle-prove-it-works` | `references/principles.md` | One principle, shared by every skill |
| `correct` | `learn correct` | The guardrails table moves to `memory/guardrails.md`, read in review rather than loaded every session |
| `principle-encode-lessons-in-structure` | `learn correct` | The procedure behind the principle |
| `principle-encode-lessons-in-structure` | `references/principles.md` | One principle, shared by every skill |
| `recall` | `catch-up work` | Reads the memory tree first, transcripts only when memory does not cover the topic |
| `ketchup` | `catch-up chat` | Pictures only where the host renders them |
| `technical-writing` | `write docs` | The plugin's single standard for prose people read |
| `automate-me` | `learn profile` | Edits the user's existing rules instead of creating a second copy |
| `unslop` | `write plain` | The tell list, folded into the rewrite checks |
| `principle-fix-root-causes` | `debug` | The legitimate-state test for guards, and fixing the pattern rather than the instance |

## EveryInc/compound-engineering-plugin

Reviewed at `2e41b44` (v3.31.0, 2026-10-17).

| Upstream | Here | What changed |
| --- | --- | --- |
| `ce-brainstorm` | `plan brainstorm` | Uses the plugin's shared interview discipline |
| `ce-plan` | `plan plan` | One plan file grows from brainstorm, as upstream; no status field |
| `ce-work` | `build work` | Parallel waves only when `tickets-check.mjs` finds no path collision |
| `ce-simplify-code` | `build simplify` | Keeps the tests that proved each unit |
| `ce-code-review` | `review code` | Quotes are checked against the file, which upstream does not do |
| `ce-doc-review` | `review doc` | Uses the same findings gate as code review |
| `ce-compound` | `learn capture` | Lessons in `memory/lessons/`, found by a script that reads both YAML list styles |
| `ce-compound-refresh` | `learn refresh` | Lookup skips stale and retired lessons, which upstream marks but still serves |
| `ce-debug` | `debug` | Reads `memory/bugs-and-risks.md` and the lessons before investigating, which upstream skips |
| `ce-pov` | `plan decide` | Keeps the two evidence floors and the frozen first position |
| `ce-optimize` | `build optimize` | One-metric decision script; a supplied noise can raise the floor, never lower it below the samples' spread; a correctness gate per candidate |
| `ce-prototype` | `prototype` | Merged with Matt's `prototype` |
| `ce-commit` | `ship commit` | A script checks the index for staged work the agent did not make, including other hunks of a file it changed |
| `ce-commit-push-pr` | `ship pr` | Pushes to the branch's upstream remote instead of always `origin` |
| `ce-babysit-pr` | `ship watch` | No persistent watcher; `pr-state.mjs` ties checks to the current head and separates checks passed from ready to merge; three fix rounds by default; "flaky" must be measured |
| `ce-resolve-pr-feedback` | `ship feedback` | |
| `lfg` | `autopilot` | Stages joined through files, each with a gate |
| `ce-handoff` | `project-memory handoff` | Already covered, evidence-gated |
| `ce-noslop` | `write plain` | |
| `wtf` | `write plain` | |
| `ce-test-browser` | `verify run` | Checks the instance's identity and version before driving, rather than trusting a port |
| `ce-worktree` | `build work` | Worktrees for parallel workers |
| `ce-explain` | not adopted | Explaining how code works is default model behavior; a skill for it would be a no-op |
| `ce-ideate` | not adopted | Idea generation sits before this plugin's loop; `plan brainstorm` starts once there is an idea |
| `ce-strategy` | not adopted | Product strategy documents are outside coding and project engineering |
| `ce-product-pulse` | not adopted | Needs product analytics this plugin does not read |
| `ce-sweep` | not adopted | Batch triage of a tracker; `ship feedback` and `debug` cover single items |
| `ce-polish` | not adopted | Needs a voice-interview service and an OpenAI key; `prototype ui` and `verify` cover the review loop |
| `ce-dogfood` | not adopted | Overlaps `verify run` driven against the feature map |
| `ce-test-xcode` | not adopted | Platform-specific; `verify create` names mobile as a surface but ships no simulator recipe |
| `ce-promote` | not adopted | Marketing copy is outside the plugin's scope |
| `ce-proof` | not adopted | Depends on an external sharing service |
| `ce-riffrec-feedback-analysis` | not adopted | Depends on a specific recording tool |
| `ce-retune` | not adopted | Needs a benchmark harness across model versions; tracked as a future need for this plugin's own skills |
| `ce-bakeoff` | not adopted | Multi-model bake-offs; `plan decide` covers a second opinion |
| `ce-setup` | not adopted | No configuration file is needed; skills read the project as it is |
