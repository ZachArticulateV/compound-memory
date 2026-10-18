# Review feedback

Answer every open review comment on a PR, fixing what is right and explaining
what is not.

1. **Collect** the unresolved threads and review summaries (`gh pr view
   --comments`, `gh api` for review threads, or the host's GitHub tool).
2. **Verify each claim** against the code before acting. A comment is a claim
   to check, whether a person or a bot wrote it.
3. **Decide per comment:**
   - **Correct and small** (a rename, a missed case, a test to add): fix it.
   - **Correct and large** (a redesign, an API change): propose the change in a
     reply and ask the author or the user before building it.
   - **Not correct:** reply with the evidence (the line, the test, the trace)
     that shows why.
   - **Optional nit:** apply it when it rides along with another fix; otherwise
     reply that it stays and why.
4. **Fix** in one commit per concern, run the checks, push.
5. **Reply on each thread** with what was done, naming the commit, and resolve
   the threads you addressed. Re-request review from anyone who requested
   changes.

Report each thread and its outcome: fixed (commit), replied (why), or waiting
on the user.
