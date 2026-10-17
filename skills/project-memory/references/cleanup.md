# Mode: cleanup

A meticulous pass over the whole memory tree for the three ways memory goes
bad: it contradicts itself, it contradicts the repository, and it rots — keeps
content that was once true or useful and has stopped earning its place. Then,
with the user's agreement, the fixes.

Each mode asks a different question:

| Mode | Question |
| --- | --- |
| `sync` | What changed in the project that memory has not caught up with? |
| `audit` | Is memory true, judged by an evaluator that did not write it? |
| `cleanup` | Does memory agree with itself and with the checkout, and is every line still worth loading? |
| `repair` | How is each accepted audit finding corrected? |

Cleanup is the only mode that reads every memory file in full. That is its cost
and its point: contradictions live between files, so no single-file read finds
them. Run it when memory feels heavy or untrustworthy, after a long run of
sessions, or before handing a project to someone new. It is never routine.

You have already run the state probe. Use its output rather than re-deriving.

## 1. Collect the deterministic signals

Two inspectors beside the probe, both read-only:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" --json
node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" --json
```

The probe you already ran supplies staleness (memory files behind changes to
the paths they reference), the handoff's branch match, and whether the contract
files carry the same memory section. The validator supplies structural
findings. The rot check supplies candidates: `completed-task`, `resolved-bug`,
`duplicated-text`, `diverging-test-counts`, `stale-handoff`, `journal-entries`,
`unreachable-file`, and `startup-budget`.

These are where the review starts, not the review. Code finds shapes. It cannot
see two sentences that disagree in different words, a status that is wrong, or a
cause nobody established. Every signal is confirmed by reading the files it
names before it becomes a finding.

## 2. Read everything and build a claim ledger

Read every file under `memory/` except `archive/`, plus the memory section of
`CLAUDE.md`, `.claude/CLAUDE.md`, and `AGENTS.md`. Open an archived file only
to confirm something was moved there.

As you read, keep a ledger of the major claims — a claim is major when a session
acting on it would do something differently. One row per claim:

| Field | Holds |
| --- | --- |
| Subject | The capability, bug, decision, task, term, or file the claim is about |
| Claim | What it says, quoted |
| Where | File and line |
| Kind | State, verification, cause, decision, task, term, or pointer |
| Rests on | The evidence it cites, or `nothing cited` |

Keep the ledger in your working notes, never under `memory/`. It is a tool for
this pass, and a second copy of every claim is the opposite of what this mode
is for. Then sort it by subject: a subject with two rows is where contradictions
and duplicates are.

## 3. Pass one: contradictions inside memory

For each subject with more than one row, ask whether the rows can all be true at
once. These pairs disagree most often:

| Between | The usual contradiction |
| --- | --- |
| `current-state.md` and `bugs-and-risks.md` | A capability is working while an open bug says it is broken |
| `current-state.md` and the active handoff | The handoff lists as verified what the state calls unverified, or a different test result |
| `current-state.md` and `acceptance-criteria.md` | A criterion is verified while its capability is partial |
| `next-actions.md` and everything else | An item already done, or blocked by something already resolved |
| `decisions/` and `current-state.md` | State describes the rejected alternative, or a superseded decision as current |
| `glossary.md` and every file | A term used in a sense the glossary does not define, or under its avoided word |
| `INDEX.md` and the tree | A read-first file that is gone, or an authority row for a system the project does not use |
| The contract files and memory | An instruction that contradicts memory, or memory sections that differ |
| Two handoffs | Both claiming the same workstream |

The repository settles a contradiction, not the file that sounds more sure or
was edited more recently. When the evidence cannot settle it, the finding is
`CONFLICTING` in the sense of `evidence-policy.md`: record both sides and put
the question to the user. Never resolve a contradiction by picking the
friendlier claim.

## 4. Pass two: inaccuracies against the checkout

For every ledger row that the checkout can answer, check it:

- a path, command, script, setting, or function memory names exists and does
  what memory says
- a count memory states (modes, endpoints, checks, files) matches the code
- a branch, commit, pull request, or release memory names is in the state
  memory gives it, according to Git
- a test result memory cites matches a run, if you run it; an unrun suite is
  `UNVERIFIABLE`, never `VALID`
- a `Confirmed root cause` is established by the evidence it cites

Classify each checked claim with the finding taxonomy in `evidence-policy.md`:
`VALID`, `STALE`, `CONTRADICTED`, `UNVERIFIABLE`, `DUPLICATED`, `MISPLACED`,
`TOO_VERBOSE`, or `MISSING`. A claim about intent or history the repository does
not record is `UNVERIFIABLE`, which is not grounds for deleting it.

Bound what this pass is worth. The session checking memory is the same kind of
process that wrote it and shares its blind spots, which is exactly what `audit`
exists to remove. Cleanup's accuracy pass is thorough, not independent. Say so,
and recommend `audit` for the claims that would do the most harm if wrong.

## 5. Pass three: rot

Rot is memory that has stopped earning its place. Each class has a cheapest
correct fix, taken from the lifecycle rules in `memory-schema.md`:

| Rot | Looks like | Fix |
| --- | --- | --- |
| Stale state | Probe staleness; a status code has moved past | Replace the claim in its owner, citing the evidence |
| Finished work still listed | `completed-task`; an item done according to Git | Record the completion if nothing durable does, then remove the item |
| Resolved bugs kept live | `resolved-bug` | Move the entry to `archive/` with its evidence |
| Expired handoff | `stale-handoff`; work merged, shipped, or abandoned | File its durable facts in their owners, then retire the file and update `INDEX.md` |
| The same claim twice | `duplicated-text`; one subject, two files | Keep it in the owner (Which artifact owns a fact), point or delete elsewhere |
| Diverging numbers | `diverging-test-counts`; two counts for one thing | Keep the one evidence supports, and its date; remove the other |
| Journal creep | `journal-entries`; a snapshot that tells a story | Collapse it to one current description; history is in Git |
| Superseded but present | Text describing a replaced decision or design as current | A superseding record if none exists; current text rewritten to match it |
| Hardened hypothesis | A suspected cause written as confirmed | Downgrade it to a hypothesis, keeping the evidence |
| Unreachable content | `unreachable-file` | Link it from `INDEX.md` if it is needed, otherwise archive it |
| Copied detail | A spec, log, or pull request restated in memory | Replace it with a pointer to the source |
| Dead or vague tasks | No observable outcome, or blocked by something gone | Rewrite with an outcome, or remove with the user's agreement |
| Startup bloat | `startup-budget` | Move what is not startup reading to the file that is retrieved when relevant |
| Unanchored time | "currently", "recently", "new", "soon" with no date or commit | Anchor it to evidence, or remove the word |

What does not count as rot: decision records, which are history and are
superseded rather than edited; `project-brief.md`, which is frozen; and
`archive/`, which exists to hold what was retired. Prose that is merely
unpolished is not a finding either.

## 6. Present the plan, then stop

Report the findings in three groups — contradictions, inaccuracies, rot —
ordered within each by the harm of acting on the claim. A false statement about
what works outranks a long section. For each:

```text
CONTRADICTED  memory/current-state.md:24 vs memory/bugs-and-risks.md:9
  Claim: "refresh tokens work" / "refresh fails after a 401"
  Evidence: tests/auth.test.mjs has no refresh case; the bug's repro still fails
  Action: replace the state claim with "partial", citing the open bug
```

Then say what was checked and what was not: the claims you verified, the ones
`UNVERIFIABLE` from this checkout, and that this pass is not independent.

Ask the user which items to apply: all, some, or none. Nothing is written
before that answer. Removal and archiving lose information from the startup
read, and some of what looks like rot is deliberate — a duplicate kept as a
signpost, a hedge the user wants.

## 7. Apply what was accepted

For each accepted item, edit the claim in the artifact that owns it, under that
artifact's lifecycle:

- `current-state.md` is a snapshot: replace obsolete state, never annotate it
  with what it used to say.
- A decision record is never edited. A reversed decision gets a new record and
  `status: superseded` on the old one.
- A resolved bug, retired content, or an unreachable note worth keeping moves
  to `archive/`. It is not deleted.
- One fact, one home. Resolving a duplicate leaves the claim in its owner and a
  pointer, or nothing, everywhere else.
- Touch only what an accepted item names. Do not refresh `Updated:` dates,
  reformat tables, or reword sentences nobody flagged.

When a fix depends on a fact you could not establish, do not guess it into
memory. Mark the claim unverified and say why.

## 8. Validate and converge

Run both inspectors again:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/memory-validate.mjs" --json
node "${CLAUDE_SKILL_DIR}/../../scripts/memory-hygiene.mjs" --json
```

Every remaining signal is either a declined item or one you can name a reason
to keep. A second cleanup on an unchanged tree should find nothing new; if it
would, this pass left work undone or created some. Structural validation is not
semantic correctness: a tree that validates and raises no rot signal can still
be wrong about the project.

## 9. Report

Say which files changed, one line each with the evidence, and which were
deliberately left alone. Name any substantial block removed or archived, so the
removal is visible without a diff. List what remains: declined items,
`UNVERIFIABLE` claims, open questions for the user. Recommend `audit` when the
claims that matter most were only checked by this session, and `sync` when the
passes found project changes memory has not absorbed.

## Failure modes this mode must avoid

- Treating a rot signal as a finding without reading the files it names.
- Settling a contradiction by recency or confidence instead of evidence.
- Calling this pass an independent audit.
- Recording an unrun test as `VALID`.
- Writing the claim ledger into `memory/`.
- Writing anything before the user accepts the plan.
- Deleting what the lifecycle says to archive or supersede.
- Editing a decision record or `project-brief.md` to match current reality.
- Leaving two copies of a claim after resolving a duplicate.
- Treating an `UNVERIFIABLE` claim as grounds for deletion.
- Refreshing dates or formatting to make the pass look productive.
- Auditing wording. Unpolished prose is not rot.
