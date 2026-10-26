# Passive continuity follow-up

Date: 2026-10-26.

The user chose automatic handoff and memory saves while the session continues.
This follows the local 2.1.0-rc.1 build. It replaces the optional-only 50% warning
choice. It does not claim that model quality falls at that percentage.

## Work and checks

| Unit | Change | Required check |
| --- | --- | --- |
| C1 | Queue one passive save per measured crossing and deliver it at the next active boundary | 49% stays quiet; 50% requests a save; repeats do not flood the session; hooks exit 0 |
| C2 | Save current memory, a handoff, and plan/proof links through the active lead | A prepared save rejects changed files; failed saves stay pending; saved receipts match bytes; another session cannot consume it |
| C3 | Keep task and time fallbacks without inventing usage | Unknown readings stay unknown; Claude time fallback waits thirty minutes; Codex uses the shared agent-led recipe |
| C4 | Update rules and verify both code and Claude-facing behavior | Focused checks, full suite, strict manifest check, memory validation, and Claude source review |

## Scope

Hooks only queue and deliver requests. The lead does the semantic work: it reads
the evidence and decides which facts remain true. The checked writer captures
file hashes before it applies the update. It saves a receipt only after files
match. It keeps pending requests on failure. Old saved receipts can expire to
keep the queue small. Pending requests are never removed for space.

The save does not close or clear the session. It does not transfer run ownership
or export unfinished worker changes. It does not ask for routine approval.
Explicit read-only scope still leaves the request pending. The hooks themselves
never repair memory or launch a model.

Claude setup remains explicit because it changes a local display setting.
Once set up, passive saves are the default behavior. Codex has no verified
percentage feed or enabled hook adapter. Its current lead follows the shared
recipe at task boundaries. This does not install a background timer.

## Verification record

The initial regression failed because the old status-line bridge saved only a
checkpoint. It created no pending memory save. Local evidence is under
`.verify/finish/passive-*`.

C1-C4 are built and checked. The final source suite ran 1,056 tests: 1,029
passed, none failed, and 27 skipped. Skips remain the existing opt-in model
checks and unavailable local browser-package checks; they are not passes.
The captured proof is
`.verify/proofs/6ecba9c8-d4e3-44ba-b4c1-fbd29da551a5/proof.json`.
Its source hashes still match the final implementation.

Claude reviewed the source twice. The fixes cover notice truncation, repeat
backoff, compaction recovery, newer pending work, separate session readings,
busy and dead writer locks, overlapping references, escaped document links,
and narrow setup permissions. The final corrections have focused tests and
the full suite. They were not sent for a third model review.

A real Claude CLI session received a pending trigger from an injected 50%
status-line input. It used only the setup's scoped write/helper grants. It
updated memory, preserved a separate branch handoff, saved its own handoff,
linked the plan and evidence, ran the memory validator, and continued reading
the source. The final memory validator returned no findings. The latest saved
receipt matches the files. The pending queue is empty.

One unrelated compound file-list command was denied. The initial live harness
required no permission denial of any kind, so that assertion failed. The
assessment preserves the failure and checks the required behavior separately:
all save and validation commands were allowed, the save completed, and the
session continued. No broad shell permission was added to make it pass.
See `.verify/finish/passive-live-assessment.json` for that distinction.

Strict plugin validation, plan validation, memory validation, document links,
JSON parsing, and whitespace checks passed. The final summary is
`.verify/finish/passive-final-checks.json`. No user project setup, persistent
job, commit, push, or publication occurred.

The live check proves delivery and saving with supplied telemetry. It does not
prove an interactive status-line percentage feed on every host. Codex remains
agent-led at task boundaries. Neither check establishes a quality drop at 50%.

The baseline run found two existing flaky tests. An unmarked Git hash happened
to contain only digits. The fixture now uses explicit commit citations and a
fixed numeric control. Cold Git calls also exceeded a short fail-closed budget.
The test retries only valid setup; unsafe-state assertions still run once.
The production time budget is unchanged.

Used lessons: `field-regex-crosses-lines` for handoff fields and
`nested-node-test-context` for child command checks. The final suite runs their
regression checks. No AI OS lesson matched this task.
