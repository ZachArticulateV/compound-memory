# Agent-task eval, 2026-10-21

Model `sonnet` (2.1.306 (Claude Code)), 2 trial(s) per task and configuration, each prompt starting with the task's skill command. Baseline: `origin/main` (6d2b5f8). Revised: 1ebfe2c. Same prompt, limits, and settings in every run; no user settings or MCP servers loaded.

| Config | Correct | False success | Missed faults | Needless questions | Errors | Mean s | Mean $ | Mean input tok | Mean output tok | Small: correct | Small: mean s | Small: mean $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 7/12 | 5/12 | 4/8 | 0/12 | 0/12 | 11.7 | 0.058 | 75410 | 1017 | 2/6 | 8.1 | 0.043 |
| revised | 10/12 | 1/12 | 2/8 | 0/12 | 0/12 | 9.9 | 0.057 | 66565 | 971 | 4/6 | 7.1 | 0.049 |

## Per task

| Task | Size | Config | Correct | Claimed | Seconds | $ | Skills used |
| --- | --- | --- | --- | --- | --- | --- | --- |
| typo | small | baseline #1 | yes | success | 7 | 0.046 | - |
| typo | small | revised #1 | yes | success | 5 | 0.046 | - |
| measure | small | baseline #1 | no | success | 6 | 0.041 | - |
| measure | small | revised #1 | no | success | 7 | 0.042 | - |
| debug | medium | baseline #1 | yes | success | 14 | 0.066 | - |
| debug | medium | revised #1 | yes | success | 11 | 0.061 | - |
| review-uncommitted | medium | baseline #1 | yes | success | 14 | 0.068 | - |
| review-uncommitted | medium | revised #1 | yes | success | 15 | 0.072 | - |
| commit-staged | medium | baseline #1 | yes | success | 12 | 0.064 | - |
| commit-staged | medium | revised #1 | yes | success | 12 | 0.062 | - |
| pr-ready | small | baseline #1 | no | success | 6 | 0.042 | - |
| pr-ready | small | revised #1 | yes | partial | 9 | 0.058 | - |
| typo | small | baseline #2 | yes | success | 20 | 0.050 | - |
| typo | small | revised #2 | yes | success | 6 | 0.046 | - |
| measure | small | baseline #2 | no | success | 6 | 0.041 | - |
| measure | small | revised #2 | no | partial | 6 | 0.042 | - |
| debug | medium | baseline #2 | yes | success | 15 | 0.065 | - |
| debug | medium | revised #2 | yes | success | 11 | 0.059 | - |
| review-uncommitted | medium | baseline #2 | yes | success | 22 | 0.100 | - |
| review-uncommitted | medium | revised #2 | yes | success | 16 | 0.070 | - |
| commit-staged | medium | baseline #2 | no | success | 16 | 0.067 | - |
| commit-staged | medium | revised #2 | yes | success | 11 | 0.063 | - |
| pr-ready | small | baseline #2 | no | success | 4 | 0.042 | - |
| pr-ready | small | revised #2 | yes | success | 10 | 0.062 | - |
