#!/usr/bin/env node
// This is an execution entry, not a read-only helper. Native launches and the
// explicitly supplied proof commands need the user's task authority.
import {spawn} from 'node:child_process'
import {randomUUID,createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,rmdirSync,writeFileSync,lstatSync} from 'node:fs'
import {dirname,isAbsolute,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {validatePlan,planFingerprint} from '../lib/plan-contract.mjs'
import {codeFingerprint} from '../lib/changes.mjs'
import {validateProof} from '../lib/proof.mjs'
import {claimTask,readRun,transitionTask,submitResult,acceptResult,setIntegration,inspectRun,proofContext} from '../lib/run-state.mjs'
import {captureProof} from '../verify/capture.mjs'
import {taskPacket} from '../hosts/setup.mjs'
import {createWorkerWorkspace,auditWorkerWorkspace,integrateWorkerWorkspace} from './workspaces.mjs'

const ensure=(value,message)=>{if(!value)throw new Error(message)}
const positive=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max
const cleanEnv=env=>{const out={...env};delete out.NODE_TEST_CONTEXT;return out}
const context=a=>Object.fromEntries(['runId','planId','planRevision','taskId','attempt','ownerVersion','workerId','assignmentId'].map(k=>[k,a[k]]))
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
function evidenceFile(root,path) {
  ensure(typeof path==='string'&&path.trim(),'saved evidence path required')
  const absolute=resolve(root,path);let cursor=absolute
  while(true){ensure(!lstatSync(cursor).isSymbolicLink(),'evidence path must not be linked');const parent=dirname(cursor);if(parent===cursor)break;cursor=parent}
  const stat=lstatSync(absolute);ensure(stat.isFile()&&stat.size<=1048576,'evidence must be a regular file up to 1 MiB')
  const bytes=readFileSync(absolute);return {path:absolute,sha256:sha256(bytes),content:JSON.parse(bytes.toString('utf8'))}
}
const checked=result=>{ensure(result.ok,result.error??result.problems?.map(p=>p.message).join('; '));return result}
function auth(root,runId,ownerId,ownerVersion,extra={}) {
  const {ledger}=checked(readRun(root,runId))
  return {ownerId,ownerVersion,expectedRevision:ledger.revision,...extra}
}
export function hostCapabilities(host) {
  const native=['claude','codex-cli'].includes(host)
  return {host,nativeDispatch:native,parallel:native,sequential:true,
    filesystem:host==='codex-cli'?'host workspace-write or read-only sandbox':host==='claude'?'restricted file tools and scoped permissions':'caller-owned execution',
    processStop:'process group on POSIX; taskkill /T on Windows; failure stays unconfirmed',
    limits:'parent wall time, captured output bytes, input bytes; no CPU or memory quota',
    unavailable:native?[]:['native child process dispatch; use a confirmed CLI or explicit sequential callback'],
    externalActions:'No blanket external-action guarantee; use the named host profile and current host evidence.'}
}

/** Named native adapter only. No command strings, shell, or arbitrary CLI args. */
export function nativeInvocation({host,binary,workspace,controlDir,pluginRoot=ROOT,role='code-specialist',paths=['.'],platform=process.platform}) {
  ensure(['claude','codex-cli'].includes(host),'native dispatch supports claude or codex-cli')
  ensure(['code-specialist','code-scout','memory-auditor'].includes(role),'this launcher supports code or file-read workers; other roles use their dedicated workflow')
  ensure(typeof binary==='string'&&isAbsolute(binary)&&existsSync(binary)&&lstatSync(binary).isFile(),'supply an absolute native executable or JavaScript CLI entry')
  ensure(!/\.(?:cmd|bat|ps1)$/i.test(binary),'shell shims are not supported; resolve the native executable or JavaScript entry')
  const writable=role==='code-specialist'
  mkdirSync(controlDir,{recursive:true})
  let args,outputPath=null
  if(host==='claude') {
    const settings=join(controlDir,'settings.json'),mcp=join(controlDir,'mcp.json')
    const names=writable?['Read','Grep','Glob','Edit','Write']:['Read','Grep','Glob']
    ensure(Array.isArray(paths)&&paths.length>0&&paths.every(p=>typeof p==='string'&&!/[()\[\]*?\\:\r\n]/.test(p)&&!p.split('/').includes('..')),'paths cannot contain permission-pattern operators')
    const writeRules=writable?paths.flatMap(path=>{
      const full=resolve(workspace,path).replace(/\\/g,'/').replace(/^([A-Za-z]):\//,(_,drive)=>`/${drive.toLowerCase()}/`)
      const pattern=`/${full}${path==='.'||existsSync(join(workspace,path))&&lstatSync(join(workspace,path)).isDirectory()?'/**':''}`
      return [`Edit(${pattern})`]
    }):[]
    const settingsJson=JSON.stringify({disableAllHooks:true,autoMemoryEnabled:false,permissions:{allow:['Read','Grep','Glob',...writeRules],deny:['Bash','Agent','Task','WebFetch','WebSearch']}})
    writeFileSync(settings,settingsJson,{flag:'wx'})
    writeFileSync(mcp,JSON.stringify({mcpServers:{}}),{flag:'wx'})
    // Absolute normalized Edit rules cover both Edit and Write. Settings-file
    // /path rules anchor at the file's directory, not the worker directory.
    args=['-p','--restricted','--strict-mcp-config','--mcp-config',mcp,'--settings',settings,'--plugin-dir',pluginRoot,'--agent',`compound-memory:${role}`,
      '--tools',names.join(','),'--permission-mode','dontAsk','--permission-prompts','none','--no-chrome','--no-session-persistence','--output-format','json']
  } else {
    outputPath=join(controlDir,'result.txt')
    const disabled=['apps','plugins','browser_use','browser_use_external','computer_use','image_generation','multi_agent','multi_agent_v2','hooks','memories','in_app_browser','workspace_dependencies']
    args=['exec','--ignore-user-config','--ephemeral','-c','approval_policy="never"','-c','web_search="disabled"',
      ...(platform==='win32'?['-c','windows.sandbox="mxc"']:[]),...disabled.flatMap(n=>['--disable',n]),
      '-c','project_doc_max_bytes=0','--ignore-rules','-s',writable?'workspace-write':'read-only','--skip-git-repo-check','-C',workspace,'-o',outputPath]
  }
  return {command:/\.m?js$/i.test(binary)?process.execPath:binary,args:/\.m?js$/i.test(binary)?[binary,...args]:args,cwd:workspace,outputPath,host,capabilities:hostCapabilities(host)}
}

/** Parent-owned lifetime. Never accepts an arbitrary executable from a packet. */
export async function launchNative({invocation,prompt,timeLimitMs,outputLimitBytes,signal,processEnv=process.env}) {
  ensure(positive(timeLimitMs,3600000)&&positive(outputLimitBytes,16777216),'invalid launch limits')
  ensure(Buffer.byteLength(prompt)<=131072,'native prompt too large')
  if(signal?.aborted)return {ok:false,error:'cancelled before launch',stopped:true}
  return new Promise(resolvePromise=>{
    let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),bytes=0,failure=null,stopConfirmed=false,finished=false,spawnError=null,stopPromise=Promise.resolve()
    const child=spawn(invocation.command,invocation.args,{cwd:invocation.cwd,env:cleanEnv(processEnv),shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']})
    const finish=async code=>{
      if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel)
      await stopPromise
      const error=failure??spawnError??(code===0?null:`native host exited ${code}`)
      resolvePromise({ok:!error,error,exitCode:code,stdout:stdout.toString('utf8'),stderr:stderr.toString('utf8'),stopped:!failure||stopConfirmed,outputBytes:bytes})
    }
    const stop=reason=>{
      if(failure)return;failure=reason
      if(!child.pid){stopConfirmed=true;return}
      if(process.platform==='win32') {
        stopPromise=new Promise(done=>{
          const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{shell:false,windowsHide:true,env:cleanEnv(processEnv),stdio:'ignore'})
          const killTimer=setTimeout(()=>{killer.kill();child.kill()},5000)
          killer.on('error',()=>{child.kill()})
          killer.on('close',code=>{clearTimeout(killTimer);stopConfirmed=code===0;done()})
        })
      } else {try{process.kill(-child.pid,'SIGKILL');stopConfirmed=true}catch{child.kill('SIGKILL')}}
    }
    const collect=(stream,data)=>{
      bytes+=data.length
      const kept=data.subarray(0,Math.max(0,outputLimitBytes-stdout.length-stderr.length))
      if(stream==='stdout')stdout=Buffer.concat([stdout,kept]);else stderr=Buffer.concat([stderr,kept])
      if(bytes>outputLimitBytes)stop('native output limit exceeded')
    }
    const cancel=()=>stop('cancelled by lead')
    const timer=setTimeout(()=>stop('native time limit exceeded'),timeLimitMs)
    signal?.addEventListener('abort',cancel,{once:true})
    child.stdout.on('data',data=>collect('stdout',data));child.stderr.on('data',data=>collect('stderr',data))
    child.on('error',error=>{spawnError=error.message});child.on('close',code=>finish(code))
    child.stdin.on('error',()=>{});child.stdin.end(prompt)
  })
}

function parseResult(host,run,invocation,limit) {
  let text=run.stdout
  if(host==='claude') {
    const wrapper=JSON.parse(text);ensure(wrapper.is_error!==true,'Claude reported an error');text=wrapper.result
  } else if(invocation?.outputPath) {
    ensure(existsSync(invocation.outputPath),'native host did not save a result')
    ensure(lstatSync(invocation.outputPath).size<=limit,'native result exceeds assignment output limit')
    text=readFileSync(invocation.outputPath,'utf8')
  }
  ensure(typeof text==='string'&&Buffer.byteLength(text)<=limit,'result is missing or too large')
  return JSON.parse(text)
}

/** One conflict-free wave. Returned work still needs lead review and acceptance.
 * sequentialWorker is an explicit current-session fallback, not native proof. */
export async function dispatchWave({root,plan,runId,ownerId,ownerVersion,host,binary,maxWorkers=2,mode='parallel',taskLimit=8,timeLimitMs=300000,outputLimitBytes=65536,
  role='code-specialist',signal,processEnv=process.env,pluginRoot=ROOT,sequentialWorker,checkCommands={}}={}) {
  let lock,ownsLock=false
  const jobs=[]
  try {
    checked(validatePlan(plan));ensure(['parallel','sequential'].includes(mode),'invalid dispatch mode')
    ensure(positive(maxWorkers,8)&&positive(taskLimit,100)&&positive(timeLimitMs,3600000)&&positive(outputLimitBytes,1048576),'invalid dispatch limits')
    const caps=hostCapabilities(host)
    ensure(caps.nativeDispatch || mode==='sequential'&&typeof sequentialWorker==='function','host has no native dispatch; provide an explicit sequential worker')
    const state=checked(inspectRun(root,runId,plan)),ledger=state.ledger
    ensure(ledger.owner.id===ownerId&&ledger.owner.version===ownerVersion,'wrong dispatch owner')
    ensure(ledger.planFingerprint===planFingerprint(plan),'plan changed')
    lock=join(root,'.verify','runs',runId,'.dispatch-lock');mkdirSync(lock);ownsLock=true
    const slots=(mode==='sequential'?1:maxWorkers)-Object.values(ledger.tasks).filter(s=>s.assignment&&s.state!=='accepted').length
    const candidates=plan.tasks.filter(t=>ledger.tasks[t.id].state==='ready').slice(0,Math.max(0,Math.min(slots,taskLimit)))
    for(const task of candidates) {
      if(signal?.aborted)break
      const current=checked(inspectRun(root,runId,plan))
      if(current.ledger.tasks[task.id].state!=='ready')continue
      const manifest=createWorkerWorkspace({root,paths:task.paths})
      const claimed=checked(claimTask(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{taskId:task.id,workerId:`worker-${randomUUID()}`,role,
        workspace:manifest.workspace,workspaceManifest:manifest.manifestPath,leaseMs:timeLimitMs,timeLimitMs,outputLimitBytes})))
      const assignment=claimed.assignment
      checked(transitionTask(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{taskId:task.id,state:'running'})))
      const job=(async()=>{
        let stopped=true
        try {
          const packetHost=caps.nativeDispatch?host:'codex-cli'
          const {packet}=checked(taskPacket({host:packetHost,root,plan,runId,taskId:task.id,pluginRoot}))
          packet.freshness.code='source-and-copy-baseline-checked-at-claim'
          packet.instructions.push((host==='claude'?'This launcher gives Claude workers file tools.':'Codex workers may use command-based reads and file edits within the assigned host sandbox; the task and role still limit what they may change.')+' Do not run Git, installs, or child agents. The lead captures declared checks after return. Return proofs:[]; completion is pending lead checks and acceptance. Use summary for routine observations. Findings contains only unresolved issues, not notes that the lead owns checks, byte comparisons, or fingerprint validation.')
          let result,launch=null
          const startedAt=new Date().toISOString()
          if(caps.nativeDispatch) {
            const invocation=nativeInvocation({host,binary,workspace:manifest.workspace,controlDir:join(manifest.container,'control'),pluginRoot,role,paths:task.paths})
            const remaining=Math.min(timeLimitMs,Date.parse(assignment.leaseUntil)-Date.now(),Date.parse(ledger.owner.leaseUntil)-Date.now())
            ensure(remaining>0,'lease expired before launch')
            launch=await launchNative({invocation,prompt:JSON.stringify(packet),timeLimitMs:remaining,outputLimitBytes:Math.min(16777216,outputLimitBytes*8),signal,processEnv})
            const control=join(manifest.container,'control')
            writeFileSync(join(control,'stdout.log'),launch.stdout,{flag:'wx'})
            writeFileSync(join(control,'stderr.log'),launch.stderr,{flag:'wx'})
            writeFileSync(join(control,'launch.json'),JSON.stringify({invocation,startedAt,finishedAt:new Date().toISOString(),exitCode:launch.exitCode,error:launch.error,stopped:launch.stopped,outputBytes:launch.outputBytes},null,2),{flag:'wx'})
            stopped=launch.stopped;ensure(launch.ok,launch.error)
            result=parseResult(host,launch,invocation,outputLimitBytes)
          } else {
            // The host owns a fallback callback's lifetime. It must return a stop
            // receipt. Promises cannot be forcibly stopped by this JavaScript API.
            stopped=false
            const fallback=await sequentialWorker({packet,manifest,signal})
            ensure(fallback.stopped===true,'sequential callback must confirm it stopped')
            stopped=true
            result=fallback.result
          }
          const audit=auditWorkerWorkspace(manifest);ensure(audit.ok,audit.error)
          ensure(JSON.stringify([...result.changedPaths].sort())===JSON.stringify(audit.changedPaths),'reported changed paths differ from actual worker changes')
          ensure(Object.keys(packet.context).every(k=>result.context?.[k]===packet.context[k]),'worker result context differs')
          ensure(result.status==='completed',`worker reported failure: ${result.summary}`)
          return {ok:true,taskId:task.id,assignment,result,manifest,workerProofs:[],workerFingerprint:audit.fingerprint,startedAt,finishedAt:new Date().toISOString(),basis:caps.nativeDispatch?'native-cli':'sequential-callback'}
        }catch(error){
          const transition=transitionTask(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{taskId:task.id,state:signal?.aborted?'cancelled':'failed',reason:error.message}))
          return {ok:false,taskId:task.id,error:error.message,assignment,manifest,stopped,transitionError:transition.ok?null:transition.error}
        }
      })()
      jobs.push(job)
    }
    const results=await Promise.all(jobs)
    // Capture is synchronous. Wait for native children to exit first so a slow
    // check cannot delay another child's wall-time or cancellation signal.
    for(const report of results.filter(r=>r.ok)) {
      try {
        ensure(!signal?.aborted,'cancelled before worker checks')
        const task=plan.tasks.find(t=>t.id===report.taskId)
        for(const checkId of task.requiredChecks) {
          const command=checkCommands[checkId];ensure(command,'missing explicit worker check command: '+checkId)
          const remaining=Math.min(Date.parse(report.assignment.leaseUntil),Date.parse(ledger.owner.leaseUntil))-Date.now()
          ensure(remaining>0,'lease expired before worker checks')
          const proof=captureProof(report.manifest.workspace,{...command,checkId,context:context(report.assignment),paths:task.paths.includes('.')?[]:task.paths,
            timeoutMs:Math.min(command.timeoutMs??60000,remaining),processEnv})
          ensure(!proof.error&&proof.proof.outcome==='passed',`worker check failed: ${checkId}`)
          report.workerProofs.push({workspace:report.manifest.workspace,path:proof.proofPath})
        }
        const afterChecks=auditWorkerWorkspace(report.manifest)
        ensure(afterChecks.ok&&afterChecks.fingerprint===report.workerFingerprint,'worker source changed during checks')
        checked(submitResult(root,runId,plan,report.result))
        checked(transitionTask(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{taskId:task.id,state:'awaiting-review'})))
        writeFileSync(join(dirname(report.manifest.manifestPath),'dispatch.json'),JSON.stringify(report,null,2),{flag:'wx'})
      }catch(error){
        report.ok=false;report.error=error.message;report.stopped=true
        const transition=transitionTask(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{taskId:report.taskId,state:signal?.aborted?'cancelled':'failed',reason:error.message}))
        report.transitionError=transition.ok?null:transition.error
      }
    }
    return {ok:results.every(r=>r.ok),results,capabilities:caps,mode,waiting:plan.tasks.filter(t=>!results.some(r=>r.taskId===t.id)&&ledger.tasks[t.id].state!=='accepted').map(t=>t.id)}
  }catch(error){
    // A later claim can fail after earlier children started. Keep authority
    // until every started child has returned; never orphan a live wave.
    const settled=await Promise.allSettled(jobs)
    return {ok:false,error:error.message,results:settled.filter(s=>s.status==='fulfilled').map(s=>s.value)}
  }
  finally{if(ownsLock)rmdirSync(lock)}
}

/** Integration is explicit. Task proof is recaptured on the source tree. */
export function acceptWorkerResult({root,plan,runId,ownerId,ownerVersion,report,checkCommands,resolutions=[],processEnv=process.env}={}) {
  let merged=null
  const proofs=[]
  try {
    const live=checked(inspectRun(root,runId,plan)).ledger,task=plan.tasks.find(t=>t.id===report?.taskId)
    ensure(live.owner.id===ownerId&&live.owner.version===ownerVersion&&Date.now()<Date.parse(live.owner.leaseUntil),'wrong or expired integration owner')
    ensure(report?.ok&&task&&report.workerProofs?.length===task.requiredChecks.length,'worker checks are missing')
    ensure(report.manifest.workspace===live.tasks[task.id].assignment?.workspace&&resolve(report.manifest.root)===resolve(root),'worker workspace does not match the assignment')
    const deadline=Math.min(Date.parse(live.owner.leaseUntil),Date.parse(live.tasks[task.id].assignment.leaseUntil))
    // Reserve a short merge window. Disk stalls can still exceed it; retain the
    // merge receipt and cap every later check against the actual deadline.
    let checkBudgetMs=10000
    for(const checkId of task.requiredChecks) {
      const command=checkCommands?.[checkId]
      ensure(command&&typeof command.command==='string'&&command.command&&Array.isArray(command.args??[])&& (command.args??[]).every(a=>typeof a==='string'),'missing explicit integrated task check: '+checkId)
      ensure(positive(command.timeoutMs??60000,3600000),'invalid integrated check time limit')
      checkBudgetMs+=command.timeoutMs??60000
    }
    ensure(Date.now()+checkBudgetMs<deadline,'worker or owner lease lacks time for integration and its checks; renew or retry before merging')
    ensure(JSON.stringify([...report.manifest.paths].sort())===JSON.stringify([...task.paths].sort()),'worker ownership differs from task')
    ensure(report.result.status==='completed'&&report.result.blockers.length===0,'worker failure or blockers prevent integration')
    ensure(Array.isArray(resolutions)&&resolutions.length===report.result.findings.length,'unresolved findings prevent integration')
    const resolved=report.result.findings.map(finding=>{
      const matches=resolutions.filter(r=>r.finding===finding)
      ensure(matches.length===1,'each finding requires exactly one lead resolution')
      const evidence=evidenceFile(root,matches[0].evidence)
      ensure(typeof matches[0].reason==='string'&&matches[0].reason.trim(),'finding resolution needs a reason')
      return {finding,reason:matches[0].reason,evidence:{path:evidence.path,sha256:evidence.sha256}}
    })
    const found=new Set()
    for(const receipt of report.workerProofs) {
      ensure(receipt.workspace===report.manifest.workspace,'worker proof names another workspace')
      const validation=validateProof(receipt.workspace,receipt.path,{context:report.result.context,paths:task.paths.includes('.')?[]:task.paths})
      ensure(validation.ok,'worker proof is missing, changed, or failed')
      ensure(task.requiredChecks.includes(validation.proof.checkId)&&!found.has(validation.proof.checkId),'worker check set differs from the plan')
      found.add(validation.proof.checkId)
    }
    checked(submitResult(root,runId,plan,report.result)) // identity and live assignment check before source writes
    ensure(Date.now()+checkBudgetMs<deadline,'lease budget changed before integration')
    merged=integrateWorkerWorkspace(report.manifest);ensure(merged.ok,merged.error)
    for(const checkId of task.requiredChecks) {
      ensure(checkCommands[checkId],'missing explicit integrated task check: '+checkId)
      const command=checkCommands[checkId],remaining=deadline-Date.now()-1000
      ensure(remaining>0,'lease expired after merge; retain the merge receipt and worker copy for recovery')
      const proof=captureProof(root,{...command,timeoutMs:Math.min(command.timeoutMs??60000,remaining),checkId,context:report.result.context,paths:task.paths.includes('.')?[]:task.paths,processEnv})
      if(proof.proofPath)proofs.push(proof.proofPath)
      ensure(!proof.error&&proof.proof.outcome==='passed',`integrated task check failed: ${checkId}`)
    }
    let resolutionPath=null
    if(resolved.length){resolutionPath=join(root,'.verify','runs',runId,`resolved-${randomUUID()}.json`);writeFileSync(resolutionPath,JSON.stringify({context:report.result.context,resolved,proofs},null,2),{flag:'wx'})}
    const result={...report.result,resultId:`integrated-${randomUUID()}`,proofs,findings:[],summary:report.result.summary+(resolutionPath?` Lead finding resolutions: ${resolutionPath}`:'')}
    checked(submitResult(root,runId,plan,result))
    checked(acceptResult(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{resultId:result.resultId})))
    return {ok:true,result,merged}
  }catch(error){return {ok:false,error:error.message,merged,proofs,...(merged?.ok?{recovery:'Keep the merge receipt and worker copy. Recheck unchanged merged work under current leases; reconcile an expired assignment before retry.'}:{})}}
}

/** review must name a fixed current combined tree and carry no open findings. */
export function verifyIntegration({root,plan,runId,ownerId,ownerVersion,checkCommands,review,processEnv=process.env}={}) {
  try {
    const status=checked(inspectRun(root,runId,plan))
    ensure(status.ledger.owner.id===ownerId&&status.ledger.owner.version===ownerVersion&&Date.now()<Date.parse(status.ledger.owner.leaseUntil),'wrong or expired integration owner')
    ensure(status.acceptedTasks.length===plan.tasks.length,'tasks lack current acceptance')
    ensure(status.passedGates.length===plan.gates.length,'gates lack current proof')
    const fingerprint=codeFingerprint(root);ensure(fingerprint.ok,fingerprint.error)
    ensure(review?.fingerprint===fingerprint.fingerprint && Array.isArray(review.findings)&&review.findings.length===0 && typeof review.evidence==='string'&&review.evidence.trim(),'a clean review of the fixed combined tree is required')
    const savedReview=evidenceFile(root,review.evidence)
    ensure(savedReview.content.fingerprint===fingerprint.fingerprint&&Array.isArray(savedReview.content.findings)&&savedReview.content.findings.length===0,'saved review does not match the current source and clean finding set')
    const boundReview={...review,evidence:savedReview.path,sha256:savedReview.sha256}
    writeFileSync(join(root,'.verify','runs',runId,`integration-review-${randomUUID()}.json`),JSON.stringify(boundReview,null,2),{flag:'wx'})
    const proofs=[]
    for(const checkId of plan.finalChecks) {
      ensure(checkCommands[checkId],'missing explicit final check: '+checkId)
      const command=checkCommands[checkId]
      const capture=captureProof(root,{...command,env:{...command.env,combinedReviewSha256:savedReview.sha256},checkId,context:proofContext(status.ledger,'integration'),paths:[],processEnv})
      ensure(!capture.error&&capture.proof.outcome==='passed',`combined check failed: ${checkId}`);proofs.push(capture.proofPath)
    }
    checked(setIntegration(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{proofs})))
    return {ok:true,proofs,review:boundReview,mayClaimSuccess:checked(inspectRun(root,runId,plan)).mayClaimSuccess}
  }catch(error){
    let recorded=false
    try{recorded=setIntegration(root,runId,plan,auth(root,runId,ownerId,ownerVersion,{state:'failed',reason:error.message})).ok}catch{}
    return {ok:false,error:error.message,recorded}
  }
}

const USAGE='dispatch.mjs --request <json-file>\nExecutes an authorized native worker wave. Request names root, plan, runId, ownerId, ownerVersion, host, binary, limits and explicit checkCommands. Does not accept results or commit. This is not a pre-approved read-only helper.\n'
export async function main(argv=process.argv.slice(2)) {
  if(argv.includes('--help')){process.stdout.write(USAGE);return 0}
  try {
    const {values}=parseArgs({args:argv,options:{request:{type:'string'}},strict:true})
    ensure(values.request,'request file required')
    const result=await dispatchWave(JSON.parse(readFileSync(values.request,'utf8')))
    process.stdout.write(JSON.stringify(result,null,2)+'\n');return result.ok?0:1
  }catch(error){process.stderr.write(error.message+'\n'+USAGE);return 2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main()
