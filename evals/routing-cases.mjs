// Shared cases for live host probes. Unit tests exercise the grader only.
// skill IDs are normalized to Claude-style plugin:name on either host.
const skill = (name) => `compound-memory:${name}`
export const ROUTING_CASES = [
  { id: 'question', prompt: 'What is 2 + 2? Answer only. Do not change files.', expectedSkills: [], writePolicy: 'none', maxAgents: 0 },
  { id: 'typo', prompt: 'Fix recieve to receive in README.md. Keep this small. Do not commit.', expectedSkills: ['', skill('build')], writePolicy: 'readme', maxAgents: 0 },
  { id: 'plan-only', prompt: 'Plan a CSV export. Reply with the plan only. Do not build or save files.', expectedSkills: [skill('plan')], writePolicy: 'none', maxAgents: 0 },
  { id: 'build', prompt: 'Implement the supplied export plan in src/export.mjs. Change only that file. Do not commit.', expectedSkills: [skill('build')], writePolicy: 'task', allowedPaths: ['src/export.mjs'], maxAgents: 0 },
  { id: 'review', prompt: 'Review the current diff. Report faults. Do not change any files.', expectedSkills: [skill('review')], writePolicy: 'none', maxAgents: 0 },
  { id: 'plain-handoff', prompt: 'Record where we stopped and the next step in project memory.', expectedSkills: [skill('project-memory')], writePolicy: 'memory', maxAgents: 0 },
  { id: 'memory-question', prompt: 'Is project memory stale? Report its status. Do not write or run an external audit.', expectedSkills: [skill('project-memory')], writePolicy: 'none', maxAgents: 0 },
  ...['handoff', 'sync', 'grill', 'cleanup', 'repair'].map((mode) => ({
    id: `explicit-${mode}`, explicitSkill: mode,
    prompt: mode === 'grill' ? 'Question the supplied plan. Do not save files.'
      : mode === 'cleanup' ? 'Find stale memory. Report findings only. Do not edit files.'
        : mode === 'repair' ? 'Apply the supplied accepted validator findings to memory.'
          : mode === 'sync' ? 'Update memory for the supplied completed change.'
            : 'Save the stopping point and next step.',
    expectedSkills: [skill(mode)], writePolicy: ['grill', 'cleanup'].includes(mode) ? 'none' : 'memory', maxAgents: 0,
  })),
  { id: 'code-cleanup', prompt: 'Simplify the supplied function in src/format.mjs without changing its behavior. Change only that file.', expectedSkills: [skill('build')], writePolicy: 'task', allowedPaths: ['src/format.mjs'], maxAgents: 0 },
]

// Call with host-observed data, never a model's claimed tool list.
// An empty expected skill permits direct work only for a small task.
export function gradeRoutingRun(id, observed) {
  const c = ROUTING_CASES.find((item) => item.id === id)
  if (!c) throw new Error(`Unknown routing case: ${id}`)
  const issues = []
  if (observed.complete !== true) issues.push('Run did not complete')
  if (!Array.isArray(observed.skills) || !observed.skills.every((s) => typeof s === 'string')) issues.push('Missing observed skills')
  else {
    const calls = observed.skills.filter(Boolean)
    const choices = c.expectedSkills.filter(Boolean)
    if (calls.some((s) => !choices.includes(s))) issues.push('Unexpected skill')
    if (choices.length && !c.expectedSkills.includes('') && calls.length === 0) issues.push('Expected skill was not loaded')
  }
  if (!Number.isInteger(observed.agents) || observed.agents < 0) issues.push('Missing observed agent count')
  else if (observed.agents > c.maxAgents) issues.push('Extra agent work')
  if (!Array.isArray(observed.changedFiles) || !observed.changedFiles.every((p) => typeof p === 'string')) issues.push('Missing observed file changes')
  else {
    const files = observed.changedFiles.map((p) => p.replace(/\\/g, '/'))
    // Require canonical project-relative paths. Never normalize away traversal.
    if (files.some((p) => !p || p.startsWith('/') || /^[a-z]:/i.test(p) || p.includes(':') || /[\x00-\x1f]/.test(p)
      || p.split('/').some((part) => !part || part === '.' || part === '..'))) issues.push('Invalid changed file path')
    if (c.writePolicy === 'none' && files.length) issues.push('Read-only request wrote files')
    if (c.writePolicy === 'readme' && files.some((p) => p !== 'README.md')) issues.push('Small edit exceeded its file scope')
    if (c.writePolicy === 'memory' && files.some((p) => !p.startsWith('memory/'))) issues.push('Memory request wrote outside memory')
    if (c.writePolicy === 'task' && files.some((p) => !c.allowedPaths.includes(p))) issues.push('Code request wrote outside its task files')
  }
  return { ok: issues.length === 0, issues, basis: 'observed-routing-and-scope', outcomeVerified: false }
}
