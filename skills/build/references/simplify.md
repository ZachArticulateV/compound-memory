# Simplify

Make freshly written code smaller and clearer before a reviewer reads it,
without changing what it does.

## Look for

- **Reuse:** a helper, component, or utility the codebase already has that the
  new code reimplements.
- **Subtraction:** dead branches, unused parameters, options nobody asked for,
  defensive checks on values the types already guarantee, wrappers that only
  pass through.
- **Altitude:** logic at the wrong layer (business rules in a view, I/O inside a
  pure function).
- **Comments** that restate the code. Keep the ones that say why.
- **Tests** that assert nothing, duplicate another test, or pin internals. Keep
  the tests that proved each unit (the ones that failed first in `work`); they
  are the evidence.

## Steps

1. Run the suite and save the result. When the code you will touch has no
   test that would notice a change in what it does, add a characterization
   test first (inputs through the public interface, today's outputs as the
   expected values) and see it pass.
2. Make one kind of simplification at a time.
3. Run the suite after each; the same tests pass and fail as before. A test
   that changes result means behavior changed: undo the step.
4. Stop when a pass finds nothing worth removing.

Report what you removed or merged and the suite result before and after.
