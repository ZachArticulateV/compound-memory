# Benchmark: skill candidates from mattpocock/skills and cursor/plugins (pstack)

A review of 13 skills considered for adoption, with a verdict for each and the
change it needs before use. The earlier pattern-by-pattern comparison with
mattpocock/skills for this plugin is `mattpocock-skills.md`.

Reviewed on 2026-10-18 at mattpocock/skills `49dd158` (2026-10-09) and
cursor/plugins `d1715e0` (2026-10-17).

## Common traits

- **Small.** 11 to 106 lines each, against CE's thousands. They rely on model
  competence and enforce almost nothing in code. Two are exceptions in effect:
  `create-verification-skill` must run its own output end to end, and
  `correct` makes the agent build checks.
- **pstack is Cursor-first.** All eight pstack skills set
  `disable-model-invocation: true`, so they run only when typed. Their bodies
  name Cursor paths and tools (`.cursor/skills/`, `AskQuestion`,
  `~/.cursor/projects/.../agent-transcripts/`). The Claude Code copy under
  `harness/pstack/claude-code/` adds one line telling the agent to read an
  adapter table that maps the names. That translation is prompt-level.
- **pstack skills reference each other.** `unslop`, `why`, `bro`,
  `visualize`, `poteto-mode`, `maintain-verification-skill`, and
  `show-me-your-work` are named inside the reviewed skills. Copying one file
  alone leaves dead references; install the plugin or rewrite the pointers.
- **Matt's `to-tickets` and `code-review` need `/setup-matt-pocock-skills`**
  to configure the issue tracker first.

## Verdicts

| Skill | Verdict | Change needed |
| --- | --- | --- |
| `create-verification-skill` (pstack) | Adopt first | Synthetic seed data only; evidence directory out of Git |
| `correct` (pstack) | Adopt | Map "types and lint" to validator scripts for Markdown systems; keep the rule table in its own file |
| `code-review` (Matt) | Adopt | Add a correctness axis; it does not hunt bugs |
| `ketchup` (pstack) | Adopt | Expect diagrams not to render in a terminal |
| `technical-writing` (pstack) | Adopt as the one human-doc standard | Point the other writing rules at it |
| `writing-for-agents` (Matt) | Adopt as the one agent-doc standard | Already partly adopted here (iteration 5) |
| `to-tickets` (Matt) | Adapt | Add a files-touched line and a verify command per ticket |
| `prototype` (Matt) | Adapt | Default is 3 variants, cap 5; set 2 if that is the rule |
| `retro` (Matt) | Adapt | Use as input to `correct`; it has no finish check |
| `recall` (pstack) | Take the output contract only | Project memory already holds the state it reconstructs |
| `automate-me` (pstack) | Update mode only | Diff mined behavior against existing rules; do not create a second copy |
| `principle-prove-it-works` (pstack) | Keep as one rule line | Needs scripted checks to have any effect |
| `principle-encode-lessons-in-structure` (pstack) | Skip | `correct` is the working version of the same idea |

## Per skill

### create-verification-skill

Generates `verify-<app>/` with Launch, Doctor, Drive, Evidence, and Cleanup
sections, plus a feature map with four fixed headings per feature. Strong
rules: interview the repo, not the user; "ready means usable, not just that a
process answers"; kill only what you started; evidence survives cleanup;
never weaken a journey to make it pass; run the generated skill once end to end
before handing it over, and list every step a stand-in environment did that the
real target will not.

Risk: evidence is screenshots, response bodies, and DB state. In an app that
can hold personal or health data, that can capture a real person's records. Require synthetic seed data and
keep the evidence directory out of Git.

### correct

Fix each repeated mistake at the highest level that works: architecture,
then types, then a lint whose error names the fix, then a test, then docs.
A class counts after two occurrences. Each new check must fail on a real past
mistake. Already-common patterns fail only when a change adds more.
Exceptions go on the line with a reason, an expiry, and a human's approval.
A rule-to-enforcer table records what enforces each rule.

Gaps: it assumes a typed codebase with CI. It puts the rule table in the agent
instruction file, which is always loaded; `writing-for-agents` would put it
in a separate file behind a pointer.

### code-review (Matt)

Two parallel subagents: Standards (repo docs plus a Fowler smell baseline,
always judgment calls) and Spec (missing, scope creep, wrong; each with a
quoted spec line). Reports stay separate with no reranking across axes. Fails
fast on a bad ref or an empty diff.

Gaps: neither axis looks for runtime bugs, security, or data loss. No
confidence or validation pass. 400-word cap per axis. Asks for the fixed point
when none is given, which blocks unattended runs. Two subagents against CE's 7
to 9: much cheaper, and it misses what CE's correctness reviewer catches.

### ketchup

Reports only what changed since the user's last message. An action item is a
call only the user can make, with a recommendation and what happens if the
user does not answer. Under 150 words. Never marks done what still waits on
the user; checks every number shown. Read-only. Depends on `bro` and
`visualize`.

### technical-writing

Diátaxis mode first, Google developer style, Simplified Technical English
limits (20 words per instruction, 25 otherwise), Global English
disambiguation, "the codebase is the word list", and a rhythm rule so
rule-following prose does not read as machine-written. Depends on `unslop`.

### writing-for-agents

Context pointers (wording decides when material is reached), context load
against cognitive load, completion criteria judged on clarity and demand,
leading words, positive phrasing over prohibition, the environment as source of
truth, and no-op hunting. Reference only; it checks nothing.

### to-tickets

Vertical tracer-bullet tickets with blocking edges, worked by frontier.
Expand-contract for wide refactors. Avoids file paths so tickets stay durable.
Asks the user to approve the breakdown.

Gaps for several agents at once: no check that two unblocked tickets touch
different files (CE runs an 8-point check before parallel work), acceptance
criteria carry no verify command, and "fits in one fresh context window" is
not measurable.

### prototype

The question picks the shape: a single-file HTML logic demo with a pure,
liftable module, or UI variants on an existing route behind `?variant=` with a
switcher that never ships to production. The prototype is kept on a throwaway
branch; only the decision lands on main.

Gaps: the UI branch assumes a code router (Next, React Router). For a site
built without one (a hosted site builder or a CMS), use the single-file HTML branch instead.

### retro

Seven categories: navigation, automated checks, coding standards, global
`AGENTS.md`, tool economy, no-ops, information access. Mechanical violations
get a deterministic check; only judgment calls go in `CODING_STANDARDS.md`.
The reviewer enforces standards because it has the least context pressure.

Gaps: the last step is "present candidates", with no finish check, which its
own `writing-for-agents` warns against. It does not say where session logs
are. It has no apply or verify step.

### recall

Output contract: at most five capsule bullets, one status tag per thread,
at most five recurring problems, one next move. Locks scope before searching,
verifies against `git` and `gh`, and fans out cheap subagents over
transcripts.

It rebuilds state from transcripts because pstack has no canonical memory.
This plugin's `status` and `handoff` already hold that state. The output
contract is the transferable part.

### automate-me

Mines transcripts in slices, keeps signals seen in two or more slices,
updates in place mining only history since the last edit, and references
other skills instead of pasting them. Evaluation is a vibe check. Depends on
Cursor's `create-skill` and `AskQuestion`.

### principle-prove-it-works

Verify the real artifact, not a proxy; suspect the observation method first;
script the check. Twenty-two lines and no mechanism. Specific failures such as
clipped forms need a scripted check: for example, a Playwright run at several
viewport widths that fails when a form element's bounding box exceeds its
container or the viewport, with a screenshot saved as evidence.

### principle-encode-lessons-in-structure

Eleven lines. The main rule is only in the frontmatter `description`; the
body holds the exception and the corollary. `correct` covers the same idea
with a procedure.

## Overlaps to resolve

Keep one owner per meaning:

| Meaning | Candidates | Owner |
| --- | --- | --- |
| Repeated mistake becomes a check | `retro`, `correct`, `principle-encode-lessons-in-structure` | `correct`, fed by `retro`'s categories |
| Writing for humans | `technical-writing`, existing plain-English rules, CE `ce-noslop` | One of them; the rest point to it |
| Writing for agents | `writing-for-agents` | `writing-for-agents` |
| Status across sessions | `recall`, project-memory `status` and `handoff` | Project memory, with `recall`'s output contract |
| Status within a chat | `ketchup` | `ketchup` |
| Proof of done | `principle-prove-it-works`, `create-verification-skill` | `create-verification-skill` |

## Candidates for this plugin

- `recall`'s output contract for the `status` report: capsule, tagged threads,
  recurring problems, one next move.
- `ketchup`'s action-item format for handoff decisions that wait on the user:
  the call, a recommendation, and what happens if the user does not answer.
- `correct`'s rule-to-enforcer table as an `audit` check: a memory rule with
  no enforcer that was broken twice is a finding.
