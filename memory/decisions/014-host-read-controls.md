---
id: 014
status: accepted
date: 2026-10-25
---

# Verify read controls on each host

## Context

The legacy Windows helper could not start a file read.
The supported MXC mode passed a real read and rejected a write.
Claude and Codex expose different read tools.

## Decision

Select MXC per audit call on Windows. Keep read-only access.
Unsupported hosts fail or use the existing subagent fallback.
Never retry with weaker access or change global settings to make an audit pass.

Claude audit entry requires only Read, Grep, and Glob.
Codex command reads require a real read and a denied-write control.
App and MCP action tools must be absent.
Codex internal coordination tools may remain despite feature flags.
Do not claim that no-delegation is enforced there. Use Claude for strict tool isolation.

Keep shared result schemas as local validation contracts.
If a provider's strict decoder cannot accept a schema, return JSON and validate locally.
Do not remove shared constraints to fit a provider decoder.

## Consequences

Host evidence is limited to the tested surface and version.
CLI results do not certify desktop UI or cloud execution.
Packet submission validates a result but does not accept the task or finish the run.
See [Phase 2 closure](../../docs/plans/2026-10-25-phase-2-closure.md).
