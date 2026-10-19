// Fixtures for the live engineering-skill scenarios.
//
// One small Node project (an invoice total with a seeded off-by-one bug and a
// failing test), plus helpers that put a scripted `gh` on PATH. Everything is
// materialized in a temp directory, like every other fixture in this suite.

import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { childEnv, commitAll, git, initRepo, makeTempRoot, writeTree } from './build.mjs'

const here = dirname(fileURLToPath(import.meta.url))

export const INVOICE_FILES = {
  'package.json': '{ "name": "invoices", "type": "module", "scripts": { "test": "node --test" } }\n',
  'lib/invoice.mjs': [
    '// Totals for an invoice. Discounts are percentages applied to the subtotal.',
    'export function subtotal(lines) {',
    '  let total = 0',
    '  for (let i = 1; i < lines.length; i++) total += lines[i].qty * lines[i].price',
    '  return total',
    '}',
    '',
    'export function total(lines, discountPct = 0) {',
    '  const s = subtotal(lines)',
    '  return Math.round(s * (1 - discountPct / 100) * 100) / 100',
    '}',
    '',
  ].join('\n'),
  'test/invoice.test.mjs': [
    "import { test } from 'node:test'",
    "import assert from 'node:assert/strict'",
    "import { total } from '../lib/invoice.mjs'",
    '',
    "test('a discount applies to the subtotal', () => {",
    '  assert.equal(total([{ qty: 10, price: 10 }, { qty: 1, price: 50 }], 10), 135)',
    '})',
    '',
  ].join('\n'),
}

/**
 * The invoice project with its bug, committed on main. The commit identity is
 * written to the fixture's own config so the spawned agent can commit too.
 */
export function invoiceRepo() {
  const root = makeTempRoot()
  writeTree(root, INVOICE_FILES)
  initRepo(root)
  git(root, ['config', 'user.email', 'fixture@example.invalid'])
  git(root, ['config', 'user.name', 'Fixture Author'])
  git(root, ['config', 'commit.gpgsign', 'false'])
  commitAll(root, 'initial')
  return root
}

/** A bare repository to stand in as `origin`. */
export function bareRemote(root) {
  const remote = makeTempRoot()
  git(remote, ['init', '--bare', '-b', 'main'])
  git(root, ['remote', 'add', 'origin', remote])
  git(root, ['push', '-q', 'origin', 'HEAD'])
  return remote
}

/**
 * A directory holding a scripted `gh`: CI status is the fixture's real
 * `npm test`, review comments are canned, and every call is logged to `log`.
 * Returns the environment to spawn the agent with.
 */
export function fakeGhEnv(log) {
  const bin = makeTempRoot()
  mkdirSync(bin, { recursive: true })
  const script = join(bin, 'gh')
  copyFileSync(join(here, 'fake-gh.cjs'), script)
  chmodSync(script, 0o755)
  // Windows resolves `gh` through PATHEXT, so give it a .cmd shim.
  writeFileSync(join(bin, 'gh.cmd'), `@echo off\r\nnode "%~dp0gh" %*\r\n`)
  const sep = process.platform === 'win32' ? ';' : ':'
  return { ...childEnv(), PATH: `${bin}${sep}${process.env.PATH}`, FAKE_GH_LOG: log, bin }
}

/** The review comments the fake `gh` serves, by id. */
export const FAKE_REVIEW_COMMENT_IDS = [901, 902, 903]
