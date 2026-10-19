#!/usr/bin/env node
// measure.mjs — decide keep, revert, or inconclusive for one measured change.
//
// WHAT THIS IS: the deterministic call under `build optimize`. It compares the
// median of the candidate's samples with the baseline's and keeps the change
// only when the improvement clears the noise floor: the larger of the samples'
// own relative spread and a minimum effect the caller sets. Inside the floor
// the answer is "inconclusive", never a silent revert, so a change that might
// have helped is measured again rather than thrown away.
//
// The rule follows Compound Engineering's ce-optimize decide.mjs, cut to one
// metric.
//
// Read-only.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { USAGE_EXIT_CODE, emit, parseCliArgs } from './lib/report.mjs'

export const MEASURE_SCHEMA_VERSION = 1

export function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Relative spread of a sample: (max - min) / |median|. Null under two samples. */
export function relativeSpread(values) {
  if (values.length < 2) return null
  const m = median(values)
  if (m === 0) return null
  return (Math.max(...values) - Math.min(...values)) / Math.abs(m)
}

export function parseSamples(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return []
  return String(raw)
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
}

/**
 * Compare a candidate with a baseline.
 *
 * direction: 'lower' when smaller is better (latency, bytes), 'higher' when
 * larger is better (throughput, score). noise: an explicit relative noise floor,
 * for example from two runs of the identical build. minEffect: the smallest
 * relative improvement worth keeping.
 */
export function decide({ baseline, candidate, direction = 'lower', noise = null, minEffect = 0.01 }) {
  if (![baseline, candidate].every((s) => Array.isArray(s) && s.length > 0 && s.every(Number.isFinite))) {
    return { verdict: 'inconclusive', reason: 'baseline and candidate each need at least one finite sample' }
  }
  if (!['lower', 'higher'].includes(direction)) return { verdict: 'inconclusive', reason: `unknown direction ${direction}` }
  const base = median(baseline)
  const cand = median(candidate)
  if (base === 0) return { verdict: 'inconclusive', reason: 'baseline median is zero, so a relative change is undefined', baseline: base, candidate: cand }

  const spreads = [relativeSpread(baseline), relativeSpread(candidate)].filter((s) => s !== null)
  const observedNoise = noise ?? (spreads.length > 0 ? Math.max(...spreads) : null)
  if (observedNoise === null) {
    return {
      verdict: 'inconclusive',
      reason: 'one sample per side shows no noise; run each side at least twice or pass --noise',
      baseline: base,
      candidate: cand,
    }
  }
  const improvement = (direction === 'lower' ? base - cand : cand - base) / Math.abs(base)
  // Use the tighter of the two floors so real wins are not discarded.
  const floor = Math.min(observedNoise, minEffect)
  const verdict = improvement > floor ? 'keep' : improvement < -floor ? 'revert' : 'inconclusive'
  const reason =
    verdict === 'keep'
      ? 'the improvement clears the noise floor'
      : verdict === 'revert'
        ? 'the candidate is worse by more than the noise floor'
        : 'the difference is inside the noise floor; measure again with more samples'
  return { verdict, reason, baseline: base, candidate: cand, improvement, noiseFloor: floor, direction }
}

const pct = (n) => `${(n * 100).toFixed(2)}%`

export function renderMeasureText(r) {
  const out = [`Verdict: ${r.verdict}`, `    ${r.reason}`]
  if (r.improvement !== undefined) {
    out.push(`    baseline median ${r.baseline}, candidate median ${r.candidate} (${r.direction} is better)`)
    out.push(`    improvement ${pct(r.improvement)}, noise floor ${pct(r.noiseFloor)}`)
  }
  return out.join('\n')
}

const USAGE = `Usage: measure.mjs --baseline "<n,n,...>" --candidate "<n,n,...>" [--direction lower|higher] [--noise <ratio>] [--min-effect <ratio>] [--json]

Keep a change only when its median improvement clears the noise floor.
Exits 0 when it ran; 2 on a usage error.
`

export function main(argv = process.argv.slice(2)) {
  const { values, error } = parseCliArgs(argv, {
    extraOptions: {
      baseline: { type: 'string' },
      candidate: { type: 'string' },
      direction: { type: 'string', default: 'lower' },
      noise: { type: 'string' },
      'min-effect': { type: 'string', default: '0.01' },
    },
  })
  if (error !== null || (!values.help && (!values.baseline || !values.candidate))) {
    process.stderr.write(`measure: ${error ?? '--baseline and --candidate are required'}\n\n${USAGE}`)
    return USAGE_EXIT_CODE
  }
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  for (const name of ['noise', 'min-effect']) {
    if (values[name] === undefined) continue
    const n = Number(values[name])
    if (!Number.isFinite(n) || n < 0) {
      process.stderr.write(`measure: --${name} must be a ratio of 0 or more (0.03 for 3%), not ${values[name]}\n\n${USAGE}`)
      return USAGE_EXIT_CODE
    }
  }
  const result = {
    schemaVersion: MEASURE_SCHEMA_VERSION,
    ...decide({
      baseline: parseSamples(values.baseline),
      candidate: parseSamples(values.candidate),
      direction: values.direction,
      noise: values.noise === undefined ? null : Number(values.noise),
      minEffect: Number(values['min-effect']),
    }),
  }
  emit(result, renderMeasureText(result), { json: values.json })
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  process.exitCode = main()
}
