// Version 2 local task state. Only the lead changes the ledger. Workers write
// immutable result files. These files coordinate one store, not offline clones.
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { codeFingerprint } from './changes.mjs'
import { validatePlan, planFingerprint, readyTasks } from './plan-contract.mjs'
import { validateProof } from './proof.mjs'
import { validateWorkspaceClaim } from '../agents/workspaces.mjs'

export const RUN_STATE_VERSION = 2
export const TASK_STATES = ['planned', 'ready', 'claimed', 'running', 'blocked', 'failed', 'awaiting-review', 'accepted', 'cancelled']
const ACTIVE = new Set(['claimed', 'running', 'awaiting-review'])
const token = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v) && v !== '.' && v !== '..'
const text = (v) => typeof v === 'string' && v.trim().length > 0
const positive = (v) => Number.isSafeInteger(v) && v > 0
const canonical = (value) => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex')
const holdsClaim = (state) => state.assignment !== null && state.state !== 'accepted'
const fail = (message) => { throw new Error(message) }
const ensure = (condition, message) => { if (!condition) fail(message) }
const date = (value = new Date()) => { const n = new Date(value).getTime(); ensure(Number.isFinite(n), 'invalid timestamp'); return n }
const iso = (value) => new Date(value).toISOString()
const wrap = (fn) => { try { return fn() } catch (error) { return { ok: false, error: error.message } } }

function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function exactFields(value, fields, label) {
  ensure(plainObject(value) && Object.keys(value).length===fields.length && fields.every(key=>Object.hasOwn(value,key)), `${label} fields do not match version 2`)
}
function safeRoot(root) {
  const value = realpathSync(resolve(root))
  ensure(lstatSync(value).isDirectory(), 'root is not a directory')
  return value
}
function safeDir(root, parts, create = false) {
  let current = safeRoot(root)
  for (const part of parts) {
    ensure(part === '.verify' || token(part), 'invalid runtime path segment')
    current = join(current, part)
    if (!existsSync(current)) {
      ensure(create, `missing runtime directory: ${part}`)
      try { mkdirSync(current) } catch (error) { if (error.code !== 'EEXIST') throw error }
    }
    const st = lstatSync(current)
    ensure(st.isDirectory() && !st.isSymbolicLink(), 'runtime directories must be real directories, not links')
  }
  return current
}
function runDir(root, id, create = false) {
  ensure(token(id), 'invalid run ID')
  return safeDir(root, ['.verify', 'runs', id], create)
}
function safeFile(file) {
  const stat = lstatSync(file)
  ensure(stat.isFile() && !stat.isSymbolicLink(), 'runtime files must be regular files, not links')
  return file
}
function readJson(file) { return JSON.parse(readFileSync(safeFile(file), 'utf8')) }
function writeTemp(file, value) {
  const tmp = `${file}.tmp-${randomUUID()}`
  const fd = openSync(tmp, 'wx')
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fsyncSync(fd) } finally { closeSync(fd) }
  return tmp
}
function replaceJson(file, value) {
  if (existsSync(file)) safeFile(file)
  const tmp = writeTemp(file, value)
  try { renameSync(tmp, file) } finally { if (existsSync(tmp)) unlinkSync(tmp) }
}
function publishSubmission(file, value) {
  const tmp = writeTemp(file, value)
  try {
    try { linkSync(tmp, file); return {idempotent:false,submission:value} } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const existing=readSubmission(file)
      ensure(canonical(existing.result) === canonical(value.result), 'result ID already exists with different content')
      return {idempotent:true,submission:existing}
    }
  } finally { unlinkSync(tmp) }
}
function locked(root, id, callback, create = false) {
  const dir = runDir(root, id, create)
  const lock = join(dir, '.lock')
  try { mkdirSync(lock) } catch (error) {
    if (error.code === 'EEXIST') fail('run is locked; confirm the old writer stopped before manual lock recovery')
    throw error
  }
  try { return callback(dir) } finally { rmdirSync(lock) }
}
function checkedPlan(plan) {
  const checked = validatePlan(plan)
  ensure(checked.ok, `invalid plan: ${checked.problems.map(p => p.message).join('; ')}`)
}
function validateLedger(ledger, id) {
  exactFields(ledger,['schemaVersion','kind','runId','revision','plan','planFingerprint','owner','limits','tasks','gates','integration','next','history','created','updated'],'ledger')
  ensure(plainObject(ledger) && ledger.schemaVersion === 2 && ledger.kind === 'run' && ledger.runId === id, 'unsupported or mismatched run ledger')
  ensure(Number.isSafeInteger(ledger.revision) && ledger.revision >= 0, 'invalid ledger revision')
  checkedPlan(ledger.plan)
  ensure(ledger.planFingerprint === planFingerprint(ledger.plan), 'stored plan fingerprint does not match')
  exactFields(ledger.owner,['id','version','leaseUntil'],'owner')
  ensure(token(ledger.owner.id) && positive(ledger.owner.version) && text(ledger.owner.leaseUntil), 'invalid lead owner')
  date(ledger.owner.leaseUntil)
  exactFields(ledger.limits,['retryLimit'],'run limits')
  ensure(positive(ledger.limits.retryLimit), 'invalid run retry limit')
  ensure(plainObject(ledger.tasks) && Object.keys(ledger.tasks).length === ledger.plan.tasks.length, 'invalid task state set')
  for (const task of ledger.plan.tasks) {
    const state = ledger.tasks[task.id]
    exactFields(state,['state','attempt','attemptsUsed','assignment','resultId','resultFingerprint','acceptanceDependencies','reason'],'task state')
    ensure(plainObject(state) && TASK_STATES.includes(state.state) && Number.isSafeInteger(state.attempt) && state.attempt >= 0, `invalid state for ${task.id}`)
    ensure(Number.isSafeInteger(state.attemptsUsed) && state.attemptsUsed>=0 && state.attemptsUsed<=state.attempt && state.attemptsUsed<=ledger.limits.retryLimit,'task attempt budget exceeds run limit')
    if (state.assignment !== null) {
      validateAssignment(state.assignment)
      ensure(state.assignment.runId === id && state.assignment.planId === ledger.plan.planId && state.assignment.planRevision === ledger.plan.revision && state.assignment.taskId === task.id && state.assignment.attempt === state.attempt, `assignment identity mismatch for ${task.id}`)
      ensure(state.assignment.ownerVersion <= ledger.owner.version, 'assignment has a future lead version')
      if (state.state !== 'accepted') ensure(state.assignment.ownerVersion === ledger.owner.version, 'unfinished assignment has an old lead version')
    }
    if (ACTIVE.has(state.state) || state.state === 'accepted') ensure(state.assignment !== null, 'active or accepted task has no assignment')
    if (state.state === 'accepted') {
      ensure(token(state.resultId) && /^[a-f0-9]{64}$/.test(state.resultFingerprint ?? ''), 'accepted task needs an immutable result fingerprint')
      exactFields(state.acceptanceDependencies,['tasks','gates'],'acceptance dependencies')
      exactFields(state.acceptanceDependencies.tasks,task.dependsOn,'accepted task dependencies')
      exactFields(state.acceptanceDependencies.gates,task.requiresGates,'accepted gate dependencies')
      ensure([...Object.values(state.acceptanceDependencies.tasks),...Object.values(state.acceptanceDependencies.gates)].every(hash=>/^[a-f0-9]{64}$/.test(hash)), 'invalid dependency result fingerprint')
    }
    else ensure(state.resultId===null && state.resultFingerprint===null && state.acceptanceDependencies===null,'unaccepted task has accepted result fields')
    ensure(state.reason===null || text(state.reason),'invalid task reason')
  }
  ensure(plainObject(ledger.gates) && plainObject(ledger.integration) && ['pending','passed','failed'].includes(ledger.integration.state), 'invalid gate or integration state')
  for (const [gateId, value] of Object.entries(ledger.gates)) {
    exactFields(value,['state','proofs','context'],'gate state')
    ensure(ledger.plan.gates.some(g => g.id === gateId), 'unknown persisted gate')
    ensure(value?.state === 'passed' && Array.isArray(value.proofs) && value.proofs.every(text), 'invalid persisted gate proof')
    ensure(canonical(value.context) === canonical(stateContext(ledger,gateId)), 'gate proof identity mismatch')
  }
  exactFields(ledger.integration,['state','proofs','context',...(ledger.integration.state==='failed'?['reason']:[])],'integration state')
  if (ledger.integration.state === 'passed') {
    ensure(Array.isArray(ledger.integration.proofs) && ledger.integration.proofs.every(text), 'invalid integration proof')
    ensure(canonical(ledger.integration.context) === canonical(stateContext(ledger,'integration')), 'integration proof identity mismatch')
  }
  ensure(Array.isArray(ledger.history), 'invalid state history')
  ensure(ledger.next===null || text(ledger.next),'invalid next action')
  ensure(text(ledger.created) && text(ledger.updated),'missing ledger timestamps')
  ensure(date(ledger.created)<=date(ledger.updated),'ledger timestamps are out of order')
  return ledger
}
function load(root, id) { return validateLedger(readJson(join(runDir(root, id), 'ledger.json')), id) }
function checkPlanIdentity(ledger, plan) {
  checkedPlan(plan)
  ensure(ledger.planFingerprint === planFingerprint(plan), 'plan changed; start a new run or use a future explicit migration')
}
function checkOwner(ledger, options, allowExpired = false) {
  ensure(options.ownerId === ledger.owner.id && options.ownerVersion === ledger.owner.version, 'stale or wrong lead owner')
  ensure(Number.isSafeInteger(options.expectedRevision) && options.expectedRevision === ledger.revision, 'stale ledger revision; read the current ledger and retry')
  ensure(date(options.now)>=date(ledger.updated),'clock moved before the last ledger write')
  if (!allowExpired) ensure(date(options.now) < date(ledger.owner.leaseUntil), 'lead lease expired; transfer with stop evidence')
}
function contextOf(assignment) {
  return Object.fromEntries(['runId','planId','planRevision','taskId','attempt','ownerVersion','workerId','assignmentId'].map(key => [key,assignment[key]]))
}
function scopePaths(task) { return task.paths.includes('.') ? [] : task.paths }
function dependencySnapshot(ledger,task) {
  return {tasks:Object.fromEntries(task.dependsOn.map(id=>[id,ledger.tasks[id].resultFingerprint])),gates:Object.fromEntries(task.requiresGates.map(id=>[id,digest(ledger.gates[id] ?? null)]))}
}
function stateContext(ledger, taskId) {
  return { runId: ledger.runId, planId: ledger.plan.planId, planRevision: ledger.plan.revision, taskId, attempt: 1, ownerVersion: ledger.owner.version, workerId: ledger.owner.id, assignmentId: `lead-${digest([ledger.runId,taskId,ledger.owner.version])}` }
}
export function proofContext(ledger, taskId) { return stateContext(ledger, taskId) }
function validateContext(context) {
  exactFields(context,['runId','planId','planRevision','taskId','attempt','ownerVersion','workerId','assignmentId'],'result context')
  for (const key of ['runId','planId','taskId','workerId','assignmentId']) ensure(token(context[key]), `invalid context ${key}`)
  for (const key of ['planRevision','attempt','ownerVersion']) ensure(positive(context[key]), `invalid context ${key}`)
}
function validateAssignment(assignment) {
  exactFields(assignment,['schemaVersion','kind','runId','planId','planRevision','taskId','attempt','ownerVersion','workerId','assignmentId','role','workspace','baseFingerprint','leaseUntil','timeLimitMs','outputLimitBytes'],'assignment')
  validateContext(contextOf(assignment))
  ensure(assignment.schemaVersion === 2 && assignment.kind === 'assignment', 'invalid assignment version')
  ensure(text(assignment.role) && text(assignment.workspace) && text(assignment.baseFingerprint), 'assignment role, workspace, and base fingerprint are required')
  ensure(isAbsolute(assignment.workspace) && /^[a-f0-9]{16}$/.test(assignment.baseFingerprint),'invalid assignment workspace or code fingerprint')
  ensure(positive(assignment.timeLimitMs) && positive(assignment.outputLimitBytes), 'assignment limits must be positive integers')
  date(assignment.leaseUntil)
}
function taskAndState(ledger, id) {
  const task = ledger.plan.tasks.find(t => t.id === id)
  ensure(task, `unknown task ${id}`)
  return { task, state: ledger.tasks[id] }
}
function validPath(path) {
  return typeof path === 'string' && path.length > 0 && !isAbsolute(path) && !/^[A-Za-z]:/.test(path) && !/[\\*?\x00-\x1f]/.test(path) && !path.split('/').some(s => s === '..' || s === '')
}
function underPath(path, prefix) {
  const p = path.toLowerCase().replace(/\/$/, ''), base = prefix.toLowerCase().replace(/\/$/, '')
  return base === '.' || p === base || p.startsWith(`${base}/`)
}
function validateResult(result) {
  exactFields(result,['schemaVersion','kind','resultId','context','status','changedPaths','proofs','blockers','findings','summary'],'result')
  ensure(plainObject(result) && result.schemaVersion === 2 && result.kind === 'result', 'unsupported result version')
  ensure(token(result.resultId), 'invalid result ID')
  validateContext(result.context)
  ensure(['completed','failed'].includes(result.status), 'worker result status must be completed or failed')
  for (const key of ['changedPaths','proofs','blockers','findings']) ensure(Array.isArray(result[key]) && result[key].every(text), `${key} must be a string array`)
  ensure(new Set(result.changedPaths).size === result.changedPaths.length && new Set(result.proofs).size === result.proofs.length, 'duplicate changed path or proof')
  ensure(text(result.summary), 'result summary is required')
}
function readSubmission(file) {
  const receipt=readJson(file)
  exactFields(receipt,['schemaVersion','kind','receivedAt','workerLeaseUntil','ownerLeaseUntil','resultFingerprint','result'],'submission')
  ensure(receipt.schemaVersion===2 && receipt.kind==='submission','unsupported submission receipt')
  validateResult(receipt.result)
  ensure(receipt.resultFingerprint===digest(receipt.result),'submitted result content changed')
  for(const field of ['receivedAt','workerLeaseUntil','ownerLeaseUntil'])ensure(text(receipt[field]),`missing submission ${field}`)
  ensure(date(receipt.receivedAt)<date(receipt.workerLeaseUntil) && date(receipt.receivedAt)<date(receipt.ownerLeaseUntil),'submission was not received under live leases')
  return receipt
}
function checkSubmission(ledger,receipt) {
  const checked=checkResult(ledger,receipt.result,receipt.receivedAt)
  ensure(receipt.workerLeaseUntil===checked.state.assignment.leaseUntil,'submission lease does not match the current assignment')
  return checked
}
function checkResult(ledger, result, now) {
  validateResult(result)
  const { task, state } = taskAndState(ledger, result.context.taskId)
  ensure(state.assignment && canonical(result.context) === canonical(contextOf(state.assignment)), 'result is for an old or different assignment')
  const replay=state.state==='accepted' && state.resultId===result.resultId
  ensure(replay || result.context.ownerVersion === ledger.owner.version, 'result is from an old lead owner')
  ensure(Buffer.byteLength(JSON.stringify(result),'utf8') <= state.assignment.outputLimitBytes, 'worker result exceeds its output limit')
  ensure(ACTIVE.has(state.state) || state.state === 'accepted' && state.resultId === result.resultId, 'task is not accepting results')
  ensure(replay || date(now) < date(state.assignment.leaseUntil), 'worker lease expired; confirm liveness before retry')
  if(replay)ensure(state.resultFingerprint===digest(result),'accepted result content changed')
  for (const path of result.changedPaths) ensure(validPath(path) && task.paths.some(p => underPath(path,p)), `changed path outside task scope: ${path}`)
  for (const path of result.proofs) ensure(validPath(path) && path.startsWith('.verify/'), 'proof must be a relative .verify/ path')
  return { task, state }
}
function proofChecks(root, proofs, required, context, paths, env) {
  const found = new Set(), problems = []
  for (const file of proofs) {
    const checked = validateProof(root, file, { context, paths, env })
    if (!checked.ok) { problems.push(...checked.problems.map(p => `${file}: ${p.message}`)); continue }
    const id = checked.proof.checkId
    if (found.has(id)) problems.push(`duplicate proof for ${id}`)
    found.add(id)
  }
  for (const check of required) if (!found.has(check)) problems.push(`missing captured proof for ${check}`)
  return { ok: problems.length === 0, problems }
}
function acceptedStatus(root, ledger, env) {
  const acceptedTasks = [], passedGates = [], stale = [], candidates = new Set()
  for (const task of ledger.plan.tasks) {
    const state = ledger.tasks[task.id]
    if (state.state !== 'accepted') continue
    try {
      const receipt=readSubmission(join(runDir(root,ledger.runId), 'inbox',`${state.resultId}.json`))
      const result=receipt.result
      checkSubmission(ledger,receipt)
      ensure(result.resultId===state.resultId && result.status==='completed' && result.blockers.length===0 && result.findings.length===0,'accepted result state changed')
      ensure(state.resultFingerprint === digest(result), 'accepted result content changed')
      ensure(canonical(result.context) === canonical(contextOf(state.assignment)), 'accepted result context changed')
      const proof = proofChecks(root, result.proofs, task.requiredChecks, result.context, scopePaths(task), env)
      if (proof.ok) candidates.add(task.id); else stale.push({ id: task.id, problems: proof.problems })
    } catch (error) { stale.push({ id:task.id, problems:[error.message] }) }
  }
  const pending = [...ledger.plan.gates]
  let progress = true
  while (progress) {
    progress = false
    for (const task of ledger.plan.tasks) {
      if (candidates.has(task.id) && !acceptedTasks.includes(task.id) && task.dependsOn.every(id=>acceptedTasks.includes(id)) && task.requiresGates.every(id=>passedGates.includes(id)) && canonical(ledger.tasks[task.id].acceptanceDependencies)===canonical(dependencySnapshot(ledger,task))) {
        acceptedTasks.push(task.id);progress=true
      }
    }
    for (const gate of pending.splice(0)) {
      const saved = ledger.gates[gate.id]
      if (!saved || saved.state !== 'passed') continue
      if (!gate.dependsOn.every(id => acceptedTasks.includes(id) || passedGates.includes(id))) { pending.push(gate); continue }
      const proof = proofChecks(root, saved.proofs, gate.requiredChecks, saved.context, [], env)
      if (proof.ok) { passedGates.push(gate.id); progress = true } else stale.push({id:gate.id,problems:proof.problems})
    }
  }
  for(const id of candidates)if(!acceptedTasks.includes(id))stale.push({id,problems:['a required task or gate has no current proof']})
  return { acceptedTasks, passedGates, stale }
}
function refreshReady(root, ledger, env) {
  const { acceptedTasks, passedGates } = acceptedStatus(root, ledger, env)
  const activeTasks = Object.keys(ledger.tasks).filter(id => holdsClaim(ledger.tasks[id]))
  const eligibleTasks = Object.keys(ledger.tasks).filter(id => ['planned','ready'].includes(ledger.tasks[id].state))
  const checked = readyTasks(ledger.plan, { acceptedTasks, passedGates, activeTasks, eligibleTasks })
  // Stale prerequisites must stop new claims, not freeze cancellation or repair.
  for (const [id,state] of Object.entries(ledger.tasks)) if (['planned','ready'].includes(state.state)) state.state = checked.ok && checked.ready.includes(id) ? 'ready' : 'planned'
  return checked
}
function mutate(root, id, plan, options, change, allowExpired = false) {
  return wrap(() => locked(root,id,(dir) => {
    const ledger = load(root,id)
    checkPlanIdentity(ledger,plan); checkOwner(ledger,options,allowExpired)
    const result = change(ledger)
    if (result?.unchanged) return {ok:true,ledger,...result}
    refreshReady(root,ledger,options.env)
    ledger.revision++
    ledger.updated = iso(date(options.now))
    validateLedger(ledger,id)
    replaceJson(join(dir,'ledger.json'),ledger)
    return {ok:true,ledger,...result}
  }))
}

export function initRun(root, plan, { runId, ownerId, leaseMs = 300000, retryLimit = 3, now = new Date() } = {}) {
  return wrap(() => {
    checkedPlan(plan); ensure(token(ownerId),'invalid owner ID'); ensure(positive(leaseMs),'invalid lead lease'); ensure(positive(retryLimit),'invalid retry limit')
    return locked(root,runId,(dir) => {
      ensure(!existsSync(join(dir,'ledger.json')),'run already exists')
      const ledger = { schemaVersion:2,kind:'run',runId,revision:0,plan:structuredClone(plan),planFingerprint:planFingerprint(plan),owner:{id:ownerId,version:1,leaseUntil:iso(date(now)+leaseMs)},limits:{retryLimit},tasks:Object.fromEntries(plan.tasks.map(t=>[t.id,{state:'planned',attempt:0,attemptsUsed:0,assignment:null,resultId:null,resultFingerprint:null,acceptanceDependencies:null,reason:null}])),gates:{},integration:{state:'pending',proofs:[],context:null},next:null,history:[],created:iso(date(now)),updated:iso(date(now)) }
      safeDir(root,['.verify','runs',runId,'inbox'],true)
      refreshReady(root,ledger); validateLedger(ledger,runId); replaceJson(join(dir,'ledger.json'),ledger)
      return {ok:true,ledger}
    },true)
  })
}
export function readRun(root,id) { return wrap(()=>({ok:true,ledger:load(root,id)})) }
export function claimTask(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger) => {
    refreshReady(root,ledger,options.env)
    const {task,state} = taskAndState(ledger,options.taskId)
    ensure(state.state === 'ready','task is not ready; dependencies, gates, or active resource claims block it')
    ensure(state.attemptsUsed < ledger.limits.retryLimit,'task attempt limit reached; report the failed work')
    ensure(token(options.workerId) && text(options.role),'worker ID and role are required')
    ensure(positive(options.leaseMs) && positive(options.timeLimitMs) && positive(options.outputLimitBytes),'assignment limits must be positive integers')
    ensure(options.leaseMs <= options.timeLimitMs,'worker lease cannot exceed its time limit')
    const workspace = realpathSync(resolve(root,options.workspace ?? '.'))
    const rel = relative(safeRoot(root),workspace)
    if (!(rel === '' || !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) {
      ensure(text(options.workspaceManifest),'external workspace requires a lead-owned manifest')
      validateWorkspaceClaim(root,workspace,options.workspaceManifest)
      const manifest=readJson(options.workspaceManifest)
      ensure(canonical([...manifest.paths].sort())===canonical([...task.paths].sort()),'workspace ownership must match task paths')
    }
    const code = codeFingerprint(root,{paths:scopePaths(task)}); ensure(code.ok,code.error)
    state.attempt++;state.attemptsUsed++
    const assignment = {schemaVersion:2,kind:'assignment',runId:id,planId:plan.planId,planRevision:plan.revision,taskId:task.id,attempt:state.attempt,ownerVersion:ledger.owner.version,workerId:options.workerId,assignmentId:randomUUID(),role:options.role,workspace,baseFingerprint:code.fingerprint,leaseUntil:iso(date(options.now)+options.leaseMs),timeLimitMs:options.timeLimitMs,outputLimitBytes:options.outputLimitBytes}
    state.assignment=assignment;state.state='claimed';state.resultId=null;state.resultFingerprint=null;state.acceptanceDependencies=null;state.reason=null
    ledger.integration={state:'pending',proofs:[],context:null}
    return {assignment}
  })
}
export function transitionTask(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger) => {
    const {state}=taskAndState(ledger,options.taskId)
    const allowed={claimed:['running','blocked','failed','cancelled','awaiting-review'],running:['blocked','failed','cancelled','awaiting-review'],'awaiting-review':['blocked','failed','cancelled'],ready:['blocked','cancelled'],planned:['blocked','cancelled']}
    ensure(allowed[state.state]?.includes(options.state),'invalid task state transition')
    if (['blocked','failed','cancelled'].includes(options.state)) ensure(text(options.reason),'transition requires a reason')
    state.state=options.state;state.reason=options.reason ?? null
    return {}
  })
}
export function submitResult(root,id,plan,result,{now=new Date()}={}) {
  return wrap(()=>{
    validateResult(result)
    const ledger=load(root,id);checkPlanIdentity(ledger,plan)
    const dir=safeDir(root,['.verify','runs',id,'inbox'])
    const file=join(dir,`${result.resultId}.json`)
    if(existsSync(file)){
      const receipt=readSubmission(file)
      ensure(canonical(receipt.result)===canonical(result),'result ID already exists with different content')
      checkSubmission(ledger,receipt)
      return {ok:true,idempotent:true,resultId:result.resultId,path:relative(safeRoot(root),file).split(sep).join('/')}
    }
    const checked=checkResult(ledger,result,now)
    ensure(date(now)<date(ledger.owner.leaseUntil),'lead lease expired')
    // The receipt is generated here, not accepted from the worker payload.
    // The CLI always uses the host clock; `now` is a test-only API seam.
    const receipt={schemaVersion:2,kind:'submission',receivedAt:iso(date(now)),workerLeaseUntil:checked.state.assignment.leaseUntil,ownerLeaseUntil:ledger.owner.leaseUntil,resultFingerprint:digest(result),result}
    const published=publishSubmission(file,receipt)
    const current=load(root,id);checkPlanIdentity(current,plan);checkSubmission(current,published.submission)
    return {ok:true,idempotent:published.idempotent,resultId:result.resultId,path:relative(safeRoot(root),file).split(sep).join('/')}
  })
}
export function acceptResult(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger)=>{
    ensure(token(options.resultId),'invalid result ID')
    const receipt=readSubmission(join(safeDir(root,['.verify','runs',id,'inbox']),`${options.resultId}.json`))
    const result=receipt.result
    const {task,state}=checkSubmission(ledger,receipt)
    ensure(result.status==='completed','worker reported failure; record a failed transition instead')
    ensure(result.blockers.length===0 && result.findings.length===0,'unresolved blockers or findings prevent acceptance')
    const current=acceptedStatus(root,ledger,options.env)
    ensure(task.dependsOn.every(id=>current.acceptedTasks.includes(id)) && task.requiresGates.every(id=>current.passedGates.includes(id)),'task prerequisites lost current proof')
    const proof=proofChecks(root,result.proofs,task.requiredChecks,result.context,scopePaths(task),options.env)
    ensure(proof.ok,proof.problems.join('; '))
    if(state.state==='accepted' && state.resultId===result.resultId){ensure(state.resultFingerprint===digest(result),'accepted result content changed');ensure(canonical(state.acceptanceDependencies)===canonical(dependencySnapshot(ledger,task)),'accepted prerequisites changed; reopen for fresh proof');return {unchanged:true,idempotent:true}}
    state.state='accepted';state.resultId=result.resultId;state.resultFingerprint=digest(result);state.acceptanceDependencies=dependencySnapshot(ledger,task);state.reason=null
    return {resultId:result.resultId}
  })
}
export function retryTask(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger)=>{
    const {state}=taskAndState(ledger,options.taskId)
    const reopening=state.state==='accepted'
    if(reopening){
      ensure(text(options.reason),'reopening accepted work requires a reason')
      ensure(!acceptedStatus(root,ledger,options.env).acceptedTasks.includes(options.taskId),'accepted work is still current; no recheck is needed')
      const affected=new Set([options.taskId]);let more=true
      while(more){more=false;for(const task of plan.tasks)if(!affected.has(task.id) && [...task.dependsOn,...task.requiresGates].some(id=>affected.has(id))){affected.add(task.id);more=true}for(const gate of plan.gates)if(!affected.has(gate.id)&&gate.dependsOn.some(id=>affected.has(id))){affected.add(gate.id);more=true}}
      ensure(!Object.entries(ledger.tasks).some(([taskId,value])=>taskId!==options.taskId && affected.has(taskId) && holdsClaim(value)),'reconcile dependent worker claims before reopening stale work')
      ledger.history.push({kind:'reopened',taskId:options.taskId,resultId:state.resultId,resultFingerprint:state.resultFingerprint,previousAttemptsUsed:state.attemptsUsed,reason:options.reason,at:iso(date(options.now))})
      state.attemptsUsed=0
    }
    if(state.assignment && !reopening){
      const stopped=options.stopped
      ensure(stopped?.workerId===state.assignment.workerId && stopped.assignmentId===state.assignment.assignmentId && text(stopped.evidence),'retry needs explicit stop evidence for the current worker')
      ledger.history.push({kind:'worker-stopped',taskId:options.taskId,assignmentId:state.assignment.assignmentId,evidence:stopped.evidence,at:iso(date(options.now))})
    }
    state.state='planned';state.assignment=null;state.resultId=null;state.resultFingerprint=null;state.acceptanceDependencies=null;state.reason=null
    return {}
  })
}
export function renewOwner(root,id,plan,options) {
  // An unchanged owner/version may resume after expiry in this one local store.
  // Exact revision checks still fence superseded owners. This is not an
  // ownership guarantee across disconnected copies of the ledger.
  return mutate(root,id,plan,options,(ledger)=>{ensure(positive(options.leaseMs),'invalid lease');ledger.owner.leaseUntil=iso(date(options.now)+options.leaseMs);return {}},true)
}
export function noteRun(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger)=>{ensure(Object.hasOwn(options,'next') && (options.next===null || text(options.next)),'next must be a nonempty string or null');ledger.next=options.next;return {}})
}
export function transferOwner(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger)=>{
    ensure(token(options.newOwnerId) && positive(options.leaseMs),'new owner and lease are required')
    ensure(options.stopped?.ownerId===ledger.owner.id && options.stopped.version===ledger.owner.version && text(options.stopped.evidence),'owner transfer needs explicit old-owner stop evidence')
    ensure(!Object.values(ledger.tasks).some(holdsClaim),'reconcile and stop active workers before owner transfer')
    ledger.history.push({kind:'owner-stopped',...options.stopped,at:iso(date(options.now))})
    ledger.owner={id:options.newOwnerId,version:ledger.owner.version+1,leaseUntil:iso(date(options.now)+options.leaseMs)}
    ledger.gates={};ledger.integration={state:'pending',proofs:[],context:null}
    return {}
  },true)
}
export function passGate(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger)=>{
    const gate=plan.gates.find(g=>g.id===options.gateId);ensure(gate,'unknown gate')
    const current=acceptedStatus(root,ledger,options.env)
    ensure(gate.dependsOn.every(dep=>current.acceptedTasks.includes(dep)||current.passedGates.includes(dep)),'gate dependencies have no current acceptance')
    ensure(Array.isArray(options.proofs),'gate proofs required')
    const context=stateContext(ledger,gate.id), proof=proofChecks(root,options.proofs,gate.requiredChecks,context,[],options.env)
    ensure(proof.ok,proof.problems.join('; '))
    ledger.gates[gate.id]={state:'passed',proofs:options.proofs,context}
    return {}
  })
}
export function setIntegration(root,id,plan,options) {
  return mutate(root,id,plan,options,(ledger)=>{
    ensure(options.state===undefined || ['passed','failed'].includes(options.state),'invalid integration state')
    if(options.state==='failed'){ensure(text(options.reason),'integration failure needs a reason');ledger.integration={state:'failed',proofs:[],context:null,reason:options.reason};return {}}
    const current=acceptedStatus(root,ledger,options.env)
    ensure(current.acceptedTasks.length===plan.tasks.length,'all tasks need current accepted proof before final integration')
    ensure(current.passedGates.length===plan.gates.length,'all gates need current proof before final integration')
    ensure(Array.isArray(options.proofs),'final proofs required')
    const context=stateContext(ledger,'integration'), proof=proofChecks(root,options.proofs,plan.finalChecks,context,[],options.env)
    ensure(proof.ok,proof.problems.join('; '))
    ledger.integration={state:'passed',proofs:options.proofs,context}
    return {}
  })
}
export function inspectRun(root,id,plan,{env}={}) {
  return wrap(()=>{
    const ledger=load(root,id);checkPlanIdentity(ledger,plan)
    const current=acceptedStatus(root,ledger,env)
    const final=ledger.integration.state==='passed' ? proofChecks(root,ledger.integration.proofs,plan.finalChecks,ledger.integration.context,[],env) : {ok:false,problems:['integration has not passed']}
    return {ok:true,ledger,...current,integration:final,mayClaimSuccess:current.acceptedTasks.length===plan.tasks.length && current.passedGates.length===plan.gates.length && final.ok}
  })
}

// Portable state is data, not a claim that an offline process stopped. The
// caller must obtain stop evidence from the host before sealing this store.
export function sealRunExport(root,id,plan,options) {
  return wrap(()=>locked(root,id,dir=>{
    const ledger=load(root,id)
    checkPlanIdentity(ledger,plan);checkOwner(ledger,options,true)
    ensure(token(options.transferId),'invalid transfer ID')
    ensure(options.stopped?.ownerId===ledger.owner.id && options.stopped.version===ledger.owner.version && text(options.stopped.evidence),'handoff needs explicit old-owner stop evidence')
    ensure(Array.isArray(options.stoppedWorkers),'worker stop evidence list is required')
    const submissions=readdirSync(safeDir(root,['.verify','runs',id,'inbox'])).filter(name=>name.endsWith('.json')).map(name=>{
      ensure(token(name.slice(0,-5)),'invalid result filename')
      return readSubmission(join(dir,'inbox',name))
    })
    ensure(submissions.length<=1000 && Buffer.byteLength(JSON.stringify(submissions))<=8_000_000,'portable results exceed the size limit')
    for(const state of Object.values(ledger.tasks))if(state.state==='accepted')ensure(submissions.some(s=>s.result.resultId===state.resultId && s.resultFingerprint===state.resultFingerprint),'required accepted result is missing')
    for(const [taskId,state] of Object.entries(ledger.tasks))if(holdsClaim(state)){
      const stopped=options.stoppedWorkers.find(s=>s.workerId===state.assignment.workerId && s.assignmentId===state.assignment.assignmentId && text(s.evidence))
      ensure(stopped,`worker ${taskId} needs explicit stop evidence`)
      ledger.history.push({kind:'handoff-worker-stopped',taskId,assignment:state.assignment,...stopped,at:iso(date(options.now))})
      state.state='planned';state.assignment=null;state.resultId=null;state.resultFingerprint=null;state.acceptanceDependencies=null;state.reason=null
    }
    const oldOwner={...ledger.owner}
    ledger.owner={id:`handoff-${options.transferId}`,version:oldOwner.version+1,leaseUntil:iso(date(options.now))}
    ledger.gates={};ledger.integration={state:'pending',proofs:[],context:null}
    ledger.history.push({kind:'handoff-sealed',transferId:options.transferId,stopped:options.stopped,previousOwner:oldOwner,at:iso(date(options.now))})
    ledger.revision++;ledger.updated=iso(date(options.now))
    validateLedger(ledger,id)
    const state={schemaVersion:1,kind:'run-export',transferId:options.transferId,ledger,submissions}
    // Store required state before publishing the ownership fence. A failed
    // export remains recoverable; no source files or worker copies are removed.
    replaceJson(join(dir,`export-${options.transferId}.json`),state)
    replaceJson(join(dir,'ledger.json'),ledger)
    return {ok:true,state}
  }))
}

export function validateRunExport(state) {
  return wrap(()=>{
    exactFields(state,['schemaVersion','kind','transferId','ledger','submissions'],'run export')
    ensure(state.schemaVersion===1 && state.kind==='run-export' && token(state.transferId),'invalid run export')
    const ledger=validateLedger(state.ledger,state.ledger?.runId)
    const sealed=ledger.history.at(-1)
    ensure(sealed?.kind==='handoff-sealed' && sealed.transferId===state.transferId && ledger.owner.id===`handoff-${state.transferId}`,'run export was not sealed for transfer')
    ensure(sealed.stopped?.ownerId===sealed.previousOwner?.id && sealed.stopped.version===sealed.previousOwner.version && text(sealed.stopped.evidence),'source owner stop evidence is missing')
    ensure(ledger.owner.version===sealed.previousOwner.version+1 && !Object.values(ledger.tasks).some(holdsClaim),'export retains a live worker or invalid ownership fence')
    ensure(Array.isArray(state.submissions) && state.submissions.length<=1000 && Buffer.byteLength(JSON.stringify(state))<=12_000_000,'invalid or oversized exported results')
    const ids=new Set()
    for(const receipt of state.submissions){
      exactFields(receipt,['schemaVersion','kind','receivedAt','workerLeaseUntil','ownerLeaseUntil','resultFingerprint','result'],'submission')
      validateResult(receipt.result)
      ensure(receipt.schemaVersion===2 && receipt.kind==='submission' && receipt.resultFingerprint===digest(receipt.result),'exported result content changed')
      ensure(!ids.has(receipt.result.resultId),'duplicate exported result');ids.add(receipt.result.resultId)
      ensure(date(receipt.receivedAt)<date(receipt.workerLeaseUntil) && date(receipt.receivedAt)<date(receipt.ownerLeaseUntil),'invalid exported receipt times')
    }
    for(const task of Object.values(ledger.tasks))if(task.state==='accepted')ensure(state.submissions.some(s=>s.result.resultId===task.resultId && s.resultFingerprint===task.resultFingerprint),'required accepted result is missing')
    return {ok:true}
  })
}

export function checkRunImport(root,state,{transportDigest}={}) {
  return wrap(()=>{
    const checked=validateRunExport(state);ensure(checked.ok,checked.error)
    const path=join(safeRoot(root),'.verify','runs',state.ledger.runId,'ledger.json')
    if(!existsSync(path))return {ok:true,idempotent:false}
    const current=load(root,state.ledger.runId)
    const imported=current.history.find(h=>h.kind==='handoff-imported' && h.transferId===state.transferId)
    if(imported){ensure(imported.exportDigest===digest(state),'transfer ID was already used with different state');if(transportDigest!==undefined)ensure(imported.transportDigest===transportDigest,'transfer ID was already used with different work or proof');return {ok:true,idempotent:true,ledger:current}}
    ensure(digest(current)===digest(state.ledger),'target run has a different owner or state; reconcile it before import')
    return {ok:true,idempotent:false}
  })
}

/** applyFiles runs only after target-state checks and while the run is locked.
 * It is an internal composition seam, never loaded from handoff data. */
export function restoreRunExport(root,state,plan,options,applyFiles=()=>{}) {
  return wrap(()=>{
    const checked=validateRunExport(state);ensure(checked.ok,checked.error)
    checkPlanIdentity(state.ledger,plan)
    ensure(token(options.newOwnerId) && positive(options.leaseMs),'new owner and lease are required')
    return locked(root,state.ledger.runId,dir=>{
      const target=checkRunImport(root,state,options);ensure(target.ok,target.error)
      if(target.idempotent)return target
      ensure(date(options.now)>=date(state.ledger.updated),'clock moved before the exported state')
      const ledger=structuredClone(state.ledger)
      ledger.owner={id:options.newOwnerId,version:ledger.owner.version+1,leaseUntil:iso(date(options.now)+options.leaseMs)}
      ledger.gates={};ledger.integration={state:'pending',proofs:[],context:null}
      ledger.history.push({kind:'handoff-imported',transferId:state.transferId,exportDigest:digest(state),...(options.transportDigest?{transportDigest:options.transportDigest}:{}),at:iso(date(options.now))})
      ledger.revision++;ledger.updated=iso(date(options.now));validateLedger(ledger,ledger.runId)
      applyFiles()
      const inbox=safeDir(root,['.verify','runs',ledger.runId,'inbox'],true)
      for(const receipt of state.submissions)publishSubmission(join(inbox,`${receipt.result.resultId}.json`),receipt)
      refreshReady(root,ledger,options.env)
      replaceJson(join(dir,'ledger.json'),ledger)
      return {ok:true,idempotent:false,ledger}
    },true)
  })
}
