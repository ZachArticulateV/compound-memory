import {test} from 'node:test'
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {readFileSync,writeFileSync,unlinkSync,symlinkSync,mkdirSync,existsSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
import {makeTempRoot,cleanupAfter,writeTree,childEnv} from './fixtures/build.mjs'
import {consumeIntegrityDue,configureIntegrity,markIntegrityDue,readIntegrityState,inspectCoverage} from '../scripts/integrity-due.mjs'
import {runSessionHook} from '../scripts/session-status-hook.mjs'
import {withIntegrityLock,integrityConfig} from '../scripts/lib/integrity-state.mjs'
import {sealIntegrityRuntime,pruneIntegrityRuntime} from '../scripts/lib/runtime-retention.mjs'
function fixture(t){const root=makeTempRoot();cleanupAfter(t,root);writeTree(root,{'memory/current-state.md':'The limit is 1.\nUptime is unknown.\n','src/a.mjs':'export const n=1\n'});configureIntegrity(root,{enabled:true,cooldownMs:0});return {root,prepare:{paths:['memory/current-state.md','src/a.mjs'],claims:[{id:'C1',artifact:'memory/current-state.md',claim:'The limit is 1.',sources:['src/a.mjs']},{id:'C2',artifact:'memory/current-state.md',claim:'Uptime is unknown.',sources:[]}]}}}
// A cold Git process may exceed the production 150 ms check budget under suite
// load. Retry only valid fixture setup. Unsafe-use assertions below run once.
async function establishLocalQueue(check) {
 for(let attempt=0;attempt<20;attempt++){if(check())return;await delay(25)}
 assert.fail('valid local queue could not finish its bounded Git checks')
}
function answer(b){return {sentPrompt:b.prompt,host:'fixture',model:null,report:{schemaVersion:1,kind:'integrity-report',bundleId:b.bundleId,snapshotFingerprint:b.snapshot.fingerprint,checkedClaims:['C1'],uncheckedClaims:[{claimId:'C2',reason:'No runtime evidence.'}],findings:[{claimId:'C1',classification:'VALID',reason:'Source agrees.',evidence:[{path:'src/a.mjs',line:1,quote:'export const n=1'}]},{claimId:'C2',classification:'UNVERIFIABLE',reason:'No runtime evidence.',evidence:[]}],repairProposals:[],nextDueReasons:[],summary:'One source checked; uptime remains unknown.'}}}
test('lead consumes an actual frozen packet and saves scoped coverage without memory edits',async t=>{const {root,prepare}=fixture(t),original=readFileSync(join(root,'memory/current-state.md'),'utf8')
 markIntegrityDue(root,{reason:'source-changed',branch:'main',now:10});const result=await consumeIntegrityDue(root,{branch:'main',prepare,now:20,run:async b=>answer(b)})
 assert.equal(result.status,'partial');assert.equal(result.coverage,1);assert.equal(readIntegrityState(root).queue[0].lastSuccess,null);assert.equal(readIntegrityState(root).queue[0].lastReportAt,20)
 assert.deepEqual(inspectCoverage(root).claims.map(c=>c.state),['checked','unchecked'])
 assert.equal(readFileSync(join(root,'memory/current-state.md'),'utf8'),original)
 // Time alone changes no source state. A real source edit requires review.
 assert.equal(inspectCoverage(root).claims[0].state,'checked');writeFileSync(join(root,'src/a.mjs'),'export const n=2\n');assert.equal(inspectCoverage(root).claims[0].state,'review-needed')
})
test('failed, cancelled and source-stale runs retain due state and never advance coverage',async t=>{
 for(const type of ['failure','cancel','stale']){const {root,prepare}=fixture(t);markIntegrityDue(root,{reason:'test',now:10})
 const result=await consumeIntegrityDue(root,{prepare,now:20,timeoutMs:type==='cancel'?10:60000,run:async (b,{signal})=>{if(type==='failure')throw Error('host failed');if(type==='cancel')return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true}));writeFileSync(join(root,'src/a.mjs'),'changed');return answer(b)}})
 assert.notEqual(result.status,'completed');const q=readIntegrityState(root).queue[0];assert.equal(q.status,'due');assert.equal(q.lastSuccess,null);assert.equal(inspectCoverage(root).claims.length,0)
 }
})
test('new events during a run survive and another branch does not consume its lease',async t=>{const {root,prepare}=fixture(t);markIntegrityDue(root,{branch:'main',reason:'start',now:10});markIntegrityDue(root,{branch:'other',reason:'start',now:10})
 const result=await consumeIntegrityDue(root,{branch:'main',prepare,now:20,run:async b=>{markIntegrityDue(root,{branch:'main',reason:'later-edit',now:21});assert.equal((await consumeIntegrityDue(root,{branch:'main',prepare,now:22,run:async()=>{throw Error('duplicate run')}})).status,'idle');return answer(b)}})
 assert.equal(result.status,'partial');assert.deepEqual(readIntegrityState(root).queue.map(q=>q.status),['due','due'])
})
test('queue loss recovers on the next event and a live writer lock blocks another writer',t=>{const {root}=fixture(t);markIntegrityDue(root,{reason:'first'});unlinkSync(join(root,'.verify/integrity/state.json'));markIntegrityDue(root,{reason:'recover'});assert.equal(readIntegrityState(root).queue.length,1)
 withIntegrityLock(root,()=>assert.throws(()=>markIntegrityDue(root,{reason:'race'}),/EEXIST/))
})
test('opt-in startup and compact have one output owner and no model launch',t=>{const {root}=fixture(t)
 for(const source of ['startup','compact']){const output=runSessionHook(JSON.stringify({hook_event_name:'SessionStart',source,cwd:root}),{env:{}});assert.equal(output.code,0);assert.equal(output.stdout.trim().split('\n').length,1);assert.equal(JSON.parse(output.stdout).hookSpecificOutput.additionalContext.match(/scoped integrity check is due/g).length,1)}
 assert.equal(readIntegrityState(root).queue.length,1);assert.equal(readIntegrityState(root).queue[0].lastAttempt,null)
})
test('runtime junctions cannot redirect queue state',t=>{const root=makeTempRoot(),outside=makeTempRoot();cleanupAfter(t,root);cleanupAfter(t,outside);symlinkSync(outside,join(root,'.verify'),process.platform==='win32'?'junction':'dir');assert.throws(()=>configureIntegrity(root,{enabled:true}),/linked path/)
})
test('unconfirmed native stop fences retries even after the nominal lease ends',async t=>{const {root,prepare}=fixture(t);markIntegrityDue(root,{reason:'test',now:10})
 const result=await consumeIntegrityDue(root,{prepare,now:20,run:async()=>{throw Object.assign(Error('native stop is unknown'),{stopped:false})}})
 assert.equal(result.cancellationUnconfirmed,true);let calls=0;assert.equal((await consumeIntegrityDue(root,{prepare,now:999999999,run:async()=>{calls++}})).status,'idle');assert.equal(calls,0)
})
test('all-unknown reports remain due and do not set a checked timestamp',async t=>{const {root,prepare}=fixture(t);markIntegrityDue(root,{reason:'test',now:10})
 const result=await consumeIntegrityDue(root,{prepare,now:20,run:async b=>{const a=answer(b);a.report.checkedClaims=[];a.report.uncheckedClaims=b.claims.map(c=>({claimId:c.id,reason:'No evidence.'}));a.report.findings=b.claims.map(c=>({claimId:c.id,classification:'UNVERIFIABLE',reason:'No evidence.',evidence:[]}));return a}})
 assert.equal(result.status,'partial');assert.equal(result.coverage,0);assert.equal(readIntegrityState(root).queue[0].status,'due');assert.ok(inspectCoverage(root).claims.every(c=>c.checkedAt===null))
})
test('retention removes only sealed untouched runtime trees',t=>{const {root}=fixture(t)
 for(const modified of [false,true]){const relative='.verify/integrity/runs/'+randomUUID(),dir=join(root,relative);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'report.json'),'{}');const seal=sealIntegrityRuntime(root,relative);if(modified)writeFileSync(join(dir,'user-note.md'),'Keep this.');assert.equal(pruneIntegrityRuntime(root,relative,seal).removed,!modified);assert.equal(existsSync(dir),modified)}
})
test('each queue use refuses a tracked or no-longer-ignored flag without writes',async t=>{const {root}=fixture(t)
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,env:childEnv(),encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr)}
 git('init');assert.equal(integrityConfig(root).enabled,false);assert.equal(markIntegrityDue(root,{reason:'not ignored'}).queued,false);assert.equal(existsSync(join(root,'.verify/integrity/state.json')),false)
 writeFileSync(join(root,'.gitignore'),'.verify/\n');await establishLocalQueue(()=>markIntegrityDue(root,{reason:'local flag'}).queued);const state=readFileSync(join(root,'.verify/integrity/state.json'),'utf8')
 git('add','-f','.verify/integrity/config.json');assert.equal(integrityConfig(root).enabled,false);assert.equal(markIntegrityDue(root,{reason:'tracked flag'}).queued,false);assert.equal(readFileSync(join(root,'.verify/integrity/state.json'),'utf8'),state)
 git('rm','--cached','-f','.verify/integrity/config.json');writeFileSync(join(root,'.gitignore'),'');assert.equal(integrityConfig(root).enabled,false);assert.equal(markIntegrityDue(root,{reason:'ignore removed'}).queued,false);assert.equal(readFileSync(join(root,'.verify/integrity/state.json'),'utf8'),state)
})
test('queue cancellation allows native shutdown grace before fencing a retry',async t=>{const {root,prepare}=fixture(t);markIntegrityDue(root,{reason:'test',now:10})
 const result=await consumeIntegrityDue(root,{prepare,now:20,timeoutMs:10,run:async(b,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>setTimeout(()=>reject(Object.assign(Error('native closed'),{stopped:true})),2500),{once:true}))})
 assert.equal(result.status,'cancelled');assert.notEqual(result.cancellationUnconfirmed,true);assert.equal(readIntegrityState(root).queue[0].lease,null)
})
test('ignoring only the flag cannot expose state, checkpoints, or run files',async t=>{const {root}=fixture(t)
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,env:childEnv(),encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr)}
 git('init');writeFileSync(join(root,'.gitignore'),'.verify/integrity/config.json\n');assert.equal(integrityConfig(root).enabled,false);assert.equal(markIntegrityDue(root,{reason:'narrow ignore'}).queued,false);assert.equal(existsSync(join(root,'.verify/integrity/state.json')),false)
 writeFileSync(join(root,'.gitignore'),'.verify/\n');await establishLocalQueue(()=>integrityConfig(root).enabled)
 writeTree(root,{'.verify/integrity/checkpoints/kept.json':'{}'});git('add','-f','.verify/integrity/checkpoints/kept.json');assert.equal(integrityConfig(root).enabled,false)
 git('rm','--cached','-f','.verify/integrity/checkpoints/kept.json');writeFileSync(join(root,'.gitignore'),'.verify/integrity/*\n!.verify/integrity/unignored.json\n');writeFileSync(join(root,'.verify/integrity/unignored.json'),'{}');assert.equal(integrityConfig(root).enabled,false)
})
test('a failed final state write cannot make a started due runner reclaimable',async t=>{const {root,prepare}=fixture(t);markIntegrityDue(root,{reason:'test',now:10});const lock=join(root,'.verify/integrity/state.lock'),statePath=join(root,'.verify/integrity/state.json')
 await assert.rejects(consumeIntegrityDue(root,{prepare,now:20,run:async()=>{assert.equal(readIntegrityState(root).queue[0].lease.executionStarted,true);writeFileSync(lock,'other writer');throw Object.assign(Error('native stop unknown'),{stopped:false})}}),/EEXIST/)
 unlinkSync(lock);const state=readIntegrityState(root);state.queue[0].lease.pid=2147483647;state.queue[0].lease.until=0;assert.equal(state.queue[0].lease.cancellationUnconfirmed,undefined);writeFileSync(statePath,JSON.stringify(state));let calls=0
 assert.equal((await consumeIntegrityDue(root,{prepare,now:99999999,run:async()=>{calls++}})).status,'idle');assert.equal(calls,0)
})
