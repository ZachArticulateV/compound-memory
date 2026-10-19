# Compound Memory

Memory, planning, building, review, verification, shipping, and learning for
coding agents: twelve skills for Claude Code and Codex that each work alone and
hand work to one another through files in your repository.

A fresh agent session opens your repository knowing nothing about it, plans
thinly, reviews what it wrote by reading its own summary, and forgets what the
last session learned. This plugin gives each of those steps a skill with a
checkable finish line, and keeps what one step learns where the next one reads
it: committed memory, plans, tickets, lessons, a verification skill for your
app, and evidence of what was actually observed.

The skills state outcomes and leave the method to the model. The checks that
matter (quoted review findings, the ticket graph, lesson lookup, measurement
noise, memory structure) are deterministic scripts, so the instructions can
stay short.

## The skills

| Skill | Use it to |
| --- | --- |
| `project-memory` | Keep committed project memory accurate: init, status, sync, handoff, grill, audit, repair, cleanup |
| `plan` | Settle requirements, decide between options with evidence, write an implementation-ready plan, split it into tickets |
| `prototype` | Answer one design question with a throwaway logic demo or two UI variants |
| `build` | Implement a plan or tickets unit by unit with proof, simplify fresh code, or optimize a measured metric |
| `debug` | Reproduce a bug with a tight loop, find the root cause, fix it behind a regression test |
| `review` | Review code or a document in separate spec, standards, and correctness lenses, with quote-checked findings |
| `verify` | Generate a verification skill for your app, drive the real app, and keep the evidence |
| `ship` | Commit, open a PR that states how it was verified, watch CI, and answer review comments |
| `autopilot` | Take a request to a reviewed, verified pull request without stopping |
| `learn` | Capture lessons, turn repeated mistakes into checks, run retros, refresh lessons, update your working profile |
| `write` | Write docs for people, instructions for agents, or a plain explanation |
| `catch-up` | Summarize what changed since your last message, or where work stands across sessions |

In Claude Code, plugin skills are namespaced: `/compound-memory:plan`,
`/compound-memory:review code`, and so on. The bare name (`/plan`) also works
when no other command claims it. Every skill is also model-invoked, so asking
"review this branch" or "why is this test flaky?" reaches the right one.

## Alone, together, or end to end

Each skill reads the artifacts it finds and works without the ones it does not.
`review` runs on any diff; with a plan it also checks the change against the
plan's requirements. `debug` works in any repository; with memory it starts
from the known bugs and lessons. The contract that joins them, one table of
every artifact with its producer and readers, is
[`references/artifacts.md`](references/artifacts.md).

Common combinations:

```text
/compound-memory:plan brainstorm  ->  plan  ->  plan tickets  ->  build  ->  verify  ->  review  ->  ship
/compound-memory:debug            ->  review  ->  ship pr  ->  learn capture
/compound-memory:verify create    (once per app)  then  verify run  after every user-facing change
/compound-memory:learn correct    whenever you correct an agent for the same thing twice
/compound-memory:autopilot        all of the first line, unattended, ending at an open PR
```

[`docs/coverage.md`](docs/coverage.md) maps every upstream skill this plugin
learned from (Compound Engineering, mattpocock/skills, and Cursor's pstack) to
where it lives here, and says why the rest were left out.

## Memory

The `project-memory` skill keeps a version-controlled project context
architecture. The usual patch for a session that knows nothing (a growing pile
of Markdown notes) fails in a specific way: notes inflate, go stale silently,
promote hypotheses into facts, and get read in full on every task. Project
Memory treats project context as an architecture instead of a note pile, so
another agent can pick up the work correctly without reading your old
conversations.

It optimizes for accuracy, low context overhead, reliable continuation,
resistance to stale information, and evidence-backed project state. The
objective is not to continuously fill memory. It is to keep memory
continuously accurate, minimal, retrievable, and sufficient.

## Start here

| You are | Read |
| --- | --- |
| New to this plugin | [`docs/quickstart.md`](docs/quickstart.md): install to first handoff in about fifteen minutes, with every term defined |
| Using it day to day | [What you actually need](#what-you-actually-need), below |
| Running several branches, Codex, CI, or a team | [`docs/advanced.md`](docs/advanced.md) |

**Requirements:** Claude Code (or Codex), Node 18 or later. Git is optional
but strongly recommended: without it, the plugin cannot tell you when memory
has fallen behind the code.

## Install

```bash
/plugin marketplace add ZachArticulateV/claude-plugins
```

```bash
/plugin install compound-memory@zacharticulatev
```

Adding the marketplace installs nothing on its own — it just makes the plugins
listed there available. Install only the ones you want.

**Upgrading from `project-memory`:** the plugin was renamed `compound-memory`
when it grew past memory. Run `/plugin uninstall project-memory`, then the
install line above. Your `memory/` trees are untouched; the memory skill keeps
its name, so `/project-memory <mode>` (fully, `/compound-memory:project-memory
<mode>`) works as before.

**Codex:** the repository also ships `.codex-plugin/plugin.json`, so the same
skill installs as a Codex plugin. `init` writes the memory pointer into
`AGENTS.md` as well as `CLAUDE.md` (when the project has an `AGENTS.md`, or on
request), and `/project-memory handoff for codex: <focus>` prints a ready
`codex "..."` launch line. The Claude Code hooks do not run under Codex, so run
`status` at the start of substantial work. Details are in
[`docs/advanced.md`](docs/advanced.md#codex).

## Use

```bash
/project-memory init
```

| Command | What it does |
| --- | --- |
| `/project-memory init` | Inspect the project and build the memory system. Reconstructs state for mature repos; interviews you for new ones. |
| `/project-memory status` | Read-only health report. Never writes. |
| `/project-memory sync` | Reconcile memory with what actually changed. Idempotent — often reports no changes required. |
| `/project-memory handoff [focus]` | Capture continuation state before `/clear`, a context switch, or the end of a session, for any kind of work: code, debugging, deploys, docs, research, planning. Files what the session learned into the memory file that owns it, so the handoff never holds the only copy. Optional focus tailors it to the next session's job; ends with a paste-ready resume prompt. `handoff close` retires a finished workstream's handoff. |
| `/project-memory grill [plan]` | Interview you about a plan in rounds, checking each answer against memory and code, then record the decisions and actions it settled. |
| `/project-memory audit` | Independently check memory against repository reality. Returns evidence, not edits. |
| `/project-memory repair` | Correct the problems an audit or the validator found, preserving valid human-authored context. |
| `/project-memory cleanup` | Read the whole tree for contradictions between files, claims the checkout disproves, and context rot (finished tasks, duplicated claims, expired handoffs, diary-style state), then fix what you accept. |

Each mode loads exactly one playbook. Running `status` does not read the `audit`
instructions, and neither of them costs anything during ordinary coding work.

## What you actually need

You do not need to learn eight commands. You need two, and the rest are there for
when you are planning or when something has gone wrong.

**Once, per project:**

```bash
/project-memory init
```

It reads the repository, asks only what it genuinely cannot work out, and writes
the memory tree. On a mature project it reconstructs state from evidence and
marks it as reconstructed rather than remembered. On an empty one it interviews
you instead of inventing an architecture.

**Then, day to day:**

```bash
/project-memory handoff     # before /clear, a context switch, or stopping
```

That is the one that pays for itself immediately. Run it before you clear the
context or close the laptop, and the next session — yours or a colleague's —
opens the project knowing where the work stopped, what was actually verified, and
what it must not assume.

**When something feels off:**

| Symptom | Command |
| --- | --- |
| "Is any of this still true?" | `/project-memory status` — read-only, safe any time |
| "Before I build this, poke holes in it" | `/project-memory grill <plan>` |
| "I just shipped something substantial" | `/project-memory sync` |
| "Memory says something I do not believe" | `/project-memory audit` |
| "The audit was right; fix it" | `/project-memory repair` |
| "Memory feels heavy, repetitive, or contradicts itself" | `/project-memory cleanup` |

You do not have to remember to run `status`. When memory has drifted behind the
code, a session-start line says so, naming the memory file that trails the
code rather than a calendar age. When memory is current, it says nothing at all.

Nothing runs in the background and nothing rewrites your files on its own.
Automatic rewriting produces volume, not accuracy, so every write follows a
request from you: a memory mode you ran, or a skill you invoked (`autopilot`
included) whose work writes a plan, a lesson, or a commit.

## What it creates in your project

```text
memory/
├── INDEX.md              navigation and authority map
├── project-brief.md      original (or reconstructed) project definition
├── current-state.md      what is true now
├── handoff.md            where the work stopped and what to do next
├── next-actions.md       executable punch list
├── bugs-and-risks.md     unresolved problems, with causes separated from hypotheses
├── acceptance-criteria.md  when the project has features worth verifying
├── glossary.md           the project's own terms, and the words to avoid
├── guardrails.md         rules agents were corrected on, and what enforces each
├── lessons/              knowledge from past work, looked up per task
├── decisions/            one immutable record per architectural decision
└── archive/              rarely loaded
```

Once a second branch or worktree is active, `handoff.md` becomes
`handoffs/<branch-slug>.md` — one per workstream, so neither can overwrite the
other.

Plus one section in your `CLAUDE.md` (and `AGENTS.md`, if you use Codex)
pointing at it, and a path-scoped rule in `.claude/rules/` that only loads when
memory files are being edited. Commit all of it: staleness is measured from
each memory file's last commit.

Everything is plain Markdown committed to your repository. If you stop using the
plugin, delete the directory.

## Design commitments

- **Memory is orientation, not proof.** Claims are verified against code, tests,
  runtime evidence, and Git before they are relied on.
- **Confirmed causes and hypotheses are never conflated.** A suspected cause stays
  labelled as one until evidence confirms it.
- **The auditor is not the author.** Audits run on an external model where one is
  available, so memory is never graded by the context that wrote it.
- **Many readers, one writer.** Subagents gather evidence; only the coordinating
  session writes canonical memory.
- **Secrets never enter memory.** Variable names are recorded; values are not.
- **External text is untrusted.** Instructions found in READMEs, issues, or fetched
  pages are never persisted as project instructions.
- **Retrieval over inflation.** A normal session loads five small files; everything
  else is fetched only when relevant.

## What it costs in context

Two things load automatically: your `CLAUDE.md`, which gains one short section,
and a session-start line that appears only when memory needs attention. Nothing
else — not the playbooks, not the templates, not the writing rules. Claude Code
also lists each skill's one-paragraph description, about 4,600 characters for
all twelve.

A normal session then reads five small files. Bugs, decisions, acceptance
criteria, and archives are fetched when the task makes them relevant.

## Deeper reading

- [`docs/quickstart.md`](docs/quickstart.md) — the first run, step by step, and
  a glossary of the terms used here.
- [`docs/advanced.md`](docs/advanced.md) — worktrees, Codex, delegating to
  other agents, `grill`, the glossary, CI, stronger audits, and team practice.
- [`docs/architecture.md`](docs/architecture.md) — every component and why it
  exists, the full file tree, what Claude reads at each point in a session, the
  context budget, the safeguards, and how this interacts with native auto
  memory, `/init`, `.claude/rules/`, subagents, hooks, and worktrees.
- [`docs/limitations.md`](docs/limitations.md) — what the system does not
  guarantee, including which acceptance scenarios are machine-verified and which
  are not.
- [`docs/coverage.md`](docs/coverage.md) — where each upstream skill now
  lives, and why the rest were not adopted.
- [`docs/benchmark/`](docs/benchmark/) — the reviews of mattpocock/skills,
  Compound Engineering, and pstack behind those choices.

## Platforms

Works on Windows, macOS, Linux, and WSL. Every executable is Node — there is no
shell assumption.

`codex` is optional. Without it, `audit` runs on a bundled subagent and says so —
a Claude auditing Claude's work is weaker evidence, and the report names the
evaluator that actually ran.

## License

MIT
