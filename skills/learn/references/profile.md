# Profile

Update the rules agents follow when working with this user, from evidence of
how the user actually works. Improve the rules the user already keeps; do not
start a second copy of them.

## 1. Find the existing rules

Look where this user keeps working preferences: the user-scope `CLAUDE.md`
(`~/.claude/CLAUDE.md`) or `AGENTS.md`, a `<handle>-mode` skill in
`~/.claude/skills/` or the project's skills, and any preferences document the
user names. These are the source. When none exists, the result is a new
user-invoked `<handle>-mode` skill.

## 2. Mine the history

Read this workspace's transcripts (paths in `references/retro.md`) since the
rules were last edited (`git log -1 --format=%cI <file>` when they are in Git).
Split the history into three slices and give each to a subagent. Each returns
patterns with evidence pointers for:

- response style (length, format, tone, "make it simpler" corrections);
- how much to do without asking;
- delegation (subagents, models, parallel work);
- what done means (tests, live checks, review);
- code and prose standards they cite;
- process (branches, worktrees, commits, PRs).

Keep a pattern only when it appears in two or more slices, or when the user
stated it as a rule ("always", "never", "from now on") and nothing later
contradicts it: one explicit instruction outweighs a habit seen twice. A
preference stated once and contradicted later is noise.

## 3. Ask about what history cannot show

One or two structured questions with four to six options each, then one open
question for anything the options missed.

## 4. Propose the change

Show the user a diff against their existing rules: lines to add, lines to
change, and lines no session followed or needed. Reference other skills and
documents by path rather than pasting them in. Keep each section to rules that
change behavior; "communicate clearly" is not a rule, "tables when comparing
options" is.

Apply what the user approves. Sanitize everything: no secrets, no personal data
from the transcripts, no other people's names.
