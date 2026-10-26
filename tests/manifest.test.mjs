import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const readManifest = (relPath) =>
  JSON.parse(readFileSync(join(repoRoot, relPath), 'utf8'))

// Fields that must agree across ecosystems. Each manifest may carry extras
// (a $schema for editor tooling, an explicit skills path for Codex); identity
// and provenance must not drift between them.
const SHARED_FIELDS = ['name', 'version', 'description', 'author', 'homepage', 'license', 'repository', 'keywords']

test('portable and legacy manifests parse as JSON', () => {
  assert.doesNotThrow(() => readManifest('plugin.json'))
  assert.doesNotThrow(() => readManifest('.claude-plugin/plugin.json'))
  assert.doesNotThrow(() => readManifest('.codex-plugin/plugin.json'))
})

test('shared metadata is identical across the Claude and Codex manifests', () => {
  const claude = readManifest('.claude-plugin/plugin.json')
  const codex = readManifest('.codex-plugin/plugin.json')

  for (const field of SHARED_FIELDS) {
    assert.deepEqual(
      codex[field],
      claude[field],
      `${field} drifted between .claude-plugin and .codex-plugin`
    )
  }
  const portable = readManifest('plugin.json')
  for (const field of SHARED_FIELDS) assert.deepEqual(portable[field], claude[field], `portable ${field} drifted`)
})

test('portable manifest uses the standard shape and the same OpenAI overlay', () => {
  const portable = readManifest('plugin.json')
  const codex = readManifest('.codex-plugin/plugin.json')
  assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
  const allowed = new Set(['$schema', ...SHARED_FIELDS, 'extensions'])
  assert.deepEqual(Object.keys(portable).filter(key => !allowed.has(key)), [])
  assert.deepEqual(portable.extensions, {'com.openai': {skills:codex.skills, hooks:codex.hooks, interface:codex.interface}})
  assert.equal(portable.extensions['com.openai'].skills, './skills/')
  assert.deepEqual(portable.extensions['com.openai'].hooks, {})
})

test('plugin name is kebab-case with no spaces', () => {
  const { name } = readManifest('.claude-plugin/plugin.json')
  assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

test('keywords is an array, not a string', () => {
  // A string here is a load error, not a warning -- the plugin would fail to
  // load at runtime rather than degrade. Guard the field type explicitly.
  for (const path of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    assert.ok(Array.isArray(readManifest(path).keywords), `${path} keywords must be an array`)
  }
})

test('version is a semver string', () => {
  const { version } = readManifest('.claude-plugin/plugin.json')
  assert.match(version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
})

test('the plugin root carries no CLAUDE.md', () => {
  // `claude plugin validate --strict` warns that a root CLAUDE.md in a plugin
  // is not loaded as plugin context, and --strict fails on the warning. This
  // repository's own instructions live at .claude/CLAUDE.md instead.
  assert.equal(existsSync(join(repoRoot, 'CLAUDE.md')), false)
  assert.equal(existsSync(join(repoRoot, '.claude', 'CLAUDE.md')), true)
})

// The description is what a marketplace shows before anyone installs. It names
// every skill and states their count, so adding or removing a skill without
// updating it would leave the listing describing a different plugin.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen']

test('the description names every skill and states how many there are', () => {
  const { description } = readManifest('.claude-plugin/plugin.json')
  const skillsDir = join(repoRoot, 'skills')
  const skills = readdirSync(skillsDir).filter((name) => existsSync(join(skillsDir, name, 'SKILL.md')))
  for (const skill of skills) {
    assert.match(description, new RegExp(`\\b${skill}\\b`), `the description does not name the ${skill} skill`)
  }
  const shortcut = (name) => /^disable-model-invocation:\s*true$/m.test(readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8'))
  const counts = { 'core skills': skills.filter((name) => !shortcut(name)).length, shortcuts: skills.filter(shortcut).length }
  for (const [kind, count] of Object.entries(counts)) {
    assert.ok(NUMBER_WORDS[count], `no number word for ${count} ${kind}`)
    assert.match(description, new RegExp(`\\b${NUMBER_WORDS[count]} ${kind}\\b`, 'i'))
  }
  assert.ok((description.match(/[.!?](?=\s|$)/g) ?? []).length <= 2, 'keep the description to two sentences')
})

test('homepage and repository point at the repository named after the plugin', () => {
  for (const path of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const { name, homepage, repository } = readManifest(path)
    const expected = `https://github.com/ZachArticulateV/${name}`
    assert.equal(repository, expected, `${path} repository`)
    assert.equal(homepage, expected, `${path} homepage`)
  }
})
