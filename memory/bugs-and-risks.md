# Bugs and Risks

Unresolved problems. Every entry keeps confirmed causes and suspected causes in
separate fields — this separation is the point of the file.

## Codex workflow coverage remains partial

Status: open
Severity: medium
Reproducibility: not applicable

**Observed:**

Phase 2 verified native package loading, installed status, a live audit, and
a shared task result on Windows CLI. Phase 3 added a live explicit scout packet.
The candidate adds real parallel writes, memory reports, and both cross-host
handoff directions. The full engineering catalog still lacks complete native
end-to-end evidence. Desktop UI and cloud
execution remain unverified. Codex hooks remain disabled.

**Affected components:**

`.codex-plugin/plugin.json`, `skills/project-memory/SKILL.md`,
`skills/project-memory/references/handoff.md`.

**Confirmed root cause:**

Unknown.

**Current hypotheses:**

None; this is a verification gap, not a known failure.

**Attempted fixes:**

The audit bridge now uses Windows MXC mode per call. Real reads work and a
read-only write control was denied. No weaker access or global setting change was used.

**Verification status:**

Named CLI cases passed. See [Phase 2 closure](../docs/plans/2026-10-25-phase-2-closure.md).

**Next verification step:**

Use the completion report for the passed handoff and bounded workflow cases.
Broader desktop and catalog trials remain optional later validation.

## Plain requests rarely invoke the plugin's skills

Status: open
Severity: medium
Reproducibility: always, in the 2026-10-21 eval

**Observed:**

In the 2026-10-21 agent-task eval (`evals/README.md`, Last measured), none of
the 24 plain-prompt runs with the plugin loaded called a plugin skill, although
all twelve were in the model's skill list. Plugin and no-plugin runs scored the
same.

The Phase 2 closure later selected build and representative multi-file review
from plain requests. A tiny review still chose direct work. Those bounded
cases do not replace a new full routing-rate measurement.

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
