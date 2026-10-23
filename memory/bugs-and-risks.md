# Bugs and Risks

Unresolved problems. Every entry keeps confirmed causes and suspected causes in
separate fields — this separation is the point of the file.

## Codex path verified only structurally

Status: open
Severity: medium
Reproducibility: not applicable

**Observed:**

The Codex manifest (including its hook opt-out),
`skills/project-memory/agents/openai.yaml`, the Outside Claude Code section,
and the Codex launch line are covered by structural tests and a reading of
Codex source. A live Claude Code run of `handoff for codex:` printed a correct
launch line; the Codex side has never run a skill.

**Affected components:**

`.codex-plugin/plugin.json`, `skills/project-memory/SKILL.md`,
`skills/project-memory/references/handoff.md`.

**Confirmed root cause:**

Unknown.

**Current hypotheses:**

None; this is a verification gap, not a known failure.

**Attempted fixes:**

None.

**Verification status:**

Not run in a live Codex session.

**Next verification step:**

Install the plugin in Codex, run `status` and `handoff for codex:` in a sample
repository, and record the result here.

## Plain requests rarely invoke the plugin's skills

Status: open
Severity: medium
Reproducibility: always, in the 2026-10-21 eval

**Observed:**

In the 2026-10-21 agent-task eval (`evals/README.md`, Last measured), none of
the 24 plain-prompt runs with the plugin loaded called a plugin skill, although
all twelve were in the model's skill list. Plugin and no-plugin runs scored the
same.

**Affected components:**

Every skill's `description` in `skills/*/SKILL.md`.

**Confirmed root cause:**

Unknown.

**Current hypotheses:**

- The model handles short tasks without a skill whatever the description says.
- The descriptions' trigger wording does not match how users phrase requests.

**Attempted fixes:**

`ship`'s description gained a trigger for "ready to merge" (`39e8868`); not yet
re-measured with plain prompts.

**Verification status:**

Measured once, two trials per cell, one model.

## Verify helpers' browser tests do not run in CI

Status: open
Severity: low
Reproducibility: always on CI

**Observed:**

`tests/verify-helpers.test.mjs` skips its browser cases when Playwright or
Chromium is missing, which is the case on the GitHub runners. They pass where
Playwright and Chromium are installed.

**Affected components:**

`scripts/verify/layout-check.mjs`, `scripts/verify/console-check.mjs`.

**Confirmed root cause:**

The workflow installs no browser.

**Current hypotheses:**

None.

**Attempted fixes:**

None; the not-checked path (exit 3) and the refusal to write outside the
ignored .verify directory are tested everywhere.

**Verification status:**

Browser cases verified outside CI only.
