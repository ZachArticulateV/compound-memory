# Refresh lessons

Re-check lessons against the code as it is now, so lookup keeps returning
lessons that are true.

## Steps

1. **List them,** including stale and retired ones, then the active ones whose
   code moved since they were written (a path gone, or commits to their paths):

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --all --limit 0
   node "${CLAUDE_SKILL_DIR}/../../scripts/lessons.mjs" --drift
   ```

   Check the drifted ones first. A small refresh (after one change) checks only
   those.

2. **Check each lesson:**
   - do the paths, commands, and commits it names still exist?
   - has its `retire_when` condition come true?
   - does the code still behave the way the lesson says?
   - does another lesson say the same thing?
3. **Classify:**
   - **keep:** still true.
   - **update:** mostly true; correct it and set `updated:`.
   - **stale:** may be wrong and needs a closer look; set `status: stale` so
     lookup stops serving it.
   - **retire:** no longer true; set `status: retired` and say why in the body.
   - **merge:** two lessons on one subject; keep the stronger one, fold in the
     other's evidence, and retire the other with a pointer.
   - **promote:** a lesson that a check could now enforce; hand it to
     `correct`.

   A claim you cannot check is unverified, not false. Age alone does not make a
   lesson stale; changed code does.
4. **Delete** a lesson only when it is retired, nothing links to it, and the
   user agrees. A lesson whose mistake a check now prevents is retired with a
   pointer to the check; the check is the lesson now.
5. **Validate** with `memory-validate.mjs`.

Report each lesson and its class, with the evidence for every change.
