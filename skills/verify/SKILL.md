---
name: verify
description: "Prove software works the way a user experiences it: generate a project verification skill that launches and drives the real app, run it to capture evidence for a change, or keep its feature map current. Use when the user asks to verify a change, test it in the real app, prove something works, check a UI for clipped or broken layout, or set up repeatable verification."
argument-hint: "[create|run|maintain] [feature, change, or URL]"
---

# Verify

Show that the change works by doing what a user does and keeping what you
saw. A passing build, a green type check, or an agent's summary is a proxy;
the running app is the evidence.

**Done when:** each user-facing behavior in scope has evidence from the real
app at a named path, or a stated reason it could not be driven, and the
evidence still exists after cleanup.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `create` | Generate the project's own verification skill | `references/create.md` |
| `run` | Drive the app for a change and capture evidence | `references/run.md` |
| `maintain` | Update the feature map after the app changed | `references/maintain.md` |

Pick the mode the request describes. With no mode word and nothing in the
request to decide it, use `run`. Ready-made scripted checks (clipped layout,
console errors, component provenance) are in `references/checks.md`.

## Standards for evidence

- **The real user path.** Click, type, call the endpoint, run the command; not
  internal setters or test-only routes.
- **Action and result.** Capture what you did and the state it produced, and
  check side effects (a row written, a file created, a message sent) alongside
  what is visible.
- **Synthetic data only** when the system can hold personal or health
  information. Evidence (screenshots, response bodies, database rows) is
  captured, so it must not contain a real person's data.
- **Evidence stays out of Git** (`.verify/` in `.gitignore`) and survives
  cleanup. Cleanup stops what this run started and nothing else.
- **Suspect the observation first** when a result contradicts the code: a
  stale build, a cached page, the wrong port.

## Works with

- **Reads:** the plan's requirements and Verification section, the diff, the
  project's verification skill and feature map.
- **Hands off:** evidence paths to `review` and to the PR body in `ship`;
  a failed check to `debug`.
- **Alone:** `run` works ad hoc in a project with no verification skill;
  `create` makes one so the next run does not start from zero.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.

Draws on pstack's `create-verification-skill`, `maintain-verification-skill`,
and `principle-prove-it-works`, and Compound Engineering `ce-test-browser`.
