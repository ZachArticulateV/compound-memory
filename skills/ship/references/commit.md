# Commit

Turn the working tree into commits a reviewer can read one at a time.

1. **Look first:** `git status`, `git diff`, `git diff --cached`, and
   `git log -10 --oneline` for the repository's message style. Before you
   stage anything, save what is already staged:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/changes.mjs" snapshot
   ```

   Staged work you did not make belongs to someone else. Leave it out of your
   commits unless the user said to include it: save it
   (`git diff --cached --binary > .verify/their-staged.patch`), unstage it, and
   restore it after your commits (`git apply --cached --3way` on that patch).
   Say if the restore did not apply cleanly; the patch keeps their work.
2. **Group by intent.** One commit per logical change (a unit, a ticket, a
   fix). Stage files, or hunks with `git add -p`, per group. When one file
   holds changes for two groups, or yours and someone else's, stage only your
   hunks. Leave out files that do not belong: build output, local
   configuration, evidence under `.verify/`, secrets.
3. **Check the index** before each commit:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/changes.mjs" staged --intended <path>,<path> --baseline .verify/staged-before.json
   ```

   It exits 1 when a staged file is outside the paths you name, or when lines
   staged before the snapshot are still staged. It names each file with both
   staged and unstaged lines, so a partial commit is deliberate.
4. **Write the message** in the repository's style. The subject says what
   changed; the body says why, and names the plan unit or ticket it carries.
   For a long or quoted message, write it to a file and use `git commit -F`.
5. **Run the fast checks** the repository uses before committing (lint, format,
   type check, the changed package's tests) when they exist.

Report the commits made, each with its subject and the files in it, and any
staged work you set aside and restored.
