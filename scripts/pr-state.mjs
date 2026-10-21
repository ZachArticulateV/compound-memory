#!/usr/bin/env node
// pr-state.mjs — where a pull request stands, from what GitHub reports.
//
// WHAT THIS IS: the deterministic call under `ship pr` and `ship watch`. Three
// claims are easy to blur and are kept apart here:
//
//   open            the PR exists.
//   checks-passed   every check GitHub reports for the PR's head commit
//                   finished green, there was at least one, and the head is
//                   the commit the agent means (no unpushed local commit).
//   ready-to-merge  checks passed, and GitHub reports it mergeable, not a
//                   draft, no review blocking it, and no unresolved thread.
//
// "No checks" is not green, a check still running is not green, and a check
// result for an older commit says nothing about the current head. Explaining a
// red check is a report, not a pass.
//
// Input: the JSON of `gh pr view <n> --json number,url,state,isDraft,
// headRefOid,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup`, or
// the same facts from a host GitHub tool (`head.sha`, a `checks` list with
// name/status/conclusion or name/state). Unresolved review threads come from
// `--threads` (the reviewThreads nodes from `gh api graphql`, or a list of
// `{ isResolved }`); without it, threads are reported as not checked.
//
// Read-only. Exits 0 when the PR has reached the state `--want` names
// (default: checks), 1 when it has not, 2 on a usage error.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { headOf, isGitCheckout } from './lib/changes.mjs'
import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const PR_STATE_SCHEMA_VERSION = 1
export const STAGES = ['closed', 'open', 'checks-pending', 'checks-failed', 'checks-passed', 'ready-to-merge']

const PASS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const FAIL = new Set(['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE'])

const up = (v) => (v === undefined || v === null ? '' : String(v).toUpperCase())

/** One check as passed, failed, or pending, whatever shape it came in. */
export function classifyCheck(c) {
  const name = c.name ?? c.context ?? c.workflowName ?? '(unnamed)'
  const status = up(c.status)
  const conclusion = up(c.conclusion)
  const state = up(c.state)
  let result
  if (state) result = PASS.has(state) ? 'passed' : FAIL.has(state) ? 'failed' : 'pending'
  else if (status && status !== 'COMPLETED') result = 'pending'
  else if (conclusion) result = PASS.has(conclusion) ? 'passed' : FAIL.has(conclusion) ? 'failed' : 'pending'
  else result = 'pending'
  const sha = c.headSha ?? c.head_sha ?? c.commit?.oid ?? c.sha ?? null
  return { name, result, sha, url: c.detailsUrl ?? c.targetUrl ?? c.html_url ?? null }
}

function threadList(input) {
  if (input === null || input === undefined) return null
  const nodes = Array.isArray(input) ? input : input?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? input?.reviewThreads?.nodes ?? input?.nodes ?? null
  return Array.isArray(nodes) ? nodes : null
}

export function prState(pr, { localHead = null, threads = null } = {}) {
  const head = pr.headRefOid ?? pr.head?.sha ?? pr.head_sha ?? null
  const state = up(pr.state)
  const blockers = []
  const notes = []

  if (state === 'MERGED' || state === 'CLOSED' || pr.merged === true) {
    return { schemaVersion: PR_STATE_SCHEMA_VERSION, number: pr.number ?? null, url: pr.url ?? pr.html_url ?? null, head, stage: 'closed', merged: state === 'MERGED' || pr.merged === true, checks: [], blockers: [`the PR is ${state.toLowerCase() || 'closed'}`], notes, prCreated: true, checksPassed: false, readyToMerge: false }
  }
  if (head === null) blockers.push('the input names no head commit, so no check can be tied to it')
  if (localHead !== null && head !== null && localHead !== head) {
    blockers.push(`local HEAD ${localHead.slice(0, 12)} is not the PR head ${head.slice(0, 12)}: push, or pull, before trusting any check`)
  }

  const raw = pr.statusCheckRollup ?? pr.checks ?? []
  const all = (Array.isArray(raw) ? raw : raw?.contexts?.nodes ?? []).map(classifyCheck)
  const forOther = all.filter((c) => c.sha !== null && head !== null && c.sha !== head)
  const checks = all.filter((c) => !forOther.includes(c))
  if (forOther.length > 0) notes.push(`${forOther.length} check result(s) are for another commit and were ignored`)

  const failed = checks.filter((c) => c.result === 'failed')
  const pending = checks.filter((c) => c.result === 'pending')
  let stage
  if (checks.length === 0) {
    stage = 'open'
    blockers.push('no checks reported for the head commit; that is not a pass')
  } else if (failed.length > 0) {
    stage = 'checks-failed'
    blockers.push(`${failed.length} check(s) failed: ${failed.map((c) => c.name).join(', ')}`)
  } else if (pending.length > 0) {
    stage = 'checks-pending'
    blockers.push(`${pending.length} check(s) still running: ${pending.map((c) => c.name).join(', ')}`)
  } else stage = 'checks-passed'
  if (blockers.some((b) => b.startsWith('local HEAD') || b.startsWith('the input names no head')) && stage === 'checks-passed') stage = 'open'

  const mergeBlockers = []
  if (pr.isDraft === true || pr.draft === true) mergeBlockers.push('the PR is a draft')
  const mergeable = pr.mergeable
  if (mergeable === false || up(mergeable) === 'CONFLICTING') mergeBlockers.push('GitHub reports a merge conflict')
  else if (mergeable === null || mergeable === undefined || up(mergeable) === 'UNKNOWN') mergeBlockers.push('GitHub has not computed mergeability yet; check again')
  const mss = up(pr.mergeStateStatus ?? pr.mergeable_state)
  if (['BEHIND', 'BLOCKED', 'DIRTY'].includes(mss)) mergeBlockers.push(`merge state is ${mss.toLowerCase()}`)
  const review = up(pr.reviewDecision)
  if (review === 'CHANGES_REQUESTED') mergeBlockers.push('a reviewer requested changes')
  if (review === 'REVIEW_REQUIRED') mergeBlockers.push('a required review is missing')
  const nodes = threadList(threads)
  let unresolved = null
  if (nodes === null) notes.push('review threads not checked (pass --threads)')
  else {
    unresolved = nodes.filter((t) => t.isResolved !== true && t.resolved !== true).length
    if (unresolved > 0) mergeBlockers.push(`${unresolved} review thread(s) unresolved`)
  }

  const checksPassed = stage === 'checks-passed'
  const readyToMerge = checksPassed && mergeBlockers.length === 0 && nodes !== null
  if (checksPassed && nodes === null) mergeBlockers.push('review threads not checked')
  return {
    schemaVersion: PR_STATE_SCHEMA_VERSION,
    number: pr.number ?? null,
    url: pr.url ?? pr.html_url ?? null,
    head,
    localHead,
    stage: readyToMerge ? 'ready-to-merge' : stage,
    prCreated: true,
    checksPassed,
    readyToMerge,
    checks,
    unresolvedThreads: unresolved,
    blockers: checksPassed ? mergeBlockers : [...blockers, ...mergeBlockers],
    notes,
  }
}

function render(r) {
  const out = [`PR ${r.number ? `#${r.number}` : ''} ${r.url ?? ''}`.trim(), `Head ${r.head ? r.head.slice(0, 12) : 'unknown'}: ${r.stage}`]
  out.push(`  PR created: yes`, `  Checks passed on this head: ${r.checksPassed ? 'yes' : 'no'}`, `  Ready to merge: ${r.readyToMerge ? 'yes' : 'no'}`)
  for (const c of r.checks ?? []) out.push(`    ${c.result.padEnd(8)} ${c.name}`)
  for (const b of r.blockers) out.push(`  blocker: ${b}`)
  for (const n of r.notes) out.push(`  note: ${n}`)
  return out.join('\n')
}

const USAGE = `Usage: pr-state.mjs --input <pr.json|-> [--threads <threads.json>] [--head <sha>|--no-local] [--want checks|ready] [--json] [--cwd <dir>]

Classify a pull request as open, checks-pending, checks-failed, checks-passed,
or ready-to-merge, from gh pr view --json (or a host GitHub tool's output).
The local HEAD is compared with the PR head unless --no-local.
Exits 0 when the PR reached --want (default checks), 1 when not, 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, root, error } = parseCliArgs(argv, {
    extraOptions: {
      input: { type: 'string' },
      threads: { type: 'string' },
      head: { type: 'string' },
      'no-local': { type: 'boolean', default: false },
      want: { type: 'string', default: 'checks' },
    },
  })
  if (error !== null || (!values.help && !values.input) || !['checks', 'ready'].includes(values.want)) {
    process.stderr.write(`pr-state: ${error ?? (values.input ? '--want is checks or ready' : '--input is required')}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const readJson = (file) => JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'))
  let pr
  let threads = null
  try {
    pr = readJson(values.input)
    if (values.threads) threads = readJson(values.threads)
  } catch (err) {
    process.stderr.write(`pr-state: cannot read input: ${err.message}\n`)
    return USAGE_EXIT_CODE
  }
  const absRoot = resolve(root)
  const localHead = values['no-local'] ? null : values.head ?? (isGitCheckout(absRoot) ? headOf(absRoot) : null)
  const result = prState(pr, { localHead, threads })
  emit(result, render(result), { json: values.json })
  const reached = values.want === 'ready' ? result.readyToMerge : result.checksPassed
  return reached ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
