# Decide

Recommend one option for a judgment call, grounded in evidence, or say that
the evidence does not support a recommendation yet.

## Steps

1. **Frame it.** State the question in one sentence and list the options,
   including doing nothing. Name what the choice costs to reverse. The subject
   can also be a document's direction or options someone else wrote
   (line-level findings stay with `review doc`). When the options would have to
   be invented, or nobody knows what would make one better, run `plan
   brainstorm` first.
2. **Take your position first.** Write down which option you favor and why,
   before you gather opinions. A position formed after reading others' answers
   is an echo.
3. **Gather the evidence the question needs.**
   - *Project evidence:* the code, decision records in `memory/decisions/`,
     lessons, Git history, closed issues and pull requests where the team
     already tried or rejected it, measurements you can run, and for a
     dependency its license and the runtime versions it needs. Every decision
     about this project needs some. A claim made earlier in the conversation
     is a lead to check, not evidence; try to disprove each one the call rests
     on.
   - *Outside evidence:* official documentation, source, upstream issues,
     benchmarks, how comparable projects chose. Needed when the choice turns on
     how something outside the repository behaves (a library, a host, a
     service, a standard); read the current version, not memory of it. A
     choice that turns only on this repository does not need it.

   If the evidence the question needs is missing, the answer is **Hold**: name
   the evidence that would settle it and how to get it. A guess presented as a
   verdict costs more than a short delay.
4. **Get a second opinion when the stakes justify it** ("oracle this", or a
   choice that is hard to reverse). Give a different model when one is
   available (the Codex CLI from Claude Code, `claude -p` from Codex), or a
   fresh subagent otherwise, the same question and evidence, without your
   position. Say which it was: a fresh context on the same model is a second
   reading, not a second model. Compare reasons, not votes. Models that agree
   can share a blind spot; say so when they agree. When the second opinion
   lands on another option, send it the evidence each side used and ask once
   more. Report whether it moved; if still split, say whether the gap is in
   evidence or in judgment ("either is viable", with the trade-off).
5. **Revise** if the evidence or the second opinion moved you, and say what
   moved you.

## Output

```markdown
**Recommendation:** <option> (confidence: high | medium | low)
**Why:** <three reasons at most, each citing its evidence>
**What would change it:** <the observation that would flip the call>
**Cost of being wrong:** <reversible in a day | needs a migration | ...>
```

For "should we adopt, switch to, or are we exposed to X", the recommendation
is one of **Adopt**, **Trial** (on one slice first), **Hold**, **Reject**, or
**Not affected**; a Trial or Hold names the short test, changing nothing, that
would settle it.

When the decision is hard to reverse, surprising without context, and a real
trade-off, offer to record it with `/project-memory` as a decision record.

## Done check

A recommendation or a Hold, every claim tied to evidence (outside claims to a
source you read), and the reversal cost stated.
