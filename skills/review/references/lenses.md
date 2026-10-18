# Lenses

Each lens answers one question about the change. Every finding carries a
severity, a confidence, a file and line, and the quoted line it is about.

**Severity:** P0 breaks production, loses data, or opens a security hole. P1 is
a defect users will hit. P2 is a real problem with limited reach. P3 is worth
fixing when nearby.

**Confidence:** 100 means you traced it and are certain; 75 means you traced
the path and would bet on it; 50 means plausible and not traced; 25 means a
hunch. Only 75 and above reach the report, except P0.

## Always

### Spec: does it do what was asked?

Report requirements that are missing or partly built; behavior the change adds
that nobody asked for (scope creep); and requirements that look built but are
built wrong. Quote the spec line for each.

### Standards: does it follow this project's rules?

Report each place the diff breaks a documented standard or a guardrail, citing
the file and rule. Skip what tooling already enforces. Then look for these code
smells, always as judgment calls ("possible Feature Envy"), and drop any the
project's own standards endorse:

- **Mysterious Name:** a name that does not say what the thing does.
- **Duplicated Code:** the same shape twice in the change.
- **Feature Envy:** a function that uses another object's data more than its own.
- **Data Clumps:** fields that always travel together and want a type.
- **Primitive Obsession:** a string or number standing in for a domain concept.
- **Repeated Switches:** the same branching on the same type in several places.
- **Shotgun Surgery:** one logical change scattered across many files.
- **Divergent Change:** one module edited for unrelated reasons.
- **Speculative Generality:** hooks or options for needs nobody has.
- **Message Chains:** `a.b().c().d()` that callers should not depend on.
- **Middle Man:** a layer that only delegates.
- **Refused Bequest:** a subtype that ignores what it inherits.

### Correctness: what breaks?

Trace inputs from real callers. Look for logic errors, unhandled states, null
and empty cases, off-by-one, error paths that swallow failures, race
conditions, resource leaks, broken invariants, data loss or corruption, and
security holes (injection, missing authorization, secrets in code, unsafe
deserialization). A finding at 75 or above names the input or sequence that
triggers it.

## When the diff calls for it

- **Security, in depth:** authentication, authorization, payments, personal or
  health data, file uploads, anything exposed to the internet. Check that
  personal and health data is not logged, cached, or sent to a third party.
- **Performance:** hot paths, loops over unbounded data, new queries
  (especially inside loops), and bundle size on the client.
- **Tests:** new behavior without a test, tests that pass when the behavior
  breaks, tests that pin internals.
- **Migration:** schema or data changes; check reversibility, locking on large
  tables, and the order relative to deploying code.
- **Interface:** public APIs, CLIs, and file formats; check backward
  compatibility and documentation.
