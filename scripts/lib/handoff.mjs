// Explicit, bounded handoff transport. Data does not grant access or prove that
// another process stopped. Export seals one store; disconnected copies still
// require host-verified stop evidence. Imports never stage or commit files.
import {createHash,randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,realpathSync,writeFileSync,renameSync,unlinkSync,chmodSync} from 'node:fs'
import {dirname,join,resolve,isAbsolute} from 'node:path'
import {headOf,branchOf,isGitCheckout} from './changes.mjs'
import {planFingerprint} from './plan-contract.mjs'
import {readRun,sealRunExport,validateRunExport,checkRunImport,restoreRunExport,inspectRun} from './run-state.mjs'
import {auditWorkerWorkspace} from '../agents/workspaces.mjs'

const ensure=(value,message)=>{if(!value)throw Error(message)}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const digest=value=>hash(canonical(value))
const wrap=fn=>{try{return fn()}catch(error){return {ok:false,error:error.message}}}
const privatePath=path=>path.split('/').some(p=>/^(?:\.git|node_modules|\.ssh|\.aws|\.codex|\.npmrc|\.netrc|\.pypirc|settings\.local\.json|\.env(?:\..*)?|credentials(?:\..*)?|secrets?(?:\..*)?)$/i.test(p))||/\.(?:pem|key|p12|pfx)$/i.test(path)
const runtime=path=>/^\.verify(?:\/|$)/i.test(path)
const under=(path,scope)=>scope==='.'||path.toLowerCase()===scope.toLowerCase()||path.toLowerCase().startsWith(`${scope.toLowerCase()}/`)
const scoped=(path,plan)=>plan.tasks.some(t=>t.paths.some(p=>under(path,p)))
function literal(path){ensure(typeof path==='string'&&path&&!isAbsolute(path)&&!/[\\:\x00-\x1f*?\[\]~]/.test(path)&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p)),'handoff requires a plain relative path');return path}
function noLinks(path){let next=resolve(path);while(true){if(existsSync(next))ensure(!lstatSync(next).isSymbolicLink(),'linked paths are not allowed');const parent=dirname(next);if(parent===next)break;next=parent}return resolve(path)}
function rootPath(root){const path=realpathSync(noLinks(root));ensure(lstatSync(path).isDirectory(),'root must be a directory');return path}
function fileAt(root,path){return noLinks(join(root,literal(path)))}
function read(root,path){const file=fileAt(root,path);if(!existsSync(file))return null;const stat=lstatSync(file);ensure(stat.isFile(),'handoff input is not a regular file');ensure(stat.size<=2_000_000,'handoff file exceeds 2 MB');const bytes=readFileSync(file);const after=lstatSync(file);ensure(stat.size===after.size&&stat.mtimeMs===after.mtimeMs&&stat.ino===after.ino,'handoff input changed while reading');return {bytes,mode:stat.mode&0o777}}
const description=(value,include=false)=>({sha256:value?hash(value.bytes):null,mode:value?.mode??null,...(include?{bytes:value?value.bytes.toString('base64'):null}:{})})
const same=(a,b)=>a.sha256===b.sha256&&(a.sha256===null||process.platform==='win32'||a.mode===b.mode)
function git(root,args){const env={...process.env,GIT_TERMINAL_PROMPT:'0'};delete env.NODE_TEST_CONTEXT;return execFileSync('git',['--literal-pathspecs',...args],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:12_000_000})}
function gitEntries(root,head){const base=new Map(),index=new Map();if(head)for(const item of git(root,['ls-tree','-rz','--full-tree','HEAD']).toString('utf8').split('\0').filter(Boolean)){const match=/^(\d+) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(item);ensure(match,'unsupported Git tree entry');base.set(match[3],{mode:parseInt(match[1],8)&0o777,object:match[2]})}for(const item of git(root,['ls-files','--stage','-z']).toString('utf8').split('\0').filter(Boolean)){const match=/^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/.exec(item);ensure(match&&match[3]==='0','unresolved Git index needs review before export');index.set(match[4],{mode:parseInt(match[1],8)&0o777,object:match[2]})}return {base,index}}
function treePaths(root,plan){
  const paths=[]
  function walk(dir=''){for(const entry of readdirSync(noLinks(join(root,dir)),{withFileTypes:true})){const path=dir?`${dir}/${entry.name}`:entry.name;if(runtime(path)||privatePath(path))continue;if(!scoped(path,plan)&&!plan.tasks.some(t=>t.paths.some(p=>under(p,path))))continue;literal(path);ensure(!entry.isSymbolicLink(),'linked task inputs cannot be exported');if(entry.isDirectory())walk(path);else {ensure(entry.isFile(),'non-regular task input');paths.push(path);ensure(paths.length<=5000,'handoff file count exceeds 5000')}}}
  walk();return paths
}
function captureCheckout(root,plan,ledger,options){
  const selected=new Set((options.workPaths??[]).map(literal))
  for(const path of selected)ensure(scoped(path,plan)&&!runtime(path)&&!privatePath(path),'work path is private or outside task scope')
  const hasGit=isGitCheckout(root),head=headOf(root)
  const entries=hasGit?gitEntries(root,head):{base:new Map(),index:new Map()}
  const paths=new Set([...treePaths(root,plan),...entries.base.keys(),...entries.index.keys()].filter(path=>scoped(path,plan)&&!runtime(path)))
  const overrides=new Map(),workers=[]
  for(const [taskId,state] of Object.entries(ledger.tasks))if(state.assignment&&state.state!=='accepted'&&rootPath(state.assignment.workspace)!==root){
    const manifestPath=options.workspaceManifests?.[taskId]
    ensure(typeof manifestPath==='string',`unfinished external worker ${taskId} needs its workspace manifest`)
    const manifest=JSON.parse(readFileSync(noLinks(manifestPath),'utf8'))
    ensure(manifest.root===root&&manifest.workspace===rootPath(state.assignment.workspace),'worker manifest belongs to another assignment')
    ensure(canonical([...manifest.paths].sort())===canonical([...plan.tasks.find(t=>t.id===taskId).paths].sort()),'worker manifest scope differs from task')
    const audit=auditWorkerWorkspace(manifest);ensure(audit.ok,audit.error)
    for(const path of audit.changedPaths){ensure(!overrides.has(path),'unfinished worker paths overlap');const base=manifest.files.find(f=>f.path===path);const source=read(root,path);ensure((source?hash(source.bytes):null)===(base?.sha256??null),'source changed under unfinished worker');paths.add(path);overrides.set(path,read(manifest.workspace,path))}
    workers.push({taskId,manifestPath,workspace:manifest.workspace,fingerprint:audit.fingerprint})
  }
  let total=0
  const blob=entry=>entry?{bytes:git(root,['cat-file','blob',entry.object]),mode:entry.mode}:null
  const files=[...paths].sort().map(path=>{
    literal(path);ensure(!privatePath(path),`private task input cannot be transported: ${path}`)
    const source=read(root,path),current=overrides.has(path)?overrides.get(path):source,base=blob(entries.base.get(path)),index=blob(entries.index.get(path))
    for(const value of [source,current,base,index])if(value){ensure(value.bytes.length<=2_000_000,'handoff file exceeds 2 MB');total+=value.bytes.length}
    ensure(total<=20_000_000,'handoff source budget exceeds 20 MB')
    return {path,included:selected.has(path),tasks:plan.tasks.filter(t=>t.paths.some(p=>under(path,p))).map(t=>t.id),base:description(base),source:description(source),current:{...description(current),bytes:selected.has(path)&&current?current.bytes.toString('base64'):null},index:{...description(index),bytes:selected.has(path)&&index?index.bytes.toString('base64'):null}}
  })
  ensure(files.length<=5000,'handoff file count exceeds 5000')
  for(const path of selected)ensure(files.some(f=>f.path===path),`work path does not exist: ${path}`)
  return {kind:hasGit?'git':'files',head,branch:hasGit?branchOf(root):null,files,workers}
}
function proofFiles(root,ledger,include){
  const wanted=new Set()
  const inbox=join(root,'.verify','runs',ledger.runId,'inbox')
  for(const file of readdirSync(noLinks(inbox)).filter(n=>n.endsWith('.json'))){const receipt=JSON.parse(readFileSync(noLinks(join(inbox,file)),'utf8'));for(const path of receipt.result?.proofs??[])wanted.add(path)}
  for(const gate of Object.values(ledger.gates))for(const path of gate.proofs)wanted.add(path)
  for(const path of ledger.integration.proofs)wanted.add(path)
  const files=[],missing=[];let total=0
  for(const path of wanted){literal(path);ensure(/^\.verify\/(?:proofs|evidence)\//.test(path),'proof path is outside evidence storage');if(!include||!existsSync(fileAt(root,path))){missing.push(path);continue}const record=read(root,path);const parsed=JSON.parse(record.bytes.toString('utf8'));const paths=[path,...(parsed.outputs??[]).map(o=>o.path)];for(const rel of paths){literal(rel);ensure(/^\.verify\/(?:proofs|evidence)\//.test(rel),'proof output path is outside evidence storage');if(files.some(f=>f.path===rel))continue;const data=read(root,rel);if(!data){missing.push(rel);continue}total+=data.bytes.length;ensure(total<=12_000_000&&files.length<2000,'optional proof budget exceeded');files.push({path:rel,sha256:hash(data.bytes),bytes:data.bytes.toString('base64')})}}
  return {included:include,files,missing:[...new Set(missing)].sort()}
}
const bundleHash=bundle=>digest(Object.fromEntries(Object.entries(bundle).filter(([key])=>key!=='sha256')))
function validDescription(value,bytes=false){ensure(value&&typeof value==='object'&&(value.sha256===null||/^[a-f0-9]{64}$/.test(value.sha256))&&(value.mode===null||Number.isInteger(value.mode)&&value.mode>=0&&value.mode<=511),'invalid handoff file hash or mode');if(bytes){ensure(value.bytes===null||typeof value.bytes==='string','invalid handoff bytes');if(value.bytes!==null){const decoded=Buffer.from(value.bytes,'base64');ensure(decoded.toString('base64')===value.bytes&&hash(decoded)===value.sha256&&decoded.length<=2_000_000,'handoff bytes do not match their hash')}}}
function validateBundle(bundle,plan){
  ensure(bundle?.schemaVersion===1&&bundle.kind==='portable-handoff'&&bundle.sha256===bundleHash(bundle),'invalid or changed handoff bundle')
  ensure(Buffer.byteLength(JSON.stringify(bundle))<=40_000_000,'handoff bundle exceeds 40 MB')
  const state=validateRunExport(bundle.state);ensure(state.ok,state.error)
  ensure(planFingerprint(plan)===bundle.state.ledger.planFingerprint,'handoff plan differs from the requested plan')
  ensure(['claude','codex'].includes(bundle.sourceHost)&&['claude','codex'].includes(bundle.targetHost),'unsupported handoff host')
  ensure(bundle.checkout&&['git','files'].includes(bundle.checkout.kind)&&Array.isArray(bundle.checkout.files)&&bundle.checkout.files.length<=5000,'invalid checkout manifest')
  const paths=new Set()
  for(const file of bundle.checkout.files){literal(file.path);ensure(!privatePath(file.path)&&!runtime(file.path)&&scoped(file.path,plan),'handoff path is private or outside scope');ensure(!paths.has(file.path.toLowerCase()),'duplicate or case-aliased handoff path');paths.add(file.path.toLowerCase());for(const key of ['base','source'])validDescription(file[key]);for(const key of ['current','index'])validDescription(file[key],true);ensure(typeof file.included==='boolean'&&(file.included||file.current.bytes===null&&file.index.bytes===null),'invalid work inclusion flag');ensure(canonical(file.tasks)===canonical(plan.tasks.filter(t=>t.paths.some(p=>under(file.path,p))).map(t=>t.id)),'handoff path has wrong task mapping')}
  ensure(Array.isArray(bundle.evidence?.files)&&bundle.evidence.files.length<=2000,'invalid optional evidence bundle')
  const evidencePaths=new Set()
  for(const file of bundle.evidence.files){literal(file.path);ensure(/^\.verify\/(?:proofs|evidence)\//.test(file.path),'invalid evidence path');ensure(!evidencePaths.has(file.path.toLowerCase()),'duplicate evidence path');evidencePaths.add(file.path.toLowerCase());ensure(typeof file.bytes==='string'&&Buffer.from(file.bytes,'base64').toString('base64')===file.bytes&&hash(Buffer.from(file.bytes,'base64'))===file.sha256,'evidence bytes changed')}
}

/** A deliberate handoff action. Missing work bytes remain named gaps. */
export function exportHandoff(root,runId,plan,options={}){
  return wrap(()=>{
    root=rootPath(root)
    ensure(['claude','codex'].includes(options.sourceHost)&&['claude','codex'].includes(options.targetHost),'sourceHost and targetHost must name claude or codex')
    ensure(typeof options.destination==='string','destination is required')
    const destination=noLinks(resolve(options.destination));ensure(!existsSync(destination),'handoff destination already exists')
    ensure(existsSync(dirname(destination))&&lstatSync(dirname(destination)).isDirectory(),'handoff destination parent must exist')
    const current=readRun(root,runId);ensure(current.ok,current.error)
    const checkout=captureCheckout(root,plan,current.ledger,options),evidence=proofFiles(root,current.ledger,options.includeProofs===true)
    const transferId=randomUUID()
    // A second scan prevents a moving worker or source from becoming the
    // snapshot. This is a stale-data check, not an adversarial OS lock.
    ensure(digest(checkout)===digest(captureCheckout(root,plan,current.ledger,options)),'source or worker changed during handoff capture')
    const sealed=sealRunExport(root,runId,plan,{...options,transferId});ensure(sealed.ok,sealed.error)
    const bundle={schemaVersion:1,kind:'portable-handoff',sourceHost:options.sourceHost,targetHost:options.targetHost,created:new Date(options.now??new Date()).toISOString(),sourceRoot:root,state:sealed.state,checkout,evidence}
    bundle.sha256=bundleHash(bundle)
    // Required transport is retained beside the fenced ledger even if the
    // requested destination becomes unavailable after preflight.
    const recovery=join(root,'.verify','runs',runId,`handoff-${transferId}.json`)
    writeFileSync(noLinks(recovery),`${JSON.stringify(bundle,null,2)}\n`,{flag:'wx'})
    writeFileSync(destination,`${JSON.stringify(bundle,null,2)}\n`,{flag:'wx'})
    return {ok:true,bundle,path:destination,recoveryPath:recovery,missingEdits:checkout.files.filter(f=>!same(f.base,f.current)&&!f.included).map(f=>f.path),ownership:'source fenced; offline copies still need host stop evidence'}
  })
}

/** Read-only reconciliation. No directories, ledger, or source files change. */
export function previewHandoff(root,bundle,plan){
  return wrap(()=>{
    root=rootPath(root);validateBundle(bundle,plan)
    const target=checkRunImport(root,bundle.state,{transportDigest:bundle.sha256});ensure(target.ok,target.error)
    if(target.idempotent)return {ok:true,idempotent:true,ledger:target.ledger,requiredWrites:[],missingEdits:[],conflicts:[],blockedTasks:[]}
    ensure((isGitCheckout(root)?'git':'files')===bundle.checkout.kind,'checkout kind differs from handoff')
    ensure(headOf(root)===bundle.checkout.head,'checkout HEAD differs from handoff; reconcile the base first')
    const requiredWrites=[],missingEdits=[],conflicts=[],blockedTasks=new Set()
    for(const file of bundle.checkout.files){const current=description(read(root,file.path));if(same(current,file.current))continue;if(!same(current,file.base)&&!same(current,file.source)){conflicts.push(file.path);file.tasks.forEach(t=>blockedTasks.add(t));continue}if(!file.included||file.current.sha256!==null&&file.current.bytes===null){missingEdits.push(file.path);file.tasks.forEach(t=>blockedTasks.add(t));continue}requiredWrites.push(file.path)}
    const expected=new Set(bundle.checkout.files.map(f=>f.path.toLowerCase()))
    for(const path of treePaths(root,plan))if(!expected.has(path.toLowerCase())){conflicts.push(path);plan.tasks.filter(t=>t.paths.some(p=>under(path,p))).forEach(t=>blockedTasks.add(t.id))}
    for(const file of bundle.evidence.files){const present=read(root,file.path);if(present&&hash(present.bytes)!==file.sha256)conflicts.push(file.path)}
    const ok=!missingEdits.length&&!conflicts.length
    return {ok,idempotent:false,requiredWrites,missingEdits,conflicts,blockedTasks:[...blockedTasks].sort(),...(ok?{}:{error:conflicts.length?`checkout conflict: ${conflicts.join(', ')}`:`missing required edits: ${missingEdits.join(', ')}`}),proofStatus:'Copied proof is historical. inspectRun must recheck it in the target checkout.'}
  })
}

export function importHandoff(root,bundle,plan,options={}){
  const applied=[]
  try{
    root=rootPath(root)
    const preview=previewHandoff(root,bundle,plan);if(!preview.ok)return preview
    if(preview.idempotent)return preview
    ensure(!preview.requiredWrites.length||options.applyWork===true,'applyWork must be true to restore unfinished files')
    const restored=restoreRunExport(root,bundle.state,plan,{...options,transportDigest:bundle.sha256},()=>{
      const fresh=previewHandoff(root,bundle,plan);ensure(fresh.ok,fresh.error)
      ensure(canonical(fresh.requiredWrites)===canonical(preview.requiredWrites),'checkout changed before handoff import')
      const backupRoot=noLinks(join(root,'.verify','handoff-imports',bundle.state.transferId))
      mkdirSync(backupRoot,{recursive:true})
      for(const path of preview.requiredWrites){
        const file=bundle.checkout.files.find(f=>f.path===path),destination=fileAt(root,path),before=read(root,path)
        const backup=noLinks(join(backupRoot,'before',path));if(before){mkdirSync(noLinks(dirname(backup)),{recursive:true});if(!existsSync(backup))writeFileSync(backup,before.bytes,{flag:'wx'})}
        if(file.current.sha256===null){if(existsSync(destination))unlinkSync(destination)}
        else{mkdirSync(noLinks(dirname(destination)),{recursive:true});const temporary=noLinks(`${destination}.handoff-${bundle.state.transferId}`);writeFileSync(temporary,Buffer.from(file.current.bytes,'base64'),{flag:'wx'});renameSync(temporary,destination);chmodSync(destination,file.current.mode)}
        applied.push(path)
      }
      for(const file of bundle.evidence.files){const destination=fileAt(root,file.path);if(!existsSync(destination)){mkdirSync(noLinks(dirname(destination)),{recursive:true});writeFileSync(destination,Buffer.from(file.bytes,'base64'),{flag:'wx'})}}
      writeFileSync(noLinks(join(backupRoot,'receipt.json')),`${JSON.stringify({transferId:bundle.state.transferId,bundleSha256:bundle.sha256,applied,staging:'Git index was not changed.'},null,2)}\n`)
    })
    if(!restored.ok)return {...restored,applied,recovery:'Retain the bundle and .verify/handoff-imports backups. Inspect partial writes before retry.'}
    return {...restored,applied,inspection:inspectRun(root,bundle.state.ledger.runId,plan),staging:'Working files restored. Original index bytes remain in the bundle; no staging or commits were performed.'}
  }catch(error){return {ok:false,error:error.message,applied}}
}
