# Simplify

Make freshly written code smaller and clearer before a reviewer reads it,
without changing what it does.

## Look for

- **Reuse:** a helper, component, or utility the codebase already has that the
  new code reimplements.
- **Subtraction:** dead branches, unused parameters, options nobody asked for,
  defensive checks on values the types already guarantee, wrappers that only
  pass through, state that duplicates other state.
- **Altitude:** logic at the wrong layer (business rules in a view, I/O inside a
  pure function).
- **Efficiency:** the same read or call repeated, a query inside a loop,
  independent work run one after another, a check for existence before an
  operation that could simply fail, a collection that grows without bound.
- **Comments** that restate the code. Keep the ones that say why. A comment
  stating a rule nothing enforces becomes an assertion in an existing test.
- **Tests** that assert nothing, duplicate another test, or pin internals. Keep
  the tests that proved each unit (the ones that failed first in `work`); they
  are the evidence.

Never remove validation at a trust boundary, protection against data loss, a
security check, or an accessibility affordance, and never treat plan, ticket,
memory, or lesson files as dead code. Remove a test only after you have seen
it pass and can name the test that still covers its behavior; the only test
guarding an interface, a file format, or a migration stays. A test that fails
is reported as a possible defect, not deleted.

## Steps

1. Run the suite, the type check, and the linter, and save the results (say
   which the project lacks). When the code you will touch has no test that
   would notice a change in what it does, add a characterization test first
   (inputs through the public interface, today's outputs as the expected
   values) and see it pass.
2. Make one kind of simplification at a time.
3. Run the same checks after each; the same tests pass and fail as before. A
   test that changes result means behavior changed: undo the step.
4. Stop when a pass finds nothing worth removing.

Report what you removed or merged and the check results before and after.

## On request, any scope

When the user names an existing area, or asks to audit, find, or list what
could be simpler, report first: numbered findings, each marked delete,
refactor, or encode as a test, with the evidence (the line, the duplicate, the
caller count). Change nothing until they pick. Re-check each picked finding
against the code as it is now before applying it, then follow the steps above.
