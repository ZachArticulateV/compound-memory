#!/usr/bin/env node
// Local upgrade/disable/removal plans. Native host installation is separate.
// Memory and unrelated user settings are never migration targets.
import {createHash,randomUUID} from 'node:crypto'
import {existsSync,lstatSync,readFileSync,readdirSync,mkdirSync,writeFileSync,realpathSync,renameSync,unlinkSync,rmdirSync,chmodSync} from 'node:fs'
import {dirname,join,resolve,relative,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {withScheduleMetadata} from './scheduling/local.mjs'
import {removeContinuityPermissions} from './hosts/context.mjs'

const INSTALL='.verify/compound-memory-install.json'
const CONFIG='.verify/integrity/config.json'
const STATUS_OWNER='.verify/integrity/status-line-owner.json'
const SETTINGS='.claude/settings.local.json'
const ensure=(value,message)=>{if(!value)throw Error(message)}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const digest=value=>hash(canonical(value))
const planHash=plan=>digest(Object.fromEntries(Object.entries(plan).filter(([k])=>k!=='sha256')))
const jsonBytes=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`)
const sameJson=(a,b)=>canonical(a)===canonical(b)
const wrap=fn=>{try{return fn()}catch(error){return {ok:false,error:error.message}}}
function noLinks(path){let next=resolve(path);while(true){if(existsSync(next))ensure(!lstatSync(next).isSymbolicLink(),'linked migration paths are not allowed');const parent=dirname(next);if(parent===next)break;next=parent}return resolve(path)}
function projectRoot(root){const path=realpathSync(noLinks(root));ensure(lstatSync(path).isDirectory(),'project root is not a directory');return path}
function pathAt(root,path){ensure(typeof path==='string'&&path&&!isAbsolute(path)&&!/[\\:\x00-\x1f~]/.test(path)&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p)),'invalid migration path');return noLinks(join(root,path))}
function read(root,path,maxBytes=2_000_000){const file=pathAt(root,path);if(!existsSync(file))return null;const stat=lstatSync(file);ensure(stat.isFile()&&stat.size<=maxBytes,'migration input exceeds its regular-file byte limit');return {bytes:readFileSync(file),mode:stat.mode&0o777}}
const fileHash=value=>value?hash(value.bytes):null
function object(value,label){ensure(value&&typeof value==='object'&&!Array.isArray(value),`${label} must be a JSON object`);return value}
function parsed(value,label){return value?object(JSON.parse(value.bytes.toString('utf8')),label):null}
function ownedPath(path){return [INSTALL,CONFIG,STATUS_OWNER,SETTINGS].includes(path)||/^\.verify\/schedules\/[a-z][a-z0-9-]{0,48}\.json$/.test(path)}
function change(path,before,after,reason){return {path,beforeSha256:fileHash(before),afterSha256:after?hash(after):null,afterBase64:after?after.toString('base64'):null,reason}}

/** Read-only. The returned plan lists exact before/after hashes. */
export function previewMigration(root,{action,targetVersion='2.0.0'}={}){
  return wrap(()=>{
    root=projectRoot(root)
    ensure(['upgrade','disable','remove'].includes(action),'action must be upgrade, disable, or remove')
    ensure(/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(targetVersion),'invalid target version')
    const files=[],preservedConflicts=[],installBefore=read(root,INSTALL),prior=parsed(installBefore,'installation receipt')
    if(prior)ensure(prior.schemaVersion===1&&prior.owner==='compound-memory'&&typeof prior.enabled==='boolean','installation receipt is not owned or uses an unsupported version')
    const enabled=action==='upgrade'?(prior?.enabled??true):false
    const installation={...prior,schemaVersion:1,owner:'compound-memory',version:targetVersion,enabled,state:action==='remove'?'removed':enabled?'installed':'disabled'}
    if(!sameJson(prior,installation))files.push(change(INSTALL,installBefore,jsonBytes(installation),'Record this project version and local hook state.'))
    if(action!=='upgrade'){
      const configBefore=read(root,CONFIG),config=parsed(configBefore,'integrity configuration')
      if(config){ensure(config.schemaVersion===1&&typeof config.enabled==='boolean','unsupported integrity configuration');if(config.enabled)files.push(change(CONFIG,configBefore,jsonBytes({...config,enabled:false}),'Turn off queued integrity checks.'))}
      const schedules=pathAt(root,'.verify/schedules')
      if(existsSync(schedules)){
        ensure(lstatSync(schedules).isDirectory(),'schedule path is not a directory')
        const names=readdirSync(schedules).filter(name=>/^[a-z][a-z0-9-]{0,48}\.json$/.test(name)).sort()
        ensure(names.length<=1000,'too many schedule files for a bounded migration')
        for(const name of names){
          const path=`.verify/schedules/${name}`,before=read(root,path),job=parsed(before,'schedule')
          if(job.owner!=='compound-memory')continue
          ensure(job.schemaVersion===1&&job.root===root&&name===`${job.id}.json`&&typeof job.enabled==='boolean','owned schedule identity changed')
          const active=existsSync(pathAt(root,`.verify/schedules/${job.id}.lock`))
          if(active)preservedConflicts.push({path,observedSha256:fileHash(before),reason:action==='remove'?'Keep the active or unconfirmed job and its run lock. Pause new runs. Remove it only after the host confirms the old run stopped.':'Keep the active or unconfirmed run and its lock. Pause new runs without claiming that the current process stopped.'})
          if(action==='remove'&&!active)files.push(change(path,before,null,'Remove this inactive plugin-owned job configuration. Reports stay.'))
          else if(job.enabled)files.push(change(path,before,jsonBytes({...job,enabled:false}),'Pause this plugin-owned job.'))
        }
      }
      const ownerBefore=read(root,STATUS_OWNER),owner=parsed(ownerBefore,'status-line ownership')
      if(owner&&!owner.restored){
        ensure(owner.schemaVersion===1&&owner.settingsPath===SETTINGS&&typeof owner.hadPrior==='boolean'&&owner.owned&&Object.hasOwn(owner,'prior'),'unsupported status-line ownership receipt')
        const settingsBefore=read(root,SETTINGS),settings=parsed(settingsBefore,'Claude project settings')
        if(settings&&sameJson(settings.statusLine,owner.owned)){
          const after=removeContinuityPermissions(settings,owner).settings;if(owner.hadPrior)after.statusLine=owner.prior;else delete after.statusLine
          files.push(change(SETTINGS,settingsBefore,jsonBytes(after),'Restore the previous status line and remove only added continuity permissions.'))
          files.push(change(STATUS_OWNER,ownerBefore,jsonBytes({...owner,restored:true}),'Mark the exact owned status line as restored.'))
        }else{
          // A user replacement is not ours to restore. It must not keep the
          // remaining plugin hooks or owned scheduled checks running.
          preservedConflicts.push({path:SETTINGS,observedSha256:fileHash(settingsBefore),reason:'The owned status line changed or is missing. Keep the user display and unrelated settings.'})
          if(owner.continuityPermissions){
            if(settings){const cleanup=removeContinuityPermissions(settings,owner);if(cleanup.removed)files.push(change(SETTINGS,settingsBefore,jsonBytes(cleanup.settings),'Remove only added continuity permissions; keep the user status line.'))}
            files.push(change(STATUS_OWNER,ownerBefore,jsonBytes({...owner,restored:true,statusLinePreserved:true}),'Release owned continuity setup while preserving the user display.'))
          }
        }
      }
    }
    const plan={schemaVersion:1,kind:'migration-plan',root,action,targetVersion,files,preservedConflicts}
    ensure(Buffer.byteLength(JSON.stringify(plan))<=12_000_000,'migration plan exceeds 12 MB')
    plan.sha256=planHash(plan)
    return {ok:true,plan,preservedConflicts,preserved:['memory/','AGENTS.md','CLAUDE.md','unrelated settings','unowned schedules','past reports','worker copies'],hostInstallation:'Native plugin enable, disable, and uninstall remain explicit host actions.'}
  })
}

function migrationDir(root){const directory=pathAt(root,'.verify/migrations');mkdirSync(directory,{recursive:true});return directory}
function lock(root,work){const directory=migrationDir(root),file=noLinks(join(directory,'.lock'));try{mkdirSync(file)}catch(error){if(error.code==='EEXIST')throw Error('migration is locked; confirm the old writer stopped before recovery');throw error}try{return work(directory)}finally{rmdirSync(file)}}
function scheduleLocks(root,entries,action){
  const ids=[...new Set(entries.map(entry=>/^\.verify\/schedules\/([a-z][a-z0-9-]{0,48})\.json$/.exec(entry.path)?.[1]).filter(Boolean))].sort()
  const take=index=>index===ids.length?action():withScheduleMetadata(root,ids[index],()=>take(index+1))
  return take(0)
}
function write(root,path,bytes,mode=0o600){const file=pathAt(root,path);if(bytes===null){if(existsSync(file))unlinkSync(file);return}mkdirSync(noLinks(dirname(file)),{recursive:true});const temp=noLinks(`${file}.migration-${randomUUID()}`);writeFileSync(temp,bytes,{flag:'wx',mode});try{renameSync(temp,file);chmodSync(file,mode)}finally{if(existsSync(temp))unlinkSync(temp)}}
function saveReceipt(file,receipt){const temp=noLinks(`${file}.${randomUUID()}.tmp`);writeFileSync(temp,jsonBytes(receipt),{flag:'wx'});renameSync(temp,noLinks(file))}
function checkedPlan(root,plan){
  ensure(plan?.schemaVersion===1&&plan.kind==='migration-plan'&&plan.root===root&&plan.sha256===planHash(plan),'invalid or changed migration plan')
  const current=previewMigration(root,{action:plan.action,targetVersion:plan.targetVersion});ensure(current.ok,current.error)
  ensure(current.plan.sha256===plan.sha256,'project changed since preview, or plan was altered; preview again')
  return current.plan
}

export function applyMigration(root,plan){
  return wrap(()=>{
    root=projectRoot(root);checkedPlan(root,plan)
    if(!plan.files.length)return {ok:true,idempotent:true,changedPaths:[],receiptPath:null,preservedConflicts:plan.preservedConflicts}
    return lock(root,directory=>scheduleLocks(root,[...plan.files,...plan.preservedConflicts],()=>{
      checkedPlan(root,plan)
      const id=randomUUID(),folder=noLinks(join(directory,id));mkdirSync(folder)
      const files=plan.files.map(file=>{ensure(ownedPath(file.path),'migration path is not owned');const before=read(root,file.path);ensure(fileHash(before)===file.beforeSha256,'source changed since preview');return {...file,beforeBase64:before?before.bytes.toString('base64'):null,beforeMode:before?.mode??null}})
      const receipt={schemaVersion:1,kind:'migration-receipt',owner:'compound-memory',id,root,planSha256:plan.sha256,action:plan.action,targetVersion:plan.targetVersion,status:'prepared',files,preservedConflicts:plan.preservedConflicts,applied:[]}
      const receiptPath=join(folder,'receipt.json');saveReceipt(receiptPath,receipt)
      try{
        for(const file of files){ensure(fileHash(read(root,file.path))===file.beforeSha256,'source changed during migration');write(root,file.path,file.afterBase64===null?null:Buffer.from(file.afterBase64,'base64'),file.beforeMode??0o600);receipt.applied.push(file.path);saveReceipt(receiptPath,receipt)}
        receipt.status='applied';saveReceipt(receiptPath,receipt)
        return {ok:true,changedPaths:receipt.applied,receiptPath,preservedConflicts:plan.preservedConflicts,backup:'The receipt keeps exact original bytes. Keep it for rollback.'}
      }catch(error){receipt.status='partial';receipt.error=error.message;saveReceipt(receiptPath,receipt);return {ok:false,error:error.message,changedPaths:receipt.applied,receiptPath,recovery:'Keep the receipt. Run rollback after checking for later edits.'}}
    }))
  })
}

function receiptAt(root,receiptPath){const file=noLinks(resolve(root,receiptPath)),rel=relative(root,file).replace(/\\/g,'/');ensure(/^\.verify\/migrations\/[a-f0-9-]+\/receipt\.json$/.test(rel),'rollback receipt must be inside this project migration store');const bytes=read(root,rel,40_000_000);ensure(bytes,'rollback receipt is missing');const receipt=parsed(bytes,'migration receipt');ensure(receipt.schemaVersion===1&&receipt.kind==='migration-receipt'&&receipt.owner==='compound-memory'&&receipt.root===root&&join(root,'.verify','migrations',receipt.id,'receipt.json')===file,'migration receipt identity changed');ensure(['prepared','partial','applied','rolling-back','rolled-back'].includes(receipt.status)&&Array.isArray(receipt.files)&&receipt.files.length<=1004,'invalid migration receipt');const paths=new Set();for(const entry of receipt.files){ensure(ownedPath(entry.path)&&!paths.has(entry.path.toLowerCase()),'unowned or duplicate rollback path');paths.add(entry.path.toLowerCase());for(const stage of ['before','after']){const bytes=entry[`${stage}Base64`],expected=entry[`${stage}Sha256`];ensure(bytes===null?expected===null:typeof bytes==='string'&&Buffer.from(bytes,'base64').toString('base64')===bytes&&hash(Buffer.from(bytes,'base64'))===expected,'rollback bytes changed')}ensure(entry.beforeMode===null||Number.isInteger(entry.beforeMode)&&entry.beforeMode>=0&&entry.beforeMode<=511,'invalid original mode')}return {file,receipt}}

export function rollbackMigration(root,receiptPath){
  return wrap(()=>{
    root=projectRoot(root)
    const initial=receiptAt(root,receiptPath)
    if(initial.receipt.status==='rolled-back')return {ok:true,idempotent:true,changedPaths:[]}
    return lock(root,()=>scheduleLocks(root,initial.receipt.files,()=>{
      const {file,receipt}=receiptAt(root,receiptPath)
      const pending=[]
      for(const entry of receipt.files){const actual=fileHash(read(root,entry.path));if(actual===entry.beforeSha256&&['prepared','partial','rolling-back'].includes(receipt.status))continue;ensure(actual===entry.afterSha256,`file changed after migration: ${entry.path}; preserve the later edit`);pending.push(entry)}
      const restored=receipt.restored??[]
      receipt.status='rolling-back';receipt.restored=restored;saveReceipt(file,receipt)
      for(const entry of pending.reverse()){ensure(fileHash(read(root,entry.path))===entry.afterSha256,'file changed during rollback');write(root,entry.path,entry.beforeBase64===null?null:Buffer.from(entry.beforeBase64,'base64'),entry.beforeMode??0o600);restored.push(entry.path);saveReceipt(file,receipt)}
      receipt.status='rolled-back';receipt.restored=restored;saveReceipt(file,receipt)
      return {ok:true,idempotent:false,changedPaths:restored,receiptPath:file}
    }))
  })
}

const usage=`Usage: migrate.mjs preview --action <upgrade|disable|remove> --version <version> [--cwd <root>]
       migrate.mjs apply --plan <saved-preview-plan.json> [--cwd <root>]
       migrate.mjs rollback --receipt <receipt.json> [--cwd <root>]
Preview writes nothing. Save only its plan object for apply. Apply verifies it
against current files and keeps exact original bytes. Rollback refuses later
edits. Disable silences owned local hooks, pauses owned schedules, and restores
the owned status line. Remove also removes inactive owned job configurations.
An active or unconfirmed run is kept and reported. Its job is paused, not killed.
Memory, user rules, reports, and unrelated settings remain. Native host plugin
installation/removal is a separate explicit host action. No model calls run.
`
export function main(argv=process.argv.slice(2)){
  if(argv.includes('--help')){process.stdout.write(usage);return 0}
  try{const {values,positionals}=parseArgs({args:argv,allowPositionals:true,strict:true,options:{cwd:{type:'string'},action:{type:'string'},version:{type:'string'},plan:{type:'string'},receipt:{type:'string'},json:{type:'boolean'}}});ensure(positionals.length===1,'one operation is required');const root=resolve(values.cwd??process.cwd());let result;if(positionals[0]==='preview')result=previewMigration(root,{action:values.action,targetVersion:values.version});else if(positionals[0]==='apply'){ensure(values.plan,'--plan is required');const file=resolve(root,values.plan);ensure(lstatSync(file).size<=12_000_000,'plan is too large');result=applyMigration(root,JSON.parse(readFileSync(file,'utf8')))}else if(positionals[0]==='rollback'){ensure(values.receipt,'--receipt is required');result=rollbackMigration(root,values.receipt)}else throw Error('unknown migration operation');process.stdout.write(`${JSON.stringify(result,null,2)}\n`);return result.ok?0:1}catch(error){process.stderr.write(`migration: ${error.message}\n${usage}`);return 2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main()
