# Task selection

Start with the requested result. Use the smallest workflow that reaches it.
Read only the skill and mode needed for this request.
These are model instructions, not a deterministic command dispatcher.

## Scope comes first

- A question does not authorize a change. Answer it from evidence. Do not
  write files, launch a build, or save a new memory record just to answer it.
- Read-only means no file writes. If a check needs temporary output or another
  model call, disclose that effect and stay within the user's scope. A strict
  no-write request may need a narrower check and an explicit proof limit.
- Plan-only work ends with the requested plan or reply. A request to save a
  plan permits that document, not implementation, a commit, or publication.
- A small typo fix needs the edit and a check of the changed text. It does not
  need a plan file, a team, an audit, or a full test suite.
- Use authority already given in this conversation. Do not ask again for an
  accepted action. Ask only for a missing decision that changes the result.
- Do not expand a request to install tools, change user settings, schedule
  work, or publish. Those actions need authority in the request or session.

The scope rules apply before a mode's usual save, test, or commit step. When a
step exceeds the request, report that limit instead of claiming it ran.
Memory is useful context. Its presence does not make every task a memory task.

## Plain requests

| Requested result | Entry and mode |
| --- | --- |
| A reply to a simple question, calculation, or short rewrite | Answer directly |
| A small direct edit | Make and check the edit; no workflow is required |
| Requirements, options, a saved plan, or tickets | plan: brainstorm, decide, plan, or tickets |
| A demo to test one design question | prototype: logic or ui |
| Work from a plan or a specified code change | build: work |
| Simpler recent code or a measured improvement | build: simplify or optimize |
| A cause for a failure and a requested fix | debug |
| Findings on code or a document | review: code or doc |
| Proof from the real app | verify: run |
| A commit, PR, CI work, or feedback response | ship: the requested mode only |
| Explicit delivery through all stages | autopilot |
| A durable lesson or a retrospective | learn: the requested mode |
| A document or agent instructions | write: docs or agents |
| A work update | catch-up: chat or work |
| Project memory health | project-memory: status |
| Memory setup, update, handoff, questions, audit, repair, or cleanup | project-memory: the matching mode |

For a memory question such as "is memory stale?", start with status. Do not
upgrade it to an independent audit or repairs without that scope.
For "clean up this function", use code cleanup. For "clean up memory", use the
memory cleanup mode. Distinguish the object before selecting a workflow.

## Explicit entries and name collisions

Claude Code exposes plugin skills with their plugin prefix:
`/compound-memory:project-memory status` and `/compound-memory:handoff <focus>`.
The same prefix works for sync, grill, cleanup, and repair.
Short names such as `/handoff` can collide with another plugin or local skill.
Use the prefixed entry when the host lists it.

In Codex, select the skill from the host's skill list and check its plugin
source. Use `$handoff` only when that name resolves to this plugin. If a name
collision remains, name the Compound Memory skill and its installed SKILL.md
path explicitly. Do not assume Claude's slash-command syntax is a Codex API.

The five shortcuts are explicit-only on both hosts. Plain handoff or sync
requests select project-memory. Each shortcut reads one existing memory
playbook; it does not start a second skill or maintain a second procedure.

## Evidence

`evals/routing-cases.mjs` defines expected choices and scope checks. Its grader
uses observed skill calls, agent calls, and file changes. Unit tests prove the
grader and entry files agree. They do not prove a model made those choices.
Live runs must record the host, version, loaded entries, prompt, observed calls,
file changes, and outcome. Mark an unavailable host run as unverified.
