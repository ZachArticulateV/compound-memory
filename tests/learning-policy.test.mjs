import {test} from 'node:test'
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {writeFileSync} from 'node:fs'
import {makeTempRoot,cleanupAfter,writeTree} from './fixtures/build.mjs'
import {planLearning} from '../scripts/learning-policy.mjs'
const setup=t=>{const r=makeTempRoot();cleanupAfter(t,r);writeTree(r,{'src/source.mjs':'export const n=1\n','notes.md':'Keep reports short.\nSame fault repeated.\n','memory/lessons/existing.md':'---\ntitle: Keep checks local\ntags: [test]\napplies_when: Running checks\nstatus: active\n---\n\n# Keep checks local\n\n## Do this\n\nRun local checks.\n'});return r}
const observed=(id='one',line=1)=>({id,evidence:{path:'notes.md',line,quote:line===1?'Keep reports short.':'Same fault repeated.'}})
test('find-before-write sends repeated concepts to one existing lesson',t=>{const r=setup(t);const result=planLearning(r,{title:'  KEEP checks local ',rule:'Run local checks.',basis:'observed',observations:[observed()]});assert.equal(result.decision,'merge');assert.equal(result.target,'memory/lessons/existing.md');assert.equal(result.writes,false)})
test('one observation cannot become a global rule and scope never grants a write',t=>{const r=setup(t);assert.throws(()=>planLearning(r,{title:'Short reports',rule:'Keep reports short.',scope:'user',basis:'observed',observations:[observed()]}),/user scope/)
 assert.throws(()=>planLearning(r,{title:'Short reports',rule:'Keep reports short.',scope:'user',userScopeAuthorized:true,basis:'observed',observations:[observed()]}),/one observation/)
 const result=planLearning(r,{title:'Short reports',rule:'Keep reports short.',scope:'user',userScopeAuthorized:true,explicitUserRule:true,basis:'observed',observations:[observed()]});assert.equal(result.decision,'profile-proposal');assert.equal(result.writes,false)
})
test('repeat mechanical faults require captured check proof',t=>{const r=setup(t);const result=planLearning(r,{title:'Fault',rule:'Guard the input.',basis:'observed',mechanical:true,observations:[observed('one'),observed('two',2)]});assert.equal(result.decision,'check-required');assert.throws(()=>planLearning(r,{title:'Fault',rule:'Guard input.',basis:'verified',mechanical:true,observations:[observed('one'),observed('two',2)],checkProof:'.verify/missing.json'}),/proof/)
})
test('unsupported certainty and source drift block capture or retirement',t=>{const r=setup(t);assert.throws(()=>planLearning(r,{title:'Fact',rule:'It works.',basis:'verified',observations:[]}),/evidence/)
 assert.throws(()=>planLearning(r,{title:'Keep checks local',rule:'Retire it.',action:'retire',basis:'observed',observations:[observed()]}),/retirement/)
 const input={title:'Keep checks local',rule:'Retire it.',action:'retire',basis:'observed',retirementReason:'Replaced by a check.',observations:[observed()]};assert.equal(planLearning(r,input).decision,'retire')
 writeFileSync(join(r,'notes.md'),'unrelated');assert.throws(()=>planLearning(r,input),/quote/)
})
