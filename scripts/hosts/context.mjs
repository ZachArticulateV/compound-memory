// Percentages are observations, never model-quality estimates.
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs'
import {resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {digest,safeIntegrityPath,writeIntegrityFile,withIntegrityLock} from '../lib/integrity-state.mjs'
const unknown=reason=>({usedPercentage:null,basis:'unknown',reason})
export function contextReading(observation,{host,sessionId,modelId,epoch,now=Date.now(),maxAgeMs=60000}={}) {
 if(!observation||!['claude','codex'].includes(host))return unknown('No supported telemetry.')
 if(observation.host!==host||observation.sessionId!==sessionId||observation.modelId!==modelId||observation.epoch!==epoch)return unknown('Telemetry identity or epoch differs.')
 if(!Number.isSafeInteger(observation.observedAt)||now-observation.observedAt<0||now-observation.observedAt>maxAgeMs)return unknown('Telemetry is stale or has an invalid time.')
 if(observation.basis!=='host-used-percentage'||!Number.isFinite(observation.usedPercentage)||observation.usedPercentage<0||observation.usedPercentage>100)return unknown('No measured percentage.')
 return {usedPercentage:observation.usedPercentage,basis:observation.basis,reason:null}
}
const empty=()=>({schemaVersion:1,epochs:{},latches:{},last:{}})
function contextState(root){const p=safeIntegrityPath(root,'.verify/integrity/context.json');const s=existsSync(p)?JSON.parse(readFileSync(p,'utf8')):empty();if(s.schemaVersion!==1||!s.epochs||!s.latches)throw Error('invalid context state');s.last??={};return s}
export function contextCheckpoint(root,{host,sessionId,modelId,observation,event=null,now=Date.now(),threshold=50,facts=[],nextStep='',origin='lead'}={}) {
 if(origin==='integrity'||origin==='repair')return {checkpoint:false,reason:'recursive origin'}
 if(!['claude','codex'].includes(host)||![sessionId,modelId].every(x=>typeof x==='string'&&x.length>0&&x.length<200)||!Number.isFinite(threshold)||threshold<1||threshold>100)throw Error('host, session, model and bounded threshold required')
 if(!Array.isArray(facts)||facts.length>10||facts.some(x=>typeof x!=='string'||x.length>300)||typeof nextStep!=='string'||nextStep.length>500)throw Error('checkpoint exceeds bounded facts')
 return withIntegrityLock(root,()=>{
  const state=contextState(root),identity=digest({host,sessionId,modelId});let epoch=state.epochs[identity]??0
  // A post-compaction event starts a new observation epoch. Old telemetry cannot re-trigger it.
  if(event==='post-compact'){epoch++;state.epochs[identity]=epoch;delete state.last[identity];writeIntegrityFile(root,'.verify/integrity/context.json',state);return {checkpoint:false,epoch,reading:unknown('Awaiting post-compaction telemetry.')}}
  let reading=contextReading(observation,{host,sessionId,modelId,epoch,now})
  const last=state.last[identity]
  // A large measured drop is a conservative missing-callback fallback.
  // The epoch is inferred; the percentage retains its host-measured basis.
  if(reading.usedPercentage!==null&&last&&last.used>=threshold&&reading.usedPercentage<=threshold-20&&observation.observedAt>last.at){epoch++;state.epochs[identity]=epoch;state.last[identity]={used:reading.usedPercentage,at:observation.observedAt};writeIntegrityFile(root,'.verify/integrity/context.json',state);return {checkpoint:false,epoch,reading,epochBasis:'measured-drop-fallback'}}
  if(reading.usedPercentage!==null){state.last[identity]={used:reading.usedPercentage,at:observation.observedAt};writeIntegrityFile(root,'.verify/integrity/context.json',state)}
  const key=identity+':'+epoch
  const due=event==='pre-compact'||event==='handoff'||event==='time-fallback'||(reading.usedPercentage!==null&&reading.usedPercentage>=threshold)
  const latch=state.latches[key]??{};const reason=event??'threshold',latchKey=event==='time-fallback'?reason+':'+Math.floor(now/1800000):reason
  if(!due||latch[latchKey])return {checkpoint:false,path:due?latch[latchKey]:undefined,epoch,reading}
  const record={schemaVersion:1,kind:'context-checkpoint',host,sessionId,modelId,epoch,at:now,reading,reason,facts,nextStep,limit:'Advisory continuity checkpoint; no quality claim and no long audit.'}
  if(Buffer.byteLength(JSON.stringify(record))>4096)throw Error('checkpoint byte limit exceeded')
  const path=`.verify/integrity/checkpoints/${randomUUID()}.json`;writeIntegrityFile(root,path,record);latch[latchKey]=path;state.latches[key]=latch;state.epochs[identity]=epoch;writeIntegrityFile(root,'.verify/integrity/context.json',state)
  return {checkpoint:true,path,epoch,reading}
 })
}
const CONTINUITY_MODES=['pending','request','prepare','save']
function permissionPath(path){
 const canonical=realpathSync(path).split(sep).join('/')
 const operators='*?()[]{}"\'`$;|&<>%!#\\'
 if(canonical.length>2000||/[\x00-\x1f\x7f]/.test(canonical)||[...canonical].some(c=>operators.includes(c)))throw Error('unsafe continuity permission path')
 return canonical
}
/** Commands are exact through the project argument; only trailing data args vary. */
export function continuityPermissionRules(root){
 const script=permissionPath(fileURLToPath(new URL('../continuity.mjs',import.meta.url))),project=permissionPath(root)
 const commands=Object.fromEntries(CONTINUITY_MODES.map(mode=>[mode,`node "${script}" ${mode} "${project}"`]))
 const allow=Object.values(commands).map(command=>`Bash(${command} *)`)
 const validator=permissionPath(fileURLToPath(new URL('../memory-validate.mjs',import.meta.url))),inputDirectory=`${project.replace(/\/$/,'')}/.verify/integrity/continuity-inputs`
 commands.validate=`node "${validator}" --json --cwd "${project}"`
 // A double slash anchors Claude file rules at the filesystem root. On Windows
 // its absolute path syntax uses /c/... rather than a drive colon.
 const inputPattern=`/${inputDirectory.replace(/^([A-Za-z]):\//,(_,drive)=>`/${drive.toLowerCase()}/`)}/**`
 allow.push(`Edit(${inputPattern})`,`Bash(${commands.validate})`)
 return {script,root:project,commands,inputDirectory,allow}
}
function validatePermissions(settings){
 if(!Object.hasOwn(settings,'permissions'))return
 const permissions=settings.permissions
 if(!permissions||typeof permissions!=='object'||Array.isArray(permissions))throw Error('incompatible permissions')
 for(const key of ['allow','deny','ask'])if(Object.hasOwn(permissions,key)&&(!Array.isArray(permissions[key])||permissions[key].some(rule=>typeof rule!=='string')))throw Error('incompatible permissions rules')
}
/** Pure settings transform shared by direct removal and migration preview. */
export function removeContinuityPermissions(settings,owner){
 const after=structuredClone(settings),owned=owner.continuityPermissions
 if(!owned)return {settings:after,removed:false}
 if(!Array.isArray(owned.addedAllow)||owned.addedAllow.some(rule=>typeof rule!=='string')||typeof owned.hadPermissions!=='boolean'||typeof owned.hadAllow!=='boolean')throw Error('unsupported continuity permission ownership')
 validatePermissions(after)
 if(!after.permissions||!Object.hasOwn(after.permissions,'allow'))return {settings:after,removed:false}
 const old=after.permissions.allow,keep=old.filter(rule=>!owned.addedAllow.includes(rule))
 after.permissions.allow=keep
 if(!owned.hadAllow&&keep.length===0)delete after.permissions.allow
 if(!owned.hadPermissions&&Object.keys(after.permissions).length===0)delete after.permissions
 return {settings:after,removed:keep.length!==old.length}
}
export function installStatusLine(root,{settingsPath='.claude/settings.local.json',command,authorized=false,inheritedStatusLineAcknowledged=false}={}) {
 if(!authorized) return {installed:false,reason:'Setup declined; context percentage remains unknown.'}
 if(typeof command!=='string'||!command.trim()||command.length>2000)throw Error('bridge command required')
 const ownedPath='.verify/integrity/status-line-owner.json',continuity=continuityPermissionRules(root)
 const readSettings=()=>{const path=safeIntegrityPath(root,settingsPath),settings=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{}
  if(settings===null||Array.isArray(settings)||typeof settings!=='object')throw Error('incompatible settings')
  validatePermissions(settings)
  if(!Object.hasOwn(settings,'statusLine')&&!inheritedStatusLineAcknowledged)throw Error('Inherited project or user status line is unresolved. Explicitly acknowledge its temporary replacement before installing a local bridge.')
  if(settings.statusLine!==undefined&&(settings.statusLine?.type!=='command'||typeof settings.statusLine.command!=='string'))throw Error('incompatible status line')
  const ownerFile=safeIntegrityPath(root,ownedPath)
  if(existsSync(ownerFile)&&!JSON.parse(readFileSync(ownerFile,'utf8')).restored)throw Error('status-line owner already exists; remove before install')
  return settings}
 readSettings() // Refusal writes nothing, including runtime directories.
 return withIntegrityLock(root,()=>{const settings=readSettings()
  const currentAllow=settings.permissions?.allow??[],continuityPermissions={...continuity,addedAllow:continuity.allow.filter(rule=>!currentAllow.includes(rule)),hadPermissions:Object.hasOwn(settings,'permissions'),hadAllow:Object.hasOwn(settings.permissions??{},'allow')}
  const owned={type:'command',command};const owner={schemaVersion:1,settingsPath,prior:settings.statusLine??null,hadPrior:Object.hasOwn(settings,'statusLine'),inheritedStatusLineAcknowledged,owned,continuityPermissions};writeIntegrityFile(root,ownedPath,owner)
  settings.statusLine=owned;settings.permissions={...settings.permissions,allow:[...currentAllow,...continuityPermissions.addedAllow]};writeIntegrityFile(root,settingsPath,settings);return {installed:true,ownerPath:ownedPath,continuityPermissions}
 })
}
export function removeStatusLine(root){return withIntegrityLock(root,()=>{const ownerPath=safeIntegrityPath(root,'.verify/integrity/status-line-owner.json');if(!existsSync(ownerPath))return {removed:false}
 const owner=JSON.parse(readFileSync(ownerPath,'utf8'));if(owner.restored)return {removed:false};const path=safeIntegrityPath(root,owner.settingsPath);const current=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{}
 const cleanup=removeContinuityPermissions(current,owner),settings=cleanup.settings,preservedConflict=digest(settings.statusLine??null)!==digest(owner.owned)
 if(!preservedConflict){if(owner.hadPrior)settings.statusLine=owner.prior;else delete settings.statusLine}
 if(digest(settings)!==digest(current))writeIntegrityFile(root,owner.settingsPath,settings)
 // Keep the restoration receipt; future installs may replace a completed owner record.
 writeIntegrityFile(root,'.verify/integrity/status-line-owner.json',{...owner,restored:true,...(preservedConflict?{statusLinePreserved:true}:{})});return {removed:!preservedConflict,permissionsRemoved:cleanup.removed,preservedConflict}
})}
const validContextId=value=>typeof value==='string'&&value.length>0&&value.length<200&&!/[\x00-\x1f\x7f]/.test(value)
function telemetryFile(host,sessionId){return `.verify/integrity/telemetry/${digest({host,sessionId})}.json`}
/** A session must never borrow the last observation written by another session. */
export function readContextTelemetry(root,{host,sessionId}={}){
 if(!['claude','codex'].includes(host)||!validContextId(sessionId))return null
 const path=safeIntegrityPath(root,telemetryFile(host,sessionId))
 if(!existsSync(path))return null
 const value=JSON.parse(readFileSync(path,'utf8'))
 return value?.host===host&&value?.sessionId===sessionId?value:null
}
export function recordClaudeStatusLine(root,payload,{now=Date.now()}={}) {
 const sessionId=payload?.session_id,modelId=payload?.model?.id,used=payload?.context_window?.used_percentage
 if(!validContextId(sessionId)||!validContextId(modelId)||!Number.isSafeInteger(now)||!Number.isFinite(used)||used<0||used>100)return unknown('Status line has no measured usage.')
 return withIntegrityLock(root,()=>{
  const state=contextState(root),identity=digest({host:'claude',sessionId,modelId}),epoch=state.epochs[identity]??0
  const observation={host:'claude',sessionId,modelId,epoch,observedAt:now,usedPercentage:used,basis:'host-used-percentage'}
  writeIntegrityFile(root,telemetryFile('claude',sessionId),observation);return observation
 })
}
export function compactContext(root,{sessionId,now=Date.now()}={}) {
 const owner=safeIntegrityPath(root,'.verify/integrity/status-line-owner.json')
 if(!validContextId(sessionId)||!existsSync(owner)||JSON.parse(readFileSync(owner,'utf8')).restored)return {checkpoint:false}
 return withIntegrityLock(root,()=>{
  const prior=readContextTelemetry(root,{host:'claude',sessionId});if(!prior||!validContextId(prior.modelId))return {checkpoint:false}
  const state=contextState(root),identity=digest({host:'claude',sessionId,modelId:prior.modelId}),epoch=(state.epochs[identity]??0)+1
  state.epochs[identity]=epoch;delete state.last[identity];writeIntegrityFile(root,'.verify/integrity/context.json',state)
  writeIntegrityFile(root,telemetryFile('claude',sessionId),{...prior,epoch,usedPercentage:null,basis:'unknown',observedAt:now})
  return {checkpoint:false,epoch,reading:unknown('Awaiting post-compaction telemetry.')}
 })
}
