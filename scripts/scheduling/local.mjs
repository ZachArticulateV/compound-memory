#!/usr/bin/env node
// Explicit local polling with one run lease and short metadata transactions.
import {existsSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync,lstatSync,mkdtempSync,renameSync,rmSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {randomUUID} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {prepareIntegrity,validateIntegrityReport} from '../agents/memory-integrity.mjs'
import {runInspection} from '../hosts/inspection.mjs'
import {safeIntegrityPath,digest} from '../lib/integrity-state.mjs'
const check=(condition,message)=>{if(!condition)throw Error(message)}
function paths(root,id,{create=false}={}){check(/^[a-z][a-z0-9-]{0,48}$/.test(id),'invalid schedule id');const file=safeIntegrityPath(root,`.verify/schedules/${id}.json`,{createParents:create});return {file,dir:dirname(file),lock:join(dirname(file),id+'.lock'),meta:join(dirname(file),id+'.meta.lock')}}
function read(file){const stat=lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=262144,'schedule file must be a bounded regular file');return JSON.parse(readFileSync(file,'utf8'))}
function save(file,value){if(existsSync(file))check(!lstatSync(file).isSymbolicLink(),'schedule output must not be a link');const temp=file+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});try{renameSync(temp,file)}finally{if(existsSync(temp))unlinkSync(temp)}}
function metadata(root,id,action){const {meta}=paths(root,id);let held=false;try{const fd=openSync(meta,'wx');held=true;try{writeFileSync(fd,JSON.stringify({pid:process.pid,token:randomUUID(),startedAt:Date.now()}))}finally{closeSync(fd)}return action()}finally{if(held)unlinkSync(meta)}}
export {metadata as withScheduleMetadata}
export function validateSchedule(root,id,job,{now}={}) {
 check(job?.schemaVersion===1&&job.owner==='compound-memory'&&job.id===id&&job.root===resolve(root),'schedule identity changed')
 check(['claude','codex'].includes(job.host)&&typeof job.enabled==='boolean','invalid schedule host or enabled state')
 check(Number.isSafeInteger(job.intervalMs)&&job.intervalMs>=60000&&job.intervalMs<=31536000000&&Number.isSafeInteger(job.timeoutMs)&&job.timeoutMs>=1&&job.timeoutMs<=600000&&Number.isSafeInteger(job.maxOutputBytes)&&job.maxOutputBytes>=1&&job.maxOutputBytes<=4194304,'invalid schedule budget')
 check(Array.isArray(job.paths)&&job.paths.length>0&&job.paths.length<=80&&new Set(job.paths).size===job.paths.length,'invalid schedule paths');for(const path of job.paths)safeIntegrityPath(root,path)
 check(Array.isArray(job.claims)&&job.claims.length>0&&job.claims.length<=20,'invalid schedule claims');const ids=new Set()
 for(const c of job.claims){check(c&&typeof c.id==='string'&&c.id.length>0&&c.id.length<=100&&!ids.has(c.id)&&typeof c.claim==='string'&&c.claim.trim()&&c.claim.length<=4000&&job.paths.includes(c.artifact)&&Array.isArray(c.sources)&&c.sources.length<=20&&c.sources.every(p=>job.paths.includes(p)),'invalid schedule claim');ids.add(c.id)}
 for(const k of ['lastAttempt','lastSuccess'])check(job[k]===null||(Number.isSafeInteger(job[k])&&job[k]>=0&&(now===undefined||job[k]<=now)),`invalid schedule ${k}`)
 check(typeof job.lastStatus==='string'&&job.lastStatus.length<=100,'invalid schedule status')
 check(job.reports===undefined||(Array.isArray(job.reports)&&job.reports.length<=10&&job.reports.every(r=>r&&typeof r.path==='string'&&r.path.startsWith(id+'-report-')&&!r.path.includes('/')&&!r.path.includes('\\')&&/^[a-f0-9]{64}$/.test(r.sha256))),'invalid report retention index');return job
}
export function readSchedule(root,id){return validateSchedule(root,id,read(paths(root,id).file))}
export function configureSchedule(root,options){const {id,host,paths:scope,claims,intervalMs=86400000,timeoutMs=240000,maxOutputBytes=2097152}=options
 const value={schemaVersion:1,owner:'compound-memory',id,root:resolve(root),host,paths:scope,claims,intervalMs,timeoutMs,maxOutputBytes,enabled:false,lastAttempt:null,lastSuccess:null,lastStatus:'never-run',reports:[]}
 validateSchedule(root,id,value);const {file}=paths(root,id,{create:true});metadata(root,id,()=>writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'}));return value
}
export function setScheduleEnabled(root,id,enabled){check(typeof enabled==='boolean','enabled must be boolean');return metadata(root,id,()=>{const {file}=paths(root,id),value=readSchedule(root,id);value.enabled=enabled;save(file,value);return value})}
export function removeSchedule(root,id){return metadata(root,id,()=>{const {file,lock}=paths(root,id);check(!existsSync(lock),'pause and wait for the active run before removal');readSchedule(root,id);unlinkSync(file);return {removed:id}})}
function alive(pid){try{process.kill(pid,0);return true}catch(error){return error.code!=='ESRCH'}}
function acquire(root,id,now){return metadata(root,id,()=>{const p=paths(root,id),job=validateSchedule(root,id,read(p.file),{now});if(!job.enabled)return {status:'paused'}
 if(existsSync(p.lock)){
  const stat=lstatSync(p.lock);check(!stat.isSymbolicLink()&&stat.isFile(),'invalid schedule lock path');let prior;try{prior=read(p.lock)}catch{}
  if(prior?.executionStarted===true||prior?.cancellationUnconfirmed===true)return {status:'busy',reason:'Prior execution has no confirmed lease release; inspect it before recovery.'}
  const validPid=Number.isSafeInteger(prior?.pid)&&prior.pid>0
  if(validPid&&alive(prior.pid))return {status:'busy'}
  const since=Number.isSafeInteger(prior?.startedAt)?prior.startedAt:stat.mtimeMs;if(now-since<job.timeoutMs)return {status:'busy'}
  // Acquisition and reclaim hold the same metadata lock. Never steal a live PID.
  unlinkSync(p.lock)
 }
 if(job.lastAttempt!==null&&now-job.lastAttempt<job.intervalMs)return {status:'not-due'}
 const token=randomUUID();writeFileSync(p.lock,JSON.stringify({pid:process.pid,startedAt:now,token}),{flag:'wx'})
 try{job.lastAttempt=now;job.lastStatus='running';save(p.file,job)}catch(error){unlinkSync(p.lock);throw error}
 return {status:'claimed',job,token}
})}
function release(root,id,token){metadata(root,id,()=>{const {lock}=paths(root,id);if(existsSync(lock)&&read(lock).token===token)unlinkSync(lock)})}
function cleanSnapshot(path){if(!path)return;check(dirname(resolve(path))===resolve(tmpdir())&&resolve(path).startsWith(join(resolve(tmpdir()),'compound-memory-schedule-')),'unexpected snapshot cleanup root')
 const noLinks=p=>{check(!lstatSync(p).isSymbolicLink(),'linked snapshot retained');for(const child of readdirSync(p,{withFileTypes:true})){const full=join(p,child.name);check(!child.isSymbolicLink(),'linked snapshot retained');if(child.isDirectory())noLinks(full)}};noLinks(path);rmSync(path,{recursive:true,force:true})
}
function saveResult(root,id,token,result){return metadata(root,id,()=>{const {file,dir,lock}=paths(root,id);check(read(lock).token===token,'run lease changed');const current=readSchedule(root,id)
 const name=`${id}-report-${result.at}-${token}.json`,report={schemaVersion:1,owner:'compound-memory',scheduleId:id,runToken:token,...result};save(join(dir,name),report)
 const reports=[...(current.reports??[]),{path:name,sha256:digest(readFileSync(join(dir,name)))}]
 while(reports.length>10){const old=reports.shift(),p=join(dir,old.path);if(existsSync(p)&&!lstatSync(p).isSymbolicLink()&&digest(readFileSync(p))===old.sha256)unlinkSync(p)}
 current.reports=reports;current.lastStatus=result.status;if(result.status==='completed')current.lastSuccess=result.at;save(file,current)
})}
export async function tickSchedule(root,id,{now=Date.now(),run}={}) {
 check(Number.isSafeInteger(now)&&now>=0,'invalid schedule clock');const claim=acquire(root,id,now);if(claim.status!=='claimed')return claim
 const {job,token}=claim;let result,snapshotDir,settled=true,retainLease=false
 try{
  snapshotDir=mkdtempSync(join(tmpdir(),'compound-memory-schedule-'))
  const bundle=prepareIntegrity({root,paths:job.paths,claims:job.claims,destination:join(snapshotDir,'snapshot'),readMethod:job.host==='codex'?'readonly-commands':'file-tools',dueReasons:['scheduled interval'],lastCoverage:null})
  const runner=run??(async({bundle,signal})=>runInspection({host:job.host,root:bundle.snapshot.destination,prompt:bundle.prompt,timeoutMs:job.timeoutMs,maxOutputBytes:job.maxOutputBytes,signal,retainRuntime:false}))
  // Persist the fence before any child can start. A later disk or metadata-lock
  // failure cannot turn an unknown live child into a reclaimable dead-owner run.
  metadata(root,id,()=>{const {lock}=paths(root,id),prior=read(lock);check(prior.token===token,'run lease changed before execution');save(lock,{...prior,executionStarted:true})})
  const controller=new AbortController();let timer;settled=false
  const work=Promise.resolve().then(()=>runner({bundle,job,signal:controller.signal}));const settlement=work.then(()=>{settled=true},error=>{settled=true;if(error?.stopped===false)retainLease=true})
  let response
  try{response=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('schedule runtime exceeded'))},job.timeoutMs)})])}
  catch(error){controller.abort();if(!settled){let grace;await Promise.race([settlement,new Promise(r=>{grace=setTimeout(r,6500)})]).finally(()=>clearTimeout(grace))}retainLease=retainLease||!settled||error?.stopped===false;throw error}
  finally{clearTimeout(timer)}
  check(Buffer.byteLength(JSON.stringify(response.report))<=32768,'schedule report exceeds limit')
  const validation=validateIntegrityReport({bundle,report:response.report,sentPrompt:response.sentPrompt});check(validation.ok,validation.problems.join('; '))
  result={status:validation.coverage.unchecked?'partial':'completed',at:now,bundleId:bundle.bundleId,snapshotFingerprint:bundle.snapshot.fingerprint,sourceFiles:bundle.snapshot.files.map(f=>({path:f.source,sha256:f.sha256})),report:response.report,coverage:validation.coverage,host:job.host,model:response.model??null,usage:response.usage??null,elapsedMs:response.elapsedMs??null}
 }catch(error){result={status:'failed',at:now,error:error.message,cancellationUnconfirmed:retainLease}}
 finally{
  try{saveResult(root,id,token,result)}catch(error){result={status:'failed',at:now,error:`Could not save schedule result: ${error.message}`,cancellationUnconfirmed:retainLease}}
  finally{try{if(!retainLease)release(root,id,token);else metadata(root,id,()=>{const {lock}=paths(root,id),prior=read(lock);if(prior.token===token)save(lock,{...prior,cancellationUnconfirmed:true})})}finally{if(settled&&!retainLease)try{cleanSnapshot(snapshotDir)}catch(error){result.cleanupWarning=error.message}}}
 }
 return result
}
export async function main(argv=process.argv.slice(2)){
 const [action,root,id,...extra]=argv
 try{
  if(action==='--help'){console.log('local.mjs configure <root> <config.json> | enable|pause|remove|tick|serve <root> <id>\nserve polls once per minute while this process runs. No OS job is installed. Ten untouched reports are retained. An unconfirmed cancellation blocks retry.');return 0}
  if(!root||!id||extra.length)throw Error('invalid schedule arguments; use --help');let result
  if(action==='configure')result=configureSchedule(root,JSON.parse(readFileSync(id,'utf8')))
  else if(action==='enable'||action==='pause')result=setScheduleEnabled(root,id,action==='enable')
  else if(action==='remove')result=removeSchedule(root,id)
  else if(action==='tick')result=await tickSchedule(root,id)
  else if(action==='serve'){let stop=false;process.once('SIGINT',()=>{stop=true});process.once('SIGTERM',()=>{stop=true});while(!stop){result=await tickSchedule(root,id);if(result.status==='paused')break;if(!['not-due','busy'].includes(result.status))console.log(JSON.stringify(result));if(!stop)await new Promise(r=>setTimeout(r,60000))}return 0}
  else throw Error('unknown schedule action')
  console.log(JSON.stringify(result,null,2));return ['failed','partial'].includes(result.status)?1:0
 }catch(error){console.error(error.message);return 2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main()
