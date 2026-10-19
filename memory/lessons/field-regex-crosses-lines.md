---
title: Match a Markdown field's value with [ \t]*, never \s*
tags: [regex, parsing, tickets, scripts]
applies_when: Writing a script that reads "Label: value" lines from Markdown with a multiline regex
paths: [scripts/]
status: active
created: 2026-10-18
retire_when: The scripts parse Markdown with a real parser instead of line regexes
---

# Match a Markdown field's value with [ \t]*, never \s*

## What happened

`scripts/tickets-check.mjs` read `**Verify with:**` with `^\s*\**Verify with:?\**:?\s*(.*)$`
under the `m` flag. On a ticket whose `Verify with` line was empty, `\s*` ran
across the newline and captured the next line (`**Status:** ready`), so the
missing verify command was reported as present.

## Why

`\s` matches `\n`. With `m`, `^` and `$` anchor per line, but `\s*` still
consumes line breaks between them, so an empty field silently borrows its
neighbor's value.

## Do this

Use `[ \t]*` for horizontal whitespace around a field label and its value, in
every line-oriented regex over Markdown. Test the empty-field case.

## Evidence

The `cycles, unknown blockers, and missing verify commands are problems` test in
`tests/engineering-scripts.test.mjs` failed on the first version and passes
with the fix in `scripts/tickets-check.mjs` (`field`).
