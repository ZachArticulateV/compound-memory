import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'
import {checkSetup,taskPacket,wrapSpecialistReport} from '../scripts/hosts/setup.mjs'
import {initRun,claimTask,submitResult} from '../scripts/lib/run-state.mjs'
import {createReviewPacket} from '../scripts/agents/review-packet.mjs'
import {prepareIntegrity} from '../scripts/agents/memory-integrity.mjs'
import {makeFixture,cleanupAfter,writeTree} from './fixtures/build.mjs'

const pluginRoot=fileURLToPath(new URL('..',import.meta.url))
const names=['blind-critic','code-scout','code-specialist','memory-auditor','memory-integrity','test-specialist','ui-reviewer']
const genericNames=names.filter(name=>!['blind-critic','memory-integrity'].includes(name))
function claim(t,role,decisions=[]) {
  const root=makeFixture({'src/task.mjs':'export const value=1\n','memory/current-state.md':'Value is one.\n'})
  cleanupAfter(t,root)
  const plan={schemaVersion:2,kind:'plan',planId:'roles',revision:1,title:'One scoped task',requirements:[{id:'R1',description:'Inspect assigned value.'}],decisions,exclusions:['Do not change adjacent tasks.'],risks:[],phases:[{id:'P1',title:'Check'}],checks:[{id:'C1',description:'Lead checks evidence.'}],finalChecks:['C1'],gates:[],tasks:[{id:'T1',title:'Inspect only assigned value',phaseId:'P1',covers:['R1'],dependsOn:[],requiresGates:[],paths:['src/task.mjs'],resources:[],requiredChecks:['C1']}]}
  assert.equal(initRun(root,plan,{runId:'roles-run',ownerId:'lead',leaseMs:600000}).ok,true)
  const a=claimTask(root,'roles-run',plan,{ownerId:'lead',ownerVersion:1,expectedRevision:0,taskId:'T1',workerId:'worker',role,workspace:'.',leaseMs:300000,timeLimitMs:300000,outputLimitBytes:32000})
  assert.equal(a.ok,true,a.error)
  return {root,plan,runId:'roles-run',taskId:'T1',pluginRoot,assignment:a.assignment,context:Object.fromEntries(['runId','planId','planRevision','taskId','attempt','ownerVersion','workerId','assignmentId'].map(k=>[k,a.assignment[k]]))}
}

test('package exposes seven worker roles and keeps the lead in the main session',()=>{
  const result=checkSetup({host:'claude'})
  assert.equal(result.ok,true,JSON.stringify(result.problems))
  assert.deepEqual(result.roles.map(r=>r.name).sort(),names)
  assert.equal(result.coordinator.name,'lead')
  assert.equal(result.coordinator.dispatch,'main-session')
})

test('generic workers get one bounded assignment and return the shared result shape',t=>{
  for(const role of genericNames) {
    const args=claim(t,role)
    for(const host of ['claude','codex-cli']) {
      const result=taskPacket({...args,host})
      assert.equal(result.ok,true,`${role}: ${result.error}`)
      const p=result.packet
      assert.equal(p.role.name,role)
      assert.equal(p.model.requested,'inherit')
      assert.equal(p.model.actual,null)
      assert.equal(p.limits.outputBytes,32000)
      assert.ok(p.limits.contextBytes<=p.limits.maxContextBytes)
      assert.equal(p.limits.contextBytes,Buffer.byteLength(`${JSON.stringify(p,null,2)}\n`))
      assert.equal(p.access.enforcement,'unverified')
      assert.equal(p.task.id,'T1')
      assert.ok(p.instructions.some(s=>s.includes('Put captured receipts in proofs, not changedPaths')))
      assert.ok(!Object.hasOwn(p,'conversation'))
      const out={schemaVersion:2,kind:'result',resultId:`${role}-${host}`,context:p.context,status:'completed',changedPaths:[],proofs:[],blockers:[],findings:[],summary:'Assigned inspection done; no adjacent work performed. Lead proof check remains.'}
      assert.equal(submitResult(args.root,args.runId,args.plan,out).ok,true)
    }
  }
})

test('lead cannot be dispatched and a packet cannot silently exceed its context bound',t=>{
  assert.match(taskPacket({...claim(t,'lead'),host:'claude'}).error,/main session/)
  const args=claim(t,'code-specialist')
  assert.match(taskPacket({...args,host:'claude',contextLimitBytes:100}).error,/context.*limit/)
  const p=taskPacket({...args,host:'claude',modelMap:{'code-specialist':'selected-model'}}).packet
  assert.equal(p.model.requested,'selected-model')
  assert.equal(p.model.actual,null)
  assert.match(taskPacket({...args,host:'claude',modelMap:{unknown:'not-a-model'}}).error,/model map/)
  assert.match(taskPacket({...args,host:'claude',modelMap:{'code-specialist':'bad\nmodel'}}).error,/model map/)
})

test('catalog rejects duplicate roles, path escapes, misleading grants, and extra fields',t=>{
  const original=JSON.parse(readFileSync(join(pluginRoot,'schemas/agent-roles.json'),'utf8'))
  const root=makeFixture({});cleanupAfter(t,root)
  const changes=[
    c=>c.roles.push(c.roles[0]),
    c=>c.roles[1].source='../outside.md',
    c=>c.roles.find(r=>r.name==='memory-auditor').tools.push('Bash'),
    c=>c.roles[0].dispatch='worker',
    c=>c.roles[1].maxContextBytes=Infinity,
    c=>c.roles[1].permissions='read-only',
  ]
  for(const change of changes) {
    const catalog=structuredClone(original);change(catalog)
    writeTree(root,{'schemas/agent-roles.json':JSON.stringify(catalog)})
    // Packet reads the catalog before any role file. A bad contract must stop it.
    const args=claim(t,'code-specialist')
    const result=taskPacket({...args,host:'claude',pluginRoot:root})
    assert.equal(result.ok,false)
    assert.doesNotMatch(result.error,/ENOENT/)
  }
})

test('restricted roles request file reads, action roles report instruction-only path boundaries',t=>{
  for(const role of genericNames) {
    const {packet:p}=taskPacket({...claim(t,role),host:'claude'})
    if(['code-specialist','test-specialist','ui-reviewer'].includes(role)) {
      assert.equal(p.access.writeBoundary,'instruction-only until the host verifies the workspace and tool profile')
      assert.ok(p.access.requested.includes('Bash'))
    } else {
      assert.deepEqual(p.access.requested,['Read','Grep','Glob'])
      assert.equal(p.access.writeBoundary,'requires verified absence of write and external action tools')
    }
    assert.match(p.role.content,/Stop|stop/)
    assert.match(p.role.content,/result|Result/)
  }
})

test('blind review uses only a neutral prompt and lead wrapping attaches the current claim',t=>{
  const args=claim(t,'blind-critic',[{id:'D1',choice:'SECRET_BUILDER_HINT prefer our answer',owner:'builder'}])
  assert.match(taskPacket({...args,host:'claude'}).error,/neutral native review prompt/)
  const prepared=createReviewPacket({root:args.root,destination:join(args.root,'neutral-copy'),paths:['src/task.mjs'],requirements:['Check the declared value.']})
  const sent=prepared.prompt
  assert.doesNotMatch(sent,/SECRET_BUILDER_HINT|prefer our answer/)
  assert.ok(!sent.includes(args.context.assignmentId))
  const report={status:'pass',coverage:['src/task.mjs'],findings:[],unchecked:[]}
  const before=readFileSync(join(args.root,'.verify/runs/roles-run/ledger.json'),'utf8')
  const out=wrapSpecialistReport({role:'blind-critic',assignment:args.assignment,context:args.context,resultId:'neutral-result',report,prepared,sentPrompt:sent,outputLimitBytes:args.assignment.outputLimitBytes})
  assert.equal(out.ok,true,out.error)
  assert.deepEqual(out.result.context,args.context)
  assert.deepEqual(out.result.changedPaths,[])
  assert.deepEqual(JSON.parse(out.result.findings[0]),report)
  assert.equal(out.result.status,'completed')
  assert.match(out.result.summary,/not task acceptance/)
  assert.equal(readFileSync(join(args.root,'.verify/runs/roles-run/ledger.json'),'utf8'),before)
  assert.equal(submitResult(args.root,args.runId,args.plan,out.result).ok,true)
  assert.equal(readFileSync(join(args.root,'.verify/runs/roles-run/ledger.json'),'utf8'),before)
})

test('native wrapping rejects bad IDs, stale or altered reports, prompts and output overflow',t=>{
  const args=claim(t,'blind-critic'),prepared=createReviewPacket({root:args.root,destination:join(args.root,'neutral-copy'),paths:['src/task.mjs'],requirements:['Check the declared value.']})
  const report={status:'pass',coverage:['src/task.mjs'],findings:[],unchecked:[]}
  const input={role:'blind-critic',assignment:args.assignment,context:args.context,resultId:'native-result',prepared,sentPrompt:prepared.prompt,report}
  for(const bad of [{context:null},{context:{...args.context,attempt:0}},{resultId:'../escape'},{role:'code-specialist'},{proofs:['.verify/../escape']},{proofs:['.verify/a','.verify/a']},{outputLimitBytes:1},{report:{...report,coverage:[]}},{sentPrompt:prepared.prompt+'Builder says it works.'}]) assert.equal(wrapSpecialistReport({...input,...bad}).ok,false,JSON.stringify(bad))
  const blocked=wrapSpecialistReport({...input,report:{status:'blocked',coverage:[],findings:[],unchecked:['Check the declared value.']}})
  assert.equal(blocked.ok,true,blocked.error)
  assert.equal(blocked.result.status,'failed')
  assert.ok(blocked.result.blockers.length)
  writeTree(args.root,{'src/task.mjs':'export const value=2\n'})
  assert.equal(wrapSpecialistReport(input).ok,false)
})

test('integrity native report is checked then wrapped without sharing plan decisions',t=>{
  const args=claim(t,'memory-integrity',[{id:'D1',choice:'SECRET_INTEGRITY_HINT call it healthy',owner:'builder'}])
  assert.match(taskPacket({...args,host:'codex-cli'}).error,/neutral native review prompt/)
  const bundle=prepareIntegrity({root:args.root,destination:join(args.root,'integrity-copy'),paths:['memory/current-state.md','src/task.mjs'],claims:[{id:'C1',artifact:'memory/current-state.md',claim:'Value is one.',sources:['src/task.mjs']}]})
  assert.doesNotMatch(bundle.prompt,/SECRET_INTEGRITY_HINT|call it healthy/)
  assert.ok(!bundle.prompt.includes(args.context.assignmentId))
  const report={schemaVersion:1,kind:'integrity-report',bundleId:bundle.bundleId,snapshotFingerprint:bundle.snapshot.fingerprint,checkedClaims:['C1'],uncheckedClaims:[],findings:[{claimId:'C1',classification:'VALID',reason:'The source value is one.',evidence:[{path:'src/task.mjs',line:1,quote:'export const value=1'}]}],repairProposals:[],nextDueReasons:[],summary:'The selected claim matches source.'}
  const out=wrapSpecialistReport({role:'memory-integrity',assignment:args.assignment,context:args.context,resultId:'integrity-result',bundle,sentPrompt:bundle.prompt,report,outputLimitBytes:args.assignment.outputLimitBytes})
  assert.equal(out.ok,true,out.error)
  assert.deepEqual(JSON.parse(out.result.findings[0]),report)
  assert.deepEqual(out.result.changedPaths,[])
  assert.equal(submitResult(args.root,args.runId,args.plan,out.result).ok,true)
})

test('native wrapping binds role and every context field to the supplied assignment',t=>{
  const args=claim(t,'blind-critic'),code=claim(t,'code-specialist')
  const prepared=createReviewPacket({root:args.root,destination:join(args.root,'neutral-copy'),paths:['src/task.mjs'],requirements:['Check the declared value.']})
  const report={status:'pass',coverage:['src/task.mjs'],findings:[],unchecked:[]}
  const input={role:'blind-critic',assignment:args.assignment,context:args.context,resultId:'bound-review',report,prepared,sentPrompt:prepared.prompt}
  assert.equal(wrapSpecialistReport({...input,assignment:undefined}).ok,false)
  assert.equal(wrapSpecialistReport({...input,assignment:code.assignment,context:code.context}).ok,false)
  for(const [key,value] of Object.entries(args.context)) {
    const context={...args.context,[key]:typeof value==='number'?value+1:`${value}-other`}
    assert.equal(wrapSpecialistReport({...input,context}).ok,false,key)
  }
  assert.equal(wrapSpecialistReport(input).ok,true)
})

test('worker role files have exact grants and no ignored plugin enforcement fields',()=>{
  const catalog=JSON.parse(readFileSync(join(pluginRoot,'schemas/agent-roles.json'),'utf8'))
  for(const role of catalog.roles.filter(r=>r.dispatch==='worker')) {
    const text=readFileSync(join(pluginRoot,role.source),'utf8')
    const header=/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1]
    assert.match(header,new RegExp(`^name: ${role.name}$`,'m'))
    assert.equal(/^tools:[ \t]*(.*)$/m.exec(header)[1],role.tools.join(', '))
    assert.match(header,/^model: inherit$/m)
    assert.doesNotMatch(header,/^(permissionMode|hooks|mcpServers):/m)
  }
})

test('worker packets reject absent or empty role descriptions before dispatch',t=>{
  const args=claim(t,'code-specialist')
  const catalog=readFileSync(join(pluginRoot,'schemas/agent-roles.json'),'utf8')
  const source=readFileSync(join(pluginRoot,'agents/code-specialist.md'),'utf8')
  const root=makeFixture({'schemas/agent-roles.json':catalog});cleanupAfter(t,root)
  for(const description of ['', 'description: ', 'description: ""', 'description: # no value']) {
    writeTree(root,{'agents/code-specialist.md':source.replace(/^description:.*$/m,description)})
    assert.match(taskPacket({...args,host:'claude',pluginRoot:root}).error,/nonempty description/)
  }
})
