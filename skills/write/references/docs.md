# Documentation for people

Write so a tired engineer understands on the first read. Three rules sit above
the rest:

- **Cut every word that does no work.** "In order to" is "to". "It is
  important to note that" is nothing.
- **Use the short, everyday word.** "Use", not "utilize". "Help", not
  "facilitate".
- **When a rule makes a sentence worse,** fix the sentence another way or leave
  it. A sentence that obeys every rule and sounds machine-written has failed.

## Pick the mode first

One document, one purpose:

- **Tutorial** (learning by doing): say what the reader will build; every step
  shows a visible result; tell them what they should see.
- **How-to** (steps to a goal): name it by the task ("How to rotate the API
  key"), a problem a person has rather than an operation the machine does;
  action only; assume competence; allow forks ("If you use Docker, ...").
- **Reference** (facts to look up): describe only; dry, complete, certain;
  mirror the structure of the thing described, and generate it from the code
  where you can.
- **Explanation** (understanding why): one bounded topic, anchored on a real
  "why" question; its title still makes sense after "About"; context,
  trade-offs, history; opinion belongs here and nowhere else.

Split a document that mixes them, and link the parts.

## Sentences

- Talk to the reader as "you", in the present tense.
- Say who does what: "the compiler checks", not "is checked".
- Write instructions as commands, with the condition first: "To delete the
  file, run ...".
- Common case first, exceptions after.
- "Will" only for the future. No "please", "simply", "easy", or "just" in a
  procedure, and no announcing what the product will soon support. Buzzwords
  and figures of speech go.
- A term the reader may not know is defined where it first appears; invent no
  label the codebase does not use.
- Headings carry the point ("Pick the mode first", not "Modes"), in sentence
  case: a task heading is a verb phrase, a concept heading a noun phrase. One
  H1, and no skipped levels.
- Numbered lists for sequences, bullets for the rest, each introduced by a full
  sentence, with items in parallel form.
- Link text says where the link goes; never "click here".
- Code font for code, file names, and commands; bold for the names of UI
  controls. Serial commas, and no "etc.".

## Load one statement at a time

- One instruction per sentence. Split instructions longer than about 20 words
  and other sentences longer than about 25.
- Put the warning before the step it guards.
- Keep the articles ("remove the backup file").
- One word per meaning, one meaning per word, kept throughout.
- Keep "only" and "not" next to what they change.
- Make every "it", "this", and "they" point at one obvious thing.
- Periods, not semicolons or em dashes. No slashes ("a, b, or both"), and no
  "(s)" plurals.

Write for a reader whose first language is not English, and for an agent:

- Break up noun strings ("the user session token refresh handler").
- Keep the verbs, the "that", and the articles in a series ("the build and
  the tests"); use "both ... and" and "either ... or" whole.
- "This" points at a noun, never at a whole clause: "this check", not "this".
- Parentheses hold a complete phrase. No idioms and no Latin abbreviations
  ("for example", not "e.g.").

`rewrite-check.mjs --tells` lists the mechanical ones (heading levels, title
case, "click here", slashes, "(s)", em dashes, Latin abbreviations); see
`plain.md`.

## Vary the rhythm

Mix sentence lengths on purpose. Be specific: not "schema changes can cause
issues" but "a column rename fails the build". Take a view where the mode
allows it.

## Specific documents

- **PR descriptions and commit messages:** every rule but the mode choice. A PR
  body is a briefing a reviewer reads in under a minute; link logs and tables
  rather than pasting them.
- **Reports:** the decision or finding first, then the evidence, then the
  detail.
- Every count and file tree in a document is true at the commit that lands it,
  with the command that regenerates it beside it.

## Example

Before:

> Configuration of the import budget script parameters is performed via
> budget.json. Note that running with --write, which updates the committed
> budget, should only be done when lowering it. If exceeded, CI fails.

After:

> `budget.mjs` reads the committed budget from `budget.json` and counts the
> files that import protos. If the count exceeds the budget, CI fails. Run
> `budget.mjs --write` only to lower the budget.
