---
id: 016
status: accepted
date: 2026-10-26
---

# Keep execution bounded and memory signals optional

## Context

The user authorized the remaining work after Phase 3. The plugin needs safe
parallel work and cross-host continuation without turning every small task
into a managed run. Memory reports must not silently become repairs.

## Decision

Use external worker copies with owned paths and base hashes. Keep lead
acceptance and combined proof separate from worker completion. Fence exported
run ownership. Carry unfinished bytes explicitly. Recheck proof after import.

Keep due signals off until enabled in ignored local state. Hooks signal work;
the lead runs the bounded specialist. The local polling process is the first
timed-report path on both CLI hosts. It does not install an OS job or repair
canonical memory. Unknown claims stay due. Changed source requires a new check.

Use one authorized memory writer with base hashes and repeat-safe proposals.
Keep inspection, proposals, and repair separate. Learning searches existing
lessons and preserves evidence and scope. One observation cannot silently
become a user-wide rule.

The short matched trial was inconclusive. No quality threshold was established.
On 2026-10-26, the user chose 50% as a passive continuity save point after local
setup. The active lead refreshes memory and saves a handoff without ending the
session. Missing usage stays unknown. Task boundaries provide a Codex fallback.
Setup and migration preserve owned fields and refuse to erase later user work.

## Consequences

Version 2.1.0-rc.1 is a local candidate. It does not certify desktop/cloud
surfaces, every model, or all third-party workflow catalogs. Process controls
and source checks remain distinct from prose instructions. Disconnected copies
still require host-confirmed stop evidence. Unconfirmed stops block retries.

See [operation and rollback](../../docs/operations.md),
[context policy](../../docs/context-policy.md), and
[completion results](../../docs/plans/2026-10-26-completion-results.md).
