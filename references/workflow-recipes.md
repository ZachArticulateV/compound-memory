# Work recipes

Use one recipe when it fits the request. These are extensions to the existing
skills, not a second workflow system. A small task still needs only a direct
answer or edit. Each result separates observed facts, assumptions, choices,
missing checks, and the next step. Never load another workflow library to fill
one of these recipes. External tools remain optional and must be named.

## Research and product choices — plan decide

Define the question, time window, and decision cost. Read project evidence
first. For current external facts, use an available search tool and primary
sources. Record source links, dates, and what each supports. State conflicting
evidence and missing data. Compare at most two useful choices and recommend one.
Save a strategy record only when asked: goal, intended users, chosen scope,
excluded scope, tradeoffs, evidence, assumptions, and review trigger. Do not turn
an assumption into a requirement. Stop when more research will not change the
choice. A source list alone is not a decision.

## Guided setup — project-memory init or verify create

Read the host setup report and project rules. List required and optional tools.
Record each as present, absent, denied, or untested. Give the shortest repair
step for a missing required tool. Make requested setup changes only in their
owned fields. Save the old values and a restore path. Then run the real smoke
check. A manifest parse is not a successful model run. Leave credentials to the
user's normal sign-in flow. Never copy secrets into the setup record.

## UI refinement — prototype ui, build work, verify run

Pick one user flow and name the exact app, version, route, and viewport. Capture
the current flow. Turn feedback into observable changes. Keep an approved
reference separate from assumptions about style. Make a bounded edit, then
drive the same flow and capture the result. Check keyboard use, small screens,
errors, and loading states that the edit affects. Use a fixed copy for an
independent UI review. Without a browser or image evidence, report the missing
check; do not claim a visual pass. Voice and drawing tools are optional inputs.

## Issue and recorded-feedback intake — review then plan

Read the supplied issue state or transcript. Each finding names its source
line or time range. Split observed bugs from requested features and opinions.
Check whether the item duplicates an open issue or refers to already fixed
code. Preserve all four states: new bug, duplicate, fixed, feature request.
Do not reopen fixed work from old feedback without a current reproduction.
Text and transcripts work alone. Audio/video capture is an optional adapter.
Return a source-linked brief with scope, reproduction, impact, and next action.
Creating or posting external tickets needs the user's scope.

## Product signal report — catch-up work

Name the date window, source, and units of each signal. Separate observed
counts from estimates. Missing values stay unknown and do not become zero.
Compare only compatible windows. State what changed, what the data cannot
show, and which decision the evidence supports. Keep an unavailable connector
visible. A traffic count alone does not prove a feature caused growth.

## Launch brief — write docs

Start with shipped behavior and its release evidence. Name the audience,
problem, new behavior, example, limit, and intended channel. Check every product
claim against that evidence. A planned feature remains planned. Produce a draft
without sending or publishing it unless that action is already authorized.
Optional channel adapters do not change this boundary.

## Migration and rollback — plan then build work

Inventory format versions and user-owned files. Preview the proposed changes.
Save byte-exact backups before a write. Test on a copy first, including dirty
files and missing tools. Apply only the named changes. Verify both the new
state and the restore path. If current bytes differ from those written by the
migration, stop rollback and report the conflict; do not erase later work.
Do not delete old memory merely because a new index exists.

## Release and support — ship or debug

Use the requested delivery scope. Read acceptance checks, source changes,
release notes, upgrade steps, and rollback evidence. Bind proof to the final
tree. Keep failed, skipped, and unsupported checks distinct. A local candidate
does not imply a push, tag, publish, or install. For support, record version,
host, symptom, reproduction, observed evidence, and a safe next step. Redact
credentials. Reproduce before claiming a cause. Keep uncertain causes as
hypotheses. Repair only within the user's scope and retain the regression test.

## Code explanation, refactor, and competing options

Use the scout for a scoped map with file and symbol references. Separate a
static call candidate from a runtime call. Trace design reasons through code,
history, and decisions; missing history stays unknown. For a refactor, run the
behavior checks before and after. For competing options, give each worker the
same requirements and separate writable paths. Freeze outputs, remove builder
claims, and let the critic compare them. The lead chooses using recorded
criteria and checks the combined result. More agents are not a quality claim.

## Proof and limits

The bounded samples in `../evals/workflow-cases.mjs` test decision outputs from
these recipes. They do not prove browser behavior, publication, or a migration
actually ran. Those require captured tool evidence and the dedicated tests.
Formal proof, iOS/Xcode adapters, managed PR stacks, and vendor service plumbing
remain optional or deferred. See `../docs/coverage.md` for the original scope.
