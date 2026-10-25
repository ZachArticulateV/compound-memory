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
  purpose. A plan with no units yet (brainstorm stage) is checked only for what
  `plan-check.mjs --stage brainstorm` checks.
- **Scope:** units or options no requirement asks for, code that already does
  what the document plans to build, and a new abstraction or option with one
  current user.
- **Premise,** for requirements, a high-stakes domain, or a new abstraction:
  would meeting every requirement solve the stated problem; what the document
  assumes about users, scale, order, or environment without saying so; which
  hard-to-reverse decision rests on no evidence.
- **Design,** for screens and flows: each screen's states (empty, loading,
  error), how each flow is entered and left, keyboard use and small screens,
  and interactions described only by what they do.
- **Reader:** for a document an agent will follow (a skill, a plan, an
  `AGENTS.md`), apply `../write/references/agents.md`; for one people read,
  `../write/references/docs.md`.

When the document plans a change the conditional lenses in `lenses.md` cover
(security, performance, migration, interface), apply them to the plan. For a
document in a high-stakes domain, run one lens, or a whole-document read, on a
different model when one is available, and set `model` on its findings.

Findings follow the same shape as code review, with the document's path and
line, and a quote of the sentence at fault. Run them through
`findings-check.mjs` the same way.

## Report or edit

Report by lens. When the user asks you to fix the document, edit it in place:
change only the sentences a finding names, keep the author's wording
elsewhere, and list the edits. When `plan` runs this review on its own draft,
apply the fixes with one right answer (a count that disagrees with its list, a
link to a section that does not exist, two words for one concept) and list
them; propose anything that changes meaning, and ask only the choices the user
owns. A finding the user defers goes into the document's Open questions,
marked deferred with its reason, so `plan-check.mjs` and the next reader see it.

On a second pass in the same session, do not raise again a finding the user
rejected unless its text changed, and confirm each applied fix landed. After
two passes, recommend stopping.
