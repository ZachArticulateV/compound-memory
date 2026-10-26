# Next Actions

Updated: 2026-10-26

## Now

The remaining development units are built for candidate 2.1.0-rc.1.
Read the [completion report](../docs/plans/2026-10-26-completion-results.md) for
final proof and host limits. Read [operation and rollback](../docs/operations.md)
for worker, handoff, memory, schedule, and migration use.
The [passive-save follow-up](../docs/plans/2026-10-26-passive-continuity.md)
records the latest source checks and the user's choice to keep sessions open.

## Next

- [ ] Install the candidate only under a new setup request.
  - Done when: the selected host loads the exact candidate and its smoke check passes.
  - Preserve: existing user settings, unrelated plugins, project memory, and prior work.
  - Boundary: the user authorized source push and merge on 2026-10-26. This does
    not install the plugin, create a release tag, or start a production timer.

## Blocked

No code task is blocked. Source push and merge are authorized for the personal
GitHub repository. Persistent setup needs a setup request. Desktop, Linux, and
macOS live checks need their target hosts.

## Optional later validation

- Measure plain-request selection rates across more tasks and models.
- Run full seeded-rot cleanup and handoff-close trials.
- Walk through setup in fresh Claude and Codex desktop sessions.
- Run the Linux CI matrix and case-insensitive macOS checks on suitable hosts.
- Calibrate context policy at several measured context levels.

These are explicit support limits. They do not permit an automatic install,
a model call, a background job, or a release. The user chose passive continuity
saves at 50% after local bridge setup. The lead saves memory and a handoff, then
keeps working. This is not a proven quality limit. Unknown context stays unknown.
