# Optimize

Improve one metric through a loop of measured experiments, keeping only the
changes whose effect is larger than the noise.

## Set up

1. **Name the metric**, the command that measures it, whether lower or higher
   is better, and the target.
2. **Baseline:** run the measurement at least three times on the unchanged
   code.
3. **Noise:** when runs vary a lot, measure two identical builds against each
   other; that difference is the noise floor every claim must clear.

## Loop

1. Form one hypothesis ("the list re-renders on every keystroke").
2. Make the one change that tests it.
3. Measure at least three times.
4. Let the script decide:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/measure.mjs" --baseline "<n,n,n>" --candidate "<n,n,n>" --direction lower
   ```

   - `keep`: commit, with the numbers in the message. The candidate becomes
     the new baseline.
   - `revert`: undo the change.
   - `inconclusive`: measure again with more samples before deciding.
5. Log each hypothesis, its numbers, and the verdict in a table in the plan
   file or the reply.

Stop at the target, or after three hypotheses in a row that do not hold, and
report the table. A cleared target with its measurements is the result; a list
of changes that look faster is not.
