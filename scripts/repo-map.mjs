#!/usr/bin/env node
// A bounded, read-only source map. It does not execute source or crawl links.
import * as nativeFs from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const GENERATED=new Set(['.git','.verify','.next','.nuxt','.cache','node_modules','vendor','dist','build','out','coverage','target','bin','obj','.venv','venv','__pycache__','generated'])
const PRIVATE=new Set(['private','secrets','.ssh','.aws','.azure','.config','.codex','.claude','credentials'])
const TEXT=new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.py','.rb','.go','.rs','.java','.cs','.c','.h','.cpp','.hpp','.vue','.svelte','.html','.css','.scss','.json','.yaml','.yml','.toml','.md','.sql','.sh','.ps1'])
const JS=new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx'])
const CACHE_STORE=new WeakMap()
const MAX_CANDIDATES=200
const MAX_CACHE_ENTRIES=1000
const hash=data=>createHash('sha256').update(data).digest('hex')
const posix=p=>p.split(sep).join('/')
const sorted=values=>[...values].sort()
const lineAt=(text,index)=>text.slice(0,index).split('\n').length
const inside=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`))}
const limitsDefault={maxFiles:200,maxEntries:2000,maxBytes:2_000_000,maxFileBytes:128_000,maxDepth:12}

/** A process-local parse cache. Current bytes are always read and hashed first. */
export function createRepoMapCache(){const token={};CACHE_STORE.set(token,new Map());return token}

function literalPath(value,label){
  const fail=()=>{throw Error(`${label} must be a literal repository-relative path`)}
  if(typeof value!=='string'||!value||isAbsolute(value)||value.includes('\\')||/[\x00-\x1f:*?\[\]~]/.test(value))fail()
  const normalized=value.replace(/^\.\//,'').replace(/\/$/,'')
  if(normalized==='.')return normalized
  if(!normalized||normalized.split('/').some(part=>!part||part==='.'||part==='..'||/[. ]$/.test(part)))fail()
  return normalized
}
function reasonFor(rel,exclude){
  // Exclude conservatively on every OS. A case-sensitive Linux disk may omit
  // more, but a Windows/macOS alias must not bypass the requested boundary.
  const folded=rel.toLowerCase()
  if(exclude.some(p=>{const lower=p.toLowerCase();return lower==='.'||folded===lower||folded.startsWith(lower+'/')}))return 'requested-exclusion'
  if(rel!=='.'&&rel.split('/').some(part=>part.includes('~')||/[. ]$/.test(part)))return 'ambiguous-path'
  for(const part of rel.toLowerCase().split('/')){
    if(GENERATED.has(part))return 'generated-or-dependency'
    if(PRIVATE.has(part)||part==='.env'||part.startsWith('.env.')||/^(?:credentials|secrets?)(?:\.|$)/.test(part)||/\.(?:pem|key|p12|pfx|keystore)$/.test(part))return 'private-name'
  }
  return null
}

// These are lexical candidates, not an AST or execution analysis. Comments and
// strings can contain false positives. Returned line references need scout review.
function parseSource(text,extension){
  if(!JS.has(extension))return {imports:[],calls:[],analysis:'inventory-only',analysisTruncated:false}
  const imports=[]
  let analysisTruncated=false
  const patterns=[/\b(?:import|export)[ \t]+(?:[^;\r\n]*?[ \t]+from[ \t]+)?['"]([^'"\r\n]+)['"]/g,/\b(?:require|import)[ \t]*\([ \t]*['"]([^'"\r\n]+)['"][ \t]*\)/g]
  for(const pattern of patterns)for(const m of text.matchAll(pattern)){
    if(imports.length>=MAX_CANDIDATES){analysisTruncated=true;break}
    imports.push({specifier:m[1],line:lineAt(text,m.index)})
  }
  const calls=[]
  const keywords=new Set(['if','for','while','switch','catch','function','import','require'])
  for(const m of text.matchAll(/\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)[ \t]*\(/g))if(!keywords.has(m[1])){
    if(calls.length>=MAX_CANDIDATES){analysisTruncated=true;break}
    calls.push({name:m[1],line:lineAt(text,m.index)})
  }
  return {imports:imports.sort((a,b)=>a.line-b.line||a.specifier.localeCompare(b.specifier)),calls,analysis:'lexical-javascript-candidates',analysisTruncated}
}

/**
 * Map only named scopes. Exclusions are literal paths; limits are positive ints.
 * fs is an injectable filesystem seam for denial tests. No persistent cache,
 * source text, Git command, network call, or write is part of this operation.
 */
export function collectRepoMap(root,options={}){
  const io={...nativeFs,...options.fs}
  const lexicalRoot=resolve(root)
  if(io.lstatSync(lexicalRoot).isSymbolicLink())throw Error('repository root must not be a link')
  const absRoot=io.realpathSync(lexicalRoot)
  if(!io.lstatSync(absRoot).isDirectory())throw Error('repository root must be a directory')
  const scope=sorted(new Set((options.scope??['.']).map(p=>literalPath(p,'scope'))))
  const exclude=sorted(new Set((options.exclude??[]).map(p=>literalPath(p,'exclude'))))
  if(!scope.length)throw Error('scope must not be empty')
  const limits={...limitsDefault}
  for(const key of Object.keys(limits))if(options[key]!==undefined){if(!Number.isSafeInteger(options[key])||options[key]<1)throw Error(`${key} must be a positive integer`);limits[key]=options[key]}
  const cache=options.cache===undefined?null:CACHE_STORE.get(options.cache)
  if(options.cache!==undefined&&!cache)throw Error('cache must come from createRepoMapCache')
  const report={schemaVersion:1,root:posix(absRoot),scope,exclude,limits,files:[],inspectedDirectories:[],excluded:[],unreadable:[],gaps:[],coverage:{completeWithinPolicy:false,wholeRepository:false,entriesSeen:0,filesRead:0,bytesRead:0},cache:{hits:0,misses:0},sourceVersion:null,sourceVersionBasis:'Hashes of bytes observed during this scan; not an atomic checkout snapshot.',analysisLimit:'Static import and call candidates only; not a runtime call graph. Non-JavaScript files are inventory only. At most 200 imports and 200 calls per file. Excluded content is not inspected. Concurrent filesystem replacement is not a security boundary.'}
  const visited=new Set(), known=new Set(), directorySet=new Set()
  const add=(kind,path,reason)=>{const key=`${kind}:${path}:${reason}`;if(known.has(key))return;known.add(key);report[kind].push(kind==='unreadable'?{path,code:reason}:{path,reason})}
  function safeMetadata(rel){
    let here=absRoot
    try{
      for(const part of (rel==='.'?[]:rel.split('/'))){
        here=join(here,part)
        if(io.lstatSync(here).isSymbolicLink()){add('excluded',rel,'link');return null}
      }
      const actual=io.realpathSync(here)
      if(!inside(absRoot,actual)){add('excluded',rel,'external-path');return null}
      return io.lstatSync(here)
    }catch(error){add('unreadable',rel,error.code??'READ_ERROR');return null}
  }
  function walk(rel,depth){
    if(visited.has(rel))return
    visited.add(rel)
    const excluded=reasonFor(rel,exclude)
    if(excluded){add('excluded',rel,excluded);return}
    if(report.coverage.entriesSeen>=limits.maxEntries){add('gaps',rel,'entry-limit');return}
    report.coverage.entriesSeen++
    const stat=safeMetadata(rel)
    if(!stat)return
    const abs=resolve(absRoot,rel)
    if(stat.isDirectory()){
      if(depth>=limits.maxDepth){add('gaps',rel,'depth-limit');return}
      let dir
      try{
        dir=io.opendirSync(abs)
        directorySet.add(rel)
        // Directory iteration is bounded too. Do not materialize an unbounded
        // readdir list merely to sort it before applying the entry budget.
        for(let entry;(entry=dir.readSync())!==null;){
          if(report.coverage.entriesSeen>=limits.maxEntries){add('gaps',rel,'entry-limit');break}
          walk(rel==='.'?entry.name:`${rel}/${entry.name}`,depth+1)
        }
      }catch(error){add('unreadable',rel,error.code??'READ_ERROR')}
      finally{dir?.closeSync()}
      return
    }
    if(!stat.isFile()){add('excluded',rel,'not-regular-file');return}
    const extension=extname(rel).toLowerCase()
    if(!TEXT.has(extension)){add('excluded',rel,'binary-or-unknown-type');return}
    if(/(?:\.min\.[cm]?js|\.map|\.lock|\.generated\.[^.]+)$/.test(rel)||['package-lock.json','npm-shrinkwrap.json','pnpm-lock.yaml','yarn.lock'].includes(basename(rel))){add('excluded',rel,'generated-or-lockfile');return}
    if(report.files.length>=limits.maxFiles){add('gaps',rel,'file-limit');return}
    if(stat.size>limits.maxFileBytes){add('gaps',rel,'file-byte-limit');return}
    if(report.coverage.bytesRead+stat.size>limits.maxBytes){add('gaps',rel,'byte-limit');return}
    let fd
    try{
      // Recheck all ancestors immediately before opening. Never follow a link
      // discovered during traversal. Changes while reading invalidate coverage.
      if(!safeMetadata(rel))return
      fd=io.openSync(abs,'r')
      const before=io.fstatSync(fd)
      if(!before.isFile()||before.size!==stat.size||before.mtimeMs!==stat.mtimeMs){add('gaps',rel,'source-changed');return}
      const buffer=Buffer.alloc(before.size)
      let read=0
      while(read<buffer.length){const n=io.readSync(fd,buffer,read,buffer.length-read,read);if(!n)break;read+=n}
      report.coverage.bytesRead+=read
      const after=io.fstatSync(fd)
      if(read!==buffer.length||after.size!==before.size||after.mtimeMs!==before.mtimeMs){add('gaps',rel,'source-changed');return}
      if(buffer.includes(0)){add('excluded',rel,'binary-content');return}
      let text
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{add('excluded',rel,'non-utf8-content');return}
      const digest=hash(buffer),key=`${extension}:${digest}`
      let facts=cache?.get(key)
      if(facts)report.cache.hits++
      else{
        facts=parseSource(text,extension);report.cache.misses++
        if(cache){if(cache.size>=MAX_CACHE_ENTRIES)cache.delete(cache.keys().next().value);cache.set(key,facts)}
      }
      if(facts.analysisTruncated)add('gaps',rel,'analysis-limit')
      report.files.push({path:rel,bytes:buffer.length,sha256:digest,lines:text?text.split('\n').length:0,...structuredClone(facts)})
    }catch(error){add('unreadable',rel,error.code??'READ_ERROR')}
    finally{if(fd!==undefined)io.closeSync(fd)}
  }
  for(const rel of scope)walk(rel,0)
  report.files.sort((a,b)=>a.path.localeCompare(b.path))
  report.inspectedDirectories=sorted(directorySet)
  for(const key of ['excluded','unreadable','gaps'])report[key].sort((a,b)=>a.path.localeCompare(b.path))
  const paths=new Set(report.files.map(file=>file.path))
  for(const file of report.files)for(const imp of file.imports){
    imp.resolved=null
    if(!imp.specifier.startsWith('.')){imp.resolution='external-package-or-alias';continue}
    const abs=resolve(absRoot,dirname(file.path),imp.specifier)
    if(!inside(absRoot,abs)){imp.resolution='outside-scope';continue}
    const stem=posix(relative(absRoot,abs))
    imp.resolved=[stem,...['.js','.mjs','.cjs','.ts','.tsx','.jsx'].map(ext=>stem+ext),...['index.js','index.mjs','index.ts','index.tsx'].map(name=>`${stem}/${name}`)].find(candidate=>paths.has(candidate))??null
    imp.resolution=imp.resolved?'observed-file':'not-inspected'
  }
  report.coverage.filesRead=report.files.length
  report.coverage.completeWithinPolicy=report.unreadable.length===0&&report.gaps.length===0
  report.sourceVersion=hash(JSON.stringify({scope,exclude,limits,files:report.files.map(({path,sha256})=>({path,sha256})),excluded:report.excluded,gaps:report.gaps,unreadable:report.unreadable}))
  return report
}

/** Trace observed local imports only. Calls remain candidates for human/model review. */
export function traceImportPath(map,from,to){
  const files=new Map(map.files.map(file=>[file.path,file])),queue=[[from]],seen=new Set()
  while(queue.length){const path=queue.shift(),tail=path.at(-1);if(seen.has(tail)||!files.has(tail))continue;seen.add(tail)
    if(tail===to)return {found:true,path,sourceVersion:map.sourceVersion,basis:'observed-static-imports',runtimeVerified:false}
    for(const edge of files.get(tail).imports)if(edge.resolved&&!seen.has(edge.resolved))queue.push([...path,edge.resolved])
  }
  return {found:false,path:[],sourceVersion:map.sourceVersion,basis:'observed-static-imports',runtimeVerified:false,reason:'No path among inspected import candidates; this does not prove no runtime path exists.'}
}

function main(){
  try{
    const {values}=parseArgs({options:{cwd:{type:'string'},scope:{type:'string',multiple:true},exclude:{type:'string',multiple:true},'max-files':{type:'string'},'max-entries':{type:'string'},'max-bytes':{type:'string'},'max-file-bytes':{type:'string'},'max-depth':{type:'string'},json:{type:'boolean'},help:{type:'boolean'}}})
    if(values.help){console.log('Usage: repo-map.mjs [--cwd dir] [--scope relative-path] [--exclude relative-path] [--max-files n] [--max-entries n] [--max-bytes n] [--max-file-bytes n] [--max-depth n] [--json]\nRead-only. Repeat scope/exclude flags. JSON reports limits and omitted paths. No code is executed.');return}
    const opts={scope:values.scope,exclude:values.exclude}
    for(const key of Object.keys(limitsDefault)){const flag=key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());if(values[flag]!==undefined)opts[key]=Number(values[flag])}
    console.log(JSON.stringify(collectRepoMap(values.cwd??process.cwd(),opts),null,2))
  }catch(error){console.error(`repo-map: ${error.message}`);process.exitCode=2}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main()
