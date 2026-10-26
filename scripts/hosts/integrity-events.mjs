// Opt-in bookkeeping, bounded to a local queue. Never launch an agent in a hook.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync} from 'node:fs'
import {integrityQueueRequested,markIntegrityDue,safeIntegrityPath} from '../lib/integrity-state.mjs'
export function localHooksEnabled(root){try{const p=safeIntegrityPath(root,'.verify/compound-memory-install.json');if(!existsSync(p))return true;const receipt=JSON.parse(readFileSync(p,'utf8'));return !(receipt.schemaVersion===1&&receipt.owner==='compound-memory'&&receipt.enabled===false)}catch{return false}}
export function queueHostEvent(root,event,{origin=process.env.COMPOUND_MEMORY_ORIGIN??'host',env=process.env}={}) {
 try {
  if(env.COMPOUND_MEMORY_HOOKS==='0'||!localHooksEnabled(root)||!integrityQueueRequested(root))return null
  const child={...env};delete child.NODE_TEST_CONTEXT
  let branch='unknown';try{branch=execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8',timeout:100,maxBuffer:4096,windowsHide:true,stdio:['ignore','pipe','pipe'],env:child}).trim()||'detached'}catch{}
  const reason=event.kind==='orientation'?`session-${event.source}`:event.kind==='file-change'?'files-changed':null
  if(!reason)return null
  const result=markIntegrityDue(root,{branch,reason,origin})
  return result.queued?'project-memory: a scoped integrity check is due. The lead can inspect the queue and run one bounded check.':null
 }catch{return null}
}
