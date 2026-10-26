// Acceptance bookkeeping. This checks receipts, not the truth of model claims.
import {readFileSync,realpathSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,relative,isAbsolute,sep} from 'node:path'
export const CASE_STATES=['passed','failed','skipped','unsupported']
export function gradeCase(record,{evidenceRoot}={}){
 const problems=[]
 if(!record||!CASE_STATES.includes(record.state))return {ok:false,problems:['invalid state']}
 if(typeof record.id!=='string'||!record.id)problems.push('missing case id')
 if(record.state!=='passed'){
  if(typeof record.reason!=='string'||!record.reason.trim())problems.push('non-pass needs a reason')
  return {ok:problems.length===0,passed:false,problems}
 }
 if(record.requiredToolsAvailable!==true)problems.push('required tool unavailable or unknown')
 if(record.outcome!==true)problems.push('asserted outcome did not pass')
 if(record.kind==='live'){
  if(!['claude','codex'].includes(record.host)||typeof record.version!=='string'||!record.version)problems.push('missing actual host version')
  if(record.mocked!==false)problems.push('mocked or unknown execution')
  if(record.exitCode!==0)problems.push('host exit did not pass')
  if(!Object.hasOwn(record,'model'))problems.push('model must be recorded or explicitly null')
 }else if(record.kind!=='deterministic')problems.push('unknown evidence kind')
 if(!Array.isArray(record.evidence)||!record.evidence.length)problems.push('missing evidence')
 else for(const e of record.evidence){
  try{if(!evidenceRoot||typeof e.path!=='string'||isAbsolute(e.path)||!/^[a-f0-9]{64}$/.test(e.sha256))throw new Error('invalid evidence root, path, or hash');const file=realpathSync(resolve(evidenceRoot,e.path)),rel=relative(realpathSync(evidenceRoot),file);if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('evidence escapes root');const hash=createHash('sha256').update(readFileSync(file)).digest('hex');if(hash!==e.sha256)throw new Error('evidence changed')}catch(error){problems.push(error.message)}
 }
 return {ok:problems.length===0,passed:problems.length===0,problems}
}
export function summarizeCases(records,options={}){
 const counts=Object.fromEntries(CASE_STATES.map(s=>[s,0])),invalid=[],seen=new Set(),passed=new Set()
 for(const row of records){const grade=gradeCase(row,options);if(!row||typeof row!=='object'){invalid.push({id:null,problems:grade.problems});continue}if(seen.has(row.id)){invalid.push({id:row.id,problems:['duplicate id']});continue}seen.add(row.id);if(!grade.ok)invalid.push({id:row.id,problems:grade.problems});else{counts[row.state]++;if(grade.passed)passed.add(row.id)}}
 const required=options.requiredIds
 if(!Array.isArray(required)||!required.length)invalid.push({id:null,problems:['explicit nonempty required case list is required']})
 else for(const id of required)if(!seen.has(id))invalid.push({id,problems:['required case missing']})
 return {counts,invalid,allRequiredPassed:invalid.length===0&&required.every(id=>passed.has(id))}
}
