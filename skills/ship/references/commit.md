# Commit

Turn the working tree into commits a reviewer can read one at a time.

1. **Look first:** `git status`, `git diff`, and `git log -10 --oneline` for the
   repository's message style.
2. **Group by intent.** One commit per logical change (a unit, a ticket, a
   fix). Stage files, or hunks with `git add -p`, per group. Leave out files
   that do not belong: build output, local configuration, evidence under
   `.verify/`, secrets.
3. **Write the message** in the repository's style. The subject says what
   changed; the body says why, and names the plan unit or ticket it carries.
   For a long or quoted message, write it to a file and use `git commit -F`.
4. **Run the fast checks** the repository uses before committing (lint, format,
   type check, the changed package's tests) when they exist.

Report the commits made, each with its subject and the files in it.
