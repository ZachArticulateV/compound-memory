import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const directory=new URL('../schemas/',import.meta.url)
const load=name=>JSON.parse(readFileSync(new URL(name,directory),'utf8'))
function closedObject(schema,required){
  assert.equal(schema.type,'object')
  assert.equal(schema.additionalProperties,false)
  assert.deepEqual([...schema.required].sort(),[...required].sort())
  for(const field of required)assert.ok(Object.hasOwn(schema.properties,field),`required field ${field} has no declared schema`)
}

test('every shipped JSON Schema can be parsed before a host receives it',()=>{
  const files=readdirSync(fileURLToPath(directory)).filter(name=>name.endsWith('.schema.json'))
  assert.ok(files.includes('portable-handoff.schema.json'))
  assert.ok(files.includes('migration-plan.schema.json'))
  for(const name of files){const schema=load(name);assert.equal(typeof schema,'object',name);assert.ok(typeof schema.$schema==='string',`${name} has no dialect`)}
})

test('portable transport schema declares required state, work bytes, and optional evidence at the correct levels',()=>{
  const schema=load('portable-handoff.schema.json')
  closedObject(schema,['schemaVersion','kind','sourceHost','targetHost','created','sourceRoot','state','checkout','evidence','sha256'])
  assert.equal(schema.properties.schemaVersion.const,1)
  assert.equal(schema.properties.kind.const,'portable-handoff')
  assert.deepEqual(schema.properties.sourceHost.enum,['claude','codex'])
  closedObject(schema.properties.state,['schemaVersion','kind','transferId','ledger','submissions'])
  closedObject(schema.properties.checkout,['kind','head','branch','files','workers'])
  closedObject(schema.properties.checkout.properties.files.items,['path','included','tasks','base','source','current','index'])
  closedObject(schema.properties.evidence,['included','files','missing'])
  closedObject(schema.properties.evidence.properties.files.items,['path','sha256','bytes'])
  closedObject(schema.$defs.fileHash,['sha256','mode'])
  closedObject(schema.$defs.fileBytes,['sha256','mode','bytes'])
  for(const [name,ref] of [['base','fileHash'],['source','fileHash'],['current','fileBytes'],['index','fileBytes']]){
    assert.equal(schema.properties.checkout.properties.files.items.properties[name].$ref,`#/$defs/${ref}`)
    assert.ok(schema.$defs[ref],`missing referenced definition ${ref}`)
  }
  assert.equal(Object.hasOwn(schema.properties,'$defs'),false,'definitions must not become a transport data field')
})

test('migration schema declares exact file changes and preserved conflicts',()=>{
  const schema=load('migration-plan.schema.json')
  closedObject(schema,['schemaVersion','kind','root','action','targetVersion','files','preservedConflicts','sha256'])
  assert.equal(schema.properties.schemaVersion.const,1)
  assert.equal(schema.properties.kind.const,'migration-plan')
  assert.deepEqual(schema.properties.action.enum,['upgrade','disable','remove'])
  closedObject(schema.properties.files.items,['path','beforeSha256','afterSha256','afterBase64','reason'])
  closedObject(schema.properties.preservedConflicts.items,['path','observedSha256','reason'])
  assert.deepEqual(schema.properties.files.items.properties.beforeSha256.type,['string','null'])
  assert.deepEqual(schema.properties.files.items.properties.afterBase64.type,['string','null'])
})
