# Agent-task eval, 2026-10-21

Model `sonnet` (2.1.306 (Claude Code)), 2 trial(s) per task and configuration, plain prompts (the model chooses whether to use a skill). Baseline: `origin/main` (6d2b5f8). Revised: 1ebfe2c plus uncommitted changes. Same prompt, limits, and settings in every run; no user settings or MCP servers loaded.

| Config | Correct | False success | Missed faults | Needless questions | Errors | Mean s | Mean $ | Mean input tok | Mean output tok | Small: correct | Small: mean s | Small: mean $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | 1/2 | 1/2 | 1/2 | 0/2 | 0/2 | 6.8 | 0.032 | 17211 | 677 | 1/2 | 6.8 | 0.032 |
| baseline | 0/2 | 2/2 | 2/2 | 0/2 | 0/2 | 4.4 | 0.036 | 18940 | 410 | 0/2 | 4.4 | 0.036 |
| revised | 0/2 | 2/2 | 2/2 | 0/2 | 0/2 | 4.8 | 0.035 | 18954 | 264 | 0/2 | 4.8 | 0.035 |

## Per task

| Task | Size | Config | Correct | Claimed | Seconds | $ | Skills used |
| --- | --- | --- | --- | --- | --- | --- | --- |
| measure | small | none #1 | yes | partial | 9 | 0.035 | - |
| measure | small | baseline #1 | no | success | 5 | 0.036 | - |
| measure | small | revised #1 | no | success | 7 | 0.035 | - |
| measure | small | none #2 | no | success | 4 | 0.029 | - |
| measure | small | baseline #2 | no | success | 4 | 0.036 | - |
| measure | small | revised #2 | no | success | 3 | 0.034 | - |
