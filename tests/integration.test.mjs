import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {makeFixture,cleanupAfter,removeTempRoot,childEnv} from './fixtures/build.mjs'
import {initRun,inspectRun,readRun,renewOwner} from '../scripts/lib/run-state.mjs'
import {codeFingerprint} from '../scripts/lib/changes.mjs'
import {captureProof} from '../scripts/verify/capture.mjs'
import {dispatchWave,acceptWorkerResult,verifyIntegration} from '../scripts/agents/dispatch.mjs'

function setup(t) {
  const plan={schemaVersion:2,kind:'plan',planId:'integration',revision:1,title:'Combine changes',requirements:[{id:'R1',description:'Combined behavior works.'}],decisions:[],exclusions:[],risks:[],phases:[{id:'P1',title:'Build'}],checks:[{id:'C1',description:'Module valid.'},{id:'C2',description:'Total within limit.'}],finalChecks:['C2'],gates:[],tasks:['A','B'].map(id=>({id,title:id,phaseId:'P1',covers:['R1'],dependsOn:[],requiresGates:[],paths:[`src/${id}.txt`],resources:[],requiredChecks:['C1']}))}
  const root=makeFixture({'src/A.txt':'0','src/B.txt':'0'});cleanupAfter(t,root)
  assert.equal(initRun(root,plan,{runId:'run',ownerId:'lead',leaseMs:300000}).ok,true)
  const checkCommands={C1:{command:process.execPath,args:['-e',`const fs=require('fs');for(const p of ['src/A.txt','src/B.txt'])if(!/^[01]$/.test(fs.readFileSync(p,'utf8')))process.exit(1)`]},C2:{command:process.execPath,args:['-e',`const fs=require('fs');process.exit(Number(fs.readFileSync('src/A.txt','utf8'))+Number(fs.readFileSync('src/B.txt','utf8'))<=1?0:1)`]}}
  return {root,plan,runId:'run',ownerId:'lead',ownerVersion:1,host:'codex-desktop',mode:'sequential',processEnv:childEnv(),checkCommands}
}
const fallback=async({packet,manifest})=>{
  writeFileSync(join(manifest.workspace,packet.task.paths[0]),'1')
  return {stopped:true,result:{schemaVersion:2,kind:'result',resultId:'result-'+packet.task.id,context:packet.context,status:'completed',changedPaths:packet.task.paths,proofs:[],blockers:[],findings:[],summary:'Added one unit.'}}
}

test('individually green work cannot pass a combined red check',async t=>{
  const opts=setup(t)
  const bin=makeFixture({'worker.mjs':`import {writeFileSync} from 'node:fs';import {join} from 'node:path';let s='';for await(const d of process.stdin)s+=d;const p=JSON.parse(s);writeFileSync(join(p.assignment.workspace,p.task.paths[0]),'1');writeFileSync(process.argv[process.argv.indexOf('-o')+1],JSON.stringify({schemaVersion:2,kind:'result',resultId:'result-'+p.task.id,context:p.context,status:'completed',changedPaths:p.task.paths,proofs:[],blockers:[],findings:[],summary:'Added one unit.'}));`});cleanupAfter(t,bin)
  const wave=await dispatchWave({...opts,host:'codex-cli',mode:'parallel',binary:join(bin,'worker.mjs')});assert.equal(wave.ok,true,JSON.stringify(wave))
  assert.equal(wave.results.length,2)
  for(const report of wave.results) {
    t.after(()=>removeTempRoot(report.manifest.container))
    const individual=captureProof(report.manifest.workspace,{...opts.checkCommands.C2,checkId:'C2',context:report.result.context,processEnv:childEnv()})
    assert.equal(individual.proof.outcome,'passed')
  }
  for(const report of wave.results)assert.equal(acceptWorkerResult({...opts,report}).ok,true)
  const review={fingerprint:codeFingerprint(opts.root).fingerprint,findings:[],evidence:join(opts.root,'.verify/review.json')}
  writeFileSync(review.evidence,JSON.stringify(review))
  const combined=verifyIntegration({...opts,review})
  assert.equal(combined.ok,false);assert.match(combined.error,/combined check failed/)
  const state=inspectRun(opts.root,'run',opts.plan)
  assert.equal(state.acceptedTasks.length,2);assert.equal(state.ledger.integration.state,'failed');assert.equal(state.mayClaimSuccess,false)
})

test('missing worker proof and wrong lead cannot modify source; final proof needs a current review',async t=>{
  const opts=setup(t),wave=await dispatchWave({...opts,sequentialWorker:fallback}),report=wave.results[0]
  assert.equal(wave.ok,true,JSON.stringify(wave));t.after(()=>removeTempRoot(report.manifest.container))
  const wrong=acceptWorkerResult({...opts,ownerId:'other',report});assert.equal(wrong.ok,false)
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'0')
  unlinkSync(join(report.manifest.workspace,report.workerProofs[0].path))
  assert.equal(acceptWorkerResult({...opts,report}).ok,false)
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'0')
  assert.equal(verifyIntegration({...opts,review:{fingerprint:'stale',findings:[],evidence:'old'}}).ok,false)
})

test('findings need saved lead decisions before merge; final review needs real matching evidence',async t=>{
  const opts=setup(t)
  const wave=await dispatchWave({...opts,sequentialWorker:async input=>{const output=await fallback(input);output.result.findings=['Lead must confirm the new value.'];return output}})
  assert.equal(wave.ok,true,JSON.stringify(wave));const a=wave.results[0];t.after(()=>removeTempRoot(a.manifest.container))
  assert.equal(acceptWorkerResult({...opts,report:a}).ok,false)
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'0')
  const decision=join(opts.root,'.verify/decision.json');writeFileSync(decision,JSON.stringify({path:'src/A.txt',observedWorkerValue:readFileSync(join(a.manifest.workspace,'src/A.txt'),'utf8')}))
  const accepted=acceptWorkerResult({...opts,report:a,resolutions:[{finding:a.result.findings[0],reason:'Read the copied file and confirmed its new value is 1.',evidence:decision}]})
  assert.equal(accepted.ok,true,accepted.error);assert.deepEqual(accepted.result.findings,[]);assert.equal(a.result.findings.length,1)
  const next=await dispatchWave({...opts,sequentialWorker:async input=>{const output=await fallback(input);writeFileSync(join(input.manifest.workspace,'src/B.txt'),'0');output.result.changedPaths=[];return output}})
  assert.equal(next.ok,true,JSON.stringify(next));t.after(()=>removeTempRoot(next.results[0].manifest.container))
  assert.equal(acceptWorkerResult({...opts,report:next.results[0]}).ok,true)
  const review={fingerprint:codeFingerprint(opts.root).fingerprint,findings:[],evidence:join(opts.root,'.verify/final-review.json')}
  assert.equal(verifyIntegration({...opts,review}).ok,false,'missing review cannot pass')
  writeFileSync(review.evidence,JSON.stringify({fingerprint:'wrong',findings:[]}))
  assert.equal(verifyIntegration({...opts,review}).ok,false,'old artifact cannot pass')
  writeFileSync(review.evidence,JSON.stringify(review))
  const final=verifyIntegration({...opts,review});assert.equal(final.ok,true,final.error);assert.equal(final.mayClaimSuccess,true)
  const proof=JSON.parse(readFileSync(join(opts.root,final.proofs[0]),'utf8'))
  assert.equal(proof.environment.reported.combinedReviewSha256,final.review.sha256)
})

test('expired worker receipt and insufficient check time cannot merge source files',async t=>{
  const opts=setup(t),wave=await dispatchWave({...opts,sequentialWorker:fallback}),report=wave.results[0]
  assert.equal(wave.ok,true,JSON.stringify(wave));t.after(()=>removeTempRoot(report.manifest.container))
  const ledger=readRun(opts.root,'run').ledger
  assert.equal(renewOwner(opts.root,'run',opts.plan,{ownerId:'lead',ownerVersion:1,expectedRevision:ledger.revision,leaseMs:900000}).ok,true)
  t.mock.timers.enable({apis:['Date'],now:Date.parse(report.assignment.leaseUntil)+1})
  const expired=acceptWorkerResult({...opts,report})
  assert.equal(expired.ok,false)
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'0','an expired receipt must not merge files')
  t.mock.timers.setTime(Date.parse(report.assignment.leaseUntil)-500)
  const short=acceptWorkerResult({...opts,report})
  assert.equal(short.ok,false)
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'0','insufficient check budget must not merge files')
})

test('integration enforces its declared check timeout and keeps a failed merge recoverable',async t=>{
  const opts=setup(t),first=await dispatchWave({...opts,sequentialWorker:fallback}),a=first.results[0]
  assert.equal(first.ok,true,JSON.stringify(first));t.after(()=>removeTempRoot(a.manifest.container))
  const defaulted=acceptWorkerResult({...opts,report:a,checkCommands:{...opts.checkCommands,C1:{...opts.checkCommands.C1,timeoutMs:null}}})
  assert.equal(defaulted.ok,true,defaulted.error)
  const proof=JSON.parse(readFileSync(join(opts.root,defaulted.result.proofs[0]),'utf8'))
  assert.equal(proof.limits.timeoutMs,60000)
  assert.ok(proof.limits.timeoutMs<=Date.parse(a.assignment.leaseUntil)-Date.parse(proof.startedAt)-1000)
  const next=await dispatchWave({...opts,sequentialWorker:fallback}),b=next.results[0]
  assert.equal(next.ok,true,JSON.stringify(next));t.after(()=>removeTempRoot(b.manifest.container))
  const failed=acceptWorkerResult({...opts,report:b,checkCommands:{...opts.checkCommands,C1:{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],timeoutMs:20}}})
  assert.equal(failed.ok,false)
  assert.equal(failed.merged.ok,true)
  assert.equal(readFileSync(join(opts.root,'src/B.txt'),'utf8'),'1')
  const failedProof=JSON.parse(readFileSync(join(opts.root,failed.proofs[0]),'utf8'))
  assert.equal(failedProof.limits.timeoutMs,20)
  assert.notEqual(failedProof.outcome,'passed')
  const recovered=acceptWorkerResult({...opts,report:b})
  assert.equal(recovered.ok,true,recovered.error)
  assert.equal(recovered.merged.idempotent,true)
})
