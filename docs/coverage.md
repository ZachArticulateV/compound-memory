# Coverage

Where each upstream skill this plugin learned from now lives, and what changed
on the way in. A user who installs this plugin needs none of the skills below:
each row names the home that does what the upstream skill does, or says why it
was left out.

The parity review behind every row is `docs/benchmark/parity-2026-10-24.md`;
the earlier adoption reviews are the other files in `docs/benchmark/`.

`tests/coverage.test.mjs` reads the **Here** column: each target is a skill, a
skill and mode (resolved to that mode's reference), or a shared reference, and
the test fails when a target does not exist or a reviewed skill has no home.

## mattpocock/skills

Parity reviewed at `5beb35b` (2026-10-19), on 2026-10-24.

| Upstream | Here | What changed |
| --- | --- | --- |
| `writing-for-agents` | `write agents` | Merged with the skill-mechanics notes; says when splitting by sequence or into a new skill pays, and where shared reference goes |
| `to-tickets` | `plan tickets` | `Touches` and `Verify with` lines checked by `tickets-check.mjs`; an integration-branch fallback for wide refactors; tracker tickets become sub-issues and leave the parent issue alone |
| `code-review` | `review code` | Separate spec and standards lenses and the smell baseline, plus a correctness lens, quote-checked findings, and a disprove pass; intent is also read from issues the commits reference |
| `prototype` | `prototype` | Two variants by default; standalone mockups for sites with no code router; each variant owns its layout; the decision names the prototype branch |
| `retro` | `learn retro` | Transcript locations and a home for every candidate, a project skill among them; agent text follows `write agents` |
| `tdd` | `build work` | Test anti-patterns and seams inside the unit loop; fakes only at boundaries the project does not own; seams named before feature-sized work |
| `diagnosing-bugs` | `debug` | The tight red loop, minimized to its load-bearing parts; ranked falsifiable hypotheses; a person-in-the-loop recipe; the cause in the commit message |
| `implement` | `build work` | The unit loop, plus tickets fetched from a tracker in blocking order |
| `to-spec` | `plan plan` | Testing seams put to the user and the nearest existing tests named in Verification |
| `pr` | `ship pr` | Before-and-after evidence, a merge-danger section, and the smallest picture (pseudocode, call tree, file tree, sequence) beside the summary |
| `handoff` | `project-memory handoff` | Evidence-gated; can write to the OS temp directory when the repository must not gain files |
| `grilling` | `project-memory grill` | A mode of the memory skill, with the shared interview discipline |
| `grill-with-docs` | `project-memory grill` | Writes decisions and terms after the user confirms, to the glossary or decision folder the project already keeps |
| `domain-modeling` | `project-memory init` | The glossary with `_Avoid_` aliases, checked by the validator, which also reads a root `GLOSSARY.md` and the context glossaries `GLOSSARY-MAP.md` links; boundary questions built on concrete cases |
| `domain-modeling` | `project-memory sync` | A newly named concept gets its glossary entry |
| `wait-what` | `write plain` | Re-explains a message in the Simplified Technical English register, in the project's glossary terms |

## cursor/plugins (pstack)

Parity reviewed at `9580c23` (2026-10-23), on 2026-10-24.

| Upstream | Here | What changed |
| --- | --- | --- |
| `create-verification-skill` | `verify create` | Writes to `.claude/skills/` or `.agents/skills/`; synthetic data where personal or health data is possible; a launch model for short-lived CLIs; a worked feature file; `feature-map-check.mjs` checks the map's shape |
| `maintain-verification-skill` | `verify maintain` | The per-feature source wave, drift spot-checked before editing, the required live pass with its recovery rules, and the clean, changed, or blocked outcome |
| `principle-prove-it-works` | `verify run` | Shipped helpers under `scripts/verify/`, results in the run record, mocks only where production already isolates the outside system |
| `principle-prove-it-works` | `references/principles.md` | One principle, shared by every skill |
| `correct` | `learn correct` | The guardrails table lives in `memory/guardrails.md`, read in review; most frequent class first, one commit per class; a first correction is recorded so the second is a repeat |
| `principle-encode-lessons-in-structure` | `learn correct` | The procedure behind the principle |
| `principle-encode-lessons-in-structure` | `references/principles.md` | A rule that stays prose carries an example; the prose goes once a check enforces it |
| `recall` | `catch-up work` | Memory first, transcripts when memory is missing or older than the window; every available source reported as found, empty, or unavailable |
| `ketchup` | `catch-up chat` | Every call still waiting on the user, with its link, impact, evidence, risk, and pick; pictures only where the host renders them |
| `technical-writing` | `write docs` | The plugin's single standard for prose people read, with the global-English layer and heading and link rules |
| `automate-me` | `learn profile` | Edits the user's existing rules instead of creating a second copy; a new mode skill is user-invoked and triggered by the user's handle only |
| `unslop` | `write plain` | The full tell list, with `rewrite-check.mjs --tells` for the ones a pattern can find |
| `principle-fix-root-causes` | `debug` | The legitimate-state test, the other ways a fault hides (retries, swallowed errors, clamped values), and fixing the pattern rather than the instance |

## EveryInc/compound-engineering-plugin

Parity reviewed at `ad4d21f` (2026-10-24), on 2026-10-24.

| Upstream | Here | What changed |
| --- | --- | --- |
| `ce-brainstorm` | `plan brainstorm` | The shared interview discipline; product shapes laid out before one is chosen; evidence of need and the smallest version; example lines for conditional requirements |
| `ce-plan` | `plan plan` | One plan file grows from brainstorm; test cases per unit, `Depends on` checked by `plan-check.mjs`, a deepen pass, and `review doc` for larger or risky plans |
| `ce-work` | `build work` | Parallel waves only when no path, hidden shared surface, or runtime resource collides; workers return red-first evidence; the user's settled decisions and edits are left alone |
| `ce-simplify-code` | `build simplify` | Keeps the tests that proved each unit; efficiency findings; a safety floor; a report-first audit of any scope |
| `ce-code-review` | `review code` | Quotes checked against the file; pre-existing findings split out with `findings-check.mjs --patch`; adversarial, reliability, frontend-timing, and agent-surface lenses; migration deployment notes |
| `ce-doc-review` | `review doc` | The same findings gate as code review; premise and design lenses; deferred findings land in the document's Open questions |
| `ce-compound` | `learn capture` | Lessons in `memory/lessons/`, failed approaches recorded, claims grounded, cited commits checked by `lessons.mjs --check` |
| `ce-compound-refresh` | `learn refresh` | Lookup skips stale and retired lessons; contradictions settled from the code; prune on request |
| `ce-debug` | `debug` | Reads `memory/bugs-and-risks.md`, the lessons, and the whole issue thread first; a fix that reverses asserted behavior is the user's call |
| `ce-pov` | `plan decide` | Two evidence floors, a frozen first position, one reconcile round with a dissenting second opinion, and adoption grades |
| `ce-optimize` | `build optimize` | One-metric decision script with a noise floor; guard metrics, judged targets, a frozen measure, and a final paired re-measure |
| `ce-prototype` | `prototype` | Merged with Matt's `prototype`; a finish floor for questions judged by eye; built in the medium that shows the answer |
| `ce-commit` | `ship commit` | `changes.mjs` catches staged work the agent did not make and the user's unstaged edits swept into a commit |
| `ce-commit-push-pr` | `ship pr` | Pushes to the branch's upstream remote; the body sized to the reviewer's decision; closing versus related issue references |
| `ce-babysit-pr` | `ship watch` | No persistent watcher; `pr-state.mjs` ties checks to the current head, waits on required checks, fork approvals, and requested reviews, and handles repositories with no CI; an until-ready loop |
| `ce-resolve-pr-feedback` | `ship feedback` | Threads, review bodies, and top-level comments, every page; replies that cannot hide in a pending review; the PR body kept true |
| `lfg` | `autopilot` | Stages joined through files, each with a gate; ships through the project's own publishing process when it names one |
| `ce-handoff` | `project-memory handoff` | Evidence-gated; records the approaches ruled out |
| `ce-noslop` | `write plain` | The tell groups and the reader-can-act check |
| `wtf` | `write plain` | Asks one question for an unclear target and says when the source contradicts itself |
| `ce-test-browser` | `verify run` | Checks the instance's identity and version before driving; shared-code fan-out; outside-party steps handed to the user |
| `ce-worktree` | `build work` | Detects a linked worktree (`git.linkedWorktree` in the probe) and works in place; worktrees for parallel workers |
| `ce-explain` | not adopted | Explaining how code works is default model behavior; a skill for it would be a no-op |
| `ce-ideate` | not adopted | Idea generation sits before this plugin's loop; `plan brainstorm` starts once there is an idea |
| `ce-strategy` | not adopted | Product strategy documents are outside coding and project engineering |
| `ce-product-pulse` | not adopted | Needs product analytics this plugin does not read |
| `ce-sweep` | not adopted | Batch triage of a tracker; `ship feedback` and `debug` cover single items |
| `ce-polish` | not adopted | Needs a voice-interview service and an outside API key; `prototype ui` and `verify` cover the review loop |
| `ce-dogfood` | not adopted | Overlaps `verify run` driven against the feature map |
| `ce-test-xcode` | not adopted | Platform-specific; `verify create` names mobile as a surface but ships no simulator recipe |
| `ce-promote` | not adopted | Marketing copy is outside the plugin's scope |
| `ce-proof` | not adopted | Depends on an external sharing service |
| `ce-riffrec-feedback-analysis` | not adopted | Depends on a specific recording tool |
| `ce-retune` | not adopted | Needs a benchmark harness across model versions; tracked as a future need for this plugin's own skills |
| `ce-bakeoff` | not adopted | Multi-model bake-offs; `plan decide` covers a second opinion |
| `ce-setup` | not adopted | No configuration file is needed; skills read the project as it is |

## Left out on purpose

The parity review names each piece of an adopted skill that was left out and
why. The recurring reasons:

- **Vendor or host machinery:** cross-model job runners, multi-vendor routes,
  a specific browser driver, Figma sync, Cursor-only paths and tools, and
  stacked-PR extensions. The plugin uses the host's subagents, a lens run on a
  different model when one is available, and the host's own tools.
- **A persistent watcher:** `ship watch` reads the PR state fresh each pass
  instead of running a daemon with locked state, and the run record carries the
  attempt limits.
- **Heavy process for small tasks:** depth-gate scripts, experiment spec files,
  checkpoint protocols, and confirmation ceremonies. The skills size the work by
  judgment (decision 009), and the checks that must be exact are scripts.
