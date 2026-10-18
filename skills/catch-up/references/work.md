# Catch up on a piece of work

Rebuild where work stands across sessions, branches, and PRs, then hand back
a short brief and the next move.

## 1. Lock the scope

Pin the topic, the window (default: the last seven days), and the workspace
(default: this one). State the scope back. Never widen "recent" to "all" or
read another project's history without being asked.

## 2. Read the record, cheapest first

1. **Memory**, when the project has it: run the state probe, then read
   `current-state.md`, the active handoff, and `next-actions.md`.

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" --json
   ```

2. **Git and the forge:** branches with recent commits, open and recently
   merged PRs and their checks, reverts.
3. **Tickets:** for a plan with tickets, the frontier and what is done.

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" --dir <tickets dir>
   ```

4. **Transcripts,** when memory is missing or does not cover the topic.
   Claude Code keeps them in `~/.claude/projects/<slug>/<session>.jsonl`
   (the workspace path with each `/` and `.` turned into `-`); Codex in
   `~/.codex/sessions/`. Order by modification time, search the topic first,
   and read only the matching parts. For more than two sessions, give each
   slice to a subagent on a fast model; each returns, per session: the goal,
   decisions, open threads, corrections, and artifacts (PRs, branches,
   tickets).
5. **The wider record,** when the topic names a feature or bug: issues and
   their comments, fixes that shipped and were reverted, errors still
   reported. Say which sources were unavailable.

## 3. Verify

Check every PR, branch, and ticket the reading surfaced against its live state.
Memory and transcripts say what was true then.

## 4. Write the brief

- **Capsule:** at most five bullets: what this work is and where it stands.
- **Threads:** one line each, with exactly one tag: `[merged #N]`,
  `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`,
  `[reverted #N]`, or `[planned, not started]`.
- **Problems:** at most five recurring ones, including fixes that were
  reverted, so the next attempt starts where the last one failed.
- **Next move:** the single most useful next action, concrete.

Cite each finding by its source (PR number, ticket, session). When memory
disagreed with what you verified, say so and suggest `/project-memory sync`.
