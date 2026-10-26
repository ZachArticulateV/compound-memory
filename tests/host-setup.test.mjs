import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { checkSetup, taskPacket } from '../scripts/hosts/setup.mjs'
import { initRun, claimTask, readRun, submitResult, transitionTask } from '../scripts/lib/run-state.mjs'
import { childEnv, cleanupAfter, makeFixture, writeTree } from './fixtures/build.mjs'

const pluginRoot = fileURLToPath(new URL('..', import.meta.url))
const roleFiles=['schemas/agent-roles.json','references/agents.md',...readdirSync(join(pluginRoot,'agents')).filter(n=>n.endsWith('.md')).map(n=>`agents/${n}`)]
const plan = () => ({schemaVersion:2,kind:'plan',planId:'host-plan',revision:1,title:'Audit memory',
  requirements:[{id:'R1',description:'Check claims.'}],decisions:[],exclusions:['No writes.'],risks:[],
  phases:[{id:'P1',title:'Audit'}],checks:[{id:'C1',description:'Review findings against source.'}],finalChecks:['C1'],gates:[],
  tasks:[{id:'T1',title:'Read current memory',phaseId:'P1',covers:['R1'],dependsOn:[],requiresGates:[],paths:['memory'],resources:[],requiredChecks:['C1']}]})
function assigned(t) {
  const root=makeFixture({'memory/current-state.md':'One claim.\n','.gitignore':'.verify/\n'})
  cleanupAfter(t,root)
  const p=plan()
  assert.equal(initRun(root,p,{runId:'run',ownerId:'lead',leaseMs:600000}).ok,true)
  const a=claimTask(root,'run',p,{ownerId:'lead',ownerVersion:1,expectedRevision:0,taskId:'T1',workerId:'auditor',role:'memory-auditor',workspace:'.',leaseMs:300000,timeLimitMs:300000,outputLimitBytes:100000})
  assert.equal(a.ok,true,a.error)
  return {root,p,assignment:a.assignment}
}

test('setup checks all host surfaces without treating package presence as runtime proof',()=>{
  for(const host of ['claude','codex-cli','codex-desktop','codex-cloud']) {
    const result=checkSetup({host,pluginRoot})
    assert.equal(result.ok,true,JSON.stringify(result.problems))
    assert.equal(result.basis,'package-inspection')
    assert.equal(result.runtime.verified,false)
    assert.equal(result.runtime.contextUsedPercent,null)
    assert.equal(result.skills.some(s=>s.name==='project-memory'),true)
    assert.ok(result.roles.some(r=>r.name==='memory-auditor'))
    if(host.startsWith('codex')) assert.equal(result.capabilities.hooks.configured,false)
  }
})

test('same assignment, role source and result schema reach both host packets without writes',t=>{
  const {root,p,assignment}=assigned(t)
  const before=readFileSync(join(root,'.verify/runs/run/ledger.json'),'utf8')
  const beforeEntries=readdirSync(join(root,'.verify/runs/run'))
  const a=taskPacket({host:'claude',root,plan:p,runId:'run',taskId:'T1',pluginRoot})
  const b=taskPacket({host:'codex-cli',root,plan:p,runId:'run',taskId:'T1',pluginRoot})
  assert.equal(a.ok,true,a.error); assert.equal(b.ok,true,b.error)
  assert.deepEqual(a.packet.assignment,assignment)
  assert.deepEqual(a.packet.assignment,b.packet.assignment)
  assert.deepEqual(a.packet.context,b.packet.context)
  assert.deepEqual(a.packet.role,b.packet.role)
  assert.deepEqual(a.packet.resultSchema,b.packet.resultSchema)
  assert.deepEqual(a.packet.auditFindingSchema,b.packet.auditFindingSchema)
  assert.deepEqual(a.packet.auditFindingSchema,JSON.parse(readFileSync(join(pluginRoot,'schemas/audit-findings.schema.json'),'utf8')))
  assert.ok(a.packet.auditFindingSchema.properties.findings.items.properties.classification.enum.includes('UNVERIFIABLE'))
  assert.equal(a.packet.resultSchema.properties.schemaVersion.const,2)
  assert.equal(a.packet.access.enforcement,'unverified')
  assert.deepEqual(a.packet.access.requested,['Read','Grep','Glob'])
  assert.deepEqual(b.packet.access.requested,['command reads under a verified read-only filesystem policy'])
  assert.match(b.packet.access.delegation,/not established/)
  assert.match(b.packet.access.requiredCheck,/denied-write control/)
  assert.ok(b.packet.instructions.some(text=>text.includes('not a provider strict-output schema')))
  assert.equal(a.packet.freshness.code,'not-checked')
  assert.equal(b.packet.dispatch.mode,'explicit-packet')
  assert.equal(readFileSync(join(root,'.verify/runs/run/ledger.json'),'utf8'),before)
  assert.deepEqual(readdirSync(join(root,'.verify/runs/run')),beforeEntries)
})

test('role access uses only one exact initial frontmatter block, never body decoys',t=>{
  const {root,p}=assigned(t)
  const files={}
  for(const file of ['plugin.json','.claude-plugin/plugin.json','.codex-plugin/plugin.json','schemas/result.schema.json','schemas/audit-findings.schema.json',...roleFiles]) files[file]=readFileSync(join(pluginRoot,file),'utf8')
  files['skills/test/SKILL.md']='---\nname: test\ndescription: Test.\n---\n'
  files['skills/test/agents/openai.yaml']='interface:\n  display_name: "Test"\n'
  const packageRoot=makeFixture(files); cleanupAfter(t,packageRoot)
  const cases=[
    '---\nname: memory-auditor\ntools: Bash\n---\ntools: Read, Grep, Glob\n',
    '---\nname: memory-auditor\n---\ntools: Read, Grep, Glob\n',
    '---\nname: memory-auditor\ntools: Read, Grep, Glob\ntools: Bash\n---\n',
    '---\nname: memory-auditor\ntools: Read, Grep, Glob\n"tools": Bash\n---\n',
    'No header.\ntools: Read, Grep, Glob\n',
    ...['permissionMode: plan','hooks: {}','mcpServers: {}'].map(field=>`---\nname: memory-auditor\ntools: Read, Grep, Glob\n${field}\n---\n`),
  ]
  for(const content of cases) {
    writeTree(packageRoot,{'agents/memory-auditor.md':content})
    assert.equal(checkSetup({host:'claude',pluginRoot:packageRoot}).ok,false,content)
    const packet=taskPacket({host:'claude',root,plan:p,runId:'run',taskId:'T1',pluginRoot:packageRoot})
    assert.equal(packet.ok,false,content)
    assert.match(packet.error,/frontmatter|tools|ignored/)
  }
  writeTree(packageRoot,{'agents/memory-auditor.md':'---\nname: memory-auditor\ndescription: Inspect selected claims.\ntools: Read, Grep, Glob\n---\ntools: Bash\n'})
  assert.equal(checkSetup({host:'claude',pluginRoot:packageRoot}).ok,true)
  assert.equal(taskPacket({host:'claude',root,plan:p,runId:'run',taskId:'T1',pluginRoot:packageRoot}).ok,true)
})

test('setup reports metadata drift and empty skill names without writing repairs',t=>{
  const files={}
  for(const file of ['plugin.json','.claude-plugin/plugin.json','.codex-plugin/plugin.json',...roleFiles]) files[file]=readFileSync(join(pluginRoot,file),'utf8')
  files['skills/test/SKILL.md']='---\nname: \ndescription: Do not consume this line as a name.\n---\n'
  files['skills/test/agents/openai.yaml']='interface:\n  display_name: "Test"\n'
  const root=makeFixture(files); cleanupAfter(t,root)
  const manifest=JSON.parse(files['plugin.json']); manifest.version='9.0.0'
  const changed=JSON.stringify(manifest)
  writeTree(root,{'plugin.json':changed})
  const result=checkSetup({host:'codex-cli',pluginRoot:root})
  assert.equal(result.ok,false)
  assert.ok(result.problems.includes('portable metadata differs: version'))
  assert.ok(result.problems.includes('skill name differs from folder: test'))
  assert.equal(readFileSync(join(root,'plugin.json'),'utf8'),changed)
})

test('skill routing fields come from frontmatter and actual YAML policy, not body text or comments',t=>{
  const files={}
  for(const file of ['plugin.json','.claude-plugin/plugin.json','.codex-plugin/plugin.json',...roleFiles]) files[file]=readFileSync(join(pluginRoot,file),'utf8')
  const root=makeFixture(files); cleanupAfter(t,root)
  const check=(header,yaml,body='')=>{
    writeTree(root,{'skills/test/SKILL.md':`---\n${header}\n---\n${body}`,'skills/test/agents/openai.yaml':yaml})
    return checkSetup({host:'claude',pluginRoot:root})
  }
  const plain='interface:\n  display_name: "Test"\n'
  assert.equal(check('name: test\ndescription: Keep arbitrary: text and tools.\nallowed-tools: Bash(node "file.mjs" *)',`${plain}# allow_implicit_invocation: false\n`,'disable-model-invocation: true\n').ok,true)
  assert.equal(check('name: test',`${plain}policy:\n  # allow_implicit_invocation: false\n`,'name: other\n').ok,true)
  assert.equal(check('name: test',`${plain}policy:\n  metadata:\n    allow_implicit_invocation: false\n`).ok,true,'a nested field is not the direct policy field')
  assert.equal(check('name: test\ndisable-model-invocation: true',`${plain}policy:\n    allow_implicit_invocation: false # explicit only\n`).ok,true)
  for(const header of ['description: No name.', 'name: test\nname: test', 'name: test\n"name": other', 'name: test\ndisable-model-invocation: maybe', 'name: test\ndisable-model-invocation: true\ndisable-model-invocation: false']) {
    assert.equal(check(header,plain,'name: test\n').ok,false,header)
  }
  for(const yaml of [`${plain}policy:\n  allow_implicit_invocation: maybe\n`,`${plain}policy:\n  allow_implicit_invocation: true\n  allow_implicit_invocation: false\n`,`${plain}policy:\n  allow_implicit_invocation: true\npolicy:\n  allow_implicit_invocation: true\n`]) {
    assert.equal(check('name: test',yaml).ok,false,yaml)
  }
  assert.equal(check('name: test\ndisable-model-invocation: true',`${plain}# allow_implicit_invocation: false\n`).ok,false,'a comment cannot disable invocation')
})

test('packet rejects changed plan, expired lease, wrong task and unregistered role',t=>{
  const {root,p}=assigned(t)
  const options={host:'codex-cli',root,plan:p,runId:'run',taskId:'T1',pluginRoot}
  assert.match(taskPacket({...options,plan:{...p,revision:2}}).error,/plan changed/)
  assert.match(taskPacket({...options,taskId:'missing'}).error,/task/)
  const ledger=readRun(root,'run').ledger
  assert.match(taskPacket({...options,now:new Date(Date.parse(ledger.tasks.T1.assignment.leaseUntil)+1)}).error,/lease expired/)
  ledger.tasks.T1.assignment.role='../outside'
  writeTree(root,{'.verify/runs/run/ledger.json':JSON.stringify(ledger)})
  assert.match(taskPacket(options).error,/role is not registered/)
})

test('packet CLI reads a current claim and both host results use the existing result validator',t=>{
  const {root,p}=assigned(t)
  writeTree(root,{'plan.json':JSON.stringify(p)})
  const before=readFileSync(join(root,'.verify/runs/run/ledger.json'),'utf8')
  for(const host of ['claude','codex-cli']) {
    const child=spawnSync(process.execPath,[join(pluginRoot,'scripts/hosts/setup.mjs'),'packet','--host',host,'--cwd',root,'--plan','plan.json','--run','run','--task','T1'],{cwd:root,encoding:'utf8',env:childEnv()})
    assert.equal(child.status,0,child.stderr)
    const {packet}=JSON.parse(child.stdout)
    const result={schemaVersion:2,kind:'result',resultId:`result-${host}`,context:packet.context,status:'completed',changedPaths:[],proofs:[],blockers:[],findings:[JSON.stringify({finding:'Missing claim evidence',classification:'UNVERIFIABLE',artifact:'memory/current-state.md',evidence:'No cited source.',confidence:'high'})],summary:'Inspected the assigned claim. Proof still needs lead review.'}
    assert.equal(submitResult(root,'run',p,result).ok,true)
  }
  assert.equal(readFileSync(join(root,'.verify/runs/run/ledger.json'),'utf8'),before)
  const stopped=transitionTask(root,'run',p,{ownerId:'lead',ownerVersion:1,expectedRevision:readRun(root,'run').ledger.revision,taskId:'T1',state:'failed',reason:'Host could not provide read tools.'})
  assert.equal(stopped.ok,true,stopped.error)
  assert.match(taskPacket({host:'codex-cli',root,plan:p,runId:'run',taskId:'T1',pluginRoot}).error,/current claimed or running/)
})

test('setup rejects unsupported surfaces and the CLI never accepts mutations',t=>{
  const root=makeFixture({'keep.txt':'unchanged'}); cleanupAfter(t,root)
  assert.equal(checkSetup({host:'invented',pluginRoot}).ok,false)
  const script=join(pluginRoot,'scripts/hosts/setup.mjs')
  const child=spawnSync(process.execPath,[script,'install','--host','codex-cli'],{cwd:root,encoding:'utf8',env:childEnv()})
  assert.equal(child.status,2)
  assert.deepEqual(readdirSync(root),['keep.txt'])
  const good=spawnSync(process.execPath,[script,'check','--host','codex-cli'],{cwd:root,encoding:'utf8',env:childEnv()})
  assert.equal(good.status,0,good.stderr)
  assert.equal(JSON.parse(good.stdout).runtime.verified,false)
  assert.deepEqual(readdirSync(root),['keep.txt'])
})
