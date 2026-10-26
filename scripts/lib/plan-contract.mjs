// Versioned static plans. This module does not read or write run state.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const schema = JSON.parse(readFileSync(new URL('../../schemas/plan.schema.json', import.meta.url), 'utf8'))
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value

/** Object key order is irrelevant. Array order is part of the plan. */
export function planFingerprint(plan) {
  return createHash('sha256').update(JSON.stringify(canonical(plan))).digest('hex')
}

// Interpret the small JSON Schema vocabulary this contract uses. Structural
// rules live in the schema; cross-record references and graph rules live below.
function checkShape(value, rule, at, problems) {
  if (rule.$ref) rule = schema.$defs[rule.$ref.split('/').at(-1)]
  const fail = message => problems.push({ kind: 'shape', message: `${at}: ${message}` })
  if ('const' in rule && value !== rule.const) fail(`must equal ${JSON.stringify(rule.const)}`)
  const matches = rule.type === 'object' ? object(value)
    : rule.type === 'array' ? Array.isArray(value)
      : rule.type === 'integer' ? Number.isSafeInteger(value)
        : typeof value === rule.type
  if (!matches) { fail(`must be ${rule.type}`); return }
  if (rule.type === 'object') {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`)
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(rule.properties ?? {}, key)) {
        if (rule.additionalProperties === false) fail(`unknown field ${key}`)
      } else checkShape(child, rule.properties[key], `${at}.${key}`, problems)
    }
  } else if (rule.type === 'array') {
    if (rule.minItems !== undefined && value.length < rule.minItems) fail(`needs at least ${rule.minItems} item(s)`)
    if (rule.uniqueItems && new Set(value.map(item => JSON.stringify(canonical(item)))).size !== value.length) fail('contains duplicate values')
    value.forEach((item, i) => checkShape(item, rule.items, `${at}[${i}]`, problems))
  } else if (rule.type === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) fail('is empty')
    if (rule.maxLength !== undefined && value.length > rule.maxLength) fail('is too long')
    if (rule.pattern && !new RegExp(rule.pattern, 'u').test(value)) fail('has invalid characters or shape')
  } else if (rule.type === 'integer' && rule.minimum !== undefined && value < rule.minimum) fail(`must be at least ${rule.minimum}`)
}

const pathKey = path => path.replace(/\/$/, '').toLowerCase()
const overlap = (a, b) => a === '.' || b === '.' || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
export const isPlanPath = value => typeof value === 'string' && new RegExp(schema.$defs.path.pattern, 'u').test(value)

/** Conservative across hosts: case variants share a claim. Paths are literal. */
export function tasksConflict(a, b) {
  return (a.paths ?? []).some(x => (b.paths ?? []).some(y => overlap(pathKey(x), pathKey(y))))
    || (a.resources ?? []).some(x => (b.resources ?? []).some(y => x.toLowerCase() === y.toLowerCase()))
}

export function validatePlan(plan) {
  const problems = []
  checkShape(plan, schema, 'plan', problems)
  if (problems.length) return { ok: false, problems }
  const add = (kind, message) => problems.push({ kind, message })
  const allIds = new Set()
  for (const group of ['requirements', 'decisions', 'phases', 'checks', 'gates', 'tasks']) {
    for (const row of plan[group]) {
      if (allIds.has(row.id)) add('duplicate-id', `${row.id} appears more than once in the plan`)
      allIds.add(row.id)
    }
  }
  const refs = Object.fromEntries(['requirements', 'phases', 'checks', 'gates', 'tasks'].map(group => [group, new Set(plan[group].map(row => row.id))]))
  const requireRef = (group, id, owner) => { if (!refs[group].has(id)) add('unknown-reference', `${owner} names unknown ${group} ID ${id}`) }
  for (const check of plan.finalChecks) requireRef('checks', check, 'finalChecks')
  const covered = new Set()
  for (const task of plan.tasks) {
    requireRef('phases', task.phaseId, task.id)
    for (const id of task.covers) { requireRef('requirements', id, task.id); covered.add(id) }
    for (const id of task.dependsOn) requireRef('tasks', id, task.id)
    for (const id of task.requiresGates) requireRef('gates', id, task.id)
    for (const id of task.requiredChecks) requireRef('checks', id, task.id)
    if (new Set(task.paths.map(pathKey)).size !== task.paths.length) add('duplicate-path', `${task.id} repeats a path claim`)
    if (new Set(task.resources.map(x => x.toLowerCase())).size !== task.resources.length) add('duplicate-resource', `${task.id} repeats a resource claim`)
  }
  for (const req of plan.requirements) if (!covered.has(req.id)) add('uncovered', `${req.id} has no task`)
  for (const gate of plan.gates) {
    requireRef('phases', gate.phaseId, gate.id)
    for (const id of gate.dependsOn) if (!refs.tasks.has(id) && !refs.gates.has(id)) add('unknown-reference', `${gate.id} names unknown task or gate ${id}`)
    for (const id of gate.requiredChecks) requireRef('checks', id, gate.id)
  }
  const graph = new Map([
    ...plan.tasks.map(task => [task.id, [...task.dependsOn, ...task.requiresGates]]),
    ...plan.gates.map(gate => [gate.id, gate.dependsOn]),
  ])
  const seen = new Set(), active = new Set(), stack = []
  const visit = id => {
    if (active.has(id)) { add('cycle', `dependency cycle: ${[...stack.slice(stack.indexOf(id)), id].join(' -> ')}`); return }
    if (seen.has(id) || !graph.has(id)) return
    active.add(id); stack.push(id)
    for (const dep of graph.get(id)) visit(dep)
    stack.pop(); active.delete(id); seen.add(id)
  }
  for (const id of graph.keys()) visit(id)
  return { ok: problems.length === 0, problems }
}

/** Select a conflict-free batch. This is a view, not an atomic task claim. */
export function readyTasks(plan, state = {}) {
  const checked = validatePlan(plan)
  const fail = problems => ({ ok: false, problems, ready: [], waiting: [] })
  if (!checked.ok) return fail(checked.problems)
  if (!object(state)) return fail([{ kind: 'invalid-state', message: 'run state must be an object' }])
  const { acceptedTasks = [], passedGates = [], activeTasks = [], eligibleTasks = plan.tasks.map(task => task.id) } = state
  const tasks = new Map(plan.tasks.map(task => [task.id, task]))
  const gates = new Map(plan.gates.map(gate => [gate.id, gate]))
  const problems = []
  for (const [name, values, source] of [['acceptedTasks', acceptedTasks, tasks], ['passedGates', passedGates, gates], ['activeTasks', activeTasks, tasks], ['eligibleTasks', eligibleTasks, tasks]]) {
    if (!Array.isArray(values) || values.some(id => typeof id !== 'string' || !source.has(id)) || new Set(values).size !== values.length) problems.push({ kind: 'invalid-state', message: `${name} must contain unique known IDs` })
  }
  if (problems.length) return fail(problems)
  const accepted = new Set(acceptedTasks), passed = new Set(passedGates), active = new Set(activeTasks), eligible = new Set(eligibleTasks)
  const depsMet = task => task.dependsOn.every(id => accepted.has(id)) && task.requiresGates.every(id => passed.has(id))
  for (const id of accepted) if (active.has(id) || !depsMet(tasks.get(id))) problems.push({ kind: 'invalid-state', message: `${id} has inconsistent accepted state` })
  for (const id of passed) if (!gates.get(id).dependsOn.every(dep => accepted.has(dep) || passed.has(dep))) problems.push({ kind: 'invalid-state', message: `${id} passed before its dependencies` })
  for (const id of active) if (!depsMet(tasks.get(id))) problems.push({ kind: 'invalid-state', message: `${id} is active before its dependencies` })
  for (let i = 0; i < activeTasks.length; i++) for (let j = i + 1; j < activeTasks.length; j++) {
    if (tasksConflict(tasks.get(activeTasks[i]), tasks.get(activeTasks[j]))) problems.push({ kind: 'unsafe-assignment', message: `${activeTasks[i]} and ${activeTasks[j]} hold conflicting claims` })
  }
  if (problems.length) return fail(problems)
  const selected = activeTasks.map(id => tasks.get(id)), ready = [], waiting = []
  for (const task of plan.tasks) {
    if (accepted.has(task.id) || active.has(task.id) || !eligible.has(task.id)) continue
    if (depsMet(task) && !selected.some(other => tasksConflict(task, other))) { ready.push(task.id); selected.push(task) }
    else waiting.push(task.id)
  }
  return { ok: true, problems: [], ready, waiting }
}
