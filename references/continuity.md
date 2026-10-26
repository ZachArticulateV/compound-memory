# Passive continuity saves

A continuity save keeps the current session running. It updates project memory
and saves a handoff for later use. It does not export a run, stop workers, clear
context, or transfer ownership. Use this recipe when a passive request is due.

The active lead is the only memory writer. At the next safe task boundary, do
the save without asking for routine approval. Finish an in-flight file edit or
check first. Keep explicit read-only requests read-only. If writes are denied,
leave the request pending and continue within the allowed scope. Do not label
a queued request or a raw context checkpoint as a completed memory update.

## Trigger and fallback

After local Claude status-line setup, the first measured reading at or above
50% queues a save. Repeat readings in the same session/model/compaction epoch
do not queue another. Prompt and tool hooks deliver a short request to the lead.
Pending reminders use increasing delays. After five notices, they occur at most
once per thirty minutes. A compaction event restores the notice. New requests
are not hidden behind older ones. Unknown usage remains unknown.
After thirty minutes, the next active prompt or tool boundary can queue a time
fallback. No idle process or new model is started by these hooks.

Codex has no verified percentage feed or enabled plugin hooks. When this recipe
is loaded during substantial authorized work, the lead uses the same command
path at accepted task boundaries and before a handoff. Use a host session ID
when available. Otherwise choose one local ID for this session and reuse it.
Use modelId `unknown` when it is not exposed. Do not invent a measured percentage.
This fallback is agent-led; it is not a native Codex percentage event.

## Save process

1. Read pending requests with the plugin's command:

   ```text
   node <plugin-root>/scripts/continuity.mjs pending <project-root> claude|codex <session-id>
   ```

   In Claude, use the command prefixes saved in
   `.verify/integrity/status-line-owner.json` by setup, under
   `continuityPermissions.commands[mode]`. Use the Bash tool in Claude, including
   on Windows. Run each Node command
   alone with quoted absolute paths. Read files with file tools. Do not join
   the helper with `cd`, file listing, or other shell commands. Local setup
   grants only the named helper modes for this project. Existing deny rules
   still take priority. A denied save remains pending; do not weaken permissions.

   For a Codex task boundary, `request` accepts an input JSON file with `host`,
   `sessionId`, `modelId`, `epoch` (use 0 if no known epoch), and
   `reason: "task-boundary"`. Reuse an epoch for repeated checks of the same
   boundary. Increment the local epoch for the next accepted task. This local
   counter is not a claim about host compaction. `handoff` and `time-fallback`
   are also supported reasons. Request creation does not save memory.

2. Check the current source, accepted work, plan, and actual test output. Refresh
   only supported facts in `memory/current-state.md` and `memory/next-actions.md`.
   Preserve unrelated content. Keep failed, skipped, and unrun checks explicit.
   Update the plan's progress or its run record under its existing ownership
   rules. Link it in the handoff. A plan-only task still does not authorize code.

3. Prepare JSON under `.verify/integrity/continuity-inputs/`. Setup grants file
   writes only in that input directory for the automatic save. It has `id`, `host`, `sessionId`,
   and `packet`. The packet has:

   - `files`: full proposed text for `memory/current-state.md`,
     `memory/next-actions.md`, and `memory/INDEX.md`. Each entry has `path` and
     `content`. An update to `memory/bugs-and-risks.md` is optional.
   - `handoff`: `path` and `content`. Use the existing branch handoff rules in
     [the handoff playbook](../skills/project-memory/references/handoff.md).
     Include a `Branch:` line and nonempty `## Objective`, `## Continue here`,
     `## Do not assume`, `## Verified`, and `## Unverified` sections.
   - `nextStep`: one concrete next step, also present under `Continue here`.
   - `references`: arrays named `plan`, `documentation`, and `evidence` with
     existing project-relative file paths. Use empty arrays only when no such
     artifact applies. Do not copy whole plans or test logs into memory.
   - `evidenceStatus`: `observed` when actual evidence files support the check,
     or `not-run`. An observed check requires at least one evidence path.

   The index must point to the chosen handoff. The lead checks the meaning.
   File hashes and section checks cannot prove that prose is true.

4. Run `prepare <project-root> <input.json>` with the same script. It saves a
   proposal and captures the current file hashes. It does not change memory.
   Read its result. Then run `save <project-root> <save-input.json>`. The second
   input has `id`, `host`, `sessionId`, and the returned `proposalPath`.
   Save applies only the prepared bytes if the source files and references still
   match. It saves backups first. Only a successful save marks this request done.

5. If a save reports busy, retry the same prepared save at the next safe step.
   A busy writer is not a content conflict. If a save conflicts, keep it pending. Read the changed files and prepare a
   fresh update. Never overwrite another writer's edits to satisfy the trigger.
   Read back the receipt and files. Run the exact `commands.validate` prefix
   from the setup record for the memory validator. Then continue the
   user's task. A brief “Progress saved” note is enough when useful.

The bounded local queue retains pending requests. Old saved receipts may expire
when space is needed. An expired trigger may request a fresh save. A failed or
partial write remains pending for recovery. No completion claim follows from
hook delivery alone.

A crashed writer can leave a lock. If the hook reports an old lock, inspect its
PID and age. `continuity.mjs recover-lock <project-root> <input.json>` accepts
`authorized: true` and requires the continuity lock's process to be confirmed
dead and the lock to be at least five minutes old. Recovery of the shared
`state.lock` uses `recoverIntegrityLock` from `scripts/lib/integrity-state.mjs`
with the same explicit authority and checks. Do not auto-remove either lock.
Recovering a lock does not complete a memory save. Read pending work again.

On a new session, the hook can report a count of pending requests from older
sessions. Do not take their ownership or mark them saved. Read their checkpoints
and existing memory as unverified context. Confirm current source and host stop
state before any explicit recovery. A fresh authorized session can make its own
save from current evidence. Old pending records are not proof that files were lost.
