import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {inspectionArgs,resolveInspectionCommand} from '../scripts/hosts/inspection.mjs'
import {classifyFailure} from '../scripts/auditor-bridge.mjs'
test('a killed partial audit cannot fall back as an environment success',()=>{assert.equal(classifyFailure({killed:true,stdout:'partial analysis',stderr:''}).kind,'error');assert.equal(classifyFailure({killed:true,stdout:'',error:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'}).kind,'error')})
test('native inspection uses restrictive host profiles and refuses unknown hosts',()=>{const claude=inspectionArgs({host:'claude',root:'r',runtime:'t'});assert.equal(claude[claude.indexOf('--tools')+1],'Read,Grep,Glob');assert.ok(claude.includes('--restricted'));const codex=inspectionArgs({host:'codex',root:'r',runtime:'t'});assert.equal(codex[codex.indexOf('-s')+1],'read-only');assert.ok(codex.includes('--ignore-user-config'));assert.ok(!codex.includes('--output-schema'));assert.throws(()=>inspectionArgs({host:'unknown'}))})
test('Claude native npm shim resolves without a shell; unfamiliar shim fails closed',()=>{const root=mkdtempSync(join(tmpdir(),'cm-native-')),shim=join(root,'claude.cmd'),native=join(root,'node_modules/@anthropic-ai/claude-code/bin/claude.exe');mkdirSync(dirname(native),{recursive:true});writeFileSync(native,'fixture');writeFileSync(shim,'@ECHO off\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\n');assert.equal(resolveInspectionCommand('claude',shim,['-p'],'win32').file,native);writeFileSync(shim,'echo unrelated\n');assert.equal(resolveInspectionCommand('claude',shim,[],'win32'),null)})
