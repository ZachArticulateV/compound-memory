// Agent tasks for comparing plugin versions on real work.
//
// Each task builds a fixture repository, gives the agent one plain request
// (no skill named, the way a user asks), and grades what the agent left
// behind: the files, the commits, the index, and the final reply. A grader
// reads artifacts, not the agent's account of them, except where the task's
// answer is the reply itself.
//
// Every task also carries a reference solution (`solve`) and a known-wrong
// reply (`wrongReply`), so tests/evals.test.mjs can show each grader accepts
// the right outcome and rejects the wrong one before any agent runs.

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { childEnv, commitAll, git, initRepo, makeTempRoot, writeTree } from '../tests/fixtures/build.mjs'
import { INVOICE_FILES } from '../tests/fixtures/engineering.mjs'

export const RESULT_LINE = 'End your reply with one line: RESULT: success, RESULT: partial, or RESULT: failed.'

const identity = (root) => {
  git(root, ['config', 'user.email', 'fixture@example.invalid'])
  git(root, ['config', 'user.name', 'Fixture Author'])
  git(root, ['config', 'commit.gpgsign', 'false'])
}

function base(files) {
  const root = makeTempRoot()
  writeTree(root, files)
  initRepo(root)
  identity(root)
  commitAll(root, 'initial')
  return root
}

const npmTest = (root) => spawnSync(process.execPath, ['--test'], { cwd: root, encoding: 'utf8', env: childEnv() })
const read = (root, rel) => (existsSync(join(root, ...rel.split('/'))) ? readFileSync(join(root, ...rel.split('/')), 'utf8') : null)
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)
const commitsSince = (root, sha) => lines(git(root, ['rev-list', `${sha}..HEAD`]))
const filesInCommits = (root, sha) => [...new Set(lines(git(root, ['diff', '--name-only', sha, 'HEAD'])))]
const status = (root) => lines(git(root, ['status', '--porcelain', '--untracked-files=all']))

const FIXED_SUBTOTAL = INVOICE_FILES['lib/invoice.mjs'].replace('let i = 1', 'let i = 0')

/** A hidden check the agent never sees: the behavior, not the agent's own test. */
function invoiceBehaves(root) {
  const probe = `import { total } from './lib/invoice.mjs'\nconst ok = total([{ qty: 2, price: 5 }, { qty: 1, price: 50 }, { qty: 3, price: 1 }]) === 63 && total([{ qty: 1, price: 10 }], 50) === 5\nprocess.exit(ok ? 0 : 1)\n`
  writeFileSync(join(root, '.eval-probe.mjs'), probe)
  const r = spawnSync(process.execPath, ['.eval-probe.mjs'], { cwd: root, encoding: 'utf8' })
  return r.status === 0
}

export const TASKS = [
  {
    id: 'typo',
    skill: 'build',
    size: 'small',
    summary: 'Fix one typo; nothing else should change.',
    prompt: 'There is a typo in README.md ("recieve"). Fix it.',
    setup: () => base({ 'README.md': '# Invoices\n\nYou will recieve an invoice each month.\n', ...INVOICE_FILES, 'lib/invoice.mjs': FIXED_SUBTOTAL }),
    grade(root) {
      const readme = read(root, 'README.md') ?? ''
      const fixed = readme.includes('receive') && !readme.includes('recieve')
      const others = status(root).filter((l) => !/README\.md$/.test(l) && !/\.verify\//.test(l))
      return { correct: fixed && others.length === 0, extraFiles: others.length, notes: others.slice(0, 5) }
    },
    solve(root) {
      writeTree(root, { 'README.md': '# Invoices\n\nYou will receive an invoice each month.\n' })
    },
    wrongReply: null,
  },
  {
    id: 'measure',
    skill: 'build optimize',
    size: 'small',
    summary: 'A supplied zero noise must not hide a 180% spread.',
    prompt: 'I rewrote the sort and ran the same benchmark, on the same input, three times for each version. Baseline runs took 10, 100, and 190 ms. The new version took 9, 90, and 171 ms. Two identical builds measured 0% apart once, so take noise as 0. Should I keep the change, revert it, or measure again? Start your reply with one word: KEEP, REVERT, or REMEASURE.',
    setup: () => base({ 'README.md': '# Sorter\n' }),
    grade(root, reply) {
      const first = (reply.trim().match(/^[*_`#\s]*(KEEP|REVERT|REMEASURE)/i)?.[1] ?? '').toUpperCase()
      return { correct: first === 'REMEASURE', missedFault: first !== 'REMEASURE', answer: first || '(none)' }
    },
    solve: null,
    rightReply: 'REMEASURE. The samples spread far more than the 10% difference.',
    wrongReply: 'KEEP. The median improved by 10% with zero noise.',
  },
  {
    id: 'debug',
    skill: 'debug',
    size: 'medium',
    summary: 'Fix a seeded off-by-one behind a regression test, and commit.',
    prompt: 'Customers report invoice totals are too low on invoices with more than one line. Find the cause, fix it, and commit the fix.',
    setup: () => {
      const root = makeTempRoot()
      writeTree(root, { ...INVOICE_FILES, '.gitignore': '.eval-probe.mjs\n' })
      initRepo(root)
      identity(root)
      commitAll(root, 'initial')
      return root
    },
    grade(root, _reply, start) {
      const behaves = invoiceBehaves(root)
      const green = npmTest(root).status === 0
      const committed = commitsSince(root, start).length > 0 && status(root).filter((l) => !/\.verify\/|\.eval-probe/.test(l)).length === 0
      const tests = read(root, 'test/invoice.test.mjs') ?? ''
      const regression = (tests.match(/\btest\(/g) ?? []).length >= 2 || lines(git(root, ['ls-files', 'test'])).length > 1
      return { correct: behaves && green && committed && regression, behaves, green, committed, regression }
    },
    solve(root) {
      writeTree(root, {
        'lib/invoice.mjs': FIXED_SUBTOTAL,
        'test/invoice.test.mjs': `${INVOICE_FILES['test/invoice.test.mjs']}\ntest('every line counts', () => {\n  assert.equal(total([{ qty: 1, price: 1 }, { qty: 1, price: 2 }]), 3)\n})\n`,
      })
      commitAll(root, 'fix: count the first invoice line')
    },
    wrongReply: null,
  },
  {
    id: 'review-uncommitted',
    skill: 'review',
    size: 'medium',
    summary: 'Review uncommitted work, including a new file holding the bug.',
    prompt: 'Review my current changes before I commit them. Tell me anything that is wrong. Do not change any files.',
    setup: () => {
      const root = base({ ...INVOICE_FILES, 'lib/invoice.mjs': FIXED_SUBTOTAL })
      git(root, ['checkout', '-q', '-b', 'feature/discount-codes'])
      writeTree(root, {
        'lib/invoice.mjs': `${FIXED_SUBTOTAL}\nexport { applyCode } from './codes.mjs'\n`,
        'lib/codes.mjs': [
          '// Discount codes. Each code is a percentage off the total.',
          "const CODES = { SPRING10: 10, VIP25: 25 }",
          '',
          'export function applyCode(amount, code) {',
          '  const pct = CODES[code] ?? 0',
          '  return amount - amount * pct / 10',
          '}',
          '',
        ].join('\n'),
      })
      git(root, ['add', 'lib/invoice.mjs'])
      return root
    },
    grade(root, reply, start) {
      const untouched = read(root, 'lib/codes.mjs')?.includes('pct / 10') && commitsSince(root, start).length === 0
      const text = reply.toLowerCase()
      const found = /codes\.mjs|applycode|pct \/ 10|\/ 10\b|divid|percent/.test(text) && /(100|ten times|10x|×10|tenfold|too (large|big|much)|90%|negative)/.test(text)
      return { correct: Boolean(untouched && found), missedFault: !found, untouched: Boolean(untouched) }
    },
    solve: null,
    rightReply: 'lib/codes.mjs: applyCode divides by 10 instead of 100, so SPRING10 takes 100% off and VIP25 makes the total negative.',
    wrongReply: 'The change to lib/invoice.mjs re-exports applyCode cleanly. Looks good to commit.',
  },
  {
    id: 'commit-staged',
    skill: 'build',
    size: 'medium',
    summary: 'Commit only the requested change while the user has unrelated staged work.',
    prompt: 'Make total() in lib/invoice.mjs throw a RangeError when any line has a negative qty, add a test for it, and commit that change.',
    setup: () => {
      const root = base({ ...INVOICE_FILES, 'lib/invoice.mjs': FIXED_SUBTOTAL, 'notes/plan.md': '# Plan\n\n- ship discounts\n' })
      writeTree(root, { 'notes/plan.md': '# Plan\n\n- ship discounts\n- ask finance about rounding (draft, do not commit yet)\n' })
      git(root, ['add', 'notes/plan.md'])
      return root
    },
    grade(root, _reply, start) {
      const committedFiles = filesInCommits(root, start)
      const notesCommitted = committedFiles.includes('notes/plan.md')
      const notesStillStaged = lines(git(root, ['diff', '--cached', '--name-only'])).includes('notes/plan.md')
      const notesKept = (read(root, 'notes/plan.md') ?? '').includes('ask finance')
      const probe = "import { total } from './lib/invoice.mjs'\nlet threw = false\ntry { total([{ qty: -1, price: 5 }]) } catch (e) { threw = e instanceof RangeError }\nprocess.exit(threw && total([{ qty: 1, price: 5 }]) === 5 ? 0 : 1)\n"
      writeFileSync(join(root, '.eval-probe.mjs'), probe)
      const behaves = spawnSync(process.execPath, ['.eval-probe.mjs'], { cwd: root }).status === 0
      const green = npmTest(root).status === 0
      return { correct: behaves && green && committedFiles.length > 0 && !notesCommitted && notesStillStaged && notesKept, missedFault: notesCommitted, behaves, green, notesCommitted, notesStillStaged, notesKept, committedFiles }
    },
    solve(root) {
      writeTree(root, {
        'lib/invoice.mjs': FIXED_SUBTOTAL.replace('export function subtotal(lines) {', "export function subtotal(lines) {\n  if (lines.some((l) => l.qty < 0)) throw new RangeError('negative qty')"),
        'test/invoice.test.mjs': `${INVOICE_FILES['test/invoice.test.mjs']}\ntest('negative qty throws', () => {\n  assert.throws(() => total([{ qty: -1, price: 1 }]), RangeError)\n})\n`,
      })
      git(root, ['add', 'lib/invoice.mjs', 'test/invoice.test.mjs'])
      git(root, ['-c', 'user.name=a', '-c', 'user.email=a@b.c', 'commit', '-q', '-m', 'feat: reject negative qty', '--', 'lib/invoice.mjs', 'test/invoice.test.mjs'])
    },
    wrongReply: null,
  },
  {
    id: 'pr-ready',
    skill: 'ship',
    size: 'small',
    summary: 'Green checks on an old head plus an unresolved thread is not ready to merge.',
    prompt: 'Is pull request #12 ready to merge? Use gh to check. Start your reply with READY or NOT READY, then say why. Do not push, merge, or change anything.',
    needsGh: true,
    setup: () => {
      const root = base({ ...INVOICE_FILES, 'lib/invoice.mjs': FIXED_SUBTOTAL })
      git(root, ['checkout', '-q', '-b', 'feature/cli'])
      writeTree(root, { 'bin/invoice.mjs': '#!/usr/bin/env node\nconsole.log("total")\n' })
      const pushed = commitAll(root, 'feat: invoice CLI')
      writeTree(root, { 'bin/invoice.mjs': '#!/usr/bin/env node\nconsole.log("total", process.argv[2])\n' })
      commitAll(root, 'fix(review): print the file name')
      writeFileSync(join(root, '.git', 'eval-pr-head'), pushed)
      return root
    },
    grade(root, reply) {
      const first = reply.trim().replace(/^[*_`#\s]+/, '').toUpperCase()
      const notReady = first.startsWith('NOT READY')
      return { correct: notReady, missedFault: !notReady }
    },
    solve: null,
    rightReply: 'NOT READY. The green checks ran on the pushed commit, but the local fix is not pushed, and one review thread is unresolved.',
    wrongReply: 'READY. All checks pass and the PR is approved.',
  },
]

/**
 * A `gh` stand-in for the pr-ready task. The PR head is the commit pushed
 * before the local fix; checks on it are green, the review is approved, and
 * one thread is unresolved.
 */
export function installFakeGh(root, binDir) {
  const head = readFileSync(join(root, '.git', 'eval-pr-head'), 'utf8').trim()
  const pr = {
    number: 12, url: 'https://github.com/acme/invoices/pull/12', title: 'Invoice CLI', state: 'OPEN', isDraft: false,
    headRefName: 'feature/cli', headRefOid: head, baseRefName: 'main', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
    reviewDecision: 'APPROVED',
    statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: 'https://github.com/acme/invoices/actions/runs/7' }],
    reviews: [{ author: { login: 'sam' }, state: 'APPROVED' }],
    commits: [{ oid: head, messageHeadline: 'feat: invoice CLI' }],
  }
  const threads = { data: { repository: { pullRequest: { reviewThreads: { nodes: [
    { id: 'T_1', isResolved: true, comments: { nodes: [{ body: 'Nit: shebang', path: 'bin/invoice.mjs', author: { login: 'sam' } }] } },
    { id: 'T_2', isResolved: false, comments: { nodes: [{ body: 'The CLI ignores the file argument; please print it.', path: 'bin/invoice.mjs', author: { login: 'dana' } }] } },
  ] } } } } }
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2)
const pr = ${JSON.stringify(pr)}
const threads = ${JSON.stringify(threads)}
const out = (x) => process.stdout.write((typeof x === 'string' ? x : JSON.stringify(x, null, 2)) + '\\n')
const pick = (o, fields) => fields ? Object.fromEntries(fields.split(',').map((f) => [f, o[f]])) : o
const at = args.indexOf('--json')
const fields = at === -1 ? null : args[at + 1]
if (args[0] === 'pr' && args[1] === 'view') out(fields ? pick(pr, fields) : 'title: Invoice CLI\\nstate: OPEN\\nreview: APPROVED\\nchecks: 1 passing')
else if (args[0] === 'pr' && args[1] === 'checks') out('test\\tpass\\t42s\\thttps://github.com/acme/invoices/actions/runs/7')
else if (args[0] === 'pr' && args[1] === 'list') out(fields ? [pick(pr, fields)] : '12\\tInvoice CLI\\tfeature/cli\\tOPEN')
else if (args[0] === 'api' && args.join(' ').includes('graphql')) out(threads)
else if (args[0] === 'api' && /pulls\\/12\\/comments/.test(args.join(' '))) out([{ id: 2, path: 'bin/invoice.mjs', body: 'The CLI ignores the file argument; please print it.', user: { login: 'dana' } }])
else if (args[0] === 'api' && /pulls\\/12/.test(args.join(' '))) out({ number: 12, state: 'open', head: { sha: pr.headRefOid, ref: 'feature/cli' }, mergeable: true })
else if (args[0] === 'repo' && args[1] === 'view') out({ nameWithOwner: 'acme/invoices', defaultBranchRef: { name: 'main' } })
else if (args[0] === 'auth') out('Logged in to github.com as fixture')
else { process.stderr.write('fake gh: unsupported ' + args.join(' ') + '\\n'); process.exitCode = 1 }
`
  const file = join(binDir, 'gh')
  writeFileSync(file, script)
  chmodSync(file, 0o755)
  return file
}
