# Document review

Review a plan, spec, or document before anyone builds from it. A defect found
here costs a sentence to fix; the same defect found in code costs a rewrite.

## Lenses

Run these in parallel subagents for a long document, or in one pass for a
short one.

- **Coherence:** contradictions between sections, terms used two ways, a
  decision that a later section ignores.
- **Feasibility:** read the code the document depends on. Does the API exist,
  does the data model support it, does the framework behave as assumed?
- **Completeness:** every requirement testable; every unit with a verify
  command; Out of scope stated; open questions either answered or deferred on
  purpose.
- **Scope:** units or options no requirement asks for.
- **Reader:** for a document an agent will follow (a skill, a plan, an
  `AGENTS.md`), apply `../write/references/agents.md`; for one people read,
  `../write/references/docs.md`.

Findings follow the same shape as code review, with the document's path and
line, and a quote of the sentence at fault. Run them through
`findings-check.mjs` the same way.

## Report or edit

Report by lens. When the user asks you to fix the document, edit it in place:
change only the sentences a finding names, keep the author's wording
elsewhere, and list the edits.
