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
// `reviewRequests` in the input (reviewers asked and not yet answered) keeps
// a PR from ready. A run waiting for a maintainer to approve it (a fork's
// ACTION_REQUIRED) is awaiting approval, not failed. `--required <file>`
// names checks branch protection requires (a JSON list or one per line); a
// required check with no result on the head is pending, not absent. With
// `--no-ci`, a repository that runs no checks can reach ready, reported as
// "no checks configured", never as checks passed.
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
const FAIL = new Set(['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'STALE'])
const AWAITING = new Set(['ACTION_REQUIRED'])

const up = (v) => (v === undefined || v === null ? '' : String(v).toUpperCase())

/** One check as passed, failed, or pending, whatever shape it came in. */
export function classifyCheck(c) {
  const name = c.name ?? c.context ?? c.workflowName ?? '(unnamed)'
  const status = up(c.status)
  const conclusion = up(c.conclusion)
  const state = up(c.state)
  let result
  const of = (v) => (PASS.has(v) ? 'passed' : FAIL.has(v) ? 'failed' : AWAITING.has(v) ? 'awaiting-approval' : 'pending')
  if (state) result = of(state)
  else if (status && status !== 'COMPLETED') result = 'pending'
  else if (conclusion) result = of(conclusion)
  else result = 'pending'
  const sha = c.headSha ?? c.head_sha ?? c.commit?.oid ?? c.sha ?? null
  const at = c.completedAt ?? c.completed_at ?? c.startedAt ?? c.started_at ?? c.createdAt ?? null
  return { name, result, sha, at, url: c.detailsUrl ?? c.targetUrl ?? c.html_url ?? null }
}

/**
 * One result per check name: a re-run check appears twice in the rollup, and
 * only its newest run counts. Without timestamps both are kept, so a failure
 * is never hidden by guessing.
 */
export function latestPerName(checks) {
  const byName = new Map()
  for (const c of checks) {
    const prev = byName.get(c.name)
    if (prev === undefined) byName.set(c.name, [c])
    else if (c.at && prev.every((p) => p.at)) byName.set(c.name, [prev[0].at >= c.at ? prev[0] : c])
    else prev.push(c)
  }
  return [...byName.values()].flat()
}

function threadList(input) {
  if (input === null || input === undefined) return null
  const conn = input?.data?.repository?.pullRequest?.reviewThreads ?? input?.reviewThreads ?? input
  const nodes = Array.isArray(input) ? input : conn?.nodes ?? null
  if (!Array.isArray(nodes)) return null
  return { nodes, partial: conn?.pageInfo?.hasNextPage === true }
}

/** Reviewers asked for a review that has not come in: logins, team names, or bots. */
export function pendingReviewers(pr) {
  const raw = pr.reviewRequests ?? pr.requested_reviewers ?? []
  const list = Array.isArray(raw) ? raw : raw?.nodes ?? []
  return list.map((r) => r?.requestedReviewer ?? r).map((r) => r?.login ?? r?.name ?? r?.slug ?? (typeof r === 'string' ? r : null)).filter(Boolean)
}

export function prState(pr, { localHead = null, threads = null, required = [], noCi = false } = {}) {
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
  const checks = latestPerName(all.filter((c) => !forOther.includes(c)))
  if (forOther.length > 0) notes.push(`${forOther.length} check result(s) are for another commit and were ignored`)
  for (const name of required) {
    if (!checks.some((c) => c.name === name)) checks.push({ name, result: 'pending', sha: head, at: null, url: null, missing: true })
  }

  const failed = checks.filter((c) => c.result === 'failed')
  const pending = checks.filter((c) => c.result === 'pending')
  const awaiting = checks.filter((c) => c.result === 'awaiting-approval')
  let stage
  let noChecks = false
  if (checks.length === 0 && noCi) {
    stage = 'checks-passed'
    noChecks = true
    notes.push('no checks configured: nothing on this head was checked by CI')
  } else if (checks.length === 0) {
    stage = 'open'
    blockers.push('no checks reported for the head commit; that is not a pass (pass --no-ci only if the repository runs none)')
  } else if (failed.length > 0) {
    stage = 'checks-failed'
    blockers.push(`${failed.length} check(s) failed: ${failed.map((c) => c.name).join(', ')}`)
  } else if (pending.length > 0 || awaiting.length > 0) {
    stage = 'checks-pending'
    const missing = pending.filter((c) => c.missing)
    const running = pending.filter((c) => !c.missing)
    if (running.length > 0) blockers.push(`${running.length} check(s) still running: ${running.map((c) => c.name).join(', ')}`)
    if (missing.length > 0) blockers.push(`${missing.length} required check(s) have not reported on this head: ${missing.map((c) => c.name).join(', ')}`)
    if (awaiting.length > 0) blockers.push(`${awaiting.length} run(s) wait for a maintainer to approve them: ${awaiting.map((c) => c.name).join(', ')}; report it, never approve it yourself`)
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
  const asked = pendingReviewers(pr)
  if (asked.length > 0) mergeBlockers.push(`review requested from ${asked.join(', ')} and not yet given`)
  const list = threadList(threads)
  const nodes = list?.nodes ?? null
  let unresolved = null
  if (nodes === null) notes.push('review threads not checked (pass --threads)')
  else {
    unresolved = nodes.filter((t) => t.isResolved !== true && t.resolved !== true).length
    if (unresolved > 0) mergeBlockers.push(`${unresolved} review thread(s) unresolved`)
    if (list.partial) mergeBlockers.push('more review threads exist than were fetched (hasNextPage); fetch every page')
  }

  const checksGreen = stage === 'checks-passed'
  const checksPassed = checksGreen && !noChecks
  const readyToMerge = checksGreen && mergeBlockers.length === 0 && nodes !== null
  if (checksGreen && nodes === null) mergeBlockers.push('review threads not checked')
  return {
    schemaVersion: PR_STATE_SCHEMA_VERSION,
    number: pr.number ?? null,
    url: pr.url ?? pr.html_url ?? null,
    head,
    localHead,
    stage: readyToMerge ? 'ready-to-merge' : noChecks ? 'open' : stage,
    prCreated: true,
    checksPassed,
    noChecksConfigured: noChecks,
    readyToMerge,
    checks,
    unresolvedThreads: unresolved,
    pendingReviews: asked,
    blockers: checksGreen ? mergeBlockers : [...blockers, ...mergeBlockers],
    notes,
  }
}

function render(r) {
  const out = [`PR ${r.number ? `#${r.number}` : ''} ${r.url ?? ''}`.trim(), `Head ${r.head ? r.head.slice(0, 12) : 'unknown'}: ${r.stage}`]
  out.push(`  PR created: yes`, `  Checks passed on this head: ${r.noChecksConfigured ? 'no checks configured' : r.checksPassed ? 'yes' : 'no'}`, `  Ready to merge: ${r.readyToMerge ? 'yes' : 'no'}`)
  for (const c of r.checks ?? []) out.push(`    ${c.result.padEnd(8)} ${c.name}`)
  for (const b of r.blockers) out.push(`  blocker: ${b}`)
  for (const n of r.notes) out.push(`  note: ${n}`)
  return out.join('\n')
}

const USAGE = `Usage: pr-state.mjs --input <pr.json|-> [--threads <threads.json>] [--required <file>] [--no-ci]
                   [--head <sha>|--no-local] [--want checks|ready] [--json] [--cwd <dir>]

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
      required: { type: 'string' },
      'no-ci': { type: 'boolean', default: false },
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
  // Windows PowerShell 5.1 writes `>` output as UTF-16 with a byte-order
  // mark; read that as well as UTF-8, with or without a BOM.
  const readText = (file) => {
    const buf = readFileSync(file === '-' ? 0 : file)
    const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8')
    return text.replace(/^\uFEFF/, '')
  }
  const readJson = (file) => JSON.parse(readText(file))
  let pr
  let threads = null
  let required = []
  try {
    pr = readJson(values.input)
    if (values.threads) threads = readJson(values.threads)
    if (values.required) {
      const text = readText(values.required).trim()
      required = text.startsWith('[') ? JSON.parse(text).map((r) => (typeof r === 'string' ? r : r.context ?? r.name)).filter(Boolean) : text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    }
  } catch (err) {
    process.stderr.write(`pr-state: cannot read input: ${err.message}\n`)
    return USAGE_EXIT_CODE
  }
  const absRoot = resolve(root)
  const localHead = values['no-local'] ? null : values.head ?? (isGitCheckout(absRoot) ? headOf(absRoot) : null)
  const result = prState(pr, { localHead, threads, required, noCi: values['no-ci'] })
  emit(result, render(result), { json: values.json })
  const reached = values.want === 'ready' ? result.readyToMerge : result.checksPassed
  return reached ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
