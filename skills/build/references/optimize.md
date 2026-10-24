# Optimize

Improve one metric through a loop of measured experiments, keeping only the
changes whose effect is larger than the noise.

## Set up

1. **Name the metric**, the command that measures it, whether lower or higher
   is better, and the target. With no measurement command, write one, show it
   to the user, and freeze it for the whole run: a measure that changes midway
   measures nothing.
2. **Name the guards:** the other metrics the change must not make worse
   (memory while chasing speed, accuracy while chasing cost), each with its
   command and direction.
3. **Set the limits:** the correctness check every candidate must pass (the
   suite, or the tests for the code under change), a time limit per
   measurement (`timeout 120 <command>`), and how many hypotheses you will try
   (default: stop after three in a row that do not hold). Ask before adding a
   dependency.
4. **Baseline:** run the measurement at least three times on the unchanged
   code, and save the numbers.
5. **Noise:** the script takes the spread of the samples you give it as the
   floor. When you have also measured two identical builds against each other,
   pass their difference over the baseline median as `--noise` (12 ms on
   400 ms is 0.03); it can raise the floor, never lower it below the spread
   the samples show.
6. **Locate first** for a time or cost target: profile, or time each stage,
   before forming hypotheses, so they aim at where the cost is.

For a quality target scored by a rubric or a model judge (a prompt, a ranking,
a classifier), build a small eval set from failures you have seen, keep a
held-out slice you score only at the end, check that an empty or copied output
scores worse than the baseline before you trust the scorer, and cap what the
judging may spend.

## Loop

1. Form one hypothesis ("the list re-renders on every keystroke").
2. Make the one change that tests it.
3. Run the correctness check. A faster candidate that fails it is reverted,
   whatever the numbers say.
4. Measure the metric and each guard at least three times.
5. Let the script decide, once for the metric and once per guard with that
   guard's own direction:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/measure.mjs" --baseline "<n,n,n>" --candidate "<n,n,n>" --direction lower --noise <ratio>
   ```

   - `keep`: commit, with the numbers in the message. The candidate becomes
     the new baseline. A guard that returns `revert` (worse beyond its noise)
     blocks the keep.
   - `revert`: undo the change.
   - `inconclusive`: measure again with more samples before deciding.
6. Read the diff before keeping. A gain that comes from something the measure
   cannot see (a skipped step, a cached answer, a broken constraint) is
   reverted, and the measure is fixed.
7. Log each hypothesis, its numbers, and the verdict in a table in a file (the
   plan, or `.verify/evidence/<run-id>/optimize.md`), so a resumed session can
   continue from it. Remove any timing code or debug output you added.

Stop at the target, or after three hypotheses in a row that do not hold.
Before reporting, measure the original baseline commit and the final state
together, as one pair, and report that result with the table (and the held-out
score, for a judged target). A cleared target with its measurements is the
result; a list of changes that look faster is not.
