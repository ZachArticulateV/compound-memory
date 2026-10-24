# Memory Schema

The canonical definition of every project memory artifact: what it is for, what
it must contain, how it changes over time, and who is allowed to change it.

Every mode reads this file. The templates in `../templates/` are the rendered
shape of what is described here — when the two disagree, this file is the
contract and the template is the bug.

## Where memory lives

Canonical project memory lives at `memory/` in the target repository and is
committed to Git. It travels with the code it describes, appears in code review,
and is recoverable through normal Git history.

This is a different thing from Claude Code's native auto memory, which lives at
`~/.claude/projects/<project>/memory/`, is machine-local, and is shared across
every worktree of the repository. Never point `autoMemoryDirectory` at the
repository. The two systems must not be merged; see `safety.md`.

## The tree

```text
memory/
├── INDEX.md
├── project-brief.md
├── current-state.md
├── handoff.md              (or handoffs/ when workstreams run in parallel)
├── next-actions.md
├── bugs-and-risks.md
├── acceptance-criteria.md  (when the project has features worth verifying)
├── glossary.md             (when the project has vocabulary of its own)
├── guardrails.md           (when an agent was corrected twice on one rule)
├── lessons/                (when work produced knowledge the code cannot carry)
│   └── <slug>.md
├── decisions/
│   ├── INDEX.md
│   └── NNN-slug.md
└── archive/
```

Create additional files only when project complexity actually calls for them.
Do not scaffold empty files against a future need.

## Placeholder convention

Templates carry unresolved values as `{{snake_case_token}}`. This exact shape is
what the validator scans for, so a rendered memory file containing `{{` is a
structural failure rather than a stylistic one. Never invent a different
placeholder syntax, and never leave a token behind as a note-to-self — an
unknown belongs in prose as an explicit unknown, not as an unrendered token.

## References

A path in a code span or a link target is a reference, and the validator
checks that it exists. A reference is also a staleness trigger: when the path
changes after the memory file was last committed, the probe reports the file
as behind. Reference a path when a change to it should prompt a re-check of
the claim beside it. The index files and the glossary are exempt, because
they point and define rather than claim. A file the work has not created yet is marked `(new)`
right after the span, as in ``add `test/cli.test.mjs` (new)``, so a plan is
not reported as a broken link while a mistyped existing path still is.

## Templates

Each row maps a template in `../templates/` to what it renders. This table is the
authority for that mapping — a template not listed here is an orphan, and a
listed template that does not exist is a broken schema.

| Template | Renders |
| --- | --- |
| `index.md` | `memory/INDEX.md` |
| `project-brief.md` | `memory/project-brief.md` |
| `current-state.md` | `memory/current-state.md` |
| `handoff.md` | `memory/handoff.md` or `memory/handoffs/<slug>.md` |
| `next-actions.md` | `memory/next-actions.md` |
| `bugs-and-risks.md` | `memory/bugs-and-risks.md` |
| `acceptance-criteria.md` | `memory/acceptance-criteria.md` |
| `glossary.md` | `memory/glossary.md` |
| `decision-record.md` | one file under `memory/decisions/` |
| `claude-md-section.md` | the memory section inserted into the project's `CLAUDE.md`, and into `AGENTS.md` when it has one |

`memory/decisions/INDEX.md` and `memory/archive/` have no template. The decisions
index is a short generated list whose shape follows from its entries, and the
archive is a directory rather than a document.

## Artifacts

### `INDEX.md`

**Purpose:** The navigation and authority map. It answers what memory exists,
which file to read for which question, which external systems are authoritative,
and what must not be assumed.

**Must contain:** a read-first ordering for normal development; retrieval
guidance for the files that are not read by default; an authority table; and a
statement that memory is orientation rather than evidence.

**Authority table:** generated from the actual project. Only list external
systems that genuinely exist for this project — inventing a row for Jira or
Linear because the template shows one is a correctness failure, not a harmless
placeholder.

**Lifecycle:** updated when the structure of memory changes, not on every write.

### `project-brief.md`

**Purpose:** Preserve the original project definition so later strategy changes
cannot quietly rewrite what the project was for.

**Must contain, for a genuinely new project:** the original problem, the purpose,
intended users, original success criteria, initial scope, original out-of-scope
boundaries, foundational constraints, and the important assumptions held at
kickoff.

**Lifecycle:** effectively frozen once approved. A change to project direction
creates a decision record; it does not edit this file.

**Mature-project exception:** when memory is introduced late, the brief is
reconstructed rather than remembered, and must say so:

```text
---
origin: reconstructed
reconstructed: YYYY-MM-DD
---

Evidence:

- README
- Git history
- package configuration
- user confirmation
```

A reconstructed brief separates verified original facts, reconstructed
interpretation, user-confirmed history, and unknown history. It is not frozen
until its obvious uncertainties are resolved or explicitly recorded as
unresolvable.

### `current-state.md`

**Purpose:** Describe what is true now. This is the file another Claude reads to
avoid breaking the project.

**Must answer:** what works, what does not, what architecture is actually in use,
what major systems exist, which workstreams are active, what is partially
implemented, what is intentionally deferred, and what major limitations exist.

**Structure:** organized by system or capability, each carrying a status, the
current implementation, what has actually been verified, and known limitations.

**The as-is / to-be split is mandatory where the two differ.** Current reality is
what the software does right now. Intended direction is what the project has
decided it should become. They are recorded as separate labelled claims, and
intended behavior is never written as working behavior.

**Lifecycle:** a snapshot, not a journal. Obsolete state is replaced. History
belongs in Git and decision records.

Wrong:

```text
August 3 authentication failed.
August 4 we fixed OAuth.
August 5 refresh tokens broke.
```

Right: one current description of authentication, with its verified behavior and
its known limitation.

### `handoff.md`

**Purpose:** Let a completely fresh session continue unfinished work without
reconstructing the previous conversation.

**Must answer:** what we were trying to accomplish, exactly where we stopped,
what changed, what was actually verified, what remains unresolved, what
hypotheses exist, what the next session should do first, and what it must not
assume.

**Also carries, when they apply:** the next session's focus, pointers to the
artifacts that already hold detail (linked, never restated), and the commands
or skills the next session should run.

**Evidence requirements:** branch, and `HEAD` when Git exists; working-tree state
when it matters; meaningful modified files; tests actually run with their actual
results. A claim that tests pass is written only when a run was observed. An
unexercised test is recorded as not run.

**Lifecycle:** replaced as work progresses. It is a continuation pointer, not a
session log.

**Parallel workstreams:** when more than one branch or worktree is active,
`handoff.md` is promoted to `handoffs/<workstream-slug>.md` and `INDEX.md` lists
the active handoffs. One workstream's continuation state never overwrites
another's. See `handoff.md` playbook.

### `next-actions.md`

**Purpose:** Executable project work, grouped as Now, Next, and Blocked.

**Must contain:** concrete actions with an observable outcome. "Reproduce the
verification timeout with request timing captured" is an action. "Improve
backend" is not. Blocked items name what blocks them.

**Ready to delegate:** an item another agent will pick up carries two
sub-bullets, in the shape of an agent brief:

- `Done when:` one or more independently checkable criteria. "Refresh retries
  stop after three attempts and surface `AuthExpiredError`" is checkable.
  "Auth works" is not.
- `Out of scope:` what the item will deliberately not touch, or `none`. This is
  what stops a delegated agent gold-plating adjacent work.

Write delegated items **behaviorally and durably**: name the behavior, the
interface, the type, or the command, not the file and line. The item may sit
for weeks while files move; a behavioral description survives that and a line
number does not. Items the current session will do next need neither
sub-bullet.

**Lifecycle:** a punch list, not a historical record. Completed items are removed
once their completion is reflected in current state, decisions, Git, or archive.

**External authority:** when an external tracker owns task state, this file
records the authority and a reference, and does not mirror the tracker's
contents. See `safety.md`.

### `bugs-and-risks.md`

**Purpose:** Track unresolved problems without letting suspicion harden into
fact.

**Each meaningful entry distinguishes:** symptoms, observed evidence, affected
components, severity, reproducibility, confirmed root cause, suspected causes,
attempted fixes, verification status, and the next investigation step.

**The cause split is mandatory.** `Confirmed root cause` defaults to `Unknown`
and is only filled when evidence establishes it. Everything else goes under
`Current hypotheses`. Writing a suspected cause in the confirmed field is the
failure this field exists to prevent.

**Lifecycle:** resolved issues are archived rather than deleted, so the record of
what was wrong survives.

### `acceptance-criteria.md`

**Purpose:** Keep completion evidence-backed. Without it, a partially functional
project reads as finished because the files exist.

**Must contain:** one entry per feature whose completion needs verifying, each
with a verification status and the evidence behind that status. The default
status is unverified. A criterion is only marked verified with cited evidence —
a test that ran, an observed behavior, a checked artifact.

**Lifecycle:** created when the project has a meaningful feature set worth
verifying; entries update as evidence accumulates.

**When to skip:** a project with no verifiable feature set does not need this
file. Do not scaffold it empty.

### `glossary.md`

**Purpose:** The project's ubiquitous language. One canonical word per concept,
so memory, code, and conversation name the same thing the same way, and a
fresh session decodes the project's jargon without guessing.

**Each entry carries:** the term in bold, a one- or two-sentence definition of
what it is (not what it does), and an `_Avoid_:` line listing the words that
must not stand in for it.

**Accepted form:** the term line starts with `**Term**:` (or `**Term:**`,
optionally after a `- ` bullet), the definition follows on the same line or
the next, and `_Avoid_:` takes a comma- or semicolon-separated list that may
wrap onto following lines until a blank line. An `_Avoid_` line with no term
above it is reported by the `glossary-format` check, because nothing enforces
it. A `Flagged ambiguities` section records words that
meant two things and how each was resolved.

**Belongs here:** concepts specific to this project. **Does not:** general
programming concepts, implementation details (file paths included), or
decisions. The glossary is a glossary and nothing else. Because it names no
implementation, it is outside change-based staleness: the probe never reports
it as behind a code change.

**Location:** when the project already keeps a root `GLOSSARY.md`, or a
`GLOSSARY-MAP.md` that links one glossary per bounded context, that is the
glossary: `INDEX.md` points to it and no copy goes under `memory/`. The same
holds for an existing decision folder such as `docs/adr/`. A project with
several bounded contexts and one glossary groups entries under a `## <Context>`
heading each, and a word defined in two contexts names its context in each
definition.

**Lifecycle:** created lazily, when the first term is resolved. Updated as soon
as a term is settled (in `grill`, once the user confirms the round). A renamed concept replaces its entry, and the old
word joins `_Avoid_`. A retired concept's entry is removed; decision records that
used the word keep it, because they are history.

**Checked:** the validator reads `memory/glossary.md`, else a root
`GLOSSARY.md`, plus each glossary `GLOSSARY-MAP.md` links to, and warns
wherever another memory file uses an `_Avoid_` word in prose. Decision records and the archive are exempt, since
they are history.

### `decisions/`

**Purpose:** An immutable record of architectural decisions and why they were
made.

**When a decision earns a record:** all three must hold.

1. **Hard to reverse.** Changing course later has a real cost.
2. **Surprising without context.** A future reader would ask why it was done
   this way.
3. **A real trade-off.** There were genuine alternatives and one was chosen for
   specific reasons.

If any is missing, there is no record: an easy reversal will just be reversed,
an unsurprising choice raises no question, and a choice with no alternative
has nothing to explain. What typically qualifies: architectural shape,
integration patterns, technology with lock-in, scope boundaries (the explicit
no-s), deliberate deviations from the obvious path, constraints invisible in
the code, and rejected alternatives whose rejection is not obvious.

**One record per decision**, named `NNN-slug.md` with a zero-padded sequential
id. `decisions/INDEX.md` stays a concise list.

**Each record carries frontmatter:**

```yaml
---
id: NNN
status: proposed | accepted | superseded | deprecated
date: YYYY-MM-DD
---
```

**And sections:** Context, Decision, Why, Alternatives considered, Consequences,
Evidence / implementation, Supersedes.

**Rejected ideas are decisions too.** When a feature or approach is declined
and is likely to be proposed again, record it: title it as the rejection
(`Not: server-side rendering`), put the reason under Why, and list where it
was requested. The interview discipline that `grill` and `init` run checks these
records before re-opening a settled question. A `Not:` record has `status:
accepted` while the rejection stands. Upstream projects keep these in an `.out-of-scope/`
directory; here they are ordinary decision records, so they supersede and
index like any other.

**Lifecycle:** append and supersede. Historical decisions are never rewritten to
make an old choice look like the current one was always intended. When a decision
changes: mark the old record superseded, create the replacement, and link them in
both directions.

### `lessons/`

**Purpose:** Knowledge from past work that the code, tests, and plan do not
carry, one lesson per file, found per task rather than read at startup.

**Owner:** the `learn` skill writes and refreshes lessons; `plan`, `build`,
`debug`, and `review` look them up with `scripts/lessons.mjs`, which matches a
task's words and changed paths against each lesson's title, tags,
`applies_when`, and `paths`. The shape, with its frontmatter, is in the
plugin's `../../references/artifacts.md`.

**Checked:** the validator's `lesson-format` check warns when a lesson lacks
the fields lookup matches on, writes a list in block style, or has no
`## Do this` section.

**Lifecycle:** updated in place when a later lesson overlaps; marked `stale`
or `retired` rather than deleted, so lookup stops serving it while the history
stays.

### `guardrails.md`

**Purpose:** Each rule an agent was corrected on, paired with what enforces it
(a check, a test, a type, or judgment). Read during review.

**Owner:** `learn correct`. A rule enforced only by judgment that is broken
again moves to a check; a row whose mistake can no longer happen is removed.

### `archive/`

**Purpose:** Retired content that is worth keeping but not worth loading.

**Lifecycle:** rarely read. Never part of normal session startup.

## Which artifact owns a fact

Every fact has one home. Repair uses this table to correct a claim, handoff uses
it to file what a session learned, and cleanup uses it to resolve a duplicate.
Read it rather than inferring from where a claim happened to be written: the
file carrying a statement is often not the file that should.

| The fact is about | It belongs in |
| --- | --- |
| What a capability does now | `current-state.md` |
| What the project decided to become | `current-state.md`, under Intended direction |
| A choice with alternatives and consequences | a new record in `decisions/` |
| A problem, its evidence, and its causes | `bugs-and-risks.md` |
| Whether a feature is done, and on what evidence | `acceptance-criteria.md` |
| Work still to do | `next-actions.md` |
| Where memory lives and who is authoritative | `INDEX.md` |
| Continuation state for this workstream | the active handoff |
| A durable project invariant | `CLAUDE.md`, mirrored into `AGENTS.md` when the change is to the memory section |
| What a project term means, or which word to avoid | `glossary.md` |
| Knowledge from past work that the code cannot carry | a lesson in `lessons/` |
| A rule agents were corrected on, and what enforces it | `guardrails.md` |
| Retired content worth keeping but not loading | `archive/` |

A fact belongs in exactly one row. A fact that seems to belong in two is
usually two facts — "the retry now works" (`current-state.md`) and "we chose
retry over a circuit breaker" (`decisions/`) — and each goes to its own home.
A copy kept in a second file is a `DUPLICATED` finding waiting to happen: the
two drift the moment one is updated.

## Lifecycle summary

| Artifact | Behavior |
| --- | --- |
| `CLAUDE.md`, `AGENTS.md` | Stable; edited rarely; memory sections identical |
| `project-brief.md` | Frozen, or reconstructed with evidence markers |
| `INDEX.md` | Concise navigation; updated when structure changes |
| `current-state.md` | Stale state replaced |
| `handoff.md` | Overwritten as continuation changes |
| `next-actions.md` | Completed work removed |
| `bugs-and-risks.md` | Resolved issues archived |
| `acceptance-criteria.md` | Status advances only with evidence |
| `glossary.md` | Created lazily; terms replaced, old words move to `_Avoid_` |
| `guardrails.md` | Created lazily; a row leaves once its mistake cannot happen |
| `lessons/*` | Updated in place; marked stale or retired rather than deleted |
| `decisions/*` | Append and supersede; history preserved |
| `archive/*` | Rarely loaded |

There is no universal "append new information" strategy. Applying one is how
memory inflates.

## Startup budget

A normal substantive session reads only:

```text
CLAUDE.md (or AGENTS.md, for Codex and other agents)
memory/INDEX.md
memory/current-state.md
the active handoff
memory/next-actions.md
```

`bugs-and-risks.md`, individual decisions, acceptance criteria, the glossary,
guardrails, lessons, and anything under `archive/` are retrieved when relevant. Archives are effectively never part
of startup context.

## Who writes

Many readers, one writer. Subagents and external evaluators may inspect, test,
and recommend. Only the coordinating session writes canonical memory. This
matters most for `current-state.md` and `decisions/`. See `evidence-policy.md`.
