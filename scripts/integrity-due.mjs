#!/usr/bin/env node
// Hooks only mark due work. A lead explicitly consumes it with a read-only host.
import {readFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {prepareIntegrity,validateIntegrityReport} from './agents/memory-integrity.mjs'
import {digest,integrityConfig,mutateIntegrityState,writeIntegrityFile,readIntegrityState,safeIntegrityPath,configureIntegrity,markIntegrityDue,inspectCoverage} from './lib/integrity-state.mjs'
import {sealIntegrityRuntime,pruneIntegrityRuntime} from './lib/runtime-retention.mjs'
export {configureIntegrity,markIntegrityDue,readIntegrityState,inspectCoverage}
const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true}catch(e){return e.code!=='ESRCH'}}
export async function consumeIntegrityDue(root,{target='memory',branch='unknown',prepare,run,now=Date.now(),timeoutMs=60000,signal}={}) {
 const config=integrityConfig(root);if(!config.enabled)return {status:'disabled'}
 if(typeof run!=='function'||!prepare||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000)throw Error('bounded preparation and read-only runner required')
 const lease=randomUUID();let selected
 mutateIntegrityState(root,state=>{const q=state.queue.find(q=>q.target===target&&q.branch===branch);if(!q)return
  if(q.lease?.executionStarted || q.lease?.cancellationUnconfirmed || (q.status==='running'&&(q.lease?.until>now||alive(q.lease?.pid))))return
  if(q.status==='done'||(q.lastAttempt!==null&&now-q.lastAttempt<config.cooldownMs))return
  q.status='running';q.lastAttempt=now;q.lease={id:lease,pid:process.pid,until:now+timeoutMs+120000};selected=structuredClone(q)})
 if(!selected)return {status:'idle'}
 const controller=new AbortController();let timer;const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
 let outcome='failed',reportPath=null,bundle,report,problem=null,settled=true,retainLease=false,runtimeSeal=null
 try {
  if(controller.signal.aborted)throw Error('cancelled')
  const destination=safeIntegrityPath(root,`.verify/integrity/runs/${lease}/snapshot`,{createParents:true})
  bundle=prepareIntegrity({...prepare,root:resolve(root),destination,dueReasons:selected.reasons,lastCoverage:null})
  mutateIntegrityState(root,state=>{const q=state.queue.find(q=>q.id===selected.id);if(q?.lease?.id!==lease)throw Error('integrity lease changed before execution');q.lease.executionStarted=true})
  const stopped=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'))},timeoutMs);controller.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true})})
  settled=false;const work=Promise.resolve().then(()=>run(bundle,{signal:controller.signal,timeoutMs})),settlement=work.then(()=>{settled=true},e=>{settled=true;if(e?.stopped===false)retainLease=true})
  let answer
  try{answer=await Promise.race([work,stopped])}catch(e){controller.abort();if(!settled){let grace;await Promise.race([settlement,new Promise(r=>{grace=setTimeout(r,6500)})]).finally(()=>clearTimeout(grace))}retainLease=retainLease||!settled||e?.stopped===false;throw e}
  report=answer.report
  const checked=validateIntegrityReport({bundle,report,sentPrompt:answer.sentPrompt});if(!checked.ok)throw Error(checked.problems.join('; '))
  reportPath=`.verify/integrity/runs/${lease}/report.json`;writeIntegrityFile(root,reportPath,{report,checked,host:answer.host??'unknown',model:answer.model??null})
  outcome=report.uncheckedClaims.length?'partial':'completed'
 }catch(e){problem=String(e.message).slice(0,2000);outcome=controller.signal.aborted?'cancelled':'failed'}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(settled&&!retainLease)try{runtimeSeal=sealIntegrityRuntime(root,`.verify/integrity/runs/${lease}`)}catch(e){problem=(problem??'')+' Runtime retained: '+e.message}}
 return mutateIntegrityState(root,state=>{const q=state.queue.find(q=>q.id===selected.id);if(!q||q.lease?.id!==lease)return {status:'superseded',reportPath}
  if(retainLease){q.lease.cancellationUnconfirmed=true;q.status='running';q.lastOutcome=outcome;q.lastError=problem;return {status:outcome,reportPath,problem,cancellationUnconfirmed:true,coverage:0}}
  q.lease=null;q.lastOutcome=outcome;q.lastError=problem
  if(runtimeSeal){q.runs??=[];q.runs.push({path:`.verify/integrity/runs/${lease}`,seal:runtimeSeal});while(q.runs.length>10){const old=q.runs.shift();const pruned=pruneIntegrityRuntime(root,old.path,old.seal);if(pruned.reason)q.retentionWarning=pruned.reason}}
  if(outcome==='completed'||outcome==='partial'){
   // Check once more while holding the writer lock. A source edit invalidates completion.
   const checked=validateIntegrityReport({bundle,report,sentPrompt:bundle.prompt});if(!checked.ok){q.status='due';q.lastOutcome='stale';return {status:'stale',reportPath}}
   state.coverage=state.coverage.filter(c=>c.target!==target||c.branch!==branch)
   for(const claim of bundle.claims){const sources=[claim.artifact,...claim.sources].map(path=>({path,sha256:digest(readFileSync(safeIntegrityPath(root,path)))}));const finding=report.findings.find(f=>f.claimId===claim.id)
    const entry={id:claim.id,target,branch,artifact:claim.artifact,claim:claim.claim,sources,checked:report.checkedClaims.includes(claim.id),classification:finding.classification,reportPath,checkedAt:report.checkedClaims.includes(claim.id)?now:null,attemptedAt:now,basis:'scoped-report-source-quotes'}
    const old=state.coverage.findIndex(c=>c.id===claim.id&&c.target===target&&c.branch===branch);if(old<0)state.coverage.push(entry);else state.coverage[old]=entry}
   q.lastReportAt=now;if(outcome==='completed')q.lastSuccess=now;q.status=outcome==='completed'&&q.generation===selected.generation?'done':'due';if(q.status==='done')q.reasons=[]
  }else q.status='due'
  return {status:outcome,reportPath,problem,coverage:['completed','partial'].includes(outcome)?report.checkedClaims.length:0}
 })
}
export async function main(args=process.argv.slice(2)) {
 try{const [mode,root='.',input]=args;let result
 if(mode==='status')result={state:readIntegrityState(root),coverage:inspectCoverage(root)}
 else if(mode==='enable'||mode==='disable')result=configureIntegrity(root,{enabled:mode==='enable'})
 else if(mode==='mark')result=markIntegrityDue(root,JSON.parse(readFileSync(input,'utf8')))
 else if(mode==='consume'){
  const options=JSON.parse(readFileSync(input,'utf8'));const {runInspection}=await import('./hosts/inspection.mjs')
  result=await consumeIntegrityDue(root,{...options,prepare:{...options.prepare,readMethod:options.host==='codex'?'readonly-commands':'file-tools'},run:(bundle,limits)=>runInspection({host:options.host,root:bundle.snapshot.destination,prompt:bundle.prompt,...limits,retainRuntime:false})})
 }else throw Error('Usage: integrity-due.mjs status|enable|disable <root> | mark|consume <root> <input.json>')
 process.stdout.write(JSON.stringify(result,null,2)+'\n');return ['failed','cancelled','stale','partial'].includes(result.status)?1:0
 }catch(e){process.stderr.write(e.message+'\n');return 2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main()
