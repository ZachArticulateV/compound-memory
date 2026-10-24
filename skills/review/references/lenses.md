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
the file and rule; a standards file in a subdirectory governs only that
subtree. Skip what tooling already enforces. A new dependency pulled in for a
few lines, and a cast or `any` that opens a hole in the types, are findings
here. Then look for these code
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
deserialization). Check that nothing still reaches a deleted file through an
import, a string path, a route, or a registration, and quote the line that
does. Retries, swallowed errors, clamped values, and dropped state hide a fault
the way a guard does; name the fault. A finding at 75 or above names the input
or sequence that triggers it.

## When the diff calls for it

- **Adversarial:** for a diff past a few dozen lines or in a risky area, build
  concrete failure scenarios rather than reading for style: an assumption
  about data, timing, or order that breaks; parts right alone and wrong
  together; repeated or concurrent use; boundary values. When the change is
  itself a check (a CI gate, a merge rule, a build or deploy step, a test
  harness), ask how it could pass while the real thing fails, and run this lens
  whatever the size.
- **Security, in depth:** authentication, authorization, payments, personal or
  health data, file uploads, anything exposed to the internet. Check that
  personal and health data is not logged, cached, or sent to a third party,
  and that a feature flag or permission gate cannot be bypassed by another
  path to the same code.
- **Reliability:** every outside call has a timeout, retries are bounded and
  back off, a failure reaches the caller, and resources are released on every
  exit path.
- **Performance:** hot paths, loops over unbounded data, new queries
  (especially inside loops), and bundle size on the client.
- **Tests:** new behavior without a test, tests that pass when the behavior
  breaks, tests that pin internals, tests that depend on time, order, or
  randomness, and error paths no test reaches.
- **Migration:** schema or data changes; check reversibility, locking on large
  tables, and the order relative to deploying code. A new non-null column has
  a default or a backfill; a rename or drop goes expand, then contract; no
  mapping loses or narrows data. A risky one gets deployment notes: the
  invariants, read-only queries to run before and after, the rollback, and
  what to watch.
- **Interface:** public APIs, CLIs, and file formats; check backward
  compatibility, the version bump the change implies, error shapes, and
  documentation.
- **Frontend timing:** timers and listeners removed on unmount, async work
  that lands after the component is gone, and a double submit.
- **Agent surface:** a skill, prompt, tool definition, or instruction file,
  checked against `../write/references/agents.md`.
