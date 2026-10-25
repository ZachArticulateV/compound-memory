# Tickets

Split a plan, spec, or conversation into tickets: tracer-bullet vertical
slices, each one demoable on its own, each declaring the tickets that block it
and the paths it touches.

## Slice

- Each ticket cuts a narrow, complete path through every layer (schema, API,
  UI, tests). A ticket that is one layer of everything is a horizontal slice;
  recut it.
- Each ticket fits one fresh context window and ends in a verifiable result.
- Prefactoring comes first, as its own ticket.
- **Wide refactors** (a rename or retype that breaks every caller at once) use
  expand and contract: one ticket adds the new form beside the old, migrate
  tickets move callers in batches sized by blast radius, and a final ticket
  deletes the old form once nothing uses it. When a batch cannot pass on its
  own, the batches share an integration branch and all block one final
  integrate-and-verify ticket, the only one that promises green.

Describe behavior from the user's side. In **Touches**, name directories or
modules, not lines: coarse areas stay true longer and are enough to show which
tickets can run at once.

## Confirm

When a human is present, show the breakdown as a numbered list (title, blocked
by, what it delivers) and ask whether the granularity and the edges are right.
Iterate until they approve. In an `autopilot` run, go on with your breakdown.

## Publish

- **Local files** (the default): one file per ticket at the path in
  `../../references/artifacts.md`, numbered in dependency order, in the ticket
  shape given there.
- **An issue tracker** the project already uses: one issue per ticket, created
  blockers first, with the tracker's native blocking links where it has them.
  When the work came from an issue, read its body and comments first, make
  each ticket its sub-issue (or link the parent), and leave the parent open and
  unedited. Apply the project's existing ready label when it has one.

## Check the graph

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/tickets-check.mjs" --dir docs/plans/<slug>/tickets
```

Fix every cycle and unknown blocker it reports. When two frontier tickets touch
the same paths, add an edge between them or merge them; otherwise two agents
will edit the same files at once.

When the project has a memory tree, the frontier tickets can go into
`memory/next-actions.md` as delegated items: the ticket's `Verify with` is the
`Done when` line.

## Done check

`tickets-check.mjs` reports no cycle and no unknown blocker, and every open
ticket has a `Verify with` line.
