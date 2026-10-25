# Retrospective

Look back at a session and find what to change in the agent's environment so
the next run goes better. The output is a ranked list of changes, each with a
home.

## Sources

The session the user names, or the current one. Transcripts live in:

- Claude Code: `~/.claude/projects/<slug>/<session>.jsonl`, where `<slug>` is
  the workspace path with every character other than a letter or digit turned
  into `-` (`/home/me/app` is `-home-me-app`; on Windows, `C:\work\app` is
  `C--work-app`, under `%USERPROFILE%\.claude\projects\`); subagent
  transcripts sit under `<session>/subagents/`.
- Codex: `~/.codex/sessions/`.

Read only this workspace's transcripts. For a long session, split it across
subagents and keep only their findings.

## What to look for

- **Navigation:** the agent took long to find something. Would a pointer in an
  index or `AGENTS.md` have sent it straight there?
- **Automated checks:** the agent made a mistake a check could catch. Read the
  repository's own check commands and CI first; a check that exists but is not
  wired up, or is silently broken, is the finding. A repository with no
  guardrail at all (no hook, no CI running lint and tests) is a finding.
- **Standards:** the reviewer missed something. A mechanical rule gets a check;
  only a judgment call goes into the standards file. Standards are applied in
  review, where context pressure is lowest, not loaded into every
  implementation session.
- **Instruction files:** steering text in `AGENTS.md` or `CLAUDE.md` (the
  user's global file too, edited through `profile`) that belongs in standards,
  a check, or a skill. These files load every session, so they should hold
  pointers.
- **Tool economy:** an expensive call (a huge file read, a slow command, a noisy
  tool) that a cheaper one would replace.
- **No-ops:** instructions that do not change what the agent does by default.
- **Information access:** what the agent needed and could not see: dev-server
  logs, a read-only view of a service, documentation.
- **Memory and lessons:** a lesson the agent should have found and did not, or
  memory that was stale.

## Output

Rank the candidates by how much they would have changed the session. For each:
the category, the evidence (a quote or the tool call, with secrets and personal
or health data redacted), the proposed change, and its home:

- a check or structural fix: run `correct`;
- durable knowledge: run `capture`;
- a pointer: edit the index or instruction file;
- reference needed only sometimes, or a command repeated by hand: a project
  skill;
- memory drift: `/project-memory sync`.

Present the list and apply the ones the user picks. Text added to an
instruction file or a skill follows `../write/references/agents.md`.
