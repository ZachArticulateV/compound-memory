---
id: 010
status: accepted
date: 2026-10-19
---

# The plugin is renamed compound-memory

## Context

The plugin grew from one memory skill to twelve skills covering planning,
building, review, verification, shipping, and learning (decision 009). The name
`project-memory` described only one of them.

## Decision

The plugin is `compound-memory` ("Compound Memory"), named for the loop it runs:
each change leaves knowledge that makes the next one easier, held in committed
memory. The memory skill keeps its name, `project-memory`, so its modes and
everything they write are unchanged. The repository keeps its name.

## Why

It was picked from three proposals. It keeps "memory", which existing
users know, and names the compounding loop the engineering skills add.

## Alternatives considered

- Keeping `project-memory`: no breakage, but the name undersold eleven of the
  twelve skills.
- `project-os` and `engineering-memory`: proposed, not chosen.

## Consequences

- Engineering skills are invoked as `/compound-memory:<skill>`; the memory skill
  as `/project-memory <mode>` or `/compound-memory:project-memory <mode>`.
- Existing installs uninstall `project-memory` and install `compound-memory`.
- The marketplace entry in ZachArticulateV/claude-plugins must be renamed; it
  lives in another repository.

## Evidence / implementation

`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `README.md` (Install),
`docs/quickstart.md`, `tests/acceptance/live-engineering.test.mjs`.

## Supersedes

None.
