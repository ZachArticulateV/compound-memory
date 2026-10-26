// A policy trial needs matched tasks and measured context. Short CLI trials
// with unknown context can report overhead, but cannot select a threshold.
export const TRIAL_ARMS=['no-plugin','plugin-no-threshold','plugin-trial-threshold']
export function summarizeContextTrial(rows){
 const problems=[],hosts=[...new Set(rows.map(r=>r.host))]
 for(const host of hosts){const sample=rows.filter(r=>r.host===host);for(const arm of TRIAL_ARMS)if(!sample.some(r=>r.arm===arm))problems.push(`${host}: missing ${arm}`);if(new Set(sample.map(r=>r.taskKey)).size!==1)problems.push(`${host}: unmatched tasks`)}
 for(const row of rows){if(!TRIAL_ARMS.includes(row.arm)||!['claude','codex'].includes(row.host))problems.push('invalid trial identity');if(!Number.isFinite(row.elapsedMs)||row.elapsedMs<0)problems.push('missing measured elapsed time');if(row.context?.basis!=='measured'||!Number.isFinite(row.context?.usedPercentage))problems.push(`${row.host}: context percentage unknown`);if(row.state!=='passed')problems.push(`${row.host}: trial did not pass`)}
 if(rows.length<18)problems.push('too few repeated matched samples')
 const levels=new Set(rows.filter(r=>r.context?.basis==='measured').map(r=>Math.floor(r.context.usedPercentage/10)))
 if(levels.size<3)problems.push('fewer than three measured context levels')
 // Even a complete capture needs an independent quality comparison. Never
 // choose 50 from a crossing or a single successful response.
 return {status:'inconclusive',recommendedThreshold:null,trialThreshold:50,reason:problems.length?[...new Set(problems)]:['Measured samples require independent quality and noise analysis before a default can be selected.'],rows:rows.map(r=>({...r,cost:r.cost??null})),claim:'No universal context threshold or quality degradation is established.'}
}
