# Agent-task eval, 2026-10-21

Model `sonnet` (2.1.306 (Claude Code)), 2 trial(s) per task and configuration, each prompt starting with the task's skill command. Baseline: `origin/main` (6d2b5f8). Revised: 1ebfe2c plus uncommitted changes. Same prompt, limits, and settings in every run; no user settings or MCP servers loaded.

| Config | Correct | False success | Missed faults | Needless questions | Errors | Mean s | Mean $ | Mean input tok | Mean output tok | Small: correct | Small: mean s | Small: mean $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 0/2 | 2/2 | 2/2 | 0/2 | 0/2 | 11 | 0.047 | 40830 | 701 | 0/2 | 11 | 0.047 |
| revised | 2/2 | 0/2 | 0/2 | 0/2 | 0/2 | 10.5 | 0.056 | 62836 | 943 | 2/2 | 10.5 | 0.056 |

## Per task

| Task | Size | Config | Correct | Claimed | Seconds | $ | Skills used |
| --- | --- | --- | --- | --- | --- | --- | --- |
| measure | small | baseline #1 | no | success | 6 | 0.041 | - |
| measure | small | revised #1 | yes | partial | 12 | 0.057 | - |
| measure | small | baseline #2 | no | success | 16 | 0.053 | - |
| measure | small | revised #2 | yes | partial | 9 | 0.055 | - |
