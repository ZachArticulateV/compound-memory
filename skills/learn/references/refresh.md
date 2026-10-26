# Refresh lessons

Re-check lessons against the code as it is now, so lookup keeps returning
lessons that are true.

Use `scripts/learning-policy.mjs` for a bounded retirement proposal.
Name the existing lesson, current source quotes, and the retirement reason.
A missing source or changed quote stops the proposal. Age alone is not a reason.

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
   - does another lesson say the same thing, or the opposite? Settle two
     lessons that disagree first, from the code.
   - does it contradict an instruction file it names (`AGENTS.md`,
     `CLAUDE.md`, a standards file)? Report the conflict with both quotes;
     never edit that file from here.
   - when the code stopped following guidance that still holds, the lesson is
     kept and the change is reported as a possible regression.
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
5. **Validate** with `memory-validate.mjs`, and check the commits lessons cite
   with `lessons.mjs --check`.

## Prune

Only when the user asks to prune: apply capture's worth test to each active
lesson. Retire a true lesson only when a file you can name already states the
same reasoning, and quote that file; for a lesson that is partly recoverable
that way, cut the recoverable part and keep the rest.

Report each lesson and its class, with the evidence for every change.
