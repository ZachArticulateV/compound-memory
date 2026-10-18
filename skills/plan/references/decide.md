# Decide

Recommend one option for a judgment call, grounded in evidence, or say that
the evidence does not support a recommendation yet.

## Steps

1. **Frame it.** State the question in one sentence and list the options,
   including doing nothing. Name what the choice costs to reverse.
2. **Take your position first.** Write down which option you favor and why,
   before you gather opinions. A position formed after reading others' answers
   is an echo.
3. **Gather two kinds of evidence.**
   - *Project evidence:* the code, decision records in `memory/decisions/`,
     lessons, Git history, measurements you can run.
   - *Outside evidence:* official documentation, upstream issues, benchmarks,
     how comparable projects chose.

   If either kind is empty, the answer is **Hold**: name the evidence that
   would settle it and how to get it. A guess presented as a verdict costs more
   than a short delay.
4. **Get a second opinion when the stakes justify it** ("oracle this", or a
   choice that is hard to reverse). Give another model (for example the Codex
   CLI, or a subagent on a different model) the same question and evidence,
   without your position. Compare reasons, not votes. Models that agree can
   share a blind spot; say so when they agree.
5. **Revise** if the evidence or the second opinion moved you, and say what
   moved you.

## Output

```markdown
**Recommendation:** <option> (confidence: high | medium | low)
**Why:** <three reasons at most, each citing its evidence>
**What would change it:** <the observation that would flip the call>
**Cost of being wrong:** <reversible in a day | needs a migration | ...>
```

When the decision is hard to reverse, surprising without context, and a real
trade-off, offer to record it with `/project-memory` as a decision record.

## Done check

A recommendation or a Hold, every claim tied to evidence, and the reversal
cost stated.
