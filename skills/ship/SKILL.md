---
name: ship
description: "Get finished work merged cleanly: write commits that follow the repository's conventions, open or update a pull request that says how the change was verified, watch CI and fix what fails at the root, and answer review comments. Use when the user asks to commit, push, open or update a PR, check or fix CI, address PR feedback, or whether a PR is ready to merge."
argument-hint: "[commit|pr|watch|feedback] [PR number or URL]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/changes.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/pr-state.mjs" *), Bash(node "${CLAUDE_SKILL_DIR}/../../scripts/run-record.mjs" *)
---

# Ship

Move verified work from a branch to a mergeable pull request, and keep it
mergeable until a person merges it.

**Done when:** the mode's result holds and is reported in the words below:
commits made with only the intended work staged; a PR created with its
verification stated; checks passed on the PR's current head, or the run stopped
with each red check named as red; or every review thread fixed, answered, or
waiting on the user.

## Modes

| `$0` | Use it to | Reference |
| --- | --- | --- |
| `commit` | Commit the working tree in reviewable pieces | `references/commit.md` |
| `pr` | Push and open or update a pull request | `references/pr.md` |
| `watch` | Follow CI to a decision and fix what fails | `references/watch.md` |
| `feedback` | Answer and resolve review comments | `references/feedback.md` |

Pick the mode the request describes. "Ship it" with uncommitted work runs
`commit`, then `pr`, then `watch`.

## Say which state the PR is in

Three different claims, checked with `pr-state.mjs` against the PR's current
head (`references/watch.md`):

- **PR created:** it exists. Nothing more.
- **Checks passed:** every check GitHub reports for the head commit is green,
  there is at least one, and the head is the commit you pushed. A red check
  you explained is still red.
- **Ready to merge:** checks passed, and GitHub reports no conflict, no draft,
  no blocking review, and no unresolved thread.

## Conventions

- **Follow the repository.** Match the commit style its log uses, fill the PR
  template when one exists, and respect its branch rules. Never commit to the
  default branch; create a feature branch when you are on it.
- **Use the right remote.** Push to the branch's upstream when it has one;
  otherwise to the remote the user pushes to (usually `origin`). When the
  remotes leave it ambiguous, ask once.
- **Use what the host has** for GitHub: the `gh` CLI or a GitHub tool.
- **Merging is the user's call** unless they granted it for this work.
- **Resume from files.** A run record (`../../references/artifacts.md`), the
  branch, and the PR say where shipping stopped; read them before redoing a
  step. Three failed fix rounds on one check means stop and report.

## Works with

- **Reads:** the plan and tickets (for the PR body), `verify` evidence,
  `review` findings, and memory's handoff.
- **Hands off:** a PR URL to `autopilot` and `catch-up`; repeated CI or review
  failures to `learn correct`.
- **Alone:** commits and ships any branch, with or without the other skills'
  artifacts.

Paths in this skill and its references are relative to this skill's directory
(`${CLAUDE_SKILL_DIR}`). Outside Claude Code, that is the directory holding this
file, and `$0` is the first word after the skill name.

Draws on Compound Engineering `ce-commit`, `ce-commit-push-pr`,
`ce-babysit-pr`, and `ce-resolve-pr-feedback`, and mattpocock/skills `pr`.
