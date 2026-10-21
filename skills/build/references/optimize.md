# Optimize

Improve one metric through a loop of measured experiments, keeping only the
changes whose effect is larger than the noise.

## Set up

1. **Name the metric**, the command that measures it, whether lower or higher
   is better, and the target.
2. **Set the limits:** the correctness check every candidate must pass (the
   suite, or the tests for the code under change), a time limit per
   measurement (`timeout 120 <command>`), and how many hypotheses you will try
   (default: stop after three in a row that do not hold).
3. **Baseline:** run the measurement at least three times on the unchanged
   code, and save the numbers.
4. **Noise:** the script takes the spread of the samples you give it as the
   floor. When you have also measured two identical builds against each other,
   pass their difference over the baseline median as `--noise` (12 ms on
   400 ms is 0.03); it can raise the floor, never lower it below the spread
   the samples show.

## Loop

1. Form one hypothesis ("the list re-renders on every keystroke").
2. Make the one change that tests it.
3. Run the correctness check. A faster candidate that fails it is reverted,
   whatever the numbers say.
4. Measure at least three times.
4. Let the script decide:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/measure.mjs" --baseline "<n,n,n>" --candidate "<n,n,n>" --direction lower --noise <ratio>
   ```

   - `keep`: commit, with the numbers in the message. The candidate becomes
     the new baseline.
   - `revert`: undo the change.
   - `inconclusive`: measure again with more samples before deciding.
5. Log each hypothesis, its numbers, and the verdict in a table in the plan
   file or the reply. Remove any timing code or debug output you added.

Stop at the target, or after three hypotheses in a row that do not hold, and
report the table. A cleared target with its measurements is the result; a list
of changes that look faster is not.
