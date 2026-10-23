---
title: Strip NODE_TEST_CONTEXT before spawning anything from a node:test file
tags: [testing, node, harness, live, environment]
applies_when: A test spawns a process that may itself run node --test (an agent, a CLI, a fixture's npm test)
paths: [tests/acceptance/, tests/fixtures/]
status: active
created: 2026-10-18
retire_when: Node's test runner stops passing NODE_TEST_CONTEXT to child processes
---

# Strip NODE_TEST_CONTEXT before spawning anything from a node:test file

## What happened

The live engineering harness asserted its fixture started red, and the check
saw green. The fixture's `node --test` had inherited `NODE_TEST_CONTEXT` from
the harness and exited 0 on a failing suite. The agents the harness spawned
inherited it too.

## Why

`node --test` sets `NODE_TEST_CONTEXT` for the files it runs so they report to
it. A nested `node --test` that inherits the variable reports to a parent that
is not listening and exits 0, whatever its tests did.

## Do this

Spawn every child of a test with `childEnv()` from `tests/fixtures/build.mjs`,
which removes the variable. Assert a fixture's starting state (red or green)
before relying on it, so a leak shows up as a failed precondition.

## Evidence

`tests/engineering-scripts.test.mjs` ("every live harness spawns with
NODE_TEST_CONTEXT removed").
