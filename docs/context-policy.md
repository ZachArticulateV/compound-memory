# Context and memory policy

The plugin has no proven universal context threshold. It does not claim that
model quality starts to fall at 50% usage.

The chosen default after local bridge setup is a passive save at 50% measured
usage. This is a continuity preference, not a proven quality threshold. The
trigger saves a small checkpoint and queues a request for the active lead.
At the next safe task step, the lead updates memory, saves a continuation
handoff, links the current plan and proof, and keeps working. It does not ask
for routine approval, block a tool, clear context, or end the session.

A raw checkpoint is at most 4 KiB. It is not a memory update. A request stays
pending until the checked save writes the memory and handoff files. Changed
files cause a conflict instead of an overwrite. Repeat readings do not create
repeat work in the same session/model/compaction epoch. See the
[passive save recipe](../references/continuity.md) for the full contract.

An observation needs a host, session, model, epoch, time, and measured percentage.
Missing, old, cross-model, or unsupported values stay unknown. The plugin does
not turn token counts into percentages. A compaction event starts a new epoch.
A large measured drop is an explicitly inferred fallback when that event was
missed. After thirty minutes, the next active prompt/tool boundary can request
a save when usage is unknown. No idle timer process runs in the hook.

Claude's optional local status-line bridge records host-supplied usage. Setup
requires explicit authority. It records the prior field and restores only the
field it still owns. It does not overwrite a later user change. The bridge was
tested with supplied status-line inputs and settings copies. An interactive
desktop status-line session is not certified by those tests.

Setup also adds exact local command rules for the continuity helper's normal
modes and the memory validator in this project. It permits input-file writes
only under the continuity input folder. Removal removes only rules that setup added. Other
permissions and explicit deny rules remain in force. The save recipe uses the
stored command prefixes, so a routine save does not need a broad shell grant.

If the local settings file has no status-line field, an inherited project or
user display is unresolved. Setup refuses before any write. The explicit
`--acknowledge-inherited` install flag permits its temporary replacement.
Removal deletes the owned local field so the inherited display can resume.

No supported native Codex context-percentage input was established in the live
CLI trials. Keep it unknown. The Codex lead follows the shared recipe at accepted
task boundaries. This is agent-led work, not a native percentage hook. Do not
enable Codex hooks just to obtain a percentage.

Claude delivers pending requests through non-blocking SessionStart,
UserPromptSubmit, and PostToolUse context. Hooks do not run models or write
canonical memory. Explicit read-only scope leaves the request pending. Disabling
hooks or removing the local bridge stops delivery. The event output follows the
[Claude hook reference](https://code.claude.com/docs/en/hooks).

The release trial used the same source-versus-memory task in three arms on both
CLIs: no recipe, recipe without a threshold, and recipe with the trial policy.
Each arm returned the correct source value, kept missing latency unknown, and
kept plan-only work read-only. Elapsed time and host token counters were saved
in `.verify/finish/context-trial.json`. Context percentages and money cost were
unknown. These were short, single samples, not trials at measured context levels.

Result: **inconclusive**. The trial did not establish a quality threshold. The
user then chose 50% for passive continuity saves on 2026-10-26. The trial can show
basic policy compliance and observed overhead only. A later calibration needs
repeated matched tasks, several measured context levels, seeded relevant facts,
independent quality checks, and a noise analysis per model. Retain unknowns in
all reports. A passed percentage-crossing test is not a quality result.
