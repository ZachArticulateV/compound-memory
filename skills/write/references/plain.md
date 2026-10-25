# Plain

Two jobs: explain something the user did not follow, or rewrite a draft so it
reads plainly and carries no AI writing tells.

## Explain

The target is what the user named: a file, a link, a pasted passage, a part of
the conversation ("the migration part"), or, with nothing named, your last
message. When you cannot tell which, ask one short question.

- Open with the point in one or two sentences: what it says and why it matters
  to them.
- Then what it means for them: what happened, what state things are in, what
  they need to decide or do.
- Write in the register of Simplified Technical English: short sentences, one
  statement each, active voice, present tense, one word for one meaning.
- Use everyday words and the project's own terms from its glossary
  (`memory/glossary.md`, or the `GLOSSARY.md` it keeps). Keep a technical term
  when it matters, and say what it means once.
- Keep everything that would change what they do: failures, caveats, open
  questions. The explanation must not sound surer or more positive than the
  source.
- When the source itself is vague or contradicts itself, say so rather than
  pick a reading. When re-reading shows your earlier message was wrong, say so
  and correct it.

The explanation is shorter than the source. It explains; it does not rewrite
section by section.

## Rewrite or check

Check each sentence:

1. **Mechanism:** does it say what the thing does, or how it feels? Replace
   the feeling with the fact.
2. **Specific:** could it move to another project unchanged? Then it says
   nothing about this one.
3. **Actor:** who does the verb? Name them when the source says.
4. **One idea:** would the reader reread to hold it? Split it.
5. **Decision first:** does the first sentence carry what the reader needs?
6. **Reader can act:** could someone without the code open act on it? Gloss
   the identifier, or name the consequence.

Common tells:

- filler openers ("It's worth noting"), filler phrases ("in order to"), and
  closing summaries or upbeat outlooks that repeat the body;
- stacked hedges, and vague attributions ("experts suggest") with no source;
- "not just X but Y", ideas forced into groups of three, false ranges ("from
  setup to scale"), and rejecting an alternative nobody raised;
- fancy ways to say "is" ("serves as", "stands as", "boasts");
- empty -ing tails ("..., highlighting its importance");
- vocabulary such as delve, robust, seamless, leverage, pivotal, landscape,
  tapestry, testament, underscore, and metaphor nouns that name no mechanism
  (substrate, flywheel, north star, wedge): say what the thing does;
- invented labels for an ordinary action ("the hydration pass"): name the
  action;
- an adverb or a noun doing a verb's job ("make a decision", "significantly
  faster"): use the verb, or the number;
- mannered prose: aphorisms, personified code, dramatic fragments, a colon
  that sets up a reveal, setup-and-reversal, and em dashes as rhythm;
- compressed notes: arrows, dropped articles, verbless fragments, and
  unexplained abbreviations ("parser rejects date → exit 2") instead of whole
  sentences;
- chat artifacts: openers and closers ("Great question", "Hope this helps"),
  praise for the question, announcing what comes next, narrating your process
  in a report, guesses filling a gap in what you know, and bare counts offered
  as thoroughness;
- one thing called by several names in a paragraph;
- bold on every other phrase, a bold label that restates its line,
  decorative emoji, curly quotes in source files, and title-case headings.

The pattern-shaped ones can be listed in code; each hit is a candidate, not a
verdict:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/rewrite-check.mjs" --tells <file>
```

- **Rewrite:** fix every instance that has a plainer equivalent, changing only
  the sentences that fail; a second pass on the result changes nothing.
- **Check:** report a pattern when three or more appear in a passage or one
  repeats across passages. Name it, quote the line, give the fix in a few
  words, and rewrite nothing.

Never say whether a text was written by a model.
