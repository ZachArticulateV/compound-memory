import {test} from 'node:test'
import assert from 'node:assert/strict'
import {summarizeContextTrial,TRIAL_ARMS} from '../evals/context-trial.mjs'
test('unknown usage and one crossing cannot justify a context default',()=>{const rows=TRIAL_ARMS.map(arm=>({host:'claude',arm,taskKey:'same',elapsedMs:12,state:'passed',context:{basis:'unknown',usedPercentage:null},tokens:null}));const result=summarizeContextTrial(rows);assert.equal(result.status,'inconclusive');assert.equal(result.recommendedThreshold,null);assert.ok(result.reason.includes('claude: context percentage unknown'));assert.ok(result.rows.every(r=>r.cost===null));rows[0].taskKey='different';assert.ok(summarizeContextTrial(rows).reason.includes('claude: unmatched tasks'))})
