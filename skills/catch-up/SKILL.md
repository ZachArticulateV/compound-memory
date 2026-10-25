---
name: catch-up
description: "Sums up what changed in this conversation, or where a piece of work stands across sessions, ending with the decisions waiting on the user. Use when the user asks to be caught up, for a status or summary, or where they left off."
argument-hint: "[chat|work] [topic or time window]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/project-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" *)
---

# Catch up

Give the user, in a minute's reading, what changed, where things stand, and the
calls only they can make.

**Done when:** every item the user asked about has a current state checked
against Git, the PR, or the files (not against memory alone), and every
decision waiting on the user is listed with a recommendation.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `chat` | Summarize this conversation since the user's last message | `references/chat.md` |
| `work` | Rebuild where a piece of work stands across sessions | `references/work.md` |

Pick by the window. "What happened while I was away?" in a running chat is
`chat`. "Where did I leave off on X?" or a new session is `work`. With nothing
to decide it, use `chat` when this conversation has done work since the user's
last message, and `work` otherwise.

## Always

- **Check before reporting.** Each PR, branch, CI run, and ticket is read in
  its current state, and each number you show is checked against its source.
- **Action items are only the user's calls:** a product choice, an approval, an
  irreversible step, access you lack. Work you could do yourself is not an
  action item; name it on one line as remaining work.
- **Plain words.** Call each PR, branch, or agent by a name the user would
  know. Leave out hashes, paths, and counts unless the user needs one to act.

## Works with

- **Reads:** the memory tree (`current-state.md`, the handoff, `next-actions.md`),
  Git, PRs, tickets, `verify` evidence, and session transcripts.
- **Hands off:** the next move, often to another skill; memory drift to
  `/project-memory sync`.
- **Alone:** works from Git and transcripts when there is no memory tree.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.
