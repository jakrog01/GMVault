import { execFile } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assert, run, test } from "./support.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = relative => readFile(path.join(root, relative), "utf8")
const relations = {
  world: ["calendar", "system", "map", "pins"], campaign: ["world", "system", "calendar"], party: ["campaign"],
  pc: ["party", "player", "species", "class", "subclass", "background", "alignment", "level", "ac", "hp", "hp_max", "speed", "init_mod", "prof_bonus", "passive_perception", "spell_dc", "str", "dex", "con", "int", "wis", "cha"],
  run: ["campaign", "party", "role"], session: ["run", "date", "world_date"], state: ["run"], "world-day": ["run"],
  npc: ["world", "campaign", "faction", "location", "status"], location: ["world", "campaign", "location", "status", "map", "pins"],
  faction: ["world", "campaign", "status"], lore: ["world", "campaign"], event: ["world", "campaign", "world_date", "location"],
  quest: ["campaign", "status", "location"], encounter: ["campaign", "location", "creatures"], handout: ["campaign", "file"],
  item: ["system", "world", "campaign", "owner"], creature: ["system", "world", "campaign"], spell: ["system", "world", "campaign"],
  rules: ["system", "campaign", "world"], class: ["system", "world"], subclass: ["class", "system", "world"],
  race: ["race", "system", "world"], background: ["system", "world"], feat: ["system", "world"],
  claim: ["about", "what", "from", "session", "status"],
}
const types = Object.keys(relations)

test("plugin note types match every system package", async () => {
  const source = await read("_system/plugin/src/contract.ts")
  const literal = source.match(/export const NOTE_TYPES = (\[[\s\S]*?\]) as const;/)?.[1]
  assert.ok(literal, "NOTE_TYPES source literal")
  const pluginTypes = [...literal.matchAll(/"([^"]+)"/g)].map(match => match[1])
  for (const system of await readdir(path.join(root, "_system/systems"))) {
    const pkg = JSON.parse(await read(`_system/systems/${system}/package.json`))
    assert.deepEqual([...pluginTypes].sort(), [...pkg.noteTypes].sort(), `${system} note types`)
  }
})

test("ADR types and template frontmatter stay inside the note contract", async () => {
  const adr = await read("docs/adr/0004-note-contract.md") + await read("docs/adr/0005-system-library.md") + await read("docs/adr/0006-maps.md")
  for (const type of types) assert.ok(adr.includes(`| \`${type}\` |`), `ADR type ${type}`)
  for (const name of await readdir(path.join(root, "_system/templates"))) {
    if (!name.endsWith(".md") || name === "auto.md") continue
    const source = await read(`_system/templates/${name}`)
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1]
    assert.ok(frontmatter, `${name} frontmatter`)
    const fields = [...frontmatter.matchAll(/^([A-Za-z][\w-]*):/gm)].map(match => match[1])
    const type = frontmatter.match(/^type:\s*(\S+)/m)?.[1]
    assert.ok(types.includes(type), `${name} type ${type}`)
    for (const field of fields) assert.ok(["type", "subtype", "aliases", "tags", "origin", "source", ...relations[type]].includes(field), `${name} field ${field}`)
  }
  for (const system of await readdir(path.join(root, "_system/systems"))) {
    const pkg = JSON.parse(await read(`_system/systems/${system}/package.json`))
    assert.deepEqual([...pkg.noteTypes].sort(), [...types].sort(), `${system} note types`)
  }
})

test("ADR 0007 records package layout and retained note fields", async () => {
  const adr = await read("docs/adr/0007-system-layouts.md")
  for (const key of ["layout.mechanics", "layout.world", "layout.campaign", "layout.lore", "nested", "create"]) assert.ok(adr.includes(key), key)
  const old = await read("docs/adr/0005-system-library.md")
  for (const type of ["class", "subclass", "race", "background", "feat"]) assert.ok(old.includes(`| \`${type}\` |`), type)
  const rules = await read("_system/templates/rules.md")
  assert.match(rules, /gmvault_layout\(tp, "subtype"\)/)
})

test("Templater dispatches library and legacy paths", async () => {
  const rules = JSON.parse(await read("_system/obsidian/plugins/templater-obsidian/data.json")).file_templates
  assert.equal(rules.length, 8)
  for (const file of ["Library/dnd5e/Mechanics/Classes/Wizard.md", "Library/tor2e/Mechanics/Callings/Warden.md", "Library/dnd5e/Worlds/Faerun/Lore/Creatures/Dragon.md", "Library/dnd5e/Campaigns/Story/Quests/Q.md", "Campaigns/Old/Campaign.md", "Worlds/Old/World.md"]) assert.equal(rules.find(rule => new RegExp(rule.regex).test(file))?.template, "_system/templates/auto.md", file)
  assert.deepEqual(JSON.parse(await read(".obsidian/plugins/templater-obsidian/data.json")).file_templates, rules)
})

test("character-option templates use the shared layout dispatcher", async () => {
  for (const name of ["class", "subclass", "race", "background", "feat", "rules"]) {
    const body = await read(`_system/templates/${name}.md`)
    assert.match(body, /gmvault_layout\(tp, "system"\)/, name)
  }
  assert.match(await read("_system/templates/subclass.md"), /gmvault_layout\(tp, "parent"\)/)
  assert.match(await read("_system/templates/race.md"), /gmvault_layout\(tp, "subtype"\)/)
})

test("templates and note types are only ever added to, never removed from, since the last release", async () => {
  const exec = promisify(execFile)
  const tags = (await exec("git", ["tag", "--merged", "HEAD", "--sort=-v:refname"], { cwd: root })).stdout.split("\n").filter(tag => /^v\d+\.\d+\.\d+$/.test(tag))
  if (!tags.length) return
  const keys = body => (body.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n").map(line => line.match(/^([A-Za-z_][\w-]*):/)?.[1]).filter(Boolean)
  const listed = (await exec("git", ["ls-tree", "--name-only", `${tags[0]}:_system/templates`], { cwd: root })).stdout.split("\n").filter(name => name.endsWith(".md"))
  for (const file of listed) {
    const before = keys((await exec("git", ["show", `${tags[0]}:_system/templates/${file}`], { cwd: root })).stdout)
    const body = await read(`_system/templates/${file}`).catch(() => null)
    assert.ok(body !== null, `${file} from ${tags[0]} still ships`)
    const now = keys(body)
    for (const key of before) assert.ok(now.includes(key), `${file} keeps the ${key} field it had in ${tags[0]}`)
  }
})

test("template commands can share one Templater scope", async () => {
  for (const file of (await readdir(path.join(root, "_system/templates"))).filter(name => name.endsWith(".md"))) {
    const body = await readFile(path.join(root, "_system/templates", file), "utf8")
    const declared = [...body.matchAll(/<%\*[\s\S]*?%>/g)].flatMap(match => [...match[0].matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(entry => entry[1]))
    assert.deepEqual(declared.filter((name, index) => declared.indexOf(name) !== index), [], `${file} declares a name twice across Templater commands`)
  }
})

test("templates use the dispatcher for folder-derived relations", async () => {
  for (const [name, fields] of Object.entries({ quest: ["campaign"], encounter: ["campaign"], handout: ["campaign"], npc: ["world", "campaign"], location: ["world", "campaign"], faction: ["world", "campaign"], lore: ["world", "campaign"], event: ["world", "campaign"] })) {
    const body = await read(`_system/templates/${name}.md`)
    for (const field of fields) assert.ok(body.includes(`gmvault_layout(tp, "${field}")`), `${name}.${field}`)
  }
  for (const name of ["run", "session", "pc"]) assert.match(await read(`_system/templates/${name}.md`), /tp\.system\.suggester/)
})

await run("53-note-contract")
