# Create a verification skill

Generate a project-local skill that launches the app, drives it the way a user
does, and captures evidence. You are writing for the next agent, who will read
it cold, mid-task, without ever having seen the app.

## 1. Interview the repository

Answer these from the code; ask the user only what you cannot observe.

- **Surface:** what a user touches: web UI, CLI or TUI, desktop app, API,
  mobile app, library. Pick the primary one and note the others.
- **Run:** the project's own dev command, ports, environment variables, seed
  data, and how login works.
- **Drive:** existing harnesses first (Playwright or Cypress specs, a debug
  port, curl-able endpoints, expect scripts). Then a generic recipe: a browser
  over CDP for web and Electron, tmux or a PTY for a CLI, HTTP for a service.
- **Observe:** screenshots, accessibility snapshots, terminal transcripts,
  response bodies, logs, exit codes, database state.
- **Isolate:** whether two instances can run side by side. If not, the skill
  says so and refuses to drive an instance it did not start.
- **Data:** whether the app can hold personal or health data. If so, the skill
  seeds synthetic records and never logs into a real account.

If the checkout does not build or start, fix that first or report it exactly; a
skill written against a broken base teaches wrong steps.

## 2. Write the skill

Write `.claude/skills/verify-<app>/SKILL.md` (or `.agents/skills/` when the
project keeps its skills there) with frontmatter (`name: verify-<app>` and a
description naming the app, its surface, and when to use it) and these
sections, each filled from what the interview found:

- **Launch:** the exact command, and how to tell the app is ready. Ready means
  usable, not just that a process answers. Launch works from an empty data
  directory, including migrations and seed data. Include teardown.
- **Doctor:** one read-only check that this instance is worth driving: process
  up, right build, port owned by this run, login valid.
- **Drive:** the harness recipe with this repository's real selectors and
  commands. Prefer stable handles (accessible names, data attributes, routes)
  over coordinates.
- **Evidence:** what to capture for a proof and where (`.verify/evidence/<run-id>/`).
- **Cleanup:** stop what this run started; never kill by process name. Remove
  scratch state, keep the evidence.
- **Helpers:** any script the skill ships, executable, with its invocation
  shown. Copy the checks from `references/checks.md` that fit the surface.

Add `.verify/` to `.gitignore`.

## 3. Seed the feature map

Create `features/README.md` beside the skill (the index: baseline
preconditions, driving conventions, proof rules) and one file per user-facing
feature, starting with the top three to five. Each feature file has an H1, a
one-paragraph description of what the user sees, and four sections in order:

1. `Sub-features`: short IDs, one line each.
2. `How to get to it (user POV)`: every entry point a user has.
3. `Driving it with <harness>`: preconditions, then each user action paired
   with its exact command and observable result.
4. `Gotchas`: traps that waste or invalidate a run.

When the seed data lacks what a journey needs, the journey reports the failure
and the reason goes in Gotchas. Weakening a journey until it passes defeats the
map.

## 4. Prove the skill before handing it over

Follow the generated skill end to end once: launch, doctor, drive one mapped
feature, capture evidence, clean up. Then confirm the evidence still exists.
Fix whatever failed and run cleanup after every failed attempt. A generated
skill that was never run is a draft. If you proved it somewhere other than the
real target (a container instead of the real machine), list each step the stand-in did that the
target will not.

Point the user at `verify maintain` for keeping the map current.
