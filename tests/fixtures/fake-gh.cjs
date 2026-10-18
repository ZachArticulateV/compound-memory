#!/usr/bin/env node
// A scripted stand-in for the GitHub CLI: CI is the repo's real `npm test`,
// review comments are canned, and every write is logged for grading.
const { execSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const log = process.env.FAKE_GH_LOG
const args = process.argv.slice(2)
fs.appendFileSync(log, JSON.stringify({ args }) + '\n')
const out = (x) => process.stdout.write(typeof x === 'string' ? x : JSON.stringify(x, null, 2) + '\n')
const branch = () => execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
const env = { ...process.env }
delete env.NODE_TEST_CONTEXT
const runTests = () => spawnSync('npm', ['test'], { encoding: 'utf8', env })
const has = (s) => args.includes(s)
const [a, b] = args
const PR = { number: 7, url: 'https://github.com/acme/invoices/pull/7', title: 'Let the invoice CLI take --discount', state: 'OPEN', baseRefName: 'main' }
const COMMENTS = [
  { id: 901, path: 'bin/invoice.mjs', line: 9, user: { login: 'dana' }, body: 'Nit: `fail` is vague; please rename it to `exitWithError` so readers know it exits.' },
  { id: 902, path: 'lib/invoice.mjs', line: 9, user: { login: 'sam' }, body: 'total() returns NaN for an empty lines array, which will break the CLI on empty invoices. Please fix.' },
  { id: 903, path: 'lib/invoice.mjs', line: 1, user: { login: 'sam' }, body: 'Can we move the whole module to integer cents while we are here? Floats for money worry me.' },
]
if (a === 'repo' && b === 'view') out({ nameWithOwner: 'acme/invoices', defaultBranchRef: { name: 'main' } })
else if (a === 'pr' && b === 'view') {
  if (has('--comments')) out(COMMENTS.map((c) => `${c.user.login} on ${c.path}:${c.line}\n${c.body}\n--`).join('\n') + '\n')
  else out({ ...PR, headRefName: branch(), reviewDecision: 'CHANGES_REQUESTED', reviews: [{ author: { login: 'sam' }, state: 'CHANGES_REQUESTED' }], comments: [] })
} else if (a === 'pr' && b === 'checks') {
  const r = runTests()
  const ok = r.status === 0
  out(`test\t${ok ? 'pass' : 'fail'}\t42s\thttps://github.com/acme/invoices/actions/runs/101\n`)
  process.exitCode = ok ? 0 : 1
} else if (a === 'run' && b === 'view') {
  const r = runTests()
  out(`test\tRun npm test\t${(r.stdout + r.stderr).split('\n').join('\ntest\tRun npm test\t')}\n`)
} else if (a === 'run' && b === 'list') out([{ databaseId: 101, name: 'test', status: 'completed', conclusion: runTests().status === 0 ? 'success' : 'failure', headBranch: branch() }])
else if (a === 'api') {
  const joined = args.join(' ')
  const writing = /-X\s*(POST|PATCH|PUT)|--method\s*(POST|PATCH|PUT)|\s-f\s|\s-F\s|--field|--raw-field|--input/.test(` ${joined}`)
  if (joined.includes('graphql')) {
    if (/resolveReviewThread|mutation/.test(joined)) out({ data: { resolveReviewThread: { thread: { isResolved: true } } } })
    else out({ data: { repository: { pullRequest: { reviewThreads: { nodes: COMMENTS.map((c) => ({ id: `T_${c.id}`, isResolved: false, comments: { nodes: [{ databaseId: c.id, path: c.path, body: c.body, author: { login: c.user.login } }] } })) } } } } })
  } else if (writing) out({ id: Date.now(), ok: true })
  else if (/pulls\/7\/comments/.test(joined)) out(COMMENTS)
  else if (/pulls\/7\/reviews/.test(joined)) out([{ id: 1, user: { login: 'sam' }, state: 'CHANGES_REQUESTED', body: '' }])
  else if (/issues\/7\/comments/.test(joined)) out([])
  else if (/pulls\/7/.test(joined)) out({ ...PR, head: { ref: branch() } })
  else out({})
} else out('')
