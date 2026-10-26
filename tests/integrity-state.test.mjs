import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {makeTempRoot,cleanupAfter,writeTree} from './fixtures/build.mjs'
import {configureIntegrity,markIntegrityDue,readIntegrityState,inspectCoverage,proposeMemoryUpdate,applyMemoryUpdate} from '../scripts/lib/integrity-state.mjs'
const fixture=t=>{const r=makeTempRoot();cleanupAfter(t,r);writeTree(r,{'memory/current-state.md':'Old fact.\n','src/a.mjs':'export const n=1\n'});return r}
test('queue is off by default and coalesces by branch and target without recursive events',t=>{
 const r=fixture(t);assert.equal(markIntegrityDue(r,{reason:'start'}).queued,false);assert.equal(existsSync(join(r,'.verify')),false)
 configureIntegrity(r,{enabled:true});markIntegrityDue(r,{branch:'a',reason:'start'});markIntegrityDue(r,{branch:'a',reason:'start'});markIntegrityDue(r,{branch:'b',reason:'edit'})
 assert.equal(readIntegrityState(r).queue.length,2);assert.equal(markIntegrityDue(r,{origin:'integrity',reason:'edit'}).queued,false)
})
test('memory proposals require authority, use source preconditions, and repeat without duplicate facts',t=>{
 const r=fixture(t);const p=proposeMemoryUpdate(r,{id:'accepted-U1',reason:'Accepted work',files:[{path:'memory/current-state.md',content:'New fact.\n'}]})
 assert.equal(readFileSync(join(r,'memory/current-state.md'),'utf8'),'Old fact.\n');assert.throws(()=>applyMemoryUpdate(r,p,{}),/authority/)
 const competitor=proposeMemoryUpdate(r,{id:'other',reason:'Other',files:[{path:'memory/current-state.md',content:'Other fact.\n'}]})
 assert.equal(applyMemoryUpdate(r,p,{authorized:true}).applied,true);assert.equal(applyMemoryUpdate(r,p,{authorized:true}).repeated,true)
 assert.throws(()=>applyMemoryUpdate(r,competitor,{authorized:true}),/changed/);assert.equal(readFileSync(join(r,'memory/current-state.md'),'utf8'),'New fact.\n')
 assert.deepEqual(inspectCoverage(r).claims,[])
})
