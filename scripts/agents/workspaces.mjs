// Lead-owned copies and optimistic file integration. Copies are not a security
// boundary. The host must enforce worker access. Failed copies are never removed.
import {createHash,randomUUID} from 'node:crypto'
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,realpathSync,writeFileSync,unlinkSync,chmodSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,join,resolve,relative,isAbsolute} from 'node:path'

const ensure=(value,message)=>{if(!value)throw new Error(message)}
const hash=value=>createHash('sha256').update(value).digest('hex')
const digest=value=>hash(JSON.stringify(value)??'null')
const privatePath=path=>path.split('/').some(p=>/^(?:\.git|node_modules|\.next|\.ssh|\.aws|\.codex|\.npmrc|\.netrc|\.pypirc|settings\.local\.json|\.env(?:\..*)?|credentials(?:\..*)?|secrets?(?:\..*)?)$/i.test(p)) || /\.(?:pem|key|p12|pfx)$/i.test(path)
const generated=path=>/^(?:\.verify|dist|build|coverage)(?:\/|$)/i.test(path)
const owned=(path,paths)=>paths.some(p=>p==='.' || path.toLowerCase()===p.toLowerCase() || path.toLowerCase().startsWith(`${p.toLowerCase()}/`))
function safePath(path) {
  ensure(typeof path==='string' && path && !isAbsolute(path) && !/[\\:\x00-\x1f]/.test(path),'invalid relative file path')
  ensure(path.split('/').every(p=>p && p!=='.' && p!=='..' && !/[. ]$/.test(p) && !p.includes('~')),'ambiguous file path')
  return path
}
function noLinks(path) {
  let current=resolve(path)
  while(true) {
    if(existsSync(current))ensure(!lstatSync(current).isSymbolicLink(),`linked path is not allowed: ${current}`)
    const next=dirname(current);if(next===current)break;current=next
  }
  return resolve(path)
}
function read(root,path) {
  const full=noLinks(join(root,safePath(path)))
  if(!existsSync(full))return null
  const before=lstatSync(full);ensure(before.isFile(),`not a regular file: ${path}`)
  const bytes=readFileSync(full),after=lstatSync(full)
  ensure(before.ino===after.ino && before.dev===after.dev && before.size===after.size && before.mtimeMs===after.mtimeMs,'file changed during read')
  return {bytes,sha256:hash(bytes),mode:before.mode & 0o777}
}
function inventory(root,{maxFiles,maxBytes},source=false) {
  const files=[],skipped=[];let bytes=0
  function walk(dir='') {
    for(const item of readdirSync(noLinks(join(root,dir)),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path=dir?`${dir}/${item.name}`:item.name
      if(source && (privatePath(path)||generated(path))) {skipped.push(path);continue}
      // Proof output is separate from code. It is never merged into the source.
      if(!source && /^\.verify(?:\/|$)/i.test(path))continue
      safePath(path);ensure(!item.isSymbolicLink(),`linked worker path: ${path}`)
      if(item.isDirectory()){walk(path);continue}
      ensure(item.isFile(),`non-regular path: ${path}`)
      const file=read(root,path);bytes+=file.bytes.length
      ensure(files.length<maxFiles && bytes<=maxBytes,'workspace file or byte limit exceeded')
      files.push({path,sha256:file.sha256,bytes:file.bytes.length,mode:file.mode})
    }
  }
  walk();return {files,skipped}
}
const core=manifest=>({schemaVersion:manifest.schemaVersion,kind:manifest.kind,id:manifest.id,root:manifest.root,workspace:manifest.workspace,container:manifest.container,paths:manifest.paths,limits:manifest.limits,files:manifest.files,skipped:manifest.skipped})
function validate(manifest) {
  ensure(manifest?.schemaVersion===1 && manifest.kind==='worker-workspace','invalid workspace manifest')
  ensure(manifest.fingerprint===digest(core(manifest)),'workspace manifest changed')
  ensure(realpathSync(noLinks(manifest.root))===manifest.root && realpathSync(noLinks(manifest.workspace))===manifest.workspace,'workspace roots changed')
  ensure(dirname(manifest.workspace)===manifest.container,'workspace container mismatch')
  const marker=JSON.parse(readFileSync(noLinks(join(manifest.container,'owner.json')),'utf8'))
  ensure(marker.id===manifest.id && marker.fingerprint===manifest.fingerprint,'workspace marker mismatch')
  ensure(resolve(manifest.manifestPath)===join(manifest.root,'.verify','workspaces',manifest.id,'manifest.json'),'manifest path mismatch')
  const saved=JSON.parse(readFileSync(noLinks(manifest.manifestPath),'utf8'))
  ensure(digest(saved)===digest(manifest),'lead manifest differs from supplied copy')
  return manifest
}

export function createWorkerWorkspace({root,paths,maxFiles=5000,maxBytes=50_000_000}={}) {
  root=realpathSync(noLinks(root))
  ensure(Array.isArray(paths) && paths.length>0,'owned paths required')
  paths.forEach(p=>{if(p!=='.')safePath(p);ensure(!privatePath(p)&&!generated(p),'owned path is excluded')})
  ensure(Number.isSafeInteger(maxFiles)&&maxFiles>0&&maxFiles<=20000,'invalid file limit')
  ensure(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=200_000_000,'invalid byte limit')
  const limits={maxFiles,maxBytes},snap=inventory(root,limits,true),id=randomUUID()
  const container=realpathSync(mkdtempSync(join(tmpdir(),'compound-worker-'))),workspace=join(container,'tree')
  mkdirSync(workspace)
  const manifest={schemaVersion:1,kind:'worker-workspace',id,root,workspace,container,paths:[...paths],limits,...snap}
  manifest.fingerprint=digest(core(manifest))
  manifest.manifestPath=join(root,'.verify','workspaces',id,'manifest.json')
  for(const file of snap.files) {
    const input=read(root,file.path);ensure(input.sha256===file.sha256,'source changed while copying')
    const output=join(workspace,file.path);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,input.bytes,{flag:'wx',mode:file.mode})
  }
  mkdirSync(noLinks(dirname(manifest.manifestPath)),{recursive:true})
  writeFileSync(manifest.manifestPath,`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx'})
  writeFileSync(join(container,'owner.json'),JSON.stringify({id,fingerprint:manifest.fingerprint}),{flag:'wx'})
  validateWorkspaceClaim(root,workspace,manifest.manifestPath)
  return manifest
}

/** Used by claimTask. No run-state import, no process or source mutation. */
export function validateWorkspaceClaim(root,workspace,manifestPath) {
  const rel=relative(realpathSync(root),resolve(manifestPath)).replace(/\\/g,'/')
  ensure(/^\.verify\/workspaces\/[a-f0-9-]+\/manifest\.json$/.test(rel),'external workspace requires a lead-owned manifest')
  const manifest=validate(JSON.parse(readFileSync(noLinks(manifestPath),'utf8')))
  ensure(manifest.root===realpathSync(root) && manifest.workspace===realpathSync(workspace),'workspace belongs to another source')
  const current=inventory(manifest.root,manifest.limits,true)
  ensure(digest(current.files)===digest(manifest.files),'source changed before claim')
  ensure(digest(inventory(manifest.workspace,manifest.limits).files)===digest(manifest.files),'worker copy changed before claim')
  return true
}

export function auditWorkerWorkspace(manifest) {
  try {
    validate(manifest)
    const files=inventory(manifest.workspace,manifest.limits).files
    const before=new Map(manifest.files.map(f=>[f.path,f])),after=new Map(files.map(f=>[f.path,f]))
    const changedPaths=[...new Set([...before.keys(),...after.keys()])].filter(p=>digest(before.get(p))!==digest(after.get(p))).sort()
    const forbidden=changedPaths.filter(p=>privatePath(p)||generated(p)||!owned(p,manifest.paths))
    ensure(forbidden.length===0,`changed paths outside ownership: ${forbidden.join(', ')}`)
    return {ok:true,changedPaths,files,fingerprint:digest(files)}
  }catch(error){return {ok:false,error:error.message}}
}

/** Preflight all changes before writing any. New source edits cause a conflict.
 * An I/O failure reports partial writes; backups and the worker copy survive. */
export function integrateWorkerWorkspace(manifest) {
  const applied=[]
  try {
    const audit=auditWorkerWorkspace(manifest);ensure(audit.ok,audit.error)
    const receiptPath=noLinks(join(dirname(manifest.manifestPath),'merge.json'))
    if(existsSync(receiptPath)) {
      const receipt=JSON.parse(readFileSync(receiptPath,'utf8'))
      ensure(receipt.manifestFingerprint===manifest.fingerprint&&receipt.workerFingerprint===audit.fingerprint,'previous merge belongs to different worker bytes')
      for(const path of audit.changedPaths) {
        const source=read(manifest.root,path),target=read(manifest.workspace,path)
        ensure((source?.sha256??null)===(target?.sha256??null)&&(!source||source.mode===target.mode),`source changed after merge: ${path}`)
      }
      return {ok:true,idempotent:true,changedPaths:audit.changedPaths,applied:[],workerFingerprint:audit.fingerprint,workspace:manifest.workspace}
    }
    const before=new Map(manifest.files.map(f=>[f.path,f])),pending=[]
    for(const path of audit.changedPaths) {
      const source=read(manifest.root,path),base=before.get(path)
      ensure((source?.sha256??null)===(base?.sha256??null) && (!source||source.mode===base.mode),`source conflict: ${path}`)
      const target=read(manifest.workspace,path)
      ensure((target?.sha256??null)===(audit.files.find(f=>f.path===path)?.sha256??null),'worker changed during integration')
      pending.push({path,source,target})
    }
    for(const {path,source,target} of pending) {
      const destination=noLinks(join(manifest.root,path))
      const fresh=read(manifest.root,path)
      ensure((fresh?.sha256??null)===(source?.sha256??null)&&(!fresh||fresh.mode===source.mode),`source changed during integration: ${path}`)
      if(source) {
        const backup=join(dirname(manifest.manifestPath),'backup',path);mkdirSync(noLinks(dirname(backup)),{recursive:true})
        if(!existsSync(backup))writeFileSync(backup,source.bytes,{flag:'wx',mode:source.mode})
      }
      if(target){mkdirSync(noLinks(dirname(destination)),{recursive:true});writeFileSync(destination,target.bytes,{flag:source?'w':'wx'});chmodSync(destination,target.mode)}
      else unlinkSync(destination)
      applied.push(path)
    }
    writeFileSync(receiptPath,JSON.stringify({manifestFingerprint:manifest.fingerprint,workerFingerprint:audit.fingerprint,changedPaths:audit.changedPaths},null,2),{flag:'wx'})
    return {ok:true,changedPaths:audit.changedPaths,applied,workerFingerprint:audit.fingerprint,workspace:manifest.workspace}
  }catch(error){return {ok:false,error:error.message,applied,workspace:manifest?.workspace}}
}
