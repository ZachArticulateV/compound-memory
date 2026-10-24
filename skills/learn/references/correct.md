# Correct a repeated mistake

The user keeps correcting agents for the same mistakes. Change the repository
so the next agent cannot make them.

Assume every contributor is an agent that sees only the files it opened,
copies the nearest example, and takes the shortest path that compiles. Make a
change that looks right from one file also right for the whole repository.

## 1. Find the mistake classes

Read the evidence: the correction just given, recent reverts and fix commits,
review comments, `memory/guardrails.md`, the agent instruction files, and
comments that explain workarounds. Group mistakes into classes. A class counts
once it has happened twice; a correction the user gives now about something
that happened before counts.

## 2. Fix each class at the highest level that works

1. **Architecture:** give each piece of state one owner and each task one
   supported way. Hide internals so the wrong import fails. Replace hand-synced
   lists with one source. Delete the old way and the dead code an agent would
   copy.
2. **Types:** make the bad state impossible to write.
3. **A check:** a lint rule, CI step, pre-commit hook, or validator script whose
   error message names the file, function, or component to use instead. When
   the bad pattern is already common, fail only when a change adds more of it.
   In a repository of Markdown and configuration (an agent setup, a notes
   vault), the check is a validator script run in CI or a hook.
4. **A test** of the behavior. Fix or delete tests that pass while the behavior
   is broken, or fail when only internals change.
5. **A written rule**, last, and only for judgment calls. Nothing fails when an
   agent skips it, so put it beside the code it governs and pair it with one
   real example of the mistake.

Fix the most frequent classes first, each in its own commit, so any one fix
can be reverted alone.

## 3. Prove each check

Show that each new check fails on a real past instance of the mistake (check
out the commit, or reproduce the pattern), then passes on the fixed code. Keep
that pair as a test of the check itself (a fixture with the mistake that must
fail, and one without it that must pass), so the check cannot rot into one
that passes everything. Run
it the same way locally and in CI. An exception goes on the offending line with
a reason, an expiry date, and the name of the person who approved it.

## 4. Keep the guardrails table

Record each rule and its enforcer in `memory/guardrails.md` (from
`templates/guardrails.md`). It is read during review, not loaded every session.
A correction seen for the first time is fixed where it happened and recorded
with the enforcer "judgment"; that row is what makes the next one recognizable.
When a rule already in the table is broken again and its enforcer is
"judgment", that is a repeat: move it up the ladder in the same change. Remove a
row once its mistake cannot happen.

## Report

Each class, its evidence, the level you fixed it at and why a higher level did
not work, and the check's failing and passing output.
