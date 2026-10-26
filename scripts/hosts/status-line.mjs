#!/usr/bin/env node
// Explicit opt-in bridge. Existing user command remains the display owner.
import {readFileSync,existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {recordClaudeStatusLine,installStatusLine,removeStatusLine,contextCheckpoint} from './context.mjs'
import {safeIntegrityPath} from '../lib/integrity-state.mjs'
import {requestContinuity} from '../lib/continuity.mjs'
import {localHooksEnabled} from './integrity-events.mjs'
import {hookPolicy} from './events.mjs'
export function quoteStatusLinePath(value,{platform=process.platform}={}) {
 if(/[\x00\r\n]/.test(value))throw Error('path cannot be quoted in host command')
 if(platform==='win32'){if(/["%!]/.test(value))throw Error('path has Windows shell expansion characters');return '"'+value+'"'}
 return "'"+value.replace(/'/g,"'\\''")+"'"
}
export function statusLine(root,raw,{now=Date.now(),env=process.env}={}) {
 const ownerPath=safeIntegrityPath(root,'.verify/integrity/status-line-owner.json');if(!existsSync(ownerPath))return ''
 const owner=JSON.parse(readFileSync(ownerPath,'utf8'));if(owner.restored)return ''
 const enabled=hookPolicy(env).enabled&&!['integrity','repair','worker'].includes(env.COMPOUND_MEMORY_ORIGIN)&&localHooksEnabled(root)
 let reading={usedPercentage:null};if(enabled){try{reading=recordClaudeStatusLine(root,JSON.parse(raw),{now})}catch{}}
 if(reading.usedPercentage!==null){try{
  const checkpoint=contextCheckpoint(root,{host:'claude',sessionId:reading.sessionId,modelId:reading.modelId,observation:reading,now,nextStep:'Save current memory, a continuation handoff, and links to the plan and proof. Keep working.'})
  // A latched checkpoint keeps its path so a failed queue write can retry.
  if(checkpoint.path&&existsSync(safeIntegrityPath(root,'memory')))requestContinuity(root,{host:'claude',sessionId:reading.sessionId,modelId:reading.modelId,epoch:checkpoint.epoch,reason:'threshold',checkpointPath:checkpoint.path,now})
 }catch{/* Display must survive an unavailable checkpoint or pending-save store. */}}
 if(owner.prior?.type==='command'&&typeof owner.prior.command==='string'){
  const child={...env};delete child.NODE_TEST_CONTEXT
  // This is the exact pre-existing user command, saved during explicit setup.
  const result=spawnSync(owner.prior.command,{shell:true,cwd:root,input:raw,encoding:'utf8',timeout:1000,maxBuffer:8192,windowsHide:true,env:child})
  return result.status===0?result.stdout:''
 }
 return reading.usedPercentage===null?'context: unknown':`context: ${reading.usedPercentage}%`
}
export async function main(args=process.argv.slice(2)) {
 const [mode,root='.',acknowledgement]=args
 try{
 if(args.length>3||(acknowledgement!==undefined&&(mode!=='install'||acknowledgement!=='--acknowledge-inherited')))throw Error('invalid status-line arguments')
 if(mode==='install'){
  const script=fileURLToPath(import.meta.url),target=resolve(root)
  process.stdout.write(JSON.stringify(installStatusLine(target,{command:`node ${quoteStatusLinePath(script)} read ${quoteStatusLinePath(target)}`,authorized:true,inheritedStatusLineAcknowledged:acknowledgement==='--acknowledge-inherited'}))+'\n')
 }else if(mode==='remove')process.stdout.write(JSON.stringify(removeStatusLine(root))+'\n')
 else if(mode==='read'){const chunks=[];for await(const c of process.stdin)chunks.push(c);const raw=Buffer.concat(chunks);if(raw.length<=262144)process.stdout.write(statusLine(root,raw.toString('utf8')))}
 else throw Error('Usage: status-line.mjs install|remove|read <project-root> [--acknowledge-inherited]. The install-only flag accepts temporary replacement of an unresolved inherited display.')
 return 0
 }catch(e){if(mode!=='read')process.stderr.write(e.message+'\n');return mode==='read'?0:2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main()
