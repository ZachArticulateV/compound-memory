#!/usr/bin/env node
// Find before proposing. This policy never writes lessons or user-wide rules.
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadLessons} from './lessons.mjs'
import {safeIntegrityPath,digest} from './lib/integrity-state.mjs'
import {validateProof} from './lib/proof.mjs'
const check=(yes,message)=>{if(!yes)throw Error(message)}
const normalize=x=>x.trim().toLowerCase().replace(/[ \t]+/g,' ')
const short=x=>typeof x==='string'&&x.trim()&&x.length<=2000
export function planLearning(root,{title,rule,basis,observations=[],scope='project',userScopeAuthorized=false,explicitUserRule=false,mechanical=false,checkProof=null,action='capture',retirementReason=null}={}) {
 check(short(title)&&title.length<=200&&short(rule),'bounded title and rule required')
 check(['observed','inferred','verified'].includes(basis),'unsupported certainty basis')
 check(['project','user'].includes(scope)&&['capture','retire'].includes(action),'invalid learning scope or action')
 check(Array.isArray(observations)&&observations.length>0&&observations.length<=10,'bounded source evidence required')
 const seen=new Set(),evidence=observations.map(o=>{
  check(short(o.id)&&!seen.has(o.id),'distinct observation ids required');seen.add(o.id)
  const e=o.evidence;check(e&&Number.isSafeInteger(e.line)&&e.line>=1&&short(e.quote),'source evidence required')
  const text=readFileSync(safeIntegrityPath(root,e.path),'utf8');check(Buffer.byteLength(text)<=1048576,'source evidence limit exceeded')
  check(text.split(/\r?\n/).slice(e.line-1,e.line-1+e.quote.split('\n').length).join('\n').includes(e.quote),'source quote changed or unsupported')
  return {observationId:o.id,path:e.path,line:e.line,quote:e.quote,sha256:digest(text)}
 })
 // All existing lessons, including retired ones, are searched before choosing a home.
 const existing=loadLessons(root),matches=existing.filter(l=>normalize(l.title)===normalize(title))
 check(matches.length<=1,'duplicate existing lessons require an explicit merge review')
 const common={schemaVersion:1,kind:'learning-proposal',scope,basis,title:title.trim(),rule:rule.trim(),evidence,writes:false,certaintyLimit:'Exact source quotes and proof validity are checked. The lead must assess meaning.'}
 if(scope==='user'){
  check(userScopeAuthorized,'explicit user scope required')
  check(explicitUserRule||observations.length>=2,'one observation cannot become a user-wide rule')
  check(action==='capture','user-wide retirement needs a separate explicit profile review')
  return {...common,decision:'profile-proposal',target:null}
 }
 if(action==='retire'){
  check(matches.length===1&&short(retirementReason),'retirement requires an existing lesson, current evidence and reason')
  return {...common,decision:'retire',target:matches[0].path,retirementReason}
 }
 if(mechanical&&observations.length>=2){
  if(!checkProof)return {...common,decision:'check-required',target:matches[0]?.path??null}
  const proof=validateProof(root,checkProof);check(proof.ok,'current captured check proof required')
  return {...common,decision:'enforced-by-check',target:matches[0]?.path??null,checkProof}
 }
 return {...common,decision:matches.length?'merge':'capture',target:matches[0]?.path??null}
}
export function main(args=process.argv.slice(2)) {
 try{const [root,input]=args;if(args.length!==2)throw Error('Usage: learning-policy.mjs <root> <proposal.json>');process.stdout.write(JSON.stringify(planLearning(root,JSON.parse(readFileSync(input,'utf8'))),null,2)+'\n');return 0}
 catch(error){process.stderr.write(error.message+'\n');return 2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main()
