#!/usr/bin/env node
// The version 2 ledger has no command execution or agent launch operation.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { initRun, readRun, claimTask, transitionTask, submitResult, acceptResult, retryTask, renewOwner, noteRun, transferOwner, passGate, setIntegration, inspectRun, proofContext } from './lib/run-state.mjs'

const USAGE = `Usage: run-state.mjs <operation> --run <id> [--plan <json-file>] [--input <json-file>] [--cwd <root>] [--task <id>]

Operations:
  init        Input: ownerId, leaseMs, optional retryLimit (default 3).
  show        Read the stored ledger. No plan or input required.
  inspect     Recheck current task, gate, and final proof. Exit 1 if incomplete.
  context     Print proof context for --task <gate-id|integration|assigned-task>.
  claim       Input: lead identity/version/revision, taskId, workerId, role,
              workspace, leaseMs, timeLimitMs, outputLimitBytes.
  transition  Input: lead identity/version/revision, taskId, state, reason.
  submit      Input: version 2 worker result. Saves one immutable result-and-time
              receipt. Does not edit the ledger. Late first arrivals fail.
  accept      Input: lead identity/version/revision, resultId, optional env.
  retry       Input: lead identity/version/revision, taskId, stopped evidence.
              Verified stale accepted work can reopen with a reason and a new
              retry budget. Its assignment attempt number never resets.
  renew       Input: lead identity/version/revision, leaseMs. The same current
              owner may renew after expiry in this local store.
  note        Input: lead identity/version/revision, next (string or null).
  transfer    Input: old lead identity/version/revision, newOwnerId, leaseMs,
              stopped evidence. All worker claims must be reconciled first.
  gate        Input: lead identity/version/revision, gateId, proofs, optional env.
  integrate   Input: lead identity/version/revision, proofs, optional env;
              or state failed with a reason.

Lead fields: ownerId, ownerVersion, expectedRevision. Read show before mutation.
Time defaults to the current time. Do not put credentials in input files.
Stop evidence is a host-verified fact supplied by the lead, not a process kill.
Locks are never stolen by age. No command, agent, job, or Git action is started.
Separate offline ledger copies cannot prove exclusive ownership.
Exit 0: operation succeeded. Exit 1: invalid/incomplete state. Exit 2: bad CLI input.
`
const load = (root,file) => JSON.parse(readFileSync(resolve(root,file),'utf8'))

export function main(argv = process.argv.slice(2)) {
  if(argv.includes('--help')){process.stdout.write(USAGE);return 0}
  try {
    const {values,positionals}=parseArgs({args:argv,options:{run:{type:'string'},plan:{type:'string'},input:{type:'string'},cwd:{type:'string'},task:{type:'string'},json:{type:'boolean'}},allowPositionals:true,strict:true})
    if(positionals.length!==1 || !values.run)throw new Error('one operation and --run are required')
    const operation=positionals[0], root=resolve(values.cwd ?? process.cwd())
    const input=values.input ? load(root,values.input) : {}
    if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('input must be a JSON object')
    if(Object.hasOwn(input,'now'))throw new Error('now is a test-only API clock; CLI lease checks use the current time')
    let result
    if(operation==='show')result=readRun(root,values.run)
    else {
      if(!values.plan)throw new Error('--plan is required')
      const plan=load(root,values.plan)
      const actions={claim:claimTask,transition:transitionTask,accept:acceptResult,retry:retryTask,renew:renewOwner,note:noteRun,transfer:transferOwner,gate:passGate,integrate:setIntegration}
      if(operation==='init')result=initRun(root,plan,{...input,runId:values.run})
      else if(operation==='submit')result=submitResult(root,values.run,plan,input)
      else if(operation==='inspect')result=inspectRun(root,values.run,plan,input)
      else if(operation==='context'){
        result=inspectRun(root,values.run,plan,input)
        if(result.ok){
          const assignment=result.ledger.tasks[values.task]?.assignment
          if(assignment){const fields=['runId','planId','planRevision','taskId','attempt','ownerVersion','workerId','assignmentId'];result={ok:true,context:Object.fromEntries(fields.map(k=>[k,assignment[k]]))}}
          else if(values.task==='integration' || plan.gates.some(g=>g.id===values.task))result={ok:true,context:proofContext(result.ledger,values.task)}
          else throw new Error('--task must name an assigned task, a gate, or integration')
        }
      }
      else if(actions[operation])result=actions[operation](root,values.run,plan,input)
      else throw new Error(`unknown operation ${operation}`)
    }
    process.stdout.write(`${JSON.stringify(result,null,2)}\n`)
    return result.ok && (operation!=='inspect' || result.mayClaimSuccess) ? 0 : 1
  } catch(error){process.stderr.write(`run-state: ${error.message}\n${USAGE}`);return 2}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main()
