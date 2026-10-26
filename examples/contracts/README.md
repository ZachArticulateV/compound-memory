# Shared work examples

The examples use version 2 plan data.
They have no task progress fields.
The live ledger holds progress.
See [shared work rules](../../references/work-contracts.md).

## One task

`small.plan.json` has one requirement, one phase, one task, and one check.
The task proof checks its two assigned paths.
Final proof checks the whole combined project.
These are separate observations, even when they use the same test command.

```text
node scripts/plan-check.mjs examples/contracts/small.plan.json --json
```

## Several phases

`phases.plan.json` defines a format first.
G1 requires proof of that format before either client starts.
Both clients claim the same test port.
They wait in order even though their file paths differ.
The final check covers both clients together.

```text
node scripts/plan-check.mjs examples/contracts/phases.plan.json --json
```

## Work through a run

Use the commands from the plugin directory, with `--cwd` set to the target project.
Keep input and output files in that project's ignored `.verify/` folder.
Plan and script paths must resolve to the intended files.

1. Validate the plan.
2. Start a run with `run-state.mjs init`.
3. Read the current ledger revision.
4. Claim a ready task with the lead identity and revision.
5. Give the assignment to its worker.
6. Run the needed command through the separate `verify/capture.mjs` entry point.
7. Submit the worker result to the immutable inbox.
8. Have the lead accept the result after scope and proof checks.
9. Capture any gate proof and record the gate.
10. Capture final combined proof and record integration.
11. Use `run-state.mjs inspect` to check current completion.

```text
node scripts/run-state.mjs --help
node scripts/verify/capture.mjs --help
```

The state command takes JSON input files.
Its `context` output contains an outer result object and a `context` member.
The capture command needs the `context` member as its context file.
Do not pass the whole outer result object.

The lead revision can change after every write.
Read it again after a conflict.
A worker does not invent a newer owner version to make an old result fit.
The submission file wraps the worker result with a receipt from the submit tool.
A timely result can wait for lead review after the worker lease ends.
Reopened stale work gets a fresh retry budget and a higher attempt number.

No command in this example installs hooks, starts agents, or commits code.
The host must authorize the actual captured command.
Keep a test project separate from the plugin checkout.
