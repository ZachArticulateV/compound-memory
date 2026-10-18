# Next Actions

A punch list, not a historical record. Items are removed once their completion is
reflected in `current-state.md`, `decisions/`, Git, or `archive/`.

Each item names an observable outcome. "Improve the backend" is not an action.

## Now

- [ ] Run `ship watch` and `ship feedback` on a real GitHub pull request with CI, and the live engineering scenarios under Codex
  - Done when: each met its Done when line, recorded in `acceptance-criteria.md` (Engineering skills, live)
  - Out of scope: changing a skill's wording before the run shows a problem

- [ ] Decide whether the plugin keeps the name `project-memory` now that it ships engineering skills
  - Done when: the owner chose, and either nothing changes or the manifests, README install lines, and marketplace entry carry the new name
  - Out of scope: splitting the plugin

- [ ] Run `cleanup` and `handoff close` live on a sample repository with seeded rot (a checked task, a duplicated sentence, a merged-branch handoff)
  - Done when: each seeded item is reported, nothing is written before approval, and the result is recorded in `acceptance-criteria.md`
  - Out of scope: changing the rot signals

- [ ] Walk through `docs/quickstart.md` interactively on a fresh sample repository and fix every step that does not match what happens
  - Done when: each numbered step produced the described result in an interactive session (headless runs already covered every mode), recorded in `acceptance-criteria.md`
  - Out of scope: rewriting the advanced guide

## Next

- [ ] Tag `v1.1.0` on main (merged 2026-09-29, untagged as of 2026-10-17) and set its changelog date
- [ ] Point the ZachArticulateV/claude-plugins marketplace entry at `v1.1.0`
  - Done when: `/plugin install project-memory@zacharticulatev` installs 1.1.0 and `/project-memory grill` routes
  - Out of scope: other plugins in that marketplace

## Blocked

- [ ] Live Codex verification of `status`, the Outside Claude Code instructions, and the Codex launch line
  - Blocked by: no Codex CLI in the development environment
- [ ] Confirm filesystem case detection on a real case-insensitive macOS disk
  - Blocked by: no macOS machine or runner
