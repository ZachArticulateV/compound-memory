// Host input is an observation, never authority to run an agent or change memory.
// Codex hook delivery is not enabled by this module or by the shipped manifest.
const START_SOURCES = new Set(['startup', 'resume', 'clear', 'compact', 'fork'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell', 'exec_command', 'shell', 'shell_command'])

export function hookPolicy(env = process.env) {
  return {
    enabled: env.COMPOUND_MEMORY_HOOKS !== '0',
    queueRequested: env.COMPOUND_MEMORY_INTEGRITY_QUEUE === '1',
    queueSupported: true,
    queueEnabled: false,
  }
}

export function contextSignal() {
  return { usedPercentage: null, basis: 'unknown', reason: 'No verified status-line bridge is installed.' }
}

function patchPaths(command) {
  if (typeof command !== 'string' || command.length > 1_048_576 || (!command.startsWith('*** Begin Patch\n') && !command.startsWith('*** Begin Patch\r\n'))) return null
  const lines = command.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  if (lines.at(-1) !== '*** End Patch') return null
  const paths = []
  for (const line of lines) {
    const header = /^\*\*\* (?:Add File|Update File|Delete File|Move to):[ \t]*(.*)$/.exec(line)
    if (!header) continue
    const path = header[1].trim()
    if (!path || path.includes('\0')) return null
    paths.push(path)
    if (paths.length > 128) return null
  }
  return paths.length ? [...new Set(paths)] : null
}

/** Normalize only documented fields. Paths describe requested changes, not proof. */
export function normalizeHostEvent(payload, { host = 'claude' } = {}) {
  const ignored = { kind: 'ignored', paths: [], basis: 'unknown' }
  if (!['claude', 'codex'].includes(host) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return ignored
  if (payload.hook_event_name === 'SessionStart') {
    const source = payload.source ?? 'startup'
    return START_SOURCES.has(source) ? { kind: 'orientation', source, paths: [], basis: 'host-event' } : ignored
  }
  if (payload.hook_event_name !== 'PostToolUse') return ignored
  const input = payload.tool_input
  const tool = payload.tool_name
  const unknown = { kind: 'change-unknown', paths: [], basis: 'unknown', manualCheck: 'project-memory status' }
  if (SHELL_TOOLS.has(tool)) return unknown
  if (host === 'codex' && tool === 'apply_patch') {
    const paths = patchPaths(input?.command)
    return paths ? { kind: 'file-change', paths, basis: 'tool-input' } : unknown
  }
  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return ignored
  const path = input?.file_path ?? input?.notebook_path
  return typeof path === 'string' && path.trim() && !path.includes('\0')
    ? { kind: 'file-change', paths: [path], basis: 'tool-input' }
    : unknown
}
