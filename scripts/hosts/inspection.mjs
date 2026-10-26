// Explicit, bounded native-host inspection. No repair or write-capable fallback.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, realpathSync, lstatSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import {randomUUID} from 'node:crypto'
import { composeCodexArgv, findExecutable, resolveSpawn, extractJson, assertNoWriteEnablingFlags } from '../auditor-bridge.mjs'
import {launchNative} from '../agents/dispatch.mjs'
const issuedRuntimes=new Map()
export function disposeInspectionRuntime(runtime){
  if(!issuedRuntimes.has(runtime))throw new Error('inspection runtime is not owned by this process')
  const owned=issuedRuntimes.get(runtime),marker=join(runtime,'.compound-memory-runtime')
  if(dirname(resolve(runtime))!==resolve(tmpdir())||lstatSync(runtime).isSymbolicLink()||realpathSync(runtime)!==owned.realpath||lstatSync(marker).isSymbolicLink()||readFileSync(marker,'utf8')!==owned.token)throw new Error('inspection runtime path changed')
  rmSync(runtime,{recursive:true});issuedRuntimes.delete(runtime)
}

export function inspectionArgs({ host, root, runtime }) {
  if (host === 'claude') return ['-p', '--safe-mode', '--restricted', '--strict-mcp-config', '--mcp-config', join(runtime,'mcp.json'), '--settings', join(runtime,'settings.json'), '--tools', 'Read,Grep,Glob', '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--no-chrome', '--no-session-persistence', '--output-format', 'stream-json', '--verbose', '--max-budget-usd', '3']
  if (host !== 'codex') throw new Error('unsupported inspection host')
  const args=composeCodexArgv({root,outputPath:join(runtime,'report.txt')})
  args.splice(args.indexOf('--output-schema'),2)
  return assertNoWriteEnablingFlags([...args,'--json'])
}

export function resolveInspectionCommand(host,binary,args,platform=process.platform){
  if(/\.[cm]?js$/i.test(binary))return {file:process.execPath,args:[binary,...args]}
  const resolved=resolveSpawn(binary,args,{platform})
  if(resolved)return resolved
  // Recent Claude npm packages use a native executable rather than a JS shim.
  // Recognize that exact package path. Never execute or interpret the .cmd.
  if(host==='claude'&&platform==='win32'&&/\.cmd$/i.test(binary)){
    const source=readFileSync(binary,'utf8'),native=join(dirname(binary),'node_modules/@anthropic-ai/claude-code/bin/claude.exe')
    if(/^"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude\.exe"[ \t]+%\*[ \t]*$/mi.test(source)&&existsSync(native))return {file:native,args:args.slice()}
  }
  return null
}

export async function runInspection({host,root,prompt,timeoutMs=240000,maxOutputBytes=2097152,executable,env=process.env,signal,retainRuntime=true}={}) {
  if (typeof prompt!=='string' || Buffer.byteLength(prompt)>131072) throw new Error('invalid or oversized inspection prompt')
  if (!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000||!Number.isInteger(maxOutputBytes)||maxOutputBytes<1||maxOutputBytes>4194304) throw new Error('invalid inspection bounds')
  const runtime=mkdtempSync(join(tmpdir(),'compound-memory-inspect-'))
  const token=randomUUID();writeFileSync(join(runtime,'.compound-memory-runtime'),token,{flag:'wx'});issuedRuntimes.set(runtime,{token,realpath:realpathSync(runtime)})
  let safeToDispose=true
  try {
  writeFileSync(join(runtime,'settings.json'),JSON.stringify({disableAllHooks:true,autoMemoryEnabled:false,permissions:{allow:['Read','Grep','Glob'],deny:['Bash','Write','Edit','Agent','Task','WebSearch','WebFetch','NotebookEdit','PowerShell']}}))
  writeFileSync(join(runtime,'mcp.json'),'{"mcpServers":{}}')
  const args=inspectionArgs({host,root:resolve(root),runtime})
  const binary=executable??findExecutable(host,{env})
  if(!binary)throw new Error(`${host} CLI unavailable`)
  const command=resolveInspectionCommand(host,binary,args)
  if(!command)throw new Error('unsupported CLI launcher')
  const childEnv={...env};delete childEnv.NODE_TEST_CONTEXT
  const start=Date.now()
  const execution=await launchNative({invocation:{command:command.file,args:command.args,cwd:root},prompt,timeLimitMs:timeoutMs,outputLimitBytes:maxOutputBytes,signal,processEnv:childEnv})
  writeFileSync(join(runtime,'stdout.txt'),execution.stdout??'');writeFileSync(join(runtime,'stderr.txt'),execution.stderr??'')
  if(!execution.ok){safeToDispose=execution.stopped===true;const error=new Error(`${host} inspection failed: ${execution.error}; evidence: ${runtime}`);error.stopped=execution.stopped;throw error}
  const output=execution.stdout
  const events=output.split(/\r?\n/).flatMap(line=>{try{return[JSON.parse(line)]}catch{return[]}})
  let text,model=null,tools=null,usage=null
  if(host==='claude'){
    const init=events.find(e=>e.type==='system'&&e.subtype==='init'),last=events.findLast(e=>e.type==='result')
    if(!init || !Array.isArray(init.tools) || init.tools.some(t=>!['Read','Grep','Glob'].includes(t)))throw new Error('Claude inspection exposed unexpected tools')
    if(last?.subtype!=='success'||last.is_error)throw new Error('Claude inspection did not complete')
    text=last.result;model=init.model??null;tools=init.tools;usage=last.usage??null
  } else {text=readFileSync(join(runtime,'report.txt'),'utf8');usage=events.findLast(e=>e.type==='turn.completed')?.usage??null}
  const parsed=extractJson(text)
  if(!parsed.ok)throw new Error(parsed.error)
  const report=parsed.value
  return {report,sentPrompt:prompt,host,model,tools,usage,elapsedMs:Date.now()-start,runtime:retainRuntime?runtime:null,permissionProfile:host==='claude'?'file-read-tools':'read-only-filesystem; action features disabled; coordination instructed; actual tool list unavailable'}
  }finally{if(!retainRuntime&&safeToDispose)disposeInspectionRuntime(runtime)}
}
