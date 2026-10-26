#!/usr/bin/env node
// Export/import deliberately mutate state. Preview is read-only. None of these
// operations kills processes, starts an agent, stages files, or commits work.
import {readFileSync,lstatSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {exportHandoff,previewHandoff,importHandoff} from './lib/handoff.mjs'

const usage=`Usage: handoff.mjs <export|preview|import> --plan <plan.json> [--run <id>] [--bundle <handoff.json>] [--input <options.json>] [--cwd <root>]

Export input: ownerId, ownerVersion, expectedRevision, sourceHost, targetHost,
destination, workPaths, stopped {ownerId,version,evidence}, stoppedWorkers
[{workerId,assignmentId,evidence}], optional workspaceManifests by task ID,
and includeProofs. The destination parent must exist. Export seals the source.
Import input: newOwnerId, leaseMs, applyWork. New work files require applyWork:true.
Preview writes nothing. Missing edits or checkout conflicts block import.
The host must confirm all old leads and workers stopped. A string is not a
process check. Disconnected copies cannot prove exclusive ownership.
Proof remains subject to current checkout checks. No Git index is changed.
Exit 0: success. Exit 1: rejected state. Exit 2: invalid CLI arguments.
`
const load=file=>{if(lstatSync(file).size>40_000_000)throw Error('input exceeds 40 MB');return JSON.parse(readFileSync(file,'utf8'))}
export function main(argv=process.argv.slice(2)){
  if(argv.includes('--help')){process.stdout.write(usage);return 0}
  try{
    const {values,positionals}=parseArgs({args:argv,allowPositionals:true,strict:true,options:{plan:{type:'string'},run:{type:'string'},bundle:{type:'string'},input:{type:'string'},cwd:{type:'string'},json:{type:'boolean'}}})
    if(positionals.length!==1||!['export','preview','import'].includes(positionals[0])||!values.plan)throw Error('one operation and --plan are required')
    const root=resolve(values.cwd??process.cwd()),plan=load(resolve(root,values.plan)),options=values.input?load(resolve(root,values.input)):{}
    if(!options||typeof options!=='object'||Array.isArray(options)||Object.hasOwn(options,'now'))throw Error('options must be an object without a test clock')
    if(options.destination)options.destination=resolve(root,options.destination)
    if(options.workspaceManifests)options.workspaceManifests=Object.fromEntries(Object.entries(options.workspaceManifests).map(([key,value])=>[key,resolve(root,value)]))
    let out
    if(positionals[0]==='export'){if(!values.run)throw Error('--run is required');out=exportHandoff(root,values.run,plan,options);if(out.ok){const {bundle,...brief}=out;out={...brief,transferId:bundle.state.transferId,bundleSha256:bundle.sha256}}}
    else {if(!values.bundle)throw Error('--bundle is required');const bundle=load(resolve(root,values.bundle));out=positionals[0]==='preview'?previewHandoff(root,bundle,plan):importHandoff(root,bundle,plan,options)}
    process.stdout.write(`${JSON.stringify(out,null,2)}\n`);return out.ok?0:1
  }catch(error){process.stderr.write(`handoff: ${error.message}\n${usage}`);return 2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main()
