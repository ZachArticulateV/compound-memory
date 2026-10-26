# Claude and Codex support

Latest check: candidate 2.1.0-rc.1, 2026-10-26, America/Denver.
Code: e47e021a plus the working tree. See the
[completion results](plans/2026-10-26-completion-results.md).

## Candidate support

The local tests use Claude Code 2.1.310 and Codex CLI 0.162.1 on Windows.
Both hosts passed the supplied workflow decision samples, scheduled false-claim
report, and due-queue specialist run. Memory stayed unchanged. Bounded worker
and portable continuation evidence is recorded in the completion report.
Claude's observed model was claude-opus-5-5. Codex worker traces named
gpt-6.1-sol; inspection streams without model identity retain null.

Claude inspection uses safe mode, restricted mode, and only Read/Grep/Glob.
A real inside-file read passed. A harmless outside-file read was denied by the
host. Codex uses MXC read-only or workspace-write according to its task.
Read-only filesystem controls do not prove every internal tool is absent.

Timed reports use an explicitly started local Node process for either CLI.
No OS or app job is installed. Context percentage remains unknown where no
supported observation exists. The trial did not prove a quality threshold.
The user chose 50% for passive saves after local Claude bridge setup. The active
lead refreshes memory and saves a handoff without ending the session. Codex uses
the shared task-boundary recipe. See [context policy](context-policy.md).
Desktop, cloud, interactive status-line delivery, and Linux live sessions remain
outside this Windows CLI claim. See [operation and rollback](operations.md).

## Phase 2 and Phase 3 record

Phase 3 adds seven worker roles and keeps the lead in the main session.
Claude CLI agent entries ran the narrow cases in the
[Phase 3 record](plans/2026-10-26-phase-3-results.md).
Codex CLI ran an explicit code-scout packet with read-only controls.
The shared role and report checks cover both adapter forms. Other Codex role
workflows, native nested dispatch, desktop UI, and cloud still need live trials.

Ordinary task packets carry assignment context. Blind and integrity reviews
use dedicated native prompts instead. The lead validates the native report and
wraps it with the task IDs. Generic packets for those two roles are rejected,
so plan decisions cannot leak through that route.

Phase 2 adds shared packaging, five explicit shortcuts, read-only setup checks,
and explicit role packets. Claude loaded all 17 entries and the memory auditor.
The live auditor had only Read, Grep, and Glob. A real file read passed.
The Windows Codex read now passes under MXC. Its denied-write control also passes.
G2 is closed for the tested local CLI scope. See the
[closure results](plans/2026-10-25-phase-2-closure.md).
The [first Phase 2 results](plans/2026-10-25-phase-2-results.md) remain the earlier record.

## Phase 2 support boundary

| Surface | Built | Observed | Still open |
| --- | --- | --- | --- |
| Claude Code CLI 2.1.310 | Legacy manifest, shared skills, auditor, command hooks, setup check and packets. | 17 entries loaded. Narrow auditor read. Eight live task cases, all five shortcuts, project install/upgrade/disable/enable, both trust choices, real compact and disabled hooks passed. | Broad workflow/model certification remains Phase 7. |
| Codex CLI/app-server 0.162.1 | Portable and legacy manifests, shared skills, explicit role packets. Hooks off. | MXC read and denied-write control. Native install 17 entries, disable 0, upgrade 17. Installed status and live audit passed. A live packet result passed shared submission validation. | Strict tool-only isolation is not established. Internal coordination tools may remain visible. Full workflows remain Phase 7. |
| Codex desktop | Same source and explicit file fallback. Hooks off. | Package checks only. | Installed plugin and runtime access. Parent desktop tools do not prove child plugin support. |
| Cloud | Shared file contracts and capability report. | Package checks only. Context percentage is null. | Host file access and workflow support. Local command hooks are not claimed. |

`scripts/hosts/setup.mjs check --host <surface>` reads the package.
It cannot prove an install or a runtime grant. The accepted surface names are
claude, codex-cli, codex-desktop, and codex-cloud.
The packet command needs an existing version 2 plan and current assignment.
It checks their identity and lease, then emits the same assignment and result
schema for either host. It also carries the role and its audit finding schema.
It reports code freshness as unchecked. The lead must check current proof and
actual tool access before dispatch. This table records the Phase 2 boundary;
Phase 3 adds the role catalog and dedicated review paths described above.

Claude hooks use script-side file filtering. One handler covers Edit, Write,
MultiEdit, and NotebookEdit. Event tests cover Codex apply_patch input, multiple
paths, shell changes, missing signals, and invalid inputs. These are local tests,
not evidence of live Codex hook delivery. Shell paths stay unknown.
`COMPOUND_MEMORY_HOOKS=0` turns the plugin's advisory output off.
The local integrity flag is off by default. Enabled hooks only queue work.
No hook launches an agent. Optional status-line setup saves and restores its
owned field. Codex uses explicit task boundaries and the local polling runner.

The root OpenAI extension and legacy Codex manifest both contain `hooks: {}`.
This keeps default hook discovery off. Installing a plugin does not itself grant
hook trust. See [OpenAI packaging](https://developers.openai.com/plugins/build/plugins)
and [hook support](https://learn.chatgpt.com/docs/hooks).
Claude role limits use supported tools fields; ignored plugin-agent fields are
not used. See [Claude subagents](https://code.claude.com/docs/en/sub-agents).

The remaining sections are the historical Phase 0/1 record. They do not override
the Phase 2 results above.

## Phase 1 source additions (historical)

The working tree now has opt-in version 2 plans, a local task ledger,
immutable result files, and a separate command capture tool.
These additions do not change the Phase 0 host claims below.
See [shared work rules](../references/work-contracts.md) for their file contracts.

| Addition | Local check | Claude boundary | Codex boundary |
| --- | --- | --- | --- |
| Plan and task graph | Node tests and the two example plans on Windows. | Shared JSON and explicit script paths. No new host registration. | Same files and scripts. No new native agent registration. |
| Run ledger and result inbox | Local Node APIs and public CLI flow. | run-state is separate from wildcard-granted helpers. | Same separate entry point. A successful parent-shell test does not fix the blocked child read from Phase 0. |
| Captured proof | Real passed and failed processes, stale sources, and damaged output. | The host must authorize the capture call. No capture wildcard was added to any skill. | The same requirement applies. No sandbox bypass was added. |
| Reviewer use | Claude CLI reads the shared rules with only Read/Grep/Glob. | The lead supplies script output to a file-only reviewer. | No new live Codex review was claimed. |

Full host workflow trials remain Phase 2 and Phase 7 work.
The Phase 1 report records the exact test counts and review limits.

Do not use a valid manifest as proof of a working skill.
Do not use CLI results as proof of desktop or cloud support.

## Local versions and state

| Surface | Version or state | What was observed | What was not proved |
| --- | --- | --- | --- |
| Windows / Node | Node v24.20.0 | Local script suite ran. | Linux and macOS were not run here. |
| Claude Code CLI | 2.1.310 | Local --plugin-dir load. Twelve namespaced skills in the init event. Skill dispatch in the smoke. | Persistent install, all modes, hooks, and specialist dispatch. |
| Claude review model | claude-opus-5-5 in the init event | Read/Grep/Glob review completed. | Other models and ordinary unrestricted sessions. |
| Codex CLI | 0.162.1 | Model session ran. It reported zero tools with the mcp__ prefix. | File read failed during Windows process setup. Skill behavior was not checked. |
| Codex desktop | Current parent session; app version not captured | This planning task ran in desktop. | A separate installed Compound Memory plugin was not loaded or tested here. |
| Cloud hosts | Not tested | Official docs were read. | Local file, hook, agent, and schedule parity. |

These are observed versions, not established minimum versions.
The old repository record cites Codex 0.163.0 for discovery.
That record does not establish support on this machine's 0.162.1 CLI.

## Capability matrix

| Capability | Claude Code | Codex | Local evidence and limit | Fallback / next check |
| --- | --- | --- | --- | --- |
| Package discovery | .claude-plugin manifest and --plugin-dir are available. | Portable root plugin.json is documented. .codex-plugin/plugin.json remains a compatibility path. | Claude load observed. This repo has the compatibility manifests and no root plugin.json. No Codex install was changed. | U8 / A08: isolated install, enablement, exact names, paths with spaces, upgrade and disable. |
| Explicit skill use | Namespaced Skill call is available. | Native skill support is documented; file-based reading is a fallback. | Claude dispatched compound-memory:project-memory. Codex fallback could not read files. | U9-U11 / A09-A11: explicit and plain requests on each host. |
| Agent packaging | agents/ is documented. Plugin agent permissionMode, hooks, and mcpServers fields are ignored. | Custom agents use TOML under .codex/agents/ or the user agents folder. Parent permissions and MCP servers are inherited. | Only memory-auditor exists in this repo. Proposed roles do not exist. Plugin-level Codex agent discovery was not established. | U10-U12 / A10-A12: generated host files or explicit role packets. Test real tool grants. |
| Restricted review | A narrow tools list can remove shell and write tools. | Read-only filesystem mode does not remove external action tools by itself. | Claude review init had only Glob, Grep, Read. Codex reported zero mcp__ tools, but its file read failed. Neither test proves all role paths are isolated. | Lead runs scripts. Reviewer reads their outputs and fixed files. Use a separate restricted process when needed. A10-A14. |
| Hook execution | Current SessionStart and PostToolUse command events are documented. Agent hooks are experimental and do not cover SessionStart or PreCompact. | Command and mcp_tool handlers run. Prompt and agent handlers are parsed but skipped. Plugin hook trust is separate. | Claude hooks were disabled during the live probes. Codex manifest has hooks: {}, which disables shared discovery. | U10-U11 / A10-A11: preserve opt-out until host adapter checks pass. Explicit status remains the fallback. |
| File-change events | Edit/Write and the current if filter need live checks. | apply_patch matches Edit/Write aliases but keeps its tool name. Claude if-filter parity is not established. | Manifest validity does not prove filter behavior. Shell edits need a separate boundary check. | Test Edit, Write, apply_patch, shell changes, unrelated files, and disabled hooks. |
| Compaction | SessionStart with source compact can supply the resume packet. PreCompact is a save boundary. | Event support needs version-specific checks. | No compaction test ran. | U23 / A24: one packet at a supported boundary. Avoid duplicate startup output. Manual handoff remains available. |
| Context percentage | Status-line payload has used_percentage from the last response. It can be absent. | Hooks do not document a common percentage. App Server has thread/tokenUsage/updated, but plugin access and occupancy calculation are unproved here. | No percentage was measured. A status-line command is not a generic hook input. | Unknown remains unknown. Opt-in bridge must preserve the user's status line. U23 / A24, A31. |
| Time-based checks | Active-session /loop and other schedule modes have distinct limits. | Desktop local schedules need the app and computer running. CLI and IDE do not manage these schedules. | No timer or schedule was installed. Hooks do not supply a general interval event. | U24 / A25: select a supported scheduler. Next-event due checks are the fallback, not an idle timer. |
| Output and cancellation | Stream JSON and result records were observed. | JSON events were observed. | CLI exit 0 only means the model session ended. Both hosts can report blocked work with exit 0. Cancellation was not tested. | U6-U7, U16 / A06-A07, A17: inspect actions, tool results, and cancelled attempts. |
| Cross-host handoff | Shared project files can carry state. | Same shared files can be read when host access works. | Neither handoff direction was tested in Phase 0. | U19, U29 / A20, A30. Include run-state data and unfinished edits, not just ignored-file pointers. |

## Live probe record

### Claude review

The human requested a Claude CLI review of Claude-specific work.
The call used the local plugin directory.
It used restricted mode, an empty MCP config, disabled hooks, and no session persistence.
Only Read, Grep, and Glob were present in its init tool list.
It read the manifest and plan files.
It returned eight findings.
The [Phase 0 report](plans/2026-10-25-phase-0-findings.md) records each decision.

The reviewer said it could not see any skills.
The init event did list all twelve namespaced plugin skills.
The init event is the evidence for discovery.
The reviewer's statement is not used to override it.
No Agent tool was exposed, so this review did not test agent dispatch.

### Claude status

The first fixture was inside the parent Git repository.
The probe correctly selected that Git root.
Restricted mode also denied a skill reference outside the fixture.
This was a fixture setup fault, not proof of a product defect.

The fixture was then made a separate local Git repository.
The plugin source was added to allowed read roots.
The next run loaded the skill and read its status playbook.
It ran the state probe on the correct fixture.
The validator command was denied because the model added a shell suffix outside the allowed command form.
That attempt is partial, not a full pass.

The final probe uses single allowed Node commands.
It loaded the skill, read the playbook, and ran both checks with exit 0 and no denial.
The probe used the correct fixture root. The validator reported no memory to scan.
The fixture README stayed unchanged. No memory was created.
These are narrow status smokes on an empty fixture.
They are not repeated trials of the full plugin.
Test the default setup separately from this restricted test profile.

### Codex read-only smoke

The call ignored user config and rules.
It disabled apps, plugins, browser tools, computer use, image generation, multi-agent work, hooks, memories, and workspace dependencies.
It used ephemeral mode and the read-only Windows process setting.
No model override was set.

The model reported zero tool names starting with mcp__.
The first file-read process failed with helper_sandbox_lock_failed and Windows error 5, Access is denied.
The failing path was the host's .codex/.sandbox-bin area.
The README marker was not read.
Neither state probe nor validator ran in that child session.

The local environment is blocked for this test.
This does not show a plugin defect.
It also does not prove a working read-only boundary.
The setup was not weakened to make the test pass.
U11 and U29 must repeat it after the local process setup is fixed.
The shipped auditor bridge was not tested by this probe.

## Hook and memory design

The queue, bounded consumer, checkpoint policy, and local polling runner are
implemented. See [operation and rollback](operations.md) for setup scope.

Use command hooks for cheap event signals.
Queue work in scoped local runtime state.
Let the lead consume the queue at a defined boundary.
The lead runs the deterministic checks and supplies their output to a fresh integrity reviewer.
Keep that reviewer limited to file reads where the host can enforce it.

A timer needs the explicitly started local polling process or a separate host job.
A hook is not a timer.
The 50% context mark is a proposed warning point.
It is not a measured universal failure point.
Keep it optional until A31 compares outcomes and costs.

## Sources

Official docs were checked on 2026-10-25.
These pages do not provide a stable release date for each claim.
Recheck them when the installed host changes.

- [Claude subagents](https://code.claude.com/docs/en/sub-agents): plugin role files and ignored fields.
- [Claude hooks](https://code.claude.com/docs/en/hooks): events, filters, handler limits, and compaction.
- [Claude status line](https://code.claude.com/docs/en/statusline): context data and refresh behavior.
- [Claude scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks): active and background schedule paths.
- [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins): manifests and hook discovery.
- [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): TOML roles and inherited permissions.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks): handlers, trust, event names, and cloud limits.
- [Codex App Server](https://learn.chatgpt.com/docs/app-server): token-usage event. Plugin access remains unproved.
- [Codex schedules](https://learn.chatgpt.com/docs/automations): app and uptime limits.

Raw probe output stays in ignored .verify/phase0-2026-10-25/.
It does not travel with a normal Git clone.
This document records the durable findings and limits.
