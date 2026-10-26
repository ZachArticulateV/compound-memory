import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {childEnv} from './fixtures/build.mjs'
import {gradeCase,summarizeCases} from '../evals/acceptance.mjs'
test('acceptance receipts reject each seeded failure and preserve non-pass states',()=>{
 const evidenceRoot=mkdtempSync(join(tmpdir(),'cm-grader-'));writeFileSync(join(evidenceRoot,'result.txt'),'actual output')
 const good={id:'A30-control',kind:'live',state:'passed',host:'claude',version:'test-fixture',model:null,mocked:false,exitCode:0,outcome:true,requiredToolsAvailable:true,evidence:[{path:'result.txt',sha256:createHash('sha256').update('actual output').digest('hex')}]}
 assert.equal(gradeCase(good,{evidenceRoot}).passed,true)
 for(const change of [{requiredToolsAvailable:false},{outcome:false},{mocked:true},{exitCode:1},{version:null},{evidence:[]},{evidence:[{path:'../escape',sha256:'x'}]},{evidence:[{path:'result.txt',sha256:'wrong'}]},{state:'claimed-pass'},{kind:'unknown'}])assert.equal(gradeCase({...good,...change},{evidenceRoot}).ok,false,JSON.stringify(change))
 const summary=summarizeCases([good,{id:'missing',state:'unsupported',reason:'CLI absent',required:true},{id:'opt',state:'skipped',reason:'not enabled'}],{evidenceRoot,requiredIds:['missing']});assert.deepEqual(summary.counts,{passed:1,failed:0,skipped:1,unsupported:1});assert.equal(summary.allRequiredPassed,false)
 assert.equal(summarizeCases([good,good],{evidenceRoot,requiredIds:[good.id]}).invalid.length,1)
 assert.equal(summarizeCases([]).allRequiredPassed,false)
 assert.equal(summarizeCases([good],{evidenceRoot,requiredIds:['absent']}).allRequiredPassed,false)
 assert.equal(summarizeCases([null],{evidenceRoot,requiredIds:['absent']}).allRequiredPassed,false)
})
test('a nested failing Node test retains its failure exit',()=>{
 const root=mkdtempSync(join(tmpdir(),'cm-nested-'));const file=join(root,'bad.test.mjs');writeFileSync(file,"import {test} from 'node:test';test('seeded failure',()=>{throw new Error('EXPECTED_SEEDED_FAILURE')});")
 const result=spawnSync(process.execPath,['--test',file],{encoding:'utf8',env:childEnv(),windowsHide:true});assert.equal(result.status,1);assert.match(result.stdout+result.stderr,/EXPECTED_SEEDED_FAILURE/)
})
