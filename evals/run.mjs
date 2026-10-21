#!/usr/bin/env node
// Run the agent tasks in evals/tasks.mjs under several plugin configurations
// and record what each run produced.
//
//   node evals/run.mjs [--configs none,baseline,revised] [--tasks a,b] [--trials 2]
//                      [--model sonnet] [--baseline-ref origin/main] [--concurrency 3]
//                      [--out evals/results/<name>]
//
// Configurations:
//   none      no plugin loaded
//   baseline  the plugin as it is at --baseline-ref (extracted with git archive)
//   revised   the plugin in this checkout
//
// With --invoke, plugin runs start the prompt with the task's skill command
// (`/compound-memory:<skill>`), so the skill's own instructions are compared;
// `none` has no such command and is skipped. Without it, the prompt is plain
// and the model decides whether to use a skill, as a user's request would be.
//
// Every run uses the same model, permission mode, turn and budget limits, and
// prompt, and loads no user or MCP configuration (--setting-sources
// project,local, --strict-mcp-config), so the plugin is the only difference.
// Each run's fixture is fresh. Results are written as JSON (one row per run)
// and a Markdown summary; these are agent-task results, kept apart from the
// script tests under tests/.
//
// This spends model tokens. It refuses to run without `claude` on PATH.

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { RESULT_LINE, TASKS, installFakeGh } from './tasks.mjs'
import { childEnv, git, removeTempRoot } from '../tests/fixtures/build.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const { values } = parseArgs({
  options: {
    configs: { type: 'string', default: 'none,baseline,revised' },
    tasks: { type: 'string', default: TASKS.map((t) => t.id).join(',') },
    trials: { type: 'string', default: '2' },
    model: { type: 'string', default: 'sonnet' },
    'baseline-ref': { type: 'string', default: 'origin/main' },
    concurrency: { type: 'string', default: '3' },
    'max-turns': { type: 'string', default: '60' },
    'max-budget-usd': { type: 'string', default: '2' },
    'timeout-min': { type: 'string', default: '15' },
    out: { type: 'string' },
    keep: { type: 'boolean', default: false },
    invoke: { type: 'boolean', default: false },
  },
})

const configs = values.configs.split(',').filter((c) => !(values.invoke && c === 'none'))
const tasks = values.tasks.split(',').map((id) => {
  const task = TASKS.find((t) => t.id === id)
  if (!task) throw new Error(`no task ${id}`)
  return task
})
const trials = Number(values.trials)

if (spawnSync('claude', ['--version'], { encoding: 'utf8' }).status !== 0) {
  process.stderr.write('evals: `claude` is not on PATH; nothing ran.\n')
  process.exit(2)
}

/** The baseline plugin, extracted from a ref so the checkout itself is untouched. */
function extractBaseline(ref) {
  const dir = mkdtempSync(join(tmpdir(), 'cm-baseline-'))
  const archive = spawnSync('git', ['archive', '--format=tar', ref], { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 })
  if (archive.status !== 0) throw new Error(`git archive ${ref} failed: ${archive.stderr}`)
  const untar = spawnSync('tar', ['-x', '-C', dir], { input: archive.stdout })
  if (untar.status !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  return dir
}

const pluginDirs = {
  none: null,
  baseline: configs.includes('baseline') ? extractBaseline(values['baseline-ref']) : null,
  revised: repoRoot,
}
const baselineSha = configs.includes('baseline') ? spawnSync('git', ['rev-parse', values['baseline-ref']], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim() : null
const revisedSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim()
const revisedDirty = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim() !== ''

const QUESTION = /\b(would you like|do you want|should i|shall i|let me know (if|whether|which)|can you confirm|please confirm|which (one|option) (do|would) you)\b/i

function summarizeEvents(events) {
  const skills = []
  let asks = 0
  let toolCalls = 0
  for (const e of events) {
    if (e.type !== 'assistant') continue
    for (const c of e.message?.content ?? []) {
      if (c.type !== 'tool_use') continue
      toolCalls += 1
      if (c.name === 'Skill') skills.push(c.input?.skill ?? c.input?.command ?? '?')
      if (c.name === 'AskUserQuestion') asks += 1
    }
  }
  return { skills, asks, toolCalls }
}

function runOne(task, config, trial) {
  return new Promise((resolveRun) => {
    const root = task.setup()
    const start = git(root, ['rev-parse', 'HEAD']).trim()
    const env = childEnv()
    // The child is its own session, not part of this one.
    for (const k of Object.keys(env)) if (k.startsWith('CLAUDE_CODE_') && !/^CLAUDE_CODE_(OAUTH|USE_|API)/.test(k)) delete env[k]
    let binDir = null
    if (task.needsGh) {
      binDir = mkdtempSync(join(tmpdir(), 'cm-gh-'))
      installFakeGh(root, binDir)
      env.PATH = `${binDir}${process.platform === 'win32' ? ';' : ':'}${env.PATH}`
    }
    const args = [
      '-p', `${values.invoke && pluginDirs[config] ? `/compound-memory:${task.skill} ` : ''}${task.prompt}\n\n${RESULT_LINE}`,
      '--model', values.model,
      '--permission-mode', 'bypassPermissions',
      '--max-turns', values['max-turns'],
      '--max-budget-usd', values['max-budget-usd'],
      '--output-format', 'stream-json', '--verbose',
      '--setting-sources', 'project,local',
      '--strict-mcp-config',
      '--no-session-persistence',
    ]
    if (pluginDirs[config]) args.push('--plugin-dir', pluginDirs[config])
    const began = Date.now()
    const child = spawn('claude', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    const timer = setTimeout(() => child.kill('SIGKILL'), Number(values['timeout-min']) * 60_000)
    child.on('close', (code) => {
      clearTimeout(timer)
      const events = stdout.split('\n').filter(Boolean).flatMap((l) => {
        try { return [JSON.parse(l)] } catch { return [] }
      })
      const result = events.findLast((e) => e.type === 'result') ?? {}
      const reply = typeof result.result === 'string' ? result.result : ''
      let grade
      try {
        grade = task.grade(root, reply, start)
      } catch (err) {
        grade = { correct: false, graderError: err.message }
      }
      const claimed = (reply.match(/RESULT:\s*(success|partial|failed)/i)?.[1] ?? 'none').toLowerCase()
      const tail = reply.slice(-600)
      const { skills, asks, toolCalls } = summarizeEvents(events)
      const usage = result.usage ?? {}
      const row = {
        task: task.id, size: task.size, config, trial,
        exit: code, error: result.is_error === true || code !== 0 ? (result.subtype ?? stderr.slice(0, 300)) : null,
        correct: grade.correct === true,
        claimed,
        falseSuccess: claimed === 'success' && grade.correct !== true,
        missedFault: grade.missedFault ?? null,
        needlessQuestion: asks > 0 || QUESTION.test(tail),
        durationMs: result.duration_ms ?? Date.now() - began,
        turns: result.num_turns ?? null,
        costUsd: result.total_cost_usd ?? null,
        inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens ?? 0,
        toolCalls,
        skills,
        grade,
        replyTail: reply.slice(-400),
      }
      if (!values.keep) removeTempRoot(root)
      if (binDir) removeTempRoot(binDir)
      resolveRun(row)
    })
  })
}

async function pool(jobs, size) {
  const out = []
  let next = 0
  const workers = Array.from({ length: size }, async () => {
    while (next < jobs.length) {
      const i = next++
      const row = await jobs[i]()
      out[i] = row
      process.stderr.write(`[${out.filter(Boolean).length}/${jobs.length}] ${row.task} ${row.config} #${row.trial}: ${row.correct ? 'correct' : 'WRONG'}${row.falseSuccess ? ' (false success)' : ''} ${Math.round(row.durationMs / 1000)}s $${row.costUsd?.toFixed(3) ?? '?'}\n`)
    }
  })
  await Promise.all(workers)
  return out
}

const jobs = []
for (let trial = 1; trial <= trials; trial += 1) {
  for (const task of tasks) for (const config of configs) jobs.push(() => runOne(task, config, trial))
}
const rows = await pool(jobs, Number(values.concurrency))

const mean = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)
const rate = (xs, f) => `${xs.filter(f).length}/${xs.length}`
const summary = []
for (const config of configs) {
  const mine = rows.filter((r) => r.config === config)
  const faultRuns = mine.filter((r) => r.missedFault !== null)
  summary.push({
    config,
    runs: mine.length,
    correct: rate(mine, (r) => r.correct),
    falseSuccess: rate(mine, (r) => r.falseSuccess),
    missedFaults: rate(faultRuns, (r) => r.missedFault),
    needlessQuestions: rate(mine, (r) => r.needlessQuestion),
    errors: rate(mine, (r) => r.error !== null),
    meanSeconds: Math.round(mean(mine.map((r) => r.durationMs)) / 100) / 10,
    meanCostUsd: Math.round(mean(mine.map((r) => r.costUsd ?? 0)) * 1000) / 1000,
    meanInputTokens: Math.round(mean(mine.map((r) => r.inputTokens))),
    meanOutputTokens: Math.round(mean(mine.map((r) => r.outputTokens))),
    smallTasks: (() => {
      const small = mine.filter((r) => r.size === 'small')
      return { correct: rate(small, (r) => r.correct), meanSeconds: Math.round(mean(small.map((r) => r.durationMs)) / 100) / 10, meanCostUsd: Math.round(mean(small.map((r) => r.costUsd ?? 0)) * 1000) / 1000 }
    })(),
  })
}

const stamp = new Date().toISOString().slice(0, 10)
const outBase = values.out ?? join(here, 'results', `${stamp}-${values.model}${values.invoke ? '-invoked' : ''}`)
mkdirSync(dirname(outBase), { recursive: true })
const meta = { date: new Date().toISOString(), model: values.model, invoke: values.invoke, trials, configs, tasks: tasks.map((t) => t.id), baselineRef: values['baseline-ref'], baselineSha, revisedSha, revisedDirty, maxTurns: values['max-turns'], maxBudgetUsd: values['max-budget-usd'], node: process.version, claude: spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim() }
writeFileSync(`${outBase}.json`, `${JSON.stringify({ meta, summary, rows }, null, 2)}\n`)

const md = [
  `# Agent-task eval, ${stamp}`,
  '',
  `Model \`${values.model}\` (${meta.claude}), ${trials} trial(s) per task and configuration, ${values.invoke ? 'each prompt starting with the task\'s skill command' : 'plain prompts (the model chooses whether to use a skill)'}. Baseline: \`${values['baseline-ref']}\` (${baselineSha?.slice(0, 7) ?? 'not run'}). Revised: ${revisedSha.slice(0, 7)}${revisedDirty ? ' plus uncommitted changes' : ''}. Same prompt, limits, and settings in every run; no user settings or MCP servers loaded.`,
  '',
  '| Config | Correct | False success | Missed faults | Needless questions | Errors | Mean s | Mean $ | Mean input tok | Mean output tok | Small: correct | Small: mean s | Small: mean $ |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...summary.map((s) => `| ${s.config} | ${s.correct} | ${s.falseSuccess} | ${s.missedFaults} | ${s.needlessQuestions} | ${s.errors} | ${s.meanSeconds} | ${s.meanCostUsd} | ${s.meanInputTokens} | ${s.meanOutputTokens} | ${s.smallTasks.correct} | ${s.smallTasks.meanSeconds} | ${s.smallTasks.meanCostUsd} |`),
  '',
  '## Per task',
  '',
  '| Task | Size | Config | Correct | Claimed | Seconds | $ | Skills used |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.task} | ${r.size} | ${r.config} #${r.trial} | ${r.correct ? 'yes' : 'no'} | ${r.claimed} | ${Math.round(r.durationMs / 1000)} | ${r.costUsd?.toFixed(3) ?? '?'} | ${r.skills.join(', ') || '-'} |`),
  '',
]
writeFileSync(`${outBase}.md`, md.join('\n'))
process.stdout.write(`${md.slice(0, 6 + configs.length).join('\n')}\n\nWrote ${outBase}.json and ${outBase}.md\n`)
if (pluginDirs.baseline) removeTempRoot(pluginDirs.baseline)
