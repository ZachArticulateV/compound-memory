import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {makeFixture,cleanupAfter,removeTempRoot,initRepo,commitAll,git} from './fixtures/build.mjs'
import {createWorkerWorkspace,auditWorkerWorkspace,integrateWorkerWorkspace,validateWorkspaceClaim} from '../scripts/agents/workspaces.mjs'

test('worker copy keeps staged, unstaged and untracked input, then merges only its owned changes',t=>{
  const root=makeFixture({'src/a.txt':'base','src/b.txt':'base','.gitignore':'.verify/\n'});cleanupAfter(t,root)
  initRepo(root);commitAll(root,'base')
  writeFileSync(join(root,'src/a.txt'),'staged');git(root,['add','src/a.txt'])
  writeFileSync(join(root,'src/a.txt'),'unstaged');writeFileSync(join(root,'notes.txt'),'user new')
  const staged=git(root,['diff','--cached','--binary'])
  const copy=createWorkerWorkspace({root,paths:['src/a.txt']});t.after(()=>removeTempRoot(copy.container))
  assert.equal(validateWorkspaceClaim(root,copy.workspace,copy.manifestPath),true)
  assert.equal(readFileSync(join(copy.workspace,'src/a.txt'),'utf8'),'unstaged')
  assert.equal(readFileSync(join(copy.workspace,'notes.txt'),'utf8'),'user new')
  writeFileSync(join(copy.workspace,'src/a.txt'),'unstaged plus worker')
  const merged=integrateWorkerWorkspace(copy)
  assert.equal(merged.ok,true,merged.error)
  assert.equal(readFileSync(join(root,'src/a.txt'),'utf8'),'unstaged plus worker')
  assert.equal(readFileSync(join(root,'notes.txt'),'utf8'),'user new')
  assert.equal(git(root,['diff','--cached','--binary']),staged)
  assert.equal(integrateWorkerWorkspace(copy).idempotent,true)
  writeFileSync(join(root,'src/a.txt'),'later user edit')
  assert.equal(integrateWorkerWorkspace(copy).ok,false)
})

test('out-of-scope edits and changed source stop integration and keep the worker copy',t=>{
  const root=makeFixture({'src/a.txt':'a','src/b.txt':'b'});cleanupAfter(t,root)
  const copy=createWorkerWorkspace({root,paths:['src/a.txt']});t.after(()=>removeTempRoot(copy.container))
  writeFileSync(join(copy.workspace,'src/b.txt'),'bad')
  assert.equal(auditWorkerWorkspace(copy).ok,false)
  assert.equal(integrateWorkerWorkspace(copy).ok,false)
  assert.equal(readFileSync(join(root,'src/b.txt'),'utf8'),'b')
  writeFileSync(join(copy.workspace,'src/b.txt'),'b')
  writeFileSync(join(copy.workspace,'src/a.txt'),'worker')
  writeFileSync(join(root,'src/a.txt'),'new user change')
  assert.equal(integrateWorkerWorkspace(copy).ok,false)
  assert.equal(readFileSync(join(root,'src/a.txt'),'utf8'),'new user change')
  assert.ok(existsSync(join(copy.workspace,'src/a.txt')))
})

test('copy omits private files and integration handles owned additions and deletions',t=>{
  const root=makeFixture({'src/old.txt':'old','.env':'private','node_modules/pkg/index.js':'dependency','user.txt':'keep'});cleanupAfter(t,root)
  const copy=createWorkerWorkspace({root,paths:['src']});t.after(()=>removeTempRoot(copy.container))
  assert.equal(existsSync(join(copy.workspace,'.env')),false)
  assert.equal(existsSync(join(copy.workspace,'node_modules')),false)
  unlinkSync(join(copy.workspace,'src/old.txt'));writeFileSync(join(copy.workspace,'src/new.txt'),'new')
  assert.deepEqual(auditWorkerWorkspace(copy).changedPaths,['src/new.txt','src/old.txt'])
  assert.equal(integrateWorkerWorkspace(copy).ok,true)
  assert.equal(existsSync(join(root,'src/old.txt')),false)
  assert.equal(readFileSync(join(root,'src/new.txt'),'utf8'),'new')
  assert.equal(readFileSync(join(root,'.env'),'utf8'),'private')
  assert.equal(readFileSync(join(root,'user.txt'),'utf8'),'keep')
})

test('worker copy is bounded and cannot be claimed for a changed source or another root',t=>{
  const root=makeFixture({'src/a.txt':'base'}),other=makeFixture({'src/a.txt':'base'});cleanupAfter(t,root);cleanupAfter(t,other)
  assert.throws(()=>createWorkerWorkspace({root,paths:['src'],maxBytes:1}),/limit/)
  const copy=createWorkerWorkspace({root,paths:['src']});t.after(()=>removeTempRoot(copy.container))
  assert.throws(()=>validateWorkspaceClaim(other,copy.workspace,copy.manifestPath),/lead-owned/)
  writeFileSync(join(root,'src/a.txt'),'new')
  assert.throws(()=>validateWorkspaceClaim(root,copy.workspace,copy.manifestPath),/source changed/)
})
