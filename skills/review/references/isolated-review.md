# Fixed-target and blind review

The lead owns preparation and final acceptance. The reviewer owns findings.
Use the shared roles in `../../references/agents.md`.

## Prepare

Select only the files and requirements needed for the question. Run the
lead-owned helper through an explicit call:

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/agents/review-packet.mjs" prepare <spec.json> # not pre-approved
```

The JSON spec names root, destination, paths, requirements, and optional standards.
The destination must not exist. Paths are explicit files, relative to root.
The defaults are 80 files and 2,000,000 bytes. Optional maxFiles and maxBytes
can set limits from 1 to 1,000 files and 1 to 50,000,000 bytes.
This copy step needs the lead's existing task authority. It has no wildcard
skill grant. The helper refuses common private paths, dependency output,
traversal, symlinks, and Windows short-name or trailing-dot/space aliases.
The lead must exclude project-specific private files.
It creates a readable copy. It does not launch an agent or change permissions.

Save the full prepare output as prepared.json in lead-owned storage outside
the review directory. It includes the manifest, packet, prompt, and hashes.
Keep the returned manifest in that lead-owned storage.
It records original paths and hashes needed for the final freshness check.
Keep privateMapping outside the reviewer context too.

Use a fresh process with no inherited builder conversation. Never fork the
builder's full chat into a critic. The packet includes an absolute targetRoot.
The reviewer resolves every named target under that fixed root. Its current
working folder does not select the source. Use a neutral snapshot folder name.
Inspect the actual tool grant. The narrow Claude critic must have only Read,
Grep, and Glob. It must stop if any other tool is available. Codex command
reads use the checked adapter; its no-delegation limit remains instructed.
Use the narrow Claude entry when tool isolation is required.

Send exactly the saved review-prompt.txt as the task payload. Save the actual
sent bytes in sent.txt and check them with the command below. The builder's defence, earlier
verdicts, and preferred answer are not packet fields. Inspect the remaining
free text and target contents for leaked hints. The constructor cannot judge
whether a requirement itself contains bias.

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/agents/review-packet.mjs" verify-prompt <prepared.json> <sent.txt> # not pre-approved
```

## Visual comparisons

Set mode to visual and supply exactly two images. The helper uses A and B file
names. It does not put the original names or side mapping in the prompt.
The lead must inspect image pixels and metadata for visible identity first.
Stop or replace an identifying asset before dispatch. A neutral filename alone
cannot hide identity inside an image. Do not reveal the mapping until the
critic records A, B, or tie and its evidence. Save that first choice unchanged.

## Review and accept

For a standalone packet, return exactly one JSON object under responseContract.
Do not use Markdown fences or extra prose. Unchecked lists only assigned
requirements that could not be assessed. Put out-of-scope limits, such as
lead-owned hashing or runtime checks, in the optional limitations array.
A supported static pass does not claim those outside checks ran.

Code findings name a concrete failure path, the copied file, its line, and an exact
quote. A clean pass is valid. List unchecked requirements and missing evidence.
Do not manufacture a fault to justify the review.

After review, run the helper's check command on the saved manifest. It compares
both source files and copies with the initial hashes. A change or unreadable
file makes the review stale. Do not accept it against the changed version.

```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/agents/review-packet.mjs" check <manifest.json> # not pre-approved
node "${CLAUDE_SKILL_DIR}/../../scripts/agents/review-packet.mjs" validate <prepared.json> <report.json> <sent.txt> --final # not pre-approved
```

The validate command checks actual sent bytes, the saved packet and manifest,
source and copied files, report shape, and final finding verdicts. All reports
have the same 12,000-character output limit. Preparation files are trusted
lead-owned state. Hashes detect changes; they do not authenticate an envelope
whose contents and hashes were all replaced by an attacker.

The module's validateReviewResult function checks assigned file coverage and
citation bytes. It does not prove the reviewer's reasoning. For final checks,
high and medium findings need a lead verdict of confirmed or disproved.
The lead tries to disprove serious findings using separate evidence before a
fix is accepted. Use the existing findings-check workflow for code findings.

For a version 2 assignment, the reviewer still returns only its native JSON
report. Never send the generic task packet or builder decisions into a blind
review. After checking the native report and sent prompt, the lead wraps it
as JSON text in the shared result envelope's findings. The lead copies the
exact assignment IDs from its own state. It records that the reviewer returned
a native report and the lead made the envelope. Never invent proof receipts.
The lead captures and checks proof separately.
