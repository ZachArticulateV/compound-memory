# Writing for agents

A skill, an `AGENTS.md` or `CLAUDE.md`, a plan, or a prompt is read by a model
that follows it. The goal is a predictable process: the agent takes the same
path every run, even when the output differs.

## Pointers decide what gets read

A **context pointer** names material outside the agent's context and the
condition for reaching it: a skill's description, a line in `AGENTS.md`
naming a doc. Its wording, not its target, decides when the agent reads the
material. A must-read file behind a weak pointer is a reliability bug: sharpen
the pointer first; inline the material only if that fails.

- Put the trigger word first.
- One trigger per distinct case; synonyms for one case are one trigger.
- Every word of an always-loaded pointer costs on every turn. Prune it hardest.

## Two budgets

- **Context load:** what sits in the agent's window every turn (instruction
  files, skill descriptions). Spend it only on what changes behavior.
- **Cognitive load:** what the human must remember (which skills exist, when to
  use each). Spend it where human judgment matters.

## Put each piece at the right height

1. Steps in the file: what the agent does, in order.
2. Reference in the file: rules and facts consulted as needed.
3. Reference behind a pointer: material only some cases need.

Inline what every path needs; move behind a pointer what only some paths
reach. Keep a concept's definition, rules, and caveats under one heading. A
document can be too long even when every line is true; split it by case or by
sequence.

## Every step ends on a done check

- **Clear:** the agent can tell done from not done. A vague end ("once you
  understand it") invites stopping early.
- **Demanding:** "every changed model accounted for" drives more work than
  "list the changes".

The strongest checks are both checkable and exhaustive.

## Words the model already knows

A **leading word** is a concept the model already has (_tracer bullet_,
_red_ for a failing check, _frontier_) used as a token, so it recruits the
model's own understanding in few words. Prefer an existing word to a coined
one. Look for a phrase spelled out at several sites and collapse it into one
word.

Say what to do, not what to avoid: "write one-line comments" rather than
"do not write long comments". A prohibition earns its place only as a hard
guardrail, paired with the positive target.

## Prune

- **One home per meaning.** Duplication costs tokens and drifts.
- **The environment is a source of truth.** Leave what one command or file
  shows (`package.json` scripts, `--help`, the directory tree) to the
  environment. Write down what looking cannot find: the unwritten convention,
  the reason, the gotcha.
- **Remove no-ops:** sentences the model would follow anyway. Test by running
  the document with and without them; delete the whole sentence.
- **Remove sediment:** lines that were true once.

## Skills specifically

- **Model-invoked** (has a description): the agent can reach it on its own,
  at the cost of an always-loaded description. **User-invoked**
  (`disable-model-invocation: true`): no context cost, but the user must
  remember it.
- A description says what the skill does and when to use it, under about
  1,000 characters, with a "use when" clause carrying the trigger cases.
- Keep `SKILL.md` a short router under 8,000 bytes (Codex's limit); move
  detail to `references/` and load it per mode.
- Write paths relative to the skill's directory (`${CLAUDE_SKILL_DIR}`), and
  say how a host without that variable resolves it.
- Facts a script can compute (counts, graphs, matches) belong in a bundled
  script, not in instructions the model must follow exactly.
