# Next Actions

A punch list, not a historical record. Items are removed once their completion is
reflected in `current-state.md`, `decisions/`, or Git.

Each item names an observable outcome. "Improve the backend" is not an action.

## Now

- [ ] Raise the rate at which plain requests invoke the right skill
  - Done when: `node evals/run.mjs` (plain prompts) shows plugin skills used on the medium tasks, with no loss on the small ones
  - Out of scope: forcing a skill on small tasks

- [ ] Run the live engineering scenarios under Codex
  - Done when: each met its Done when line, recorded in `acceptance-criteria.md` (Engineering skills, live)
  - Out of scope: changing a skill's wording before the run shows a problem

- [ ] Run `cleanup` and `handoff close` live on a sample repository with seeded rot (a checked task, a duplicated sentence, a merged-branch handoff)
  - Done when: each seeded item is reported, nothing is written before approval, and the result is recorded in `acceptance-criteria.md`
  - Out of scope: changing the rot signals

- [ ] Walk through `docs/quickstart.md` interactively on a fresh sample repository and fix every step that does not match what happens
  - Done when: each numbered step produced the described result in an interactive session, recorded in `acceptance-criteria.md`
  - Out of scope: rewriting the advanced guide

## Next

- [ ] Push the `v2.0.0` tag on `b2419f6`, the release merge commit

## Blocked

- [ ] Live Codex verification of `status`, the Outside Claude Code instructions, and the Codex launch line
  - Blocked by: a Codex CLI with model access
- [ ] Confirm filesystem case detection on a real case-insensitive macOS disk
  - Blocked by: a macOS machine or runner
