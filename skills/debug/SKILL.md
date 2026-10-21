---
name: debug
description: "Find the root cause of a bug and fix it with proof: reproduce the failure, test competing explanations, trace the cause from trigger to symptom, and fix it behind a regression test. Use when something is broken, failing, flaky, slower than it used to be, or behaving differently than expected."
argument-hint: "[symptom, failing test, error, or issue]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/measure.mjs" *)
---

# Debug

Explain why the failure happens, from trigger to symptom with no gaps, and
change the code so it cannot happen again. A fix without an explanation is a
guess that happened to pass.

**Done when:** a check that reproduced the symptom now passes (for a rare bug,
its measured failure rate dropped to zero over enough runs to show it), a
regression test failed before the fix and passes after it, or the report says
why no test could reach it; the temporary instrumentation is gone; and the
causal chain is written down.

## Steps

1. **Ground.** Read what the project already knows about this area:
   `memory/bugs-and-risks.md` (known bugs and open hypotheses), the matching
   lessons, recent commits on the suspect paths, and related issues or PRs.

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --query "<symptom>" --paths <path>,<path>
   ```

2. **Build a loop that goes red.** Name one command you have already run that
   fails on the user's exact symptom (not merely "it errors"). Best is one that
   gives the same verdict every run in seconds; `references/techniques.md`
   lists ways to build one. A rare, slow, or timing bug may only allow a loop
   that fails some of the time or takes minutes: measure its failure rate and
   use it. A bug seen only in production may only allow instrumentation and a
   wait for the next occurrence. If you cannot build any loop, say so, list
   what you tried, and ask for what would make one (access to the failing
   environment, a captured log or trace). A hypothesis formed before you can
   observe the failure is a guess. Redact secrets from every command and
   output you show.
3. **Audit assumptions.** List what you believe about the failing path and mark
   each belief verified or assumed. The bug usually lives in an assumed one.
4. **Compete.** Name your leading hypothesis and at least one rival. Design the
   observation that tells them apart, and run it. `references/techniques.md`
   has ways to narrow a search.
5. **Trace the chain:** trigger, each step, symptom, every link backed by an
   observation. A gap in the chain is the next thing to observe.
6. **Fix the cause.** The root is the first place the system did something it
   should not, not the place the symptom surfaced. Ask whether the state that
   broke the code is legitimate: if it is, handle it where it broke; if it
   should never exist, find what produced it, because a guard there would hide
   the bug. Write the regression test, watch it fail, fix, watch it pass, run
   the broader suite, and fix every other place with the same fault. Run the
   original loop again: the user's symptom, not only the new test.
   Then remove the instrumentation you added (mark it `DEBUG-TEMP` when you add
   it; `git diff | grep DEBUG-TEMP` finds what is left), unless the signal is
   worth keeping as a permanent log line.
7. **After three failed fixes, stop patching.** The model of the system is
   wrong somewhere. Revisit the assumptions, question the design, and tell the
   user what you have ruled out.
8. **Record.** In a project with memory, update `memory/bugs-and-risks.md`:
   the confirmed cause in its own field, rival hypotheses kept as hypotheses.
   Offer `learn capture` when the cause would surprise the next engineer, and
   `learn correct` when this class of bug can be made impossible.

## Report

```markdown
**Symptom:** what failed, where, for whom
**Reproduction:** the check, and its failing output
**Cause:** the chain from trigger to symptom
**Fix:** what changed, and why it addresses the cause
**Proof:** the regression test and suite results, observed, and the original
loop's result after the fix
**Residual risk:** what this fix does not cover
```

## Works with

- **Reads:** bugs and risks, lessons, the verification skill, Git history.
- **Hands off:** the fix to `review` and `ship`; lessons and checks to `learn`.
- **Alone:** works in any repository with no memory tree.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file.

Draws on Compound Engineering `ce-debug`, mattpocock/skills
`diagnosing-bugs`, and pstack's `principle-fix-root-causes`.
