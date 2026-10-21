# Principles

The working habits every skill in this plugin assumes. They describe what good
work looks like; they leave the method to you.

## Ground first

Read what the project already knows before deciding anything: `memory/` when it
exists, the plan or ticket in play, and the lessons that match the task
(`node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --query "<terms>"`).
Memory is orientation. Code, tests, runtime behavior, and Git are the evidence.

## Scale the process to the task

A one-line fix gets one read, one change, and one real check: no plan file, no
subagents, no run record, no report beyond what changed and what you saw. Add
structure only as the work grows past what one sitting can hold, crosses
skills, or carries risk (data, money, security, a public interface). Read a
file once and keep what you learned; reread it only after it changed.

## Build what was asked

Each change traces to a requirement, a ticket, or the user's words. A guard,
option, or abstraction nobody asked for is scope; name it and leave it out, or
ask. Make the change easy, then make the easy change.

## Prove it works

Check the real artifact: run the feature, read the stored value, drive the
page, read the diff. A green build, a passing type check, or an agent's summary
is a proxy. When an observation contradicts the code, suspect the observation
first. The strongest proof is a script someone else can re-run; keep its output.

Pick the check that fits the change: a test that fails first for new
behavior, the same results before and after for a cleanup, a parse, lint, or
build for configuration and documents. Keep the output of every check you rely
on in a file; a result seen only in the transcript is gone when the session
ends.

Report what you observed. When a check was not run, say it was not run. A
failed or missing required check means the work is not done, however it is
worded; a check that ran before a later edit says nothing about the edit.
When an optional tool is missing, use the next-best check and name the gap;
stop only the part of the work that needs an input, a decision, or a
permission you do not have.

## Encode lessons in structure

The second time the same correction comes up, make it impossible rather than
writing it down again: architecture first, then types, then a lint whose
message names the fix, then a test. Plain-text rules are for judgment calls.

## One owner per meaning

Each fact, rule, or path has one home; everything else points to it. When two
documents say the same thing, keep the one closest to where it is used and link
to it from the other.

## Hand off in files

What the next session or skill needs goes into the artifact named in
`artifacts.md`, not only into the reply. A reply ends; a file is read again.

## Use more agents when they pay

Start a subagent when it saves reading (a wide search, a long transcript),
runs independent work in parallel, or gives an independent check (a fresh
context trying to disprove a finding). Do not start one for a task you can
finish in a few reads.

## Look outside when the decision rests on outside facts

When a choice depends on how a library, service, host, or standard behaves,
read its current documentation or source before deciding, and cite it. When it
depends only on this repository, the repository is enough.

## Decisions belong to the user

Facts are yours to look up. Product choices, approvals, and anything that
cannot be undone (a merge, a force-push, deleting data, publishing) are the
user's. Ask only when the answer would change what you build; otherwise take
the reasonable default and say which one you took. Permission the user gave
holds for the rest of the work it covered, and no further. When you can, do
the reversible work and show it for correction rather than waiting.
