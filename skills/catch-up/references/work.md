# Catch up on a piece of work

Rebuild where work stands across sessions, branches, and PRs, then hand back
a short brief and the next move.

## 1. Lock the scope

Pin the topic, the window (default: the last seven days), and the workspace
(default: this one). State the scope back. Never widen "recent" to "all" or
read another project's history without being asked, and never quietly cap
"all" to a recent slice: when you must, say so.

## 2. Read the record, cheapest first

1. **Memory**, when the project has it: run the state probe, then read
   `current-state.md`, the active handoff, and `next-actions.md`.

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" --json
   ```

2. **Git and the forge:** branches with recent commits, open and recently
   merged PRs and their checks, reverts.
3. **Run records:** `.verify/evidence/*/record.json` hold in-flight runs (the
   task, the checks, the open items, the next action). `run-record.mjs gate`
   on one says which results still hold on the code as it is now.
   Version 2 runs live under `.verify/runs/<id>/ledger.json`. A portable
   handoff also carries a required state export, not only this path. Use
   `scripts/handoff.mjs preview --bundle <bundle.json> --plan <plan.json>`
   from the plugin root to check a supplied bundle without writing. Report
   missing edits, changed checkout bytes, stale proof, and owner conflicts.
   A catch-up question does not authorize export, import, or ownership change.
4. **Tickets:** for a plan with tickets, the frontier and what is done.

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" --dir <tickets dir>
   ```

5. **Transcripts,** when memory is missing, does not cover the topic, or is
   older than sessions in the window (the probe reports when each memory file
   last changed).
   Claude Code keeps them in `~/.claude/projects/<slug>/<session>.jsonl`
   (the workspace path with each `/` and `.` turned into `-`); Codex in
   `~/.codex/sessions/`. Order by modification time, search the topic first,
   and read only the matching parts; skip this session and subagent, eval,
   and test transcripts. Read a transcript in full when the answer depends on
   what an agent actually ran. For more than two sessions, give each
   slice to a subagent on a fast model; each returns, per session: the goal,
   decisions, open threads, corrections, and artifacts (PRs, branches,
   tickets).
6. **The wider record,** when the topic names a feature, file, area, or bug:
   each source the host can reach (code history, the issue tracker and its
   comments, team chat, long-form docs, error tracking), one subagent per
   source when there are several, asked for the current state, what did not
   hold (fixes shipped and reverted), and what users still report. Report each
   source as found, checked and empty, or unavailable.

## 3. Verify

When a code question needs a fresh map, ask the code scout for the named area.
Use `repo-map.mjs --scope <relative directory> --json` from the plugin's
`scripts/` directory, with this project's root as `--cwd`. Its report names
source hashes, excluded paths, unreadable paths, and limits. Do not turn a
partial map or a static import candidate into a claim about the whole app.
Reuse only a map whose source version still matches a fresh scan.

Check every PR, branch, and ticket the reading surfaced against its live state.
Memory and transcripts say what was true then. When the state probe reports a
memory file stale, say which claim it may have outlived.

## 4. Write the brief

- **Capsule:** at most five bullets: what this work is and where it stands.
- **Threads:** one line each, with exactly one tag: `[merged #N]`,
  `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`,
  `[reverted #N]`, or `[planned, not started]`.
- **Problems:** at most five recurring ones, including fixes that were
  reverted, so the next attempt starts where the last one failed.
- **Next move:** the single most useful next action, concrete.

Leave adjacent work out unless it blocks this one. When space runs short, cut
detail before threads.

Cite each finding by its source (PR number, ticket, session). Redact secrets
and personal or health data from anything quoted out of a transcript. When memory
disagreed with what you verified, say so and suggest `/project-memory sync`.
