import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { makeFixture, cleanupAfter, childEnv } from './fixtures/build.mjs'
import { collectRepoMap, traceImportPath, createRepoMapCache } from '../scripts/repo-map.mjs'

test('repo-map finds a seeded import path and call evidence without claiming runtime coverage', t => {
  const root=makeFixture({'src/start.mjs':"import { serve } from './server.mjs'\nserve()\n",'src/server.mjs':"import { load } from './store.mjs'\nexport function serve() { return load() }\n",'src/store.mjs':'export function load() { return 3 }\n'})
  cleanupAfter(t,root)
  const map=collectRepoMap(root,{scope:['src']})
  assert.equal(map.coverage.completeWithinPolicy,true)
  assert.deepEqual(traceImportPath(map,'src/start.mjs','src/store.mjs').path,['src/start.mjs','src/server.mjs','src/store.mjs'])
  assert.ok(map.files.find(f=>f.path==='src/server.mjs').calls.some(c=>c.name==='load' && c.line===2))
  assert.match(map.analysisLimit,/not a runtime call graph/)
})

test('repo-map skips excluded, generated, private, binary and linked paths before reading bytes', t => {
  const root=makeFixture({'src/a.mjs':'export const a=1','dist/b.mjs':'secret','private/data.json':'secret','.env':'secret','src/x.png':'secret','src/drop.mjs':'secret'})
  const outside=makeFixture({'secret.mjs':'secret'})
  cleanupAfter(t,root);cleanupAfter(t,outside)
  fs.symlinkSync(outside,join(root,'outside'),process.platform==='win32'?'junction':'dir')
  const reads=[]
  const map=collectRepoMap(root,{exclude:['src/drop.mjs'],fs:{openSync(path,...args){reads.push(path);return fs.openSync(path,...args)}}})
  assert.deepEqual(reads,[join(root,'src','a.mjs')])
  for(const path of ['dist','private','.env','src/x.png','src/drop.mjs','outside']) assert.ok(map.excluded.some(f=>f.path===path),path)
  assert.equal(map.files.length,1)
  assert.equal(map.coverage.completeWithinPolicy,true)
})

test('repo-map rejects scope escapes and checks ancestors of explicit scopes', t => {
  const root=makeFixture({}), outside=makeFixture({'outside.mjs':'private'})
  cleanupAfter(t,root);cleanupAfter(t,outside)
  fs.symlinkSync(outside,join(root,'linked'),process.platform==='win32'?'junction':'dir')
  assert.throws(()=>collectRepoMap(root,{scope:['../outside']}),/relative/)
  let reads=0
  const map=collectRepoMap(root,{scope:['linked/outside.mjs'],fs:{openSync(){reads++;throw Error('must not read')}}})
  assert.equal(reads,0)
  assert.equal(map.files.length,0)
  assert.equal(map.excluded[0].reason,'link')
})

test('repo-map reports unreadable and bounded coverage honestly', t => {
  const root=makeFixture({'src/a.mjs':'export const a=1','src/b.mjs':'export const b=2','src/c.mjs':'export const c=3'})
  cleanupAfter(t,root)
  const map=collectRepoMap(root,{maxFiles:1})
  assert.equal(map.files.length,1)
  assert.equal(map.coverage.completeWithinPolicy,false)
  assert.ok(map.gaps.some(g=>g.reason==='file-limit'))
  const denied=collectRepoMap(root,{fs:{openSync(path,...args){if(path.endsWith('b.mjs'))throw Object.assign(Error('denied'),{code:'EACCES'});return fs.openSync(path,...args)}}})
  assert.equal(denied.coverage.completeWithinPolicy,false)
  assert.deepEqual(denied.unreadable,[{path:'src/b.mjs',code:'EACCES'}])
  assert.equal(denied.files.length,2)
})

test('repo-map rechecks bytes before cache reuse and invalidates changed sources', t => {
  const root=makeFixture({'a.mjs':"import './b.mjs'",'b.mjs':'export const b=1'})
  cleanupAfter(t,root)
  const cache=createRepoMapCache()
  const a=collectRepoMap(root,{cache}), b=collectRepoMap(root,{cache})
  assert.equal(a.sourceVersion,b.sourceVersion)
  assert.equal(b.cache.hits,2)
  fs.writeFileSync(join(root,'a.mjs'),"import './c.mjs'")
  const c=collectRepoMap(root,{cache})
  assert.notEqual(a.sourceVersion,c.sourceVersion)
  assert.equal(c.cache.hits,1)
  assert.equal(traceImportPath(c,'a.mjs','b.mjs').found,false)
  assert.equal(c.files.find(f=>f.path==='a.mjs').imports[0].resolved,null)
})

test('repo-map byte and entry limits report partial scans without reading oversized files', t => {
  const root=makeFixture({'a.mjs':'a'.repeat(100),'b.mjs':'x','c.mjs':'x'})
  cleanupAfter(t,root)
  let reads=0
  const map=collectRepoMap(root,{maxFileBytes:10,maxBytes:1,fs:{openSync(...args){reads++;return fs.openSync(...args)}}})
  assert.equal(reads,1)
  assert.ok(map.gaps.some(g=>g.reason==='file-byte-limit'))
  assert.ok(map.gaps.some(g=>g.reason==='byte-limit'))
  assert.equal(map.coverage.completeWithinPolicy,false)
  const bounded=collectRepoMap(root,{maxEntries:1})
  assert.equal(bounded.coverage.completeWithinPolicy,false)
  assert.ok(bounded.gaps.some(g=>g.reason==='entry-limit'))
})

test('repo-map CLI prints a bounded JSON report and rejects invalid limits', t => {
  const root=makeFixture({'src/a.mjs':'export const a=1'})
  cleanupAfter(t,root)
  const script=resolve('scripts/repo-map.mjs')
  const result=spawnSync(process.execPath,[script,'--cwd',root,'--scope','src','--json'],{encoding:'utf8',env:childEnv()})
  assert.equal(result.status,0,result.stderr)
  assert.equal(JSON.parse(result.stdout).files[0].path,'src/a.mjs')
  const bad=spawnSync(process.execPath,[script,'--max-files','0'],{encoding:'utf8',env:childEnv()})
  assert.equal(bad.status,2)
})

test('repo-map rejects an in-flight source change and bounds candidate output', t => {
  const root=makeFixture({'a.mjs':'work()\n'.repeat(201)})
  cleanupAfter(t,root)
  const bounded=collectRepoMap(root)
  assert.equal(bounded.files[0].calls.length,200)
  assert.equal(bounded.files[0].analysisTruncated,true)
  assert.equal(bounded.coverage.completeWithinPolicy,false)
  let reads=0
  const changed=collectRepoMap(root,{fs:{readSync(fd,...args){const n=fs.readSync(fd,...args);reads++;fs.appendFileSync(join(root,'a.mjs'),'changed');return n}}})
  assert.equal(reads,1)
  assert.equal(changed.files.length,0)
  assert.ok(changed.gaps.some(g=>g.reason==='source-changed'))
})

test('repo-map applies user exclusions without case-sensitive host assumptions', t => {
  const root=makeFixture({'Src/visible.mjs':'export const value=1','other.mjs':'export const other=1'})
  cleanupAfter(t,root)
  let reads=0
  const deniedReads={openSync(){reads++;throw Error('excluded paths must not open')}}
  const scoped=collectRepoMap(root,{scope:['Src'],exclude:['src'],fs:deniedReads})
  assert.equal(reads,0)
  assert.deepEqual(scoped.files,[])
  assert.deepEqual(scoped.excluded,[{path:'Src',reason:'requested-exclusion'}])
  const nested=collectRepoMap(root,{scope:['Src/visible.mjs'],exclude:['sRC'],fs:deniedReads})
  assert.equal(reads,0)
  assert.equal(nested.excluded[0].reason,'requested-exclusion')
})

test('repo-map rejects ambiguous Windows path spellings before reading files', t => {
  const root=makeFixture({'.env':'private','credentials/value.mjs':'private'})
  cleanupAfter(t,root)
  let reads=0
  const noReads={openSync(){reads++;throw Error('ambiguous paths must not open')}}
  for(const path of ['.env.','.env ','credentials~1/value.mjs','credentials./value.mjs','credentials /value.mjs','src/./value.mjs','src//value.mjs','src/value.mjs:stream']){
    assert.throws(()=>collectRepoMap(root,{scope:[path],fs:noReads}),/literal repository-relative path/,path)
    assert.throws(()=>collectRepoMap(root,{exclude:[path],fs:noReads}),/literal repository-relative path/,path)
  }
  assert.equal(reads,0)
})
