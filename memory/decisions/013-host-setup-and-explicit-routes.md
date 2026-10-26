---
id: 013
status: accepted
date: 2026-10-25
---

# Shared source with explicit host limits

## Context

The user authorized Phase 2 setup and task selection for Claude and Codex.
The hosts do not expose the same tools, hook support, or context readings.
A package file cannot prove that a host loaded or enforced it.

## Decision

Keep one source for skills, playbooks, role content, and work contracts.
Add a portable manifest while retaining both legacy manifests.
Keep Codex hooks explicitly off until live adapter and trust checks pass.

Add five explicit shortcuts that read the existing memory modes.
They do not duplicate the playbooks or auto-select themselves.
The grill procedure stays a mode, consistent with decision 005.
Core skills guide plain requests. Runtime evidence must show actual selection.

Keep setup inspection and role packets read-only.
Packets carry the current assignment, role source, result schema, and audit schema.
They report unchecked code freshness and tool access.
The lead checks those facts before dispatch.

Do not pre-approve the external auditor bridge through a wildcard skill grant.
Use the user's existing authority and the host's command rules.
Keep the integrity queue, context bridge, and schedules in their planned later phases.

## Consequences

Local package checks can pass while live host use remains blocked.
The Phase 2 report separates these results.
No user settings, status line, or installed plugin state changes as part of setup inspection.
New specialist roles still need Phase 3.
