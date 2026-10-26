// Local coordination only. Claim coverage is never a whole-project health score.
import {readFileSync,writeFileSync,mkdirSync,renameSync,unlinkSync,lstatSync,existsSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {runGit} from './git.mjs'
export const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex')
const initial=()=>({schemaVersion:1,revision:0,queue:[],coverage:[],updates:[]})
const check=(condition,message)=>{if(!condition)throw Error(message)}
export function safeIntegrityPath(root,relative,{createParents=false}={}) {
 check(typeof relative==='string' && relative.length<512 && !/[\\:\x00-\x1f]/.test(relative),'invalid relative path')
 const parts=relative.split('/');check(parts.every(p=>p && p!=='.' && p!=='..' && !/[. ]$/.test(p) && !p.includes('~')),'invalid path segment')
 let path=resolve(root);check(lstatSync(path).isDirectory()&&!lstatSync(path).isSymbolicLink(),'root must be a real directory')
 for(let i=0;i<parts.length;i++){path=join(path,parts[i]);if(existsSync(path)){const s=lstatSync(path);check(!s.isSymbolicLink(),'linked path refused');if(i<parts.length-1)check(s.isDirectory(),'parent is not a directory')}else if(createParents&&i<parts.length-1)mkdirSync(path)}
 return path
}
const read=(root,file,fallback)=>{const p=safeIntegrityPath(root,file);return existsSync(p)?JSON.parse(readFileSync(p,'utf8')):fallback}
export function readIntegrityState(root){const s=read(root,'.verify/integrity/state.json',initial());check(s.schemaVersion===1&&Array.isArray(s.queue)&&Array.isArray(s.coverage)&&Array.isArray(s.updates),'invalid integrity state');return s}
function localQueueStorage(root){
 // No Git process runs for a project without a Git marker. Existing tracked or
 // unignored outputs fail closed. Sentinels cover each future output family.
 let current=resolve(root),hasGit=false
 while(true){if(existsSync(join(current,'.git'))){hasGit=true;break}const parent=dirname(current);if(parent===current)break;current=parent}
 if(!hasGit)return true
 const exposed=runGit(['ls-files','--cached','--others','--exclude-standard','-z','--','.verify/integrity'],{cwd:root,timeout:150})
 if(!exposed.ok||exposed.stdout.length)return false
 const probes=['config.json','state.json','state.lock','context.json','telemetry.json','telemetry/__compound_memory_probe__.json','continuity.json','continuity.lock','continuity-inputs/__compound_memory_probe__.json','continuity-proposals/__compound_memory_probe__.json','status-line-owner.json','runs/__compound_memory_probe__/report.json','runs/__compound_memory_probe__/snapshot/file.txt','checkpoints/__compound_memory_probe__.json','backups/__compound_memory_probe__/file.json'].map(p=>'.verify/integrity/'+p)
 const ignored=runGit(['check-ignore','--',...probes],{cwd:root,timeout:150})
 if(!ignored.ok)return false
 const paths=new Set(ignored.stdout.split(/\r?\n/).filter(Boolean));return probes.every(p=>paths.has(p))
}
const validQueueFlag=c=>c?.schemaVersion===1&&c.enabled===true&&Number.isSafeInteger(c.cooldownMs)&&c.cooldownMs>=0&&c.cooldownMs<=86400000
export function integrityQueueRequested(root){return validQueueFlag(read(root,'.verify/integrity/config.json',null))}
export function integrityConfig(root){const c=read(root,'.verify/integrity/config.json',null);return validQueueFlag(c)&&localQueueStorage(root)?c:{schemaVersion:1,enabled:false,cooldownMs:60000}}
export function writeIntegrityFile(root,file,value){const p=safeIntegrityPath(root,file,{createParents:true});const tmp=p+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});renameSync(tmp,p)}
export function withIntegrityLock(root,action){const p=safeIntegrityPath(root,'.verify/integrity/state.lock',{createParents:true});let fd=false;try{writeFileSync(p,JSON.stringify({pid:process.pid,createdAt:Date.now()}),{flag:'wx'});fd=true;return action()}finally{if(fd)unlinkSync(p)}}
export function recoverIntegrityLock(root,{authorized=false,now=Date.now(),minAgeMs=300000}={}) {
 check(authorized===true,'explicit lock recovery authority required');const p=safeIntegrityPath(root,'.verify/integrity/state.lock');if(!existsSync(p))return {recovered:false}
 const original=readFileSync(p,'utf8'),lock=JSON.parse(original);check(Number.isSafeInteger(lock.pid)&&lock.pid>0&&Number.isSafeInteger(lock.createdAt)&&now-lock.createdAt>=minAgeMs,'lock is not stale')
 let alive=true;try{process.kill(lock.pid,0)}catch(error){if(error.code==='ESRCH')alive=false}
 check(!alive,'writer may still be alive');check(readFileSync(p,'utf8')===original,'lock changed during recovery');unlinkSync(p);return {recovered:true}
}
export function mutateIntegrityState(root,fn){return withIntegrityLock(root,()=>{const state=readIntegrityState(root);const result=fn(state);state.revision++;writeIntegrityFile(root,'.verify/integrity/state.json',state);return result})}
export function configureIntegrity(root,{enabled=false,cooldownMs=60000}={}){check(typeof enabled==='boolean'&&Number.isSafeInteger(cooldownMs)&&cooldownMs>=0&&cooldownMs<=86400000,'invalid queue config');if(enabled)check(localQueueStorage(root),'ignore .verify/ and keep the queue flag untracked before enabling it');const config={schemaVersion:1,enabled,cooldownMs};withIntegrityLock(root,()=>writeIntegrityFile(root,'.verify/integrity/config.json',config));return config}
const short=x=>typeof x==='string'&&x.length>0&&x.length<=500&&!/[\x00-\x1f]/.test(x)
export function markIntegrityDue(root,{target='memory',branch='unknown',reason,origin='lead',now=Date.now()}={}) {
 if(!integrityConfig(root).enabled||origin==='integrity'||origin==='repair')return {queued:false,reason:'disabled or recursive'}
 check([target,branch,reason,origin].every(short)&&Number.isSafeInteger(now),'invalid due event')
 return mutateIntegrityState(root,s=>{let q=s.queue.find(q=>q.target===target&&q.branch===branch);if(!q){check(s.queue.length<100,'queue limit reached');q={id:randomUUID(),target,branch,reasons:[],status:'due',generation:0,lastAttempt:null,lastSuccess:null,lease:null};s.queue.push(q)}
 const newReason=!q.reasons.includes(reason);if(newReason){q.reasons.push(reason);q.reasons=q.reasons.slice(-10)}if(newReason||q.status==='done')q.generation++;q.dueAt=now;if(q.status!=='running')q.status='due';return {queued:true,id:q.id}})
}
export function inspectCoverage(root){const state=readIntegrityState(root);return {schemaVersion:1,claims:state.coverage.map(c=>{const changed=c.sources.filter(s=>{try{return digest(readFileSync(safeIntegrityPath(root,s.path)))!==s.sha256}catch{return true}});return {...c,state:changed.length?'review-needed':c.checked?'checked':'unchecked',changedSources:changed.map(s=>s.path)}}),basis:'Source hashes and accepted scoped reports; age alone does not prove a claim false.'}}
export function proposeMemoryUpdate(root,{id,files,reason}={}) {
 check(short(id)&&short(reason)&&Array.isArray(files)&&files.length>0&&files.length<=10,'bounded update required')
 const seen=new Set();const proposed=files.map(f=>{check(typeof f.path==='string'&&/^memory\/.+\.md$/.test(f.path)&&!seen.has(f.path.toLowerCase()),'canonical memory path required');seen.add(f.path.toLowerCase());check(typeof f.content==='string'&&Buffer.byteLength(f.content)<=16000,'memory content limit exceeded');const path=safeIntegrityPath(root,f.path);return {path:f.path,before:existsSync(path)?digest(readFileSync(path)):null,content:f.content,after:digest(f.content)}})
 const p={schemaVersion:1,kind:'memory-update',id,reason,files:proposed};return {...p,fingerprint:digest(p)}
}
export function applyMemoryUpdate(root,proposal,{authorized=false}={}) {
 check(authorized===true,'explicit memory write authority required');const {fingerprint,...body}=proposal;check(fingerprint===digest(body)&&body.kind==='memory-update','changed proposal')
 // Re-parse all proposed paths before entering the write transaction.
 const validated=proposeMemoryUpdate(root,body);check(validated.files.length===body.files.length&&body.files.every(f=>f.after===digest(f.content)),'invalid proposal')
 return mutateIntegrityState(root,state=>{const prior=state.updates.find(u=>u.id===body.id);if(prior){check(prior.fingerprint===fingerprint,'update id reused');return {applied:false,repeated:true}}
 for(const f of body.files){const p=safeIntegrityPath(root,f.path);check((existsSync(p)?digest(readFileSync(p)):null)===f.before,'memory changed since proposal')}
 // Backups precede writes. A failed transaction leaves recoverable original bytes.
 const backupId=randomUUID();for(const f of body.files){const p=safeIntegrityPath(root,f.path);writeIntegrityFile(root,`.verify/integrity/backups/${backupId}/${digest(f.path)}.json`,{path:f.path,content:existsSync(p)?readFileSync(p,'utf8'):null})}
 for(const f of body.files){const p=safeIntegrityPath(root,f.path,{createParents:true});const tmp=p+'.'+randomUUID()+'.tmp';writeFileSync(tmp,f.content,{flag:'wx'});renameSync(tmp,p)}
 state.updates.push({id:body.id,fingerprint,backupId});state.updates=state.updates.slice(-500);return {applied:true,repeated:false,backupId}})
}
