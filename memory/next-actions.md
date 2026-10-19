# Next Actions

A punch list, not a historical record. Items are removed once their completion is
reflected in `current-state.md`, `decisions/`, Git, or `archive/`.

Each item names an observable outcome. "Improve the backend" is not an action.

## Now

- [ ] Run the live engineering scenarios under Codex (owner, on their machine)
  - Done when: each met its Done when line, recorded in `acceptance-criteria.md` (Engineering skills, live)
  - Out of scope: changing a skill's wording before the run shows a problem

- [ ] Run `cleanup` and `handoff close` live on a sample repository with seeded rot (a checked task, a duplicated sentence, a merged-branch handoff)
  - Done when: each seeded item is reported, nothing is written before approval, and the result is recorded in `acceptance-criteria.md`
  - Out of scope: changing the rot signals

- [ ] Walk through `docs/quickstart.md` interactively on a fresh sample repository and fix every step that does not match what happens
  - Done when: each numbered step produced the described result in an interactive session (headless runs already covered every mode), recorded in `acceptance-criteria.md`
  - Out of scope: rewriting the advanced guide

## Next

- [ ] Push the `v2.0.0` tag on `b2419f6`, the release merge commit (owner; the tag push was not available)
- [ ] Merge the marketplace rename (claude-plugins pull request #1) once the tag exists (decision 010)
  - Done when: `/plugin install compound-memory@zacharticulatev` installs it and `/compound-memory:plan` and `/project-memory grill` both route
  - Out of scope: other plugins in that marketplace

## Blocked

- [ ] Live Codex verification of `status`, the Outside Claude Code instructions, and the Codex launch line
  - Blocked by: no Codex CLI in the development environment
- [ ] Confirm filesystem case detection on a real case-insensitive macOS disk
  - Blocked by: no macOS machine or runner
