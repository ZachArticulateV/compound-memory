import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WORKFLOW_CASES,gradeWorkflow} from '../evals/workflow-cases.mjs'
for(const c of WORKFLOW_CASES)test(`workflow ${c.id}: good and seeded bad controls`,()=>{assert.equal(gradeWorkflow(c.id,c.good).ok,true);const bad=structuredClone(c.good);bad[c.field]=c.expected===false?true:c.expected===null?0:'wrong';assert.equal(gradeWorkflow(c.id,bad).ok,false);assert.equal(gradeWorkflow(c.id,{}).ok,false)})
