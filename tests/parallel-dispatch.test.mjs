import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {makeFixture,cleanupAfter,removeTempRoot,childEnv} from './fixtures/build.mjs'
import {initRun,readRun,inspectRun,retryTask} from '../scripts/lib/run-state.mjs'
import {dispatchWave,acceptWorkerResult,nativeInvocation,hostCapabilities,launchNative} from '../scripts/agents/dispatch.mjs'

export function parallelPlan() {
  return {schemaVersion:2,kind:'plan',planId:'parallel',revision:1,title:'Independent changes',requirements:[{id:'R1',description:'Both changes work.'}],decisions:[],exclusions:[],risks:[],phases:[{id:'P1',title:'Build'}],checks:[{id:'C1',description:'Task works.'},{id:'C2',description:'Combined works.'}],finalChecks:['C2'],gates:[],tasks:['A','B','C'].map(id=>({id,title:id,phaseId:'P1',covers:['R1'],dependsOn:[],requiresGates:[],paths:[`src/${id}.txt`],resources:[],requiredChecks:['C1']}))}
}
const worker=`import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
let input='';for await(const data of process.stdin)input+=data;const p=JSON.parse(input);
await new Promise(r=>setTimeout(r,120));
writeFileSync(join(p.assignment.workspace,p.task.paths[0]),'worker-'+p.task.id);
const result={schemaVersion:2,kind:'result',resultId:'result-'+p.task.id,context:p.context,status:'completed',changedPaths:p.task.paths,proofs:[],blockers:[],findings:[],summary:'Changed owned file.'};
writeFileSync(process.argv[process.argv.indexOf('-o')+1],JSON.stringify(result));`
export function setupParallel(t,plan=parallelPlan(),source=worker) {
  const root=makeFixture({'src/A.txt':'A','src/B.txt':'B','src/C.txt':'C'}),bin=makeFixture({'worker.mjs':source})
  cleanupAfter(t,root);cleanupAfter(t,bin)
  assert.equal(initRun(root,plan,{runId:'run',ownerId:'lead',leaseMs:300000}).ok,true)
  const checkCommands={C1:{command:process.execPath,args:['-e','process.exit(0)']},C2:{command:process.execPath,args:['-e','process.exit(0)']}}
  return {root,plan,runId:'run',ownerId:'lead',ownerVersion:1,host:'codex-cli',binary:join(bin,'worker.mjs'),processEnv:childEnv(),checkCommands}
}
export function cleanupReports(t,wave){for(const report of wave.results??[])if(report.manifest)t.after(()=>removeTempRoot(report.manifest.container))}

test('fixture CLI workers overlap, excess work waits, and native output alone does not accept work',async t=>{
  const opts=setupParallel(t),wave=await dispatchWave({...opts,maxWorkers:2});cleanupReports(t,wave)
  assert.equal(wave.ok,true,JSON.stringify(wave));assert.equal(wave.results.length,2)
  assert.ok(Math.max(...wave.results.map(r=>Date.parse(r.startedAt)))<Math.min(...wave.results.map(r=>Date.parse(r.finishedAt))))
  assert.deepEqual(wave.waiting,['C']);assert.equal(inspectRun(opts.root,'run',opts.plan).mayClaimSuccess,false)
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'A')
  for(const report of wave.results){const accepted=acceptWorkerResult({...opts,report});assert.equal(accepted.ok,true,accepted.error)}
  assert.equal(readFileSync(join(opts.root,'src/A.txt'),'utf8'),'worker-A')
})

test('shared resources wait; sequential native mode launches one worker',async t=>{
  const plan=parallelPlan();plan.tasks[0].resources=['port:3000'];plan.tasks[1].resources=['port:3000']
  const opts=setupParallel(t,plan),wave=await dispatchWave({...opts,maxWorkers:3});cleanupReports(t,wave)
  assert.equal(wave.ok,true,JSON.stringify(wave));assert.deepEqual(wave.results.map(r=>r.taskId),['A','C'])
  assert.deepEqual(wave.waiting,['B'])
  const seq=setupParallel(t),one=await dispatchWave({...seq,mode:'sequential'});cleanupReports(t,one)
  assert.equal(one.results.length,1)
})

test('bad plans, duplicate dispatch authority, and unsupported hosts fail before launch',async t=>{
  const opts=setupParallel(t),lock=join(opts.root,'.verify/runs/run/.dispatch-lock');mkdirSync(lock)
  assert.equal((await dispatchWave(opts)).ok,false);assert.ok(existsSync(lock),'another owner lock remains')
  const bad=structuredClone(opts.plan);bad.tasks[0].dependsOn=['A']
  assert.equal((await dispatchWave({...opts,plan:bad})).ok,false)
  assert.equal((await dispatchWave({...opts,host:'codex-desktop'})).ok,false)
  assert.equal(hostCapabilities('codex-desktop').nativeDispatch,false)
  assert.equal(Object.values(readRun(opts.root,'run').ledger.tasks).some(s=>s.assignment),false)
})

test('native parent bounds output and time and receives cancellation',async t=>{
  const root=makeFixture({'wait.mjs':'setInterval(()=>{},1000)','flood.mjs':'setInterval(()=>process.stdout.write("x".repeat(8192)),1)'});cleanupAfter(t,root)
  const invocation=file=>({command:process.execPath,args:[join(root,file)],cwd:root})
  const timed=await launchNative({invocation:invocation('wait.mjs'),prompt:'{}',timeLimitMs:80,outputLimitBytes:4096,processEnv:childEnv()})
  assert.match(timed.error,/time limit/);assert.equal(timed.stopped,true)
  const flood=await launchNative({invocation:invocation('flood.mjs'),prompt:'{}',timeLimitMs:5000,outputLimitBytes:4096,processEnv:childEnv()})
  assert.match(flood.error,/output limit/);assert.ok(Buffer.byteLength(flood.stdout)<=4096);assert.equal(flood.stopped,true)
  const controller=new AbortController();setTimeout(()=>controller.abort(),80)
  const cancelled=await launchNative({invocation:invocation('wait.mjs'),prompt:'{}',timeLimitMs:5000,outputLimitBytes:4096,signal:controller.signal,processEnv:childEnv()})
  assert.match(cancelled.error,/cancelled/);assert.equal(cancelled.stopped,true)
})

test('native adapters use bounded host profiles, without shell shims or provider schema weakening',t=>{
  const root=makeFixture({'cli.mjs':''});cleanupAfter(t,root)
  const common={binary:join(root,'cli.mjs'),workspace:root,controlDir:join(root,'control')}
  const claude=nativeInvocation({...common,host:'claude'})
  assert.ok(claude.args.includes('--restricted'));assert.equal(claude.args[claude.args.indexOf('--tools')+1],'Read,Grep,Glob,Edit,Write')
  const settings=JSON.parse(readFileSync(claude.args[claude.args.indexOf('--settings')+1],'utf8'))
  assert.equal(settings.permissions.allow.filter(rule=>rule.startsWith('Edit(//')).length,1)
  assert.ok(!settings.permissions.allow.some(rule=>rule.startsWith('Write(')))
  const codex=nativeInvocation({...common,host:'codex-cli',controlDir:join(root,'codex')})
  assert.equal(codex.args[codex.args.indexOf('-s')+1],'workspace-write');assert.ok(!codex.args.includes('--output-schema'))
  const reader=nativeInvocation({...common,host:'codex-cli',role:'code-scout',controlDir:join(root,'read')})
  assert.equal(reader.args[reader.args.indexOf('-s')+1],'read-only')
  assert.throws(()=>nativeInvocation({...common,host:'claude',role:'blind-critic'}),/dedicated workflow/)
})

test('fallback failure without a stop receipt keeps the claim fenced',async t=>{
  const opts=setupParallel(t)
  const failed=await dispatchWave({...opts,host:'codex-desktop',mode:'sequential',sequentialWorker:async()=>{throw new Error('host disconnected')}})
  cleanupReports(t,failed);assert.equal(failed.ok,false);assert.equal(failed.results[0].stopped,false)
  const again=await dispatchWave({...opts,host:'codex-desktop',mode:'sequential',sequentialWorker:async()=>{throw new Error('must not run')}})
  assert.equal(again.results.length,0)
  const state=readRun(opts.root,'run').ledger
  assert.equal(retryTask(opts.root,'run',opts.plan,{ownerId:'lead',ownerVersion:1,expectedRevision:state.revision,taskId:'A'}).ok,false)
})
