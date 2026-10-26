# Phase 2 closure

Date: 2026-10-25, America/Denver.

## Result

Phase 2 is complete for the tested Windows CLI scope. G2 passed.
Claude Code 2.1.310 and Codex CLI/app-server 0.162.1 passed the named host checks.
Phase 3 has not started. No commit, push, release, or lasting plugin install was made.

## Fixes

The old Codex probe forced the legacy elevated Windows helper.
That helper failed before it could read a file.
The supported MXC mode passed a real read and a denied-write control.
The audit bridge now selects MXC on Windows through its command arguments.
It keeps read-only access, ignores user configuration, disables the named action
features and web search, and uses temporary output outside the project.
An unsupported host fails or uses the existing subagent handoff.
There is no retry with weaker access. No Windows ACL or global setting was changed.
See [Windows sandbox support](https://learn.chatgpt.com/docs/windows/windows-sandbox).

Claude's failed write fixtures were inside the loaded plugin directory.
The same restricted mode and narrow file rules work in an external test project.
A fresh negative control inside the plugin tree failed again.
This is consistent with protected tool configuration in restricted mode.
The trace reports a denied edit; it does not name the internal classification.
No broad write grant or shell-write fallback was needed.

The shared auditor now distinguishes host access.
Claude requires only Read, Grep, and Glob.
Codex uses command reads after a real read and denied-write check.
App and MCP action tools must be absent.
Internal coordination tools may still appear in Codex despite feature flags.
No-delegation is an instruction there. Use Claude for a tool-isolated review.
Desktop and cloud packets explicitly lack live evidence.

The shared result schema is a local validation contract.
Codex's strict output decoder rejected its uniqueItems keyword.
The successful packet returned JSON and passed the unchanged local result validator.
No schema constraint was removed.

## Live checks

| Case | Result |
| --- | --- |
| Codex file access | Real file read passed; read-only write attempt failed and created no file. |
| Codex package | Native install loaded 17 skills; disable hid all 17; upgrade loaded all 17 from the test version. |
| Codex installed status | Read the installed skill and playbook; state probe and validator both returned exit 0. |
| Codex audit bridge | Found the seeded contradiction: memory says 100, source says 25. |
| Codex task packet | Read both assigned files; returned completed with the correct finding and exact assignment context; shared submission validation passed. |
| Claude typo | Changed only README.md, with no skill or agent overhead. |
| Claude build | Selected build; provided test failed before and passed after; only the assigned source file changed. |
| Claude five shortcuts | Handoff, sync, grill, cleanup, and repair all passed on seeded memory. Four write cases passed independent memory validation. |
| Claude plain review | Selected review for a representative multi-file change and found seeded bugs without writes. |
| Claude package | Isolated project install, upgrade, disable, and enable passed; existing status line, environment value, and sentinel survived. |
| Claude trust | Declining trust exited before hooks. Accepting the owned test folder then ran one startup hook. |
| Claude compaction | Real manual compaction ran exactly one compact hook; the next turn retained the test marker. |
| Claude disabled hooks | No startup hook command ran. |

The earlier one-line review still chose direct work. The representative review
selected the skill. This is bounded routing evidence, not perfect selection.
Some compound shell reads were denied in Claude. Permitted file tools and single
checks completed the work. No forbidden write was used to evade a denied edit.

The live packet result was submitted, not accepted as a completed run by the lead.
It contains no fabricated proof. The lead separately checked its finding and source files.
The Phase 1 acceptance rules remain unchanged.

## State preserved

Claude lifecycle checks used an isolated configuration directory and project install.
The user's plugin install settings were unchanged.
Interactive trust created a record for the owned temporary test folder.
Ordinary CLI logs and ignored evidence remain.

Codex needed a temporary unique plugin entry for native installation.
Native uninstall removed the plugin cache afterward.
The user configuration's final hash exactly matched its initial hash.
An empty parent cache directory for the test namespace remains.
No existing plugin was removed or disabled. No credentials were copied into the repo.

## Checks and review

- Full suite: 870 tests, 845 passed, 0 failed, 25 skipped.
- Skips: 19 gated live-model cases and 6 local Playwright cases.
- Focused adapter, auditor, and audit contract checks: 111 passed.
- Claude reviewed a fixed source copy with Read, Grep, and Glob only.
- It found no medium or high issue. Three low wording/access-scope findings were fixed.
- Strict manifest, plan coverage, memory structure, JSON, and local-link checks passed.

The final captured suite receipt is `.verify/phase2-close/full-suite-capture.json`.
It links the actual command output and source fingerprint.
Live evidence is under `.verify/phase2-close/claude/` and `codex-package/`.
Their summary files contain outcomes and limits.
The lead's separate read, denied-write, audit, and packet records are in the parent folder.
These local files are ignored by Git; carry them explicitly or rerun checks after a handoff.

Lesson checks passed: field-regex-crosses-lines and nested-node-test-context.
The external Codex read-only lesson now has a successful real read and no reported
MCP action tools. Its old forced-elevated example is not the working recipe on this host.
Read-only filesystem access alone still does not prove all tool limits.

## Remaining limits

Desktop UI and cloud execution were not tested. Their support is not inferred from CLI results.
Codex hooks remain disabled. No context bridge, integrity queue, or schedule was started.
Broad workflow and model trials remain Phase 7.
New specialist roles and their stronger tool checks are Phase 3.
