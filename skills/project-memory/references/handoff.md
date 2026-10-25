# Mode: handoff

Capture continuation state a completely fresh session can act on without
reconstructing this conversation.

Run it when stopping substantial unfinished work, before `/clear` or a context
reset, when switching tasks or agents, or when handing work to someone else.

A handoff is a continuation pointer, not a session log. It is written from
observed evidence, and the parts it cannot evidence it says it cannot evidence.

It works for any kind of work, not only code: a bug hunt, a deploy, a data
migration, a document, a research question, a plan. What changes between them
is what counts as verification (Section 2), never whether the handoff is honest
about it.

A handoff does two jobs. It files what this session learned into the memory
file that owns each fact (Section 3), so nothing durable lives only in a file
the next handoff replaces. Then it writes the continuation pointer itself.

You have already run the state probe. Use its output rather than re-deriving.

## 0. Read the focus

Any words after `handoff` are the **focus**: what the next session will be used
for. `/project-memory handoff finish the refresh-token retry` has the focus
`finish the refresh-token retry`.

A leading target (`for codex:`, `for a background session:`) names who picks
the work up (Section 10); strip it before recording the focus.

`/project-memory handoff close`, with `close` as the only word, closes a
finished workstream instead of continuing it. Go to Section 7.

The focus shapes selection, not truth. It decides which completed work, which
pointers, and which next steps earn a place, and it is recorded on the
`Next session focus:` line. It never changes what counts as verified. With no
focus, write `Next session focus: unspecified` and cover the work as it stands.

## 1. Gather the evidence first

| Fact | Source | Include when |
| --- | --- | --- |
| Branch | `git.branch` | Git exists |
| HEAD | `git.head` | Git exists |
| Working-tree state | `git.dirty`, `git.changes` | The uncommitted work matters to continuing |
| Meaningful modified files | `git.changes`, plus what you actually touched | Always, filtered to what matters |
| Work type | What the session actually did | Always: it decides what verification means (Section 2) |
| Tests run, and their results, or the work type's equivalent checks | The runs you observed this session | Always — including "none" |
| Unresolved failures | The runs you observed this session | Whenever one exists |
| Approaches tried and ruled out, with why | What the session actually tried | Whenever one was: it goes under Evidence collected, so the next session does not repeat it |
| Decisions the user made | The conversation | Whenever one was made: it is filed, not just mentioned (Section 3) |
| Next exact step | Your own state | Always |

"Meaningful" is doing work in that table. A handoff listing forty changed files
including lockfiles and formatting churn has buried the three files the next
session needs. Name the ones that carry the work; summarize the rest as a count.

**Point, do not copy.** Detail that already lives in another artifact (a spec,
a decision record, an issue, a PR, a commit, a log file) is linked under
`Pointers` by path or URL, with one line on why it matters. Restating it creates
a second copy that drifts from the first, and the handoff is the copy the next
session will believe.

Everything in the handoff is either observed or labelled as unobserved. A
handoff is the artifact most likely to be believed by the next session and least
likely to be checked, because it reads like a report from someone who was there.

## 2. Verification claims are gated on observed runs

Write a verification claim only for a run you watched in this session.

| What happened | What the handoff says |
| --- | --- |
| You ran the suite and watched it pass | `Verified: node --test, 142 passed, 0 failed, 2026-08-08` |
| You ran it and it failed | The failure, with the failing test named |
| You did not run it | `Not run: the suite was not exercised this session` |
| A test exists but was never executed | `Not run` — the file existing is not a result |
| A previous handoff said it passed | Not evidence. It is a claim about a verification |

Never write `All tests pass.` unless tests were run and observed passing.

`Not run` is a useful entry, not an admission. An empty verification section
reads as "nothing to say"; an explicit `Not run` reads as "we know this gap
exists," and it is the difference between the next session verifying before
building on the work and building on the work.

The same gate covers manual exercise, deploys, and reproductions. See
`evidence-policy.md`.

### What verification means for this kind of work

Name the work type on the `Work type:` line, then apply its row. Mixed work
applies every row that fits. A row is a definition of "observed", not a
checklist: an empty cell is a `Not run` entry, never a reason to skip it.

| Work type | Verified means you observed | `Not run` reads like |
| --- | --- | --- |
| Code change | The test, build, lint, or typecheck command and its result | `Not run: the suite was not exercised this session` |
| Bug investigation | The reproduction and what it showed; a cause only once evidence establishes it | `Not reproduced this session` |
| Infrastructure, deploy, configuration | The command, console, or health check and its output | `Not applied: written, not deployed` |
| Data or migration | The dry run, the query, and the counts it returned | `Not run against real data` |
| Documentation or content | The rendered result read back, links checked, who reviewed it | `Not reviewed: draft only` |
| Research or analysis | The sources actually read, linked; the queries actually run | `Single source: not cross-checked` |
| Planning or design | What the user decided, as opposed to what was proposed | `Proposed, not agreed` |
| Operations or process | What was sent, changed, or scheduled, and who confirmed it | `Drafted, not sent` |

A planning session's verification is the user's agreement: a recommendation
you made is `Proposed, not agreed` until the user accepts it, however settled it
felt in the conversation.

## 3. File what this session learned

The handoff is replaced every time it is written. A durable fact that lives
only there is lost the next time anyone runs this mode, and until then it is in
the one file a reader treats as temporary. So before writing the handoff, sort
what this session learned:

- **Continuation state** — where the work stopped, what to try next, what is
  half done. It stays in the handoff.
- **Durable fact** — still true and still needed after this workstream ends: a
  capability that now works, a confirmed bug, a decision the user made, a task
  discovered, a term renamed. It goes to the file that owns it, using the table
  in `memory-schema.md`, Which artifact owns a fact.

Write each durable fact under its owner's lifecycle rules in `memory-schema.md`:

- A decision gets a record only if it passes the three-part test; most
  conversations make none. A user's choice that fails the test is a line in
  `current-state.md` or `next-actions.md`, not a record.
- A new problem enters `bugs-and-risks.md` with `Confirmed root cause: Unknown`
  unless evidence established it. The handoff's hypotheses stay hypotheses there.
- A finished task leaves `next-actions.md` only once its completion is recorded
  somewhere durable. A discovered task enters it with an observable outcome.
- `project-brief.md` and the bodies of decision records are never edited here.

Then point, do not copy: list each file you updated under `Pointers` with one
line on what it now holds, and leave the fact itself out of the handoff.

Scope this to what this session learned. Drift from other work, or from before
this session, is `sync`'s job: recommend it under `Suggested commands` rather
than running a sync from here. When the owner of a fact is unclear, keep it in
the handoff and say so under `Do not assume` instead of guessing a home.

## 4. Choose the target file

The layout depends on how many workstreams are active. Read `git.worktrees` and
`handoff.layout` from the probe.

| Situation | Target |
| --- | --- |
| One active workstream | `memory/handoff.md` |
| More than one active workstream | `memory/handoffs/<workstream-slug>.md` |
| Already promoted to a directory | Stay promoted; write the file for this branch |
| The user wants it outside the repository, or the repository must not gain files | The OS temp directory (`$TMPDIR`, `/tmp`, or `%TEMP%`), with the path printed; skip filing (Section 3) |

The slug is the branch name lowercased, with every run of non-alphanumeric
characters collapsed to a single hyphen: `feature/auth-refresh` becomes
`feature-auth-refresh`.

**Before writing, read whatever is already at the target path.** If it exists
and its `Branch:` line names a different workstream, stop — two branch names can
slug to one filename, and writing anyway destroys another workstream's
continuation state with no error and nothing in the diff to notice. Disambiguate
the filename, and tell the user why the name is not the obvious one.

If the target's `Branch:` line names this branch, this is a regeneration.
Proceed to Section 6.

If it names a different branch whose work is finished — the probe or the rot
check reports it merged or gone — that workstream is over, not concurrent.
Close it first (Section 7), so its durable facts are filed before its file is
replaced, then write this workstream's handoff.

## 5. Promoting to the directory layout

When a second workstream appears and memory still holds a single
`memory/handoff.md`:

1. **Move** the existing file to `memory/handoffs/<slug>.md`, using the branch
   it declares. Move, do not copy — leaving `memory/handoff.md` behind creates a
   second candidate for the same workstream, and the two answer differently the
   moment one of them is updated.
2. Write this workstream's handoff at its own path.
3. Update `INDEX.md` so its read-first list references the active handoffs
   rather than the file that no longer exists. A stale pointer in `INDEX.md` is
   a broken reference the validator will flag, and worse, it is the first thing
   a fresh session reads.
4. Check the memory section in `CLAUDE.md` and `AGENTS.md`. The current
   template names the active handoff through `INDEX.md` and needs no change. A
   section written before that names `memory/handoff.md` directly: replace that
   line with the current template's, in every contract file that has it.
5. Report the promotion. The layout changed; that belongs in the summary.

One workstream's continuation state never overwrites another's. That is the
whole reason this layout exists.

Branch isolation cuts both ways: never carry a fact learned in another worktree
into this handoff as though it holds here. If it matters, verify it in this
checkout. See `safety.md`.

## 6. Write it

Render `templates/handoff.md`. Its sections are the structure; what they must
answer is in `memory-schema.md`. Write it for a reader with none of this
conversation: no "as discussed", no names for things only this session coined,
every path and command spelled out. These are not optional, and the validator
checks the first three:

- **Objective** — what this work was trying to accomplish.
- **Continue here** — the next exact step, then the ones after it. Never empty,
  and never "continue the work." A file a step will create is marked `(new)`
  after its path, so the validator does not report it as missing. If the next step is genuinely to decide
  something, the step is the decision and its inputs.
- **Do not assume** — what the next session must not take on faith: unverified
  claims in this handoff, hypotheses that read like conclusions, state that was
  true when you started and may not be now. This section is required. A handoff
  with nothing in it has not thought about how it will be misread.

Two more sections carry the next session's tooling:

- **Pointers** — one line per artifact that holds detail this handoff does not
  repeat. Omit the section when nothing qualifies; do not pad it.
- **Suggested commands** — the skills, modes, or commands the next session
  should run, each with its trigger: `/project-memory sync` once the retry
  lands; `node --test tests/auth` before touching the refresh path. Name only
  what is installed or present in the repository. A suggestion the next session
  cannot run costs it a failed call and some trust in the rest of the file.

**Redact before writing.** Secret values never enter memory (see `safety.md`).
The same holds for personal data that is not needed to continue: customer
names, email addresses, patient or account identifiers found in logs or
fixtures. Record that the data exists and where, not the data.

Keep it a continuation pointer. **Replace the file; never append.** A second
session entry under the first turns the handoff into the session log the schema
exists to prevent, and the next reader has to work out which half is current.
The previous handoff is in Git if anyone needs it.

Then validate:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" --json
```

## 7. Closing a finished workstream

Run this on `/project-memory handoff close`, or when Section 4 finds a handoff
for work that already merged, shipped, or was abandoned. A finished handoff left
in place is the most convincing stale file in memory: it reads like current
instructions and describes a checkout that no longer exists.

1. **File what it still holds.** Read the old handoff and apply Section 3 to
   everything in it. Its claims are claims, not evidence: a `Verified` line in
   it is filed only if this session can still observe it, otherwise it is filed
   as what the handoff reported, or not at all.
2. **Record the outcome where it belongs.** Merged or shipped work changes
   `current-state.md`; its punch-list items leave `next-actions.md` once that
   completion is recorded. Abandoned work is a line in `current-state.md` under
   Intentionally deferred, or a `Not:` decision record if it passes the test.
3. **Retire the file.** In the directory layout, delete the workstream's file
   and remove it from `INDEX.md`. In the single layout, delete
   `memory/handoff.md` and replace its read-first line in `INDEX.md` with
   `No active handoff.` — never leave a pointer to a file that is gone. Git
   keeps the old handoff for anyone who needs it.
4. **Validate**, then report which facts moved where, and that no handoff is
   active. Skip the resume prompt: there is nothing to resume.

Never close a workstream on the strength of a branch name alone. A branch can
be gone because it merged or because it was deleted unfinished; ask the user
when the evidence does not say which.

## 8. When there is no Git

`git` is `null` in the probe output. Degrade, do not fail:

- omit HEAD rather than inventing one
- record a timestamp instead of a commit identifier
- describe the working state from the files themselves
- be more explicit about what changed, since no diff exists to recover it

Say that commit identifiers are unavailable. A handoff missing HEAD for a stated
reason is honest; one missing it silently reads like an oversight.

## 9. When there is no memory yet

`memory.exists` is `false` in the probe output. A handoff is still worth writing:
continuation state is the one thing a fresh session cannot recover. Write
`memory/handoff.md` from the template and nothing else, skip Section 3 (there is
no owner to file into), and say in the report that memory is not initialized and
that `/project-memory init` would give the facts this session learned a durable
home. Do not initialize memory from here.

## 10. Report

Say which file you wrote, which memory files Section 3 updated and why, whether
the layout changed, what you recorded as verified, and what you recorded as not
run. That last one is the part the user
most needs to hear out loud, because it is the part they might otherwise assume.

End with a **resume prompt**: a fenced `text` block the user can paste as the
first message of a fresh session, in Claude Code or any other agent. It points;
it does not summarize:

```text
Continue the work recorded in memory/handoffs/feature-auth-refresh.md.
Read memory/INDEX.md, then that handoff, before changing anything.
Focus: finish the refresh-token retry.
Verify before relying on: the retry path has no passing test yet.
First step: run node --test tests/auth and confirm the timeout reproduces.
When it lands: /project-memory sync, then /project-memory handoff close.
```

When the continuation is one delegated item from `next-actions.md`, carry its
`Done when` and `Out of scope` lines into the prompt verbatim: they are the
contract the other agent works to.

When the next session is another agent, say so in the prompt and add one line
for it. The focus names the target: `/project-memory handoff for codex: finish
the refresh-token retry`.

| Next session | Add |
| --- | --- |
| Codex | A launch line: `codex "<resume prompt as one line>"`. Codex reads `AGENTS.md`, not `CLAUDE.md`; if the project has no memory section in `AGENTS.md`, the resume prompt is the only pointer it gets, so it must name `memory/INDEX.md` and the handoff path explicitly, and the report suggests `init` to add the `AGENTS.md` pointer so later Codex sessions find memory unprompted |
| A background Claude Code session | A launch line: `claude --bg --name "<short task name>" "<resume prompt as one line>"` |
| A person | Nothing extra. The prompt is still what they paste into their agent |

A launch line holds the resume prompt on one line with no double quotes, `$`,
or backticks, so it survives both bash and PowerShell quoting unchanged. Print
it; never run it. Starting another agent is the user's call, and a second
session writing memory while this one still can breaks the one-writer rule.

Keep the prompt under ten lines. The resume prompt is printed, not written to memory:
the handoff file is the durable record, and a second copy of its contents in
the same file would drift from the first.

## Failure modes this mode must avoid

- Claiming a verification that was not observed.
- Recording an unexercised test as passing.
- Overwriting another workstream's handoff.
- Copying instead of moving when promoting, and leaving two live handoffs.
- Leaving `INDEX.md` pointing at a handoff path that no longer exists.
- Appending a new session entry instead of replacing the file.
- Writing a "Continue here" that does not name a next step.
- Omitting "Do not assume" because nothing came to mind.
- Listing every changed file instead of the ones that carry the work.
- Inventing a HEAD in a project that has no Git repository.
- Restating a spec, decision, or issue instead of pointing at it.
- Suggesting a command or skill the next session does not have.
- Letting the focus upgrade an unverified claim because it matters to the focus.
- Running a launch line instead of printing it.
- A Codex resume prompt that relies on `CLAUDE.md` to find memory.
- Leaving a durable fact only in the handoff, where the next handoff erases it.
- Copying a filed fact into the handoff as well as its owner.
- Running a full sync from here instead of filing only what this session learned.
- Recording a proposal as a decision because the user did not object.
- Replacing a finished workstream's handoff without filing what it held.
- Closing a workstream because its branch is gone, without knowing why it is gone.
- Writing for a reader who was in this conversation.
