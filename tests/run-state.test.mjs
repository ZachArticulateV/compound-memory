import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { childEnv, cleanupAfter, makeTempRoot, writeTree } from './fixtures/build.mjs'
import { initRun, readRun, claimTask, transitionTask, submitResult, acceptResult, retryTask, transferOwner, renewOwner, noteRun, inspectRun, passGate, setIntegration, proofContext } from '../scripts/lib/run-state.mjs'
import { captureProof } from '../scripts/verify/capture.mjs'

const now = new Date('2026-10-25T12:00:00Z')
const plan = () => ({ schemaVersion: 2, kind: 'plan', planId: 'test-plan', revision: 1, title: 'Two independent tasks',
  requirements: [{ id: 'R1', description: 'Both modules work.' }], decisions: [], exclusions: ['No deploy.'], risks: [],
  phases: [{ id: 'P1', title: 'Build' }], checks: [{ id: 'C1', description: 'Module works.' }, { id: 'C2', description: 'Combined result works.' }],
  finalChecks: ['C2'], gates: [], tasks: ['A', 'B'].map((id) => ({ id, title: id, phaseId: 'P1', covers: ['R1'], dependsOn: [], requiresGates: [], paths: [`src/${id}`], resources: [], requiredChecks: ['C1'] })) })
function setup(t, p = plan()) {
  const root = makeTempRoot(); cleanupAfter(t, root)
  writeTree(root, { 'src/A/a.txt': 'one', 'src/B/b.txt': 'two', '.gitignore': '.verify/\n' })
  const started = initRun(root, p, { runId: 'test-run', ownerId: 'lead', leaseMs: 60000, now })
  assert.equal(started.ok, true, started.error)
  return { root, p }
}
const auth = (root, extra = {}) => ({ ownerId: 'lead', ownerVersion: 1, expectedRevision: readRun(root, 'test-run').ledger.revision, now, ...extra })
function claim(root, p, taskId = 'A', extra = {}) {
  return claimTask(root, 'test-run', p, auth(root, { taskId, workerId: `worker-${taskId}`, role: 'code', workspace: '.', leaseMs: 30000, timeLimitMs: 30000, outputLimitBytes: 100000, ...extra }))
}
function resultFor(assignment, extra = {}) {
  const { runId, planId, planRevision, taskId, attempt, ownerVersion, workerId, assignmentId } = assignment
  return { schemaVersion: 2, kind: 'result', resultId: `result-${taskId}`, context: { runId, planId, planRevision, taskId, attempt, ownerVersion, workerId, assignmentId }, status: 'completed', changedPaths: [`src/${taskId}/a.txt`], proofs: [], blockers: [], findings: [], summary: 'Done.', ...extra }
}
function captured(root, context, paths, checkId='C1', env={}) {
  const out=captureProof(root,{checkId,command:process.execPath,args:['-e','console.log("checked")'],context,paths,env,processEnv:childEnv()})
  assert.equal(out.error,undefined,out.error)
  assert.equal(out.proof.outcome,'passed')
  return out.proofPath
}
function finish(root,p,assignment,extra={}) {
  const result=resultFor(assignment,{...extra})
  result.proofs=[captured(root,result.context,p.tasks.find(t=>t.id===assignment.taskId).paths)]
  assert.equal(submitResult(root,'test-run',p,result,{now}).ok,true)
  const accepted=acceptResult(root,'test-run',p,auth(root,{resultId:result.resultId}))
  assert.equal(accepted.ok,true,accepted.error)
  return result
}

test('run state: CAS and owner fences reject stale writes without losing a claim', (t) => {
  const { root, p } = setup(t)
  const stale = auth(root, { taskId: 'B', workerId: 'worker-B', role: 'code', workspace: '.', leaseMs: 30000, timeLimitMs: 30000, outputLimitBytes: 10000 })
  assert.equal(claim(root, p).ok, true)
  assert.equal(claimTask(root, 'test-run', p, stale).ok, false)
  assert.equal(claim(root, p, 'B', { ownerVersion: 0 }).ok, false)
  assert.equal(readRun(root, 'test-run').ledger.tasks.A.state, 'claimed')
  assert.equal(readRun(root, 'test-run').ledger.tasks.B.state, 'ready')
})

test('run state: changed plans and conflicting active tasks fail closed', (t) => {
  const p = plan(); p.tasks[1].resources = ['port:3000']; p.tasks[0].resources = ['port:3000']
  const { root } = setup(t, p)
  assert.equal(claim(root, p).ok, true)
  assert.equal(claim(root, p, 'B').ok, false)
  const changed = structuredClone(p); changed.revision++
  assert.equal(transitionTask(root, 'test-run', changed, auth(root, { taskId: 'A', state: 'running' })).ok, false)
})

test('run state: worker inbox is immutable and idempotent, while unsupported proof blocks acceptance', (t) => {
  const { root, p } = setup(t)
  const a = claim(root, p).assignment
  const result = resultFor(a)
  const before = readRun(root, 'test-run').ledger.revision
  assert.equal(submitResult(root, 'test-run', p, result, { now }).ok, true)
  assert.equal(submitResult(root, 'test-run', p, result, { now }).idempotent, true)
  assert.equal(submitResult(root, 'test-run', p, { ...result, summary: 'Changed' }, { now }).ok, false)
  assert.equal(readRun(root, 'test-run').ledger.revision, before, 'workers do not write the ledger')
  assert.equal(acceptResult(root, 'test-run', p, auth(root, { resultId: result.resultId })).ok, false)
  assert.equal(readRun(root, 'test-run').ledger.tasks.A.state, 'claimed')
})

test('run state: scope escapes, old attempts, and expired claims cannot submit', (t) => {
  const { root, p } = setup(t)
  const a = claim(root, p).assignment
  assert.equal(submitResult(root, 'test-run', p, resultFor(a, { changedPaths: ['src/B/b.txt'] }), { now }).ok, false)
  assert.equal(submitResult(root, 'test-run', p, resultFor(a, { changedPaths: ['../escape'] }), { now }).ok, false)
  const result = resultFor(a); result.context.attempt = 0
  assert.equal(submitResult(root, 'test-run', p, result, { now }).ok, false)
  assert.equal(submitResult(root, 'test-run', p, resultFor(a), { now: new Date(now.getTime() + 30001) }).ok, false)
})

test('run state: expired worker needs explicit stop evidence before retry', (t) => {
  const { root, p } = setup(t)
  const a = claim(root, p).assignment
  const later = new Date(now.getTime() + 30001)
  assert.equal(retryTask(root, 'test-run', p, auth(root, { taskId: 'A', now: later })).ok, false)
  assert.equal(retryTask(root, 'test-run', p, auth(root, { taskId: 'A', now: later, stopped: { workerId: a.workerId, assignmentId: a.assignmentId, evidence: 'Host confirmed worker exited.' } })).ok, true)
  const b = claim(root, p, 'A', { now: later }).assignment
  assert.equal(b.attempt, 2)
  assert.equal(submitResult(root, 'test-run', p, resultFor(a), { now: later }).ok, false)
})

test('run state: owner transfer records stop evidence and fences old owner', (t) => {
  const { root, p } = setup(t)
  assert.equal(transferOwner(root, 'test-run', p, auth(root, { newOwnerId: 'new-lead', leaseMs: 60000 })).ok, false)
  assert.equal(transferOwner(root, 'test-run', p, auth(root, { newOwnerId: 'new-lead', leaseMs: 60000, stopped: { ownerId: 'lead', version: 1, evidence: 'Old lead stopped. No workers.' } })).ok, true)
  assert.equal(claim(root, p).ok, false)
  const current = readRun(root, 'test-run').ledger
  assert.equal(current.owner.version, 2)
  assert.equal(renewOwner(root, 'test-run', p, { ownerId: 'new-lead', ownerVersion: 2, expectedRevision: current.revision, leaseMs: 60000, now }).ok, true)
})

test('run state: the same expired lead can renew and reconcile an active worker', (t) => {
  const {root,p}=setup(t),a=claim(root,p).assignment
  const later=new Date(now.getTime()+61000)
  const renewal=renewOwner(root,'test-run',p,auth(root,{now:later,leaseMs:60000}))
  assert.equal(renewal.ok,true,renewal.error)
  assert.equal(retryTask(root,'test-run',p,auth(root,{now:later,taskId:'A',stopped:{workerId:a.workerId,assignmentId:a.assignmentId,evidence:'Host confirmed worker stopped.'}})).ok,true)
  assert.equal(transferOwner(root,'test-run',p,auth(root,{now:later,newOwnerId:'new-lead',leaseMs:60000,stopped:{ownerId:'lead',version:1,evidence:'Old lead stopped.'}})).ok,true)
  const current=readRun(root,'test-run').ledger
  assert.equal(renewOwner(root,'test-run',p,{ownerId:'lead',ownerVersion:1,expectedRevision:current.revision,now:later,leaseMs:60000}).ok,false)
})

test('run state: a stale accepted final attempt gets a fresh budget without reusing attempt IDs', (t) => {
  const {root,p}=setup(t)
  let a=claim(root,p).assignment
  for(let i=1;i<3;i++){
    assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',stopped:{workerId:a.workerId,assignmentId:a.assignmentId,evidence:'Host confirmed worker stopped.'}})).ok,true)
    a=claim(root,p).assignment
  }
  const old=finish(root,p,a)
  assert.equal(a.attempt,3)
  writeTree(root,{'src/A/a.txt':'changed'})
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',reason:'Accepted source changed.'})).ok,true)
  const recheck=claim(root,p)
  assert.equal(recheck.ok,true,recheck.error)
  assert.equal(recheck.assignment.attempt,4)
  assert.equal(submitResult(root,'test-run',p,old,{now}).ok,false)
  finish(root,p,recheck.assignment,{resultId:'result-A-recheck'})
})

test('run state: a timely submission remains reviewable after its worker lease expires', (t) => {
  const {root,p}=setup(t),a=claim(root,p).assignment,result=resultFor(a)
  result.proofs=[captured(root,result.context,['src/A'])]
  assert.equal(submitResult(root,'test-run',p,{...result,receivedAt:now.toISOString()},{now}).ok,false,'workers cannot provide receipt time')
  assert.equal(submitResult(root,'test-run',p,result,{now}).ok,true)
  const file=join(root,'.verify','runs','test-run','inbox',`${result.resultId}.json`)
  const original=readFileSync(file,'utf8')
  const receipt=JSON.parse(original)
  assert.equal(receipt.kind,'submission')
  assert.equal(receipt.receivedAt,now.toISOString())
  assert.equal(submitResult(root,'test-run',p,result,{now:new Date(now.getTime()+1000)}).idempotent,true)
  assert.equal(readFileSync(file,'utf8'),original,'a second host timestamp cannot replace the first receipt')
  const later=new Date(now.getTime()+31000)
  assert.equal(submitResult(root,'test-run',p,result,{now:later}).idempotent,true,'late repeat reuses the timely receipt')
  const accepted=acceptResult(root,'test-run',p,auth(root,{resultId:result.resultId,now:later}))
  assert.equal(accepted.ok,true,accepted.error)
  assert.equal(submitResult(root,'test-run',p,result,{now:later}).idempotent,true)
})

test('run state: a timely receipt cannot accept an old reassigned or transferred result', (t) => {
  const {root,p}=setup(t),a=claim(root,p).assignment,result=resultFor(a)
  result.proofs=[captured(root,result.context,['src/A'])]
  assert.equal(submitResult(root,'test-run',p,result,{now}).ok,true)
  const later=new Date(now.getTime()+31000)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',now:later,stopped:{workerId:a.workerId,assignmentId:a.assignmentId,evidence:'Host confirms old attempt stopped.'}})).ok,true)
  const fresh=claim(root,p,'A',{now:later}).assignment
  assert.equal(acceptResult(root,'test-run',p,auth(root,{now:later,resultId:result.resultId})).ok,false)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',now:later,stopped:{workerId:fresh.workerId,assignmentId:fresh.assignmentId,evidence:'Host confirms fresh attempt stopped.'}})).ok,true)
  assert.equal(transferOwner(root,'test-run',p,auth(root,{now:later,newOwnerId:'new-lead',leaseMs:60000,stopped:{ownerId:'lead',version:1,evidence:'Old lead stopped.'}})).ok,true)
  const ledger=readRun(root,'test-run').ledger
  assert.equal(acceptResult(root,'test-run',p,{ownerId:'new-lead',ownerVersion:2,expectedRevision:ledger.revision,now:later,resultId:result.resultId}).ok,false)
})

test('run state: abandoned temp file is harmless; lock is never stolen by age', (t) => {
  const { root, p } = setup(t)
  const dir = join(root, '.verify', 'runs', 'test-run')
  writeFileSync(join(dir, 'ledger.json.tmp-crashed'), '{"broken":')
  assert.equal(readRun(root, 'test-run').ok, true)
  mkdirSync(join(dir, '.lock'))
  assert.equal(claim(root, p).ok, false)
  assert.equal(existsSync(join(dir, '.lock')), true)
  assert.equal(readRun(root, 'test-run').ledger.revision, 0)
})

test('run state: completion cannot be reported with missing final proof', (t) => {
  const { root, p } = setup(t)
  const state = inspectRun(root, 'test-run', p)
  assert.equal(state.ok, true)
  assert.equal(state.mayClaimSuccess, false)
})

test('run state: real task, gate and combined proof pass; later source edits revoke success', (t) => {
  const p=plan();p.tasks=p.tasks.slice(0,1);p.gates=[{id:'G1',phaseId:'P1',dependsOn:['A'],requiredChecks:['C1']}]
  const {root}=setup(t,p)
  const result=finish(root,p,claim(root,p).assignment)
  const revision=readRun(root,'test-run').ledger.revision
  const replay=acceptResult(root,'test-run',p,auth(root,{resultId:result.resultId,now:new Date(now.getTime()+31000)}))
  assert.equal(replay.ok,true,replay.error)
  assert.equal(replay.idempotent,true)
  assert.equal(replay.ledger.revision,revision)
  let ledger=readRun(root,'test-run').ledger
  const gateProof=captured(root,proofContext(ledger,'G1'),[])
  const gate=passGate(root,'test-run',p,auth(root,{gateId:'G1',proofs:[gateProof]}))
  assert.equal(gate.ok,true,gate.error)
  ledger=readRun(root,'test-run').ledger
  const finalProof=captured(root,proofContext(ledger,'integration'),[],'C2')
  const integrated=setIntegration(root,'test-run',p,auth(root,{proofs:[finalProof]}))
  assert.equal(integrated.ok,true,integrated.error)
  assert.equal(inspectRun(root,'test-run',p).mayClaimSuccess,true)
  writeTree(root,{'src/A/a.txt':'changed'})
  assert.equal(inspectRun(root,'test-run',p).mayClaimSuccess,false)
})

test('run state: stale upstream work blocks claims but permits dependent stop and recheck', (t) => {
  const p=plan();p.tasks[1].dependsOn=['A']
  const {root}=setup(t,p)
  finish(root,p,claim(root,p).assignment)
  const b=claim(root,p,'B').assignment
  writeTree(root,{'src/A/a.txt':'changed'})
  assert.equal(inspectRun(root,'test-run',p).mayClaimSuccess,false)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',reason:'Source changed.'})).ok,false,'dependent worker still holds its claim')
  assert.equal(transitionTask(root,'test-run',p,auth(root,{taskId:'B',state:'cancelled',reason:'Upstream proof is stale.'})).ok,true)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'B',stopped:{workerId:b.workerId,assignmentId:b.assignmentId,evidence:'Worker stopped.'}})).ok,true)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',reason:'Source changed.'})).ok,true)
  const fresh=claim(root,p).assignment
  assert.equal(fresh.attempt,2)
  finish(root,p,fresh,{resultId:'result-A-2'})
  assert.equal(readRun(root,'test-run').ledger.tasks.B.state,'ready')
  assert.equal(readRun(root,'test-run').ledger.history.some(h=>h.kind==='reopened'&&h.resultId==='result-A'),true)
})

test('run state: rechecked upstream work does not revive an old dependent acceptance', (t) => {
  const p=plan();p.tasks[1].dependsOn=['A']
  const {root}=setup(t,p)
  finish(root,p,claim(root,p).assignment)
  const oldB=finish(root,p,claim(root,p,'B').assignment)
  writeTree(root,{'src/A/a.txt':'changed'})
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',reason:'Changed A needs fresh proof.'})).ok,true)
  finish(root,p,claim(root,p).assignment,{resultId:'result-A-2'})
  assert.deepEqual(inspectRun(root,'test-run',p).acceptedTasks,['A'])
  assert.equal(acceptResult(root,'test-run',p,auth(root,{resultId:oldB.resultId})).ok,false)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'B',reason:'Recheck against current A.'})).ok,true)
  finish(root,p,claim(root,p,'B').assignment,{resultId:'result-B-2'})
  assert.deepEqual(inspectRun(root,'test-run',p).acceptedTasks,['A','B'])
})

test('run state: current environment labels flow through acceptance and readiness', (t) => {
  const p=plan();p.tasks[1].dependsOn=['A']
  const {root}=setup(t,p)
  const a=claim(root,p).assignment,result=resultFor(a),env={app:'fixture-v1'}
  result.proofs=[captured(root,result.context,['src/A'],'C1',env)]
  assert.equal(submitResult(root,'test-run',p,result,{now}).ok,true)
  assert.equal(acceptResult(root,'test-run',p,auth(root,{resultId:result.resultId,env})).ok,true)
  assert.equal(readRun(root,'test-run').ledger.tasks.B.state,'ready')
  assert.equal(claim(root,p,'B',{env:{app:'fixture-v2'}}).ok,false)
  assert.equal(claim(root,p,'B',{env}).ok,true)
})

test('run state: a cancelled worker retains its resource until stopped and reconciled', (t) => {
  const p=plan();p.tasks[0].resources=['database:fixture'];p.tasks[1].resources=['database:fixture']
  const {root}=setup(t,p),a=claim(root,p).assignment
  assert.equal(transitionTask(root,'test-run',p,auth(root,{taskId:'A',state:'cancelled',reason:'User cancelled.'})).ok,true)
  assert.equal(claim(root,p,'B').ok,false)
  assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',stopped:{workerId:a.workerId,assignmentId:a.assignmentId,evidence:'Host confirms exit.'}})).ok,true)
  assert.equal(transitionTask(root,'test-run',p,auth(root,{taskId:'A',state:'cancelled',reason:'No retry needed.'})).ok,true)
  assert.equal(claim(root,p,'B').ok,true)
})

test('run state: retry bound, result size, and lead-owned next action are enforced', (t) => {
  const {root,p}=setup(t)
  let a=claim(root,p,'A',{outputLimitBytes:10}).assignment
  assert.equal(submitResult(root,'test-run',p,resultFor(a),{now}).ok,false)
  for(let attempt=1;attempt<=3;attempt++){
    assert.equal(retryTask(root,'test-run',p,auth(root,{taskId:'A',stopped:{workerId:a.workerId,assignmentId:a.assignmentId,evidence:'Host confirms exit.'}})).ok,true)
    const next=claim(root,p)
    if(attempt===3)assert.equal(next.ok,false)
    else {assert.equal(next.ok,true,next.error);a=next.assignment}
  }
  const before=auth(root,{next:'Check B.'})
  assert.equal(noteRun(root,'test-run',p,before).ok,true)
  assert.equal(noteRun(root,'test-run',p,{...before,next:'Old write.'}).ok,false)
  assert.equal(readRun(root,'test-run').ledger.next,'Check B.')
  assert.equal(noteRun(root,'test-run',p,auth(root,{next:null})).ok,true)
})

test('run state: persisted foreign assignments and unknown gates fail closed', (t) => {
  const {root,p}=setup(t)
  claim(root,p)
  const file=join(root,'.verify','runs','test-run','ledger.json'),good=readFileSync(file,'utf8')
  const ledger=JSON.parse(good);ledger.tasks.A.assignment.taskId='B'
  writeFileSync(file,JSON.stringify(ledger))
  assert.equal(readRun(root,'test-run').ok,false)
  const other=JSON.parse(good);other.gates.foreign={state:'passed',proofs:[]}
  writeFileSync(file,JSON.stringify(other))
  assert.equal(readRun(root,'test-run').ok,false)
})

test('run state: accepted result changes cannot bypass repeat acceptance', (t) => {
  const {root,p}=setup(t)
  const result=finish(root,p,claim(root,p).assignment)
  writeFileSync(join(root,'.verify','runs','test-run','inbox',`${result.resultId}.json`),JSON.stringify({...result,summary:'Tampered'}))
  assert.equal(acceptResult(root,'test-run',p,auth(root,{resultId:result.resultId})).ok,false)
  assert.deepEqual(inspectRun(root,'test-run',p).acceptedTasks,[])
})

test('run state: a runtime junction cannot write outside the given project', (t) => {
  const root=makeTempRoot(),outside=makeTempRoot();cleanupAfter(t,root);cleanupAfter(t,outside)
  symlinkSync(outside,join(root,'.verify'),process.platform==='win32'?'junction':'dir')
  const started=initRun(root,plan(),{runId:'test-run',ownerId:'lead',now})
  assert.equal(started.ok,false)
  assert.equal(existsSync(join(outside,'runs')),false)
})

test('run state: CLI preserves nonzero state failures and reads the stored ledger', (t) => {
  const {root,p}=setup(t)
  writeTree(root,{'plan.json':JSON.stringify(p)})
  const cli=join(import.meta.dirname,'..','scripts','run-state.mjs')
  const shown=spawnSync(process.execPath,[cli,'show','--cwd',root,'--run','test-run'],{env:childEnv(),encoding:'utf8',windowsHide:true})
  assert.equal(shown.status,0,shown.stderr)
  assert.equal(JSON.parse(shown.stdout).ledger.runId,'test-run')
  const incomplete=spawnSync(process.execPath,[cli,'inspect','--cwd',root,'--run','test-run','--plan','plan.json'],{env:childEnv(),encoding:'utf8',windowsHide:true})
  assert.equal(incomplete.status,1,incomplete.stderr)
  assert.equal(JSON.parse(incomplete.stdout).mayClaimSuccess,false)
  writeTree(root,{'input.json':JSON.stringify({...auth(root),leaseMs:300000,now:now.toISOString()})})
  const backdated=spawnSync(process.execPath,[cli,'renew','--cwd',root,'--run','test-run','--plan','plan.json','--input','input.json'],{env:childEnv(),encoding:'utf8',windowsHide:true})
  assert.equal(backdated.status,2)
  assert.match(backdated.stderr,/test-only API clock/)
})

test('run state: separate workers can submit concurrently without a lost result', async (t) => {
  const { root, p } = setup(t)
  const a = claim(root, p, 'A').assignment
  const b = claim(root, p, 'B').assignment
  const moduleUrl = pathToFileURL(join(import.meta.dirname, '..', 'scripts', 'lib', 'run-state.mjs')).href
  const runChild = (result) => new Promise((resolve, reject) => {
    const script = `import {submitResult} from ${JSON.stringify(moduleUrl)};const r=submitResult(${JSON.stringify(root)},'test-run',${JSON.stringify(p)},${JSON.stringify(result)},{now:new Date(${JSON.stringify(now.toISOString())})});console.log(JSON.stringify(r));process.exitCode=r.ok?0:1;`
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: childEnv(), windowsHide: true, stdio: ['ignore','pipe','pipe'] })
    let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d)
    child.on('error', reject); child.on('close', code => resolve({ code, out }))
  })
  const replies = await Promise.all([runChild(resultFor(a)), runChild(resultFor(b))])
  for (const reply of replies) assert.equal(reply.code, 0, reply.out)
  for (const task of ['A','B']) assert.equal(JSON.parse(readFileSync(join(root,'.verify','runs','test-run','inbox',`result-${task}.json`),'utf8')).result.context.taskId, task)
})
