# Work

Implement a plan, a set of tickets, or a plain request, one verifiable unit at
a time.

## Order the work

- **Tickets:** run the graph check and work the frontier.

  ```bash
  node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" --dir <tickets dir>
  ```

- **Tickets on a tracker:** fetch each one with the host's tool, state its
  number and title, ask when a reference is ambiguous, and take the order from
  its blocking links.
- **A plan:** take its units in dependency order; prefactoring first. With no
  plan named, use the one written in this conversation, else the one newest
  plan in `docs/plans/` that fits the request; ask when more than one fits.
- **A plain request:** write the units in the reply first, each with the check
  that will prove it. For feature-sized work, name the seams the tests will use
  and go on unless the user objects. A request that spans many files or
  touches authentication, money, stored data, or a migration gets an offer to
  `plan` it first.

A unit whose check already passes is confirmed and marked done, not rebuilt.

## Run independent units in parallel

When a wave holds units that touch disjoint paths, give each one to a
subagent. For version 2 plans, use `scripts/agents/dispatch.mjs` from the plugin
root. It checks the plan, claims a bounded ready wave, and starts named Claude
or Codex CLI workers. For tickets, `tickets-check` reports collisions. Count the hidden
shared paths as shared: lockfiles, generated output, migrations, shared types
or schemas, and single runtime resources (one port, one database). Keep waves
to a few workers. Use the shared roles in `../../references/agents.md`.
Each worker gets a packet, not the whole plan:

- the goal and Done when of the plan;
- its one unit or ticket, with the requirements and decisions it cites;
- the paths it owns, and the verify command;
- where it works: its own worktree, which it confirms is at the base commit
  before starting, or the shared tree with no Git commands, no installs, and no
  full-suite runs;
- its context and output byte limits, runtime limit, and actual host tool profile;
- what it returns: the version 2 result with exact assignment context, actual
  changed paths, the check it ran, whether it failed before the change, and the
  path of captured proof. A file-only reviewer uses lead-captured checks.

The dispatch request names the current lead, run, host, absolute CLI entry,
worker limit, time and output limits, and the exact check commands. This is an
execution entry. Do not put it in a blanket read-only tool grant. Check commands
also execute code and need the task's existing authority. Use native executables
or JavaScript CLI entries, not shell shims. Keep the inherited model choice.

The native adapter supports code-specialist, code-scout, and memory-auditor.
Claude code workers have file edit tools. The lead captures their named checks.
Codex code workers use the host's workspace-write profile. Other specialists
keep their own review or evidence flow. A host flag is a requested limit, not
proof that every tool is absent. Check the current host support report.

Set `mode: "sequential"` for one native worker. Desktop or cloud sessions can
use a confirmed CLI on their host. Otherwise the lead works one task at a time
through the exported sequential callback. That callback must confirm it stopped.
Its host owns its time and cancellation limits. Never label callback results as
native CLI proof.

Workers use bounded external copies of the current files. This includes current
user edits and new files. It excludes Git metadata, credentials, dependencies,
and generated output. Missing dependencies are a reported setup need. Do not
install them or loosen access without task authority. Copies are not an operating
system access boundary. Keep the host limits active.

`dispatchWave` returns reports awaiting review. It does not accept or commit work.
Inspect each result and the actual change set. `acceptWorkerResult` rejects
changed paths outside ownership, checks worker proof, and compares current source
bytes with the copied base. A conflict keeps both the user files and the worker
copy. Resolve it explicitly. The lead then reruns the task checks on the combined
source before acceptance. No index edits or Git commits occur in this path.
Before merge, both leases must cover the check budget and a short merge window.
Each integrated check gets a timeout capped by the remaining lease time.
A slow disk can still use that window. Keep the merge receipt and worker copy
when a later check or lease fails. Reconcile the claim and rerun the checks.
Unresolved findings stop integration. To resolve one, the lead gives
`acceptWorkerResult` its exact finding text, a reason, and a saved JSON evidence
file. The helper keeps the original result and saves the lead's decision with
the evidence hash. It never removes findings on its own.

Keep each failed or unmerged copy until recovery is complete. Cancel a native
worker through the dispatch signal. A retry needs confirmed stop evidence and
the run ledger's retry operation. A timeout with unconfirmed stop status must
not free the task for another writer. The wave lock permits one local dispatcher.
Do not remove it until its old process has stopped.

After all task results are accepted, review a fixed copy of the combined source.
Save the review as JSON with its source `fingerprint` and `findings` array.
Pass that same fingerprint, the saved file path as `evidence`, and open findings to
`verifyIntegration`. It captures every final check on the combined source.
The saved review must match the source and have no open findings. Each final
proof also records the review file's hash.
Worker passes cannot replace final proof. A changed review target or a failed
combined check keeps the run incomplete.

Read each worker's diff yourself before accepting it; a worker's summary is a
claim, the diff is the evidence. A write outside every worker's paths stops
parallel work: preserve it and report the ownership conflict to the lead.
The lead checks the combined result. It commits a wave in dependency order only
when the user's scope includes commits. Workers never commit in the shared tree.
Units that share paths run one after another.

## Isolation

Native dispatch uses the external copies described above. For other host
workflows, when the user asks for an isolated checkout, or workers need their own trees:
if the probe (`project-state.mjs --json`) reports `git.linkedWorktree: true`,
you are already in one, so work in place. Otherwise use the host's worktree
tool when it has one, else `git worktree add` from the repository root, on a
named branch, under a directory Git ignores. One branch per worktree. When
creating one fails, ask before working in the main checkout.

## The unit loop

1. **Pick the check.** For new or changed behavior, write or name the check
   that proves it (a test, a script, a `verify` feature) and watch it fail for
   the right reason first. For a refactor or other change that must keep
   behavior, run the existing tests that cover it first; when they are thin,
   add a characterization test that pins today's output, and see it pass
   before you change anything. For configuration, build files, or documents,
   the check is the tool that reads them (the parser, the build, the linter,
   a link check).
2. **Build** the smallest change that makes it pass. Reuse what the codebase
   already has.
3. **Green.** Run the check, then the broader suite around it. Save the output
   of the checks you will report.
4. **Clean up.** Remove temporary logging, debug flags, and scratch files you
   added. Mark any you add with `DEBUG-TEMP` so `git diff | grep DEBUG-TEMP`
   finds them.
5. **Return or commit.** Workers return a result and proof to the lead without
   Git mutations. The lead commits only within the user's authorized scope,
   with a message naming the unit or ticket ID, following
   `../ship/references/commit.md`: staged work that was there before you began
   is not yours to commit, and neither is an edit the user had already made in
   the working tree. When a unit must change a file that already held their
   edits, ask once whether to include them, and name what you left out. Mark a
   ticket done only after the lead checks its `Verify with` result.

A failing check you cannot explain sends you to `debug`, not to a second
guess.

## Tests worth keeping

Test behavior through public interfaces, at the seams the plan names: a test
reads like a specification and survives a refactor. Fake only what the project
does not own (an outside service, time, randomness, and the database or file
system only when a real test instance is impractical). Pass such a dependency
in rather than building it inside, and give each outside operation its own
function, so a fake returns one shape with no branching. Three kinds of test
pass while proving nothing:

- **Coupled to internals:** it mocks the code's own collaborators, calls
  private functions, or checks through a side channel; it breaks on a refactor
  that kept the behavior.
- **Tautological:** the expected value is computed the way the code computes
  it, so the test cannot disagree with the code. Expected values come from a
  literal, a worked example, or the spec.
- **Written in bulk first:** all tests, then all code, tests imagined behavior.
  One test, one change, repeat.

## Finish

Run the plan's Verification commands. For user-facing behavior, run `verify`
and keep the evidence path. Re-read the requirements against the final diff,
and remove code left from an approach you abandoned. Then hand the branch to
`simplify` or `review`, and say whether review ran ("Review: not run" rather
than silence).

Report each unit as built and verified (the check, and its output's path),
built and unverified (say why), or not built.
