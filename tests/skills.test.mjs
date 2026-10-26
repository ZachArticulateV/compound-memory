// Every skill in the plugin, held to one anatomy.
//
// The plugin ships one memory skill and eleven engineering skills that hand
// work to each other through files. What makes them usable alone, together,
// and from Codex is structural, so it is pinned here: each skill names its
// done check, says how it works alone and what it hands off, routes each mode
// to a reference that exists, reaches only files that exist, pre-approves the
// scripts it documents, and stays under the 8,000-byte router ceiling. A skill added
// without these fails here rather than in someone's session.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillsDir = join(repoRoot, 'skills')

export const CORE_SKILLS = [
  'autopilot', 'build', 'catch-up', 'debug', 'learn', 'plan',
  'project-memory', 'prototype', 'review', 'ship', 'verify', 'write',
]
export const SHORTCUTS = ['cleanup', 'grill', 'handoff', 'repair', 'sync']
export const SKILLS = [...CORE_SKILLS, ...SHORTCUTS]
const ENGINEERING = CORE_SKILLS.filter((s) => s !== 'project-memory')

/**
 * Codex truncates an explicitly invoked skill's main prompt past this many
 * bytes for some plugin formats (codex-rs ext/skills/src/render.rs,
 * MAX_SKILL_PROMPT_BYTES, read 2026-10-21). Kept as this plugin's ceiling,
 * measured with CRLF line endings, so the router arrives whole either way.
 */
const CODEX_SKILL_BYTES = 8000
/** Codex's skill list truncates a description here; Claude Code at 1,536. */
const DESCRIPTION_LIMIT = 1024

const read = (...parts) => readFileSync(join(...parts), 'utf8')
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()

function fieldValue(frontmatter, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(frontmatter)
  return m ? m[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') : undefined
}

function parseSkill(name) {
  const raw = read(skillsDir, name, 'SKILL.md')
  const [, frontmatter = '', ...rest] = raw.split(/^---$/m)
  const field = (key) => fieldValue(frontmatter, key)
  return { name, raw, frontmatter, body: rest.join('---'), field }
}

test('an empty frontmatter field does not borrow the next line', () => {
  assert.equal(fieldValue('name:  \ndescription: next line\n', 'name'), '')
  assert.equal(fieldValue('name:  \r\ndescription: next line\r\n', 'name'), '')
})

/** All Markdown under a skill: SKILL.md plus references and templates. */
function skillTexts(name) {
  const dir = join(skillsDir, name)
  const out = [['SKILL.md', read(dir, 'SKILL.md')]]
  for (const sub of ['references', 'templates']) {
    if (!isDir(join(dir, sub))) continue
    for (const f of readdirSync(join(dir, sub)).filter((f) => f.endsWith('.md'))) out.push([`${sub}/${f}`, read(dir, sub, f)])
  }
  return out
}

test('the skills directory holds twelve core skills and five explicit shortcuts', () => {
  const found = readdirSync(skillsDir).filter((d) => isDir(join(skillsDir, d)) && existsSync(join(skillsDir, d, 'SKILL.md')))
  assert.deepEqual(found.sort(), [...SKILLS].sort())
})

for (const name of SKILLS) {
  test(`${name}: frontmatter names the skill and says when to use it`, () => {
    const skill = parseSkill(name)
    assert.equal(skill.field('name'), name)
    const description = skill.field('description') ?? ''
    assert.ok(description.length > 0, 'no description')
    assert.ok(description.length <= DESCRIPTION_LIMIT, `description is ${description.length} chars; keep it under ${DESCRIPTION_LIMIT}`)
    assert.match(description, /\bUse when\b/, 'the description needs a "Use when" clause carrying its triggers')
    assert.ok(skill.field('argument-hint'), 'no argument-hint')
  })

  test(`${name}: SKILL.md fits the 8,000-byte router ceiling`, () => {
    const skill = parseSkill(name)
    const bytes = Buffer.byteLength(skill.raw.replace(/\r?\n/g, '\r\n'), 'utf8')
    assert.ok(bytes <= CODEX_SKILL_BYTES, `${bytes} bytes with CRLF; this plugin's ceiling is ${CODEX_SKILL_BYTES}`)
  })

  test(`${name}: every mode in the table routes to a reference that exists`, () => {
    const skill = parseSkill(name)
    const rows = [...skill.body.matchAll(/^\| `([a-z-]+)` \|.*\| `(references\/[a-z-]+\.md)` \|$/gm)]
    for (const [, mode, ref] of rows) {
      assert.ok(existsSync(join(skillsDir, name, ref)), `mode ${mode} routes to ${ref}, which does not exist`)
    }
  })

  test(`${name}: no reference or template is orphaned`, () => {
    const all = skillTexts(name).map(([, text]) => text).join('\n')
    // project-memory renders its templates by artifact name through its
    // schema; tests/templates.test.mjs covers those.
    for (const sub of name === 'project-memory' ? ['references'] : ['references', 'templates']) {
      const dir = join(skillsDir, name, sub)
      if (!isDir(dir)) continue
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        assert.ok(all.includes(`${sub}/${file}`), `${sub}/${file} is never named, so nothing loads it`)
      }
    }
  })

  test(`${name}: every path it names inside the plugin exists`, () => {
    const base = join(skillsDir, name)
    for (const [file, text] of skillTexts(name)) {
      const refs = new Set()
      for (const m of text.matchAll(/(?:\$\{CLAUDE_SKILL_DIR\}\/)?((?:\.\.\/)*(?:[a-z-]+\/)?(?:references|templates)\/[a-z-]+\.md)/g)) refs.add(m[1])
      for (const ref of refs) {
        // Every path is relative to the skill's directory, the convention each
        // SKILL.md states, so a reference file's `../../references/x.md` means
        // the plugin root's shared reference.
        const target = resolve(base, ref)
        assert.ok(existsSync(target), `${name}/${file} names ${ref}, which resolves to nothing`)
      }
      for (const m of text.matchAll(/scripts\/((?:[a-z-]+\/)?[a-z-]+\.mjs)/g)) {
        assert.ok(existsSync(join(repoRoot, 'scripts', ...m[1].split('/'))), `${name}/${file} names scripts/${m[1]}, which does not exist`)
      }
    }
  })

  test(`${name}: every documented script call is pre-approved, and nothing broader is`, () => {
    const skill = parseSkill(name)
    const allowed = skill.field('allowed-tools') ?? ''
    assert.doesNotMatch(allowed, /Bash\(\*\)|(^|,)\s*Bash\s*(,|$)/, 'a blanket Bash grant')
    const rules = [...allowed.matchAll(/Bash\(([^)]*)\)/g)].map((m) => m[1].trim())
    for (const [file, text] of skillTexts(name)) {
      for (const m of text.matchAll(/^\s*node "(\$\{CLAUDE_SKILL_DIR\}[^"]+)"(.*)$/gm)) {
        const command = `node "${m[1]}"${m[2]}`.trim()
        // Helpers that execute supplied code or launch another model have an
        // explicit authority boundary and must stay out of automatic grants.
        if (/# not pre-approved\b/.test(m[2])) {
          const script = m[1]
          assert.ok(!rules.some((rule) => rule.startsWith(`node "${script}"`)), `${name}/${file} marks ${script} not pre-approved, but allowed-tools approves it`)
          continue
        }
        const covered = rules.some((rule) => rule.endsWith(' *') && (command === rule.slice(0, -2) || command.startsWith(`${rule.slice(0, -2)} `)))
        assert.ok(covered, `${name}/${file} documents \`${command}\`, which no allowed-tools rule covers`)
      }
    }
  })

  test(`${name}: Codex metadata exists and agrees on invocation`, () => {
    const yamlPath = join(skillsDir, name, 'agents', 'openai.yaml')
    assert.ok(existsSync(yamlPath), 'no agents/openai.yaml')
    const yaml = read(yamlPath)
    assert.match(yaml, /^\s+display_name: ".+"$/m)
    assert.match(yaml, /^\s+short_description: ".+"$/m)
    const userInvokedClaude = /^disable-model-invocation:\s*true$/m.test(parseSkill(name).frontmatter)
    const userInvokedCodex = /allow_implicit_invocation:\s*false/.test(yaml)
    assert.equal(userInvokedCodex, userInvokedClaude)
  })
}

for (const name of ENGINEERING) {
  test(`${name}: states its done check, how it works alone, and what it hands off`, () => {
    const { body } = parseSkill(name)
    assert.match(body, /\*\*Done when:\*\*/, 'no "Done when" line')
    assert.match(body, /^## Works with$/m, 'no "Works with" section')
    assert.match(body, /\*\*Alone:\*\*|^Every other skill/m, 'no line saying how it runs without the other skills')
    assert.match(body, /Outside Claude Code/, 'no line telling a non-Claude agent how to read its variables')
    assert.match(body, /relative to this skill's directory/, 'no statement of what its paths are relative to')
  })

  test(`${name}: the skills it hands work to exist`, () => {
    const { body } = parseSkill(name)
    const section = /^## Works with$([\s\S]*?)(?=^## |\Z)/m.exec(body)?.[1] ?? ''
    for (const m of section.matchAll(/`([a-z-]+)(?: [a-z-]+)?`/g)) {
      const named = m[1]
      if (['memory'].includes(named)) continue
      if (!/^[a-z]+(-[a-z]+)*$/.test(named)) continue
      // Backticked words in this section are skill names (with an optional mode).
      assert.ok(SKILLS.includes(named), `${name} hands work to \`${named}\`, which is not a skill in this plugin`)
    }
  })
}

test('the modes other skills invoke by name exist', () => {
  // `plan tickets`, `learn capture`, `verify run`: a mode named in prose
  // anywhere in the plugin must be routed by that skill's table.
  const modes = new Map()
  for (const name of SKILLS) {
    const { body } = parseSkill(name)
    modes.set(name, new Set([...body.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1])))
  }
  const texts = SKILLS.flatMap((name) => skillTexts(name).map(([file, text]) => [`${name}/${file}`, text]))
  texts.push(['references/artifacts.md', read(repoRoot, 'references', 'artifacts.md')])
  for (const [where, text] of texts) {
    for (const m of text.matchAll(/`(plan|prototype|build|review|verify|ship|learn|write|catch-up) ([a-z]+)`/g)) {
      const [, skill, mode] = m
      assert.ok(modes.get(skill).has(mode), `${where} names \`${skill} ${mode}\`, which ${skill} does not route`)
    }
  }
})

test('the artifact contract names only skills that exist', () => {
  const artifacts = read(repoRoot, 'references', 'artifacts.md')
  const table = artifacts.split('\n').filter((l) => /^\| [A-Z]/.test(l) && !/^\| Artifact/.test(l))
  assert.ok(table.length >= 8, 'the artifact table has moved or shrunk')
  for (const row of table) {
    const [, , , producer, readers] = row.split('|').map((c) => c.trim())
    for (const m of `${producer} ${readers}`.matchAll(/`([a-z-]+)(?: [a-z]+)?`/g)) {
      assert.ok(SKILLS.includes(m[1]), `artifacts.md names \`${m[1]}\` as a producer or reader`)
    }
  }
})

test('the shared references every skill points to exist', () => {
  for (const file of ['artifacts.md', 'principles.md']) assert.ok(existsSync(join(repoRoot, 'references', file)))
})

test('the lesson template passes the lesson-format check once rendered', async () => {
  const { lessonProblems, parseLesson } = await import('../scripts/lib/lessons.mjs')
  const rendered = read(skillsDir, 'learn', 'templates', 'lesson.md')
    .replace('[{{tags}}]', '[jobs, retries]')
    .replace('[{{paths}}]', '[app/jobs/]')
    .replace(/\{\{[a-z_]+\}\}/g, 'filled in')
  assert.deepEqual(lessonProblems(parseLesson('memory/lessons/x.md', rendered)), [])
})

test('the README introduces every skill', () => {
  const readme = read(repoRoot, 'README.md')
  for (const name of SKILLS) assert.ok(readme.includes(`\`${name}\``), `README never names \`${name}\``)
  assert.match(readme, /\btwelve (?:core )?skills\b/i, 'README no longer states the core skill count')
  assert.match(readme, /\bfive (?:explicit )?shortcuts\b/i, 'README no longer states the shortcut count')
})
