---
name: write
description: "Writes and edits prose its reader gets on the first read: docs for people, instructions for agents, or a plain re-explanation. Use when the user asks to write, edit, or tighten docs or agent instructions, or says they did not follow something."
argument-hint: "[docs|agents|plain] [text, file path, or nothing for the last message]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/rewrite-check.mjs" *)
---

# Write

Prose that does its job for one named reader on the first read, with every
fact from the source still in it.

**Done when:** the text passes the checks in the mode's reference, every fact,
number, name, path, command, and stated doubt in the source survives, and
nothing was added that the source or the user did not supply. For an edit of
existing text, `rewrite-check.mjs` reports nothing lost or added, or each item
it reports was changed on purpose and you can say why.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `docs` | Write or edit documentation people read | `references/docs.md` |
| `agents` | Write or edit what an agent reads: skills, instruction files, prompts | `references/agents.md` |
| `plain` | Explain something plainly, or strip AI writing tells from a draft | `references/plain.md` |

Pick by the reader. A person reading to act or learn is `docs`; an agent
following instructions is `agents`; "what does this mean?" or "make this sound
less like a machine" is `plain`.

## Always

- **Name the reader** before writing, and write for them.
- **The codebase is the word list.** Use the real symbol, file, flag, and
  command, never a synonym for it.
- **Keep facts exact.** Code blocks, quotes, identifiers, link targets, and
  numbers are copied, not reworded.
- **Keep the doubt.** "Not verified", "may", "failed", and "unknown" stay as
  strong as the source has them. A plainer sentence must not be a surer one.
- **Check an edit in code** when the source is a file:

  ```bash
  node "${CLAUDE_SKILL_DIR}/../../scripts/rewrite-check.mjs" --before <original> --after <rewrite>
  ```

  It lists code, commands, paths, links, numbers, and words of doubt the
  rewrite lost, and identifiers it added. It cannot tell whether the meaning
  held; read it.
- **Edit the user's own writing lightly.** Keep their voice; change only what
  fails a check.
- **This skill is the plugin's writing standard.** Other skills point here
  rather than restating it.

## Works with

- **Reads:** the draft, the code it describes, the project's glossary
  (`memory/glossary.md`) for the project's own terms.
- **Hands off:** finished text to wherever it belongs; agent documents to
  `review doc` when they are large.
- **Alone:** works on any text, in or out of a repository.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.
