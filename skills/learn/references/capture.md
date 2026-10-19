# Capture a lesson

Write one lesson from work just done, so the next task that needs it finds it.

## Is it worth a lesson?

Write one when a future engineer, reading only the final code, tests, and
plan, would repeat the mistake or rediscover the finding. Skip it when:

- the code or a test already carries it (a clear name, a test that fails on
  the mistake);
- a check could enforce it instead: run `correct`;
- it is a fact about this one change, not about the codebase.

"Documentation skipped: nothing durable" is a successful result.

## Steps

1. **Search** for an existing lesson on the same thing (see the router). When
   one overlaps heavily, update it in place and set `updated:` to today, rather
   than writing a second one. When one is related, link to it.
2. **Write** `memory/lessons/<slug>.md` from `templates/lesson.md`:
   - `title`: the rule, stated as what to do;
   - `tags`: three to six words, reusing the tags existing lessons already use;
   - `applies_when`: the situation in which a future task should read it;
   - `paths`: the directories or files it concerns, so lookup by changed path
     finds it;
   - `retire_when`: the condition under which it stops being true, when there
     is one;
   - the body: What happened, Why, Do this, Evidence (a commit, a test, a PR,
     an issue).
3. **Check claims.** Every path, command, and commit the lesson names exists.
4. **Validate** with `memory-validate.mjs` and fix any finding on the lesson.

One lesson per file; one subject per lesson. Report the lesson's path, or that
nothing durable was found.
