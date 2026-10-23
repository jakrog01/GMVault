import { execFile } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assert, run, test } from "./support.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = relative => readFile(path.join(root, relative), "utf8")
const relations = {
  world: ["calendar"], campaign: ["world", "system", "calendar"], party: ["campaign"],
  pc: ["party", "player", "class", "level", "ac", "hp", "init_mod"],
  run: ["campaign", "party", "role"], session: ["run", "date", "world_date"], state: ["run"], "world-day": ["run"],
  npc: ["world", "campaign", "faction", "location", "status"], location: ["world", "campaign", "location", "status"],
  faction: ["world", "campaign", "status"], lore: ["world", "campaign"], event: ["world", "campaign", "world_date", "location"],
  quest: ["campaign", "status", "location"], encounter: ["campaign", "location", "creatures"], handout: ["campaign", "file"],
  item: ["system", "world", "campaign", "owner"], creature: ["system", "world", "campaign"], spell: ["system", "world", "campaign"],
  rules: ["system", "campaign"], claim: ["about", "what", "from", "session", "status"],
}
const types = Object.keys(relations)

test("ADR types and template frontmatter stay inside the note contract", async () => {
  const adr = await read("docs/adr/0004-note-contract.md")
  for (const type of types) assert.ok(adr.includes(`| \`${type}\` |`), `ADR type ${type}`)
  for (const name of await readdir(path.join(root, "_system/templates"))) {
    if (!name.endsWith(".md")) continue
    const source = await read(`_system/templates/${name}`)
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1]
    assert.ok(frontmatter, `${name} frontmatter`)
    const fields = [...frontmatter.matchAll(/^([A-Za-z][\w-]*):/gm)].map(match => match[1])
    const type = frontmatter.match(/^type:\s*(\S+)/m)?.[1]
    assert.ok(types.includes(type), `${name} type ${type}`)
    for (const field of fields) assert.ok(["type", "subtype", "aliases", "tags", "origin", ...relations[type]].includes(field), `${name} field ${field}`)
  }
  for (const system of await readdir(path.join(root, "_system/systems"))) {
    const pkg = JSON.parse(await read(`_system/systems/${system}/package.json`))
    assert.deepEqual([...pkg.noteTypes].sort(), [...types].sort(), `${system} note types`)
  }
})

test("Templater maps each new folder to its note template", async () => {
  const rules = JSON.parse(await read("_system/obsidian/plugins/templater-obsidian/data.json")).file_templates
  const cases = {
    "Worlds/Glass/World.md": "world", "Worlds/Glass/NPCs/A.md": "npc", "Worlds/Glass/Locations/A.md": "location",
    "Worlds/Glass/Factions/A.md": "faction", "Worlds/Glass/Lore/A.md": "lore", "Worlds/Glass/Events/A.md": "event",
    "Campaigns/Glass/NPCs/A.md": "npc", "Campaigns/Glass/Locations/A.md": "location", "Campaigns/Glass/Quests/A.md": "quest",
    "Campaigns/Glass/Factions/A.md": "faction", "Campaigns/Glass/Encounters/A.md": "encounter", "Campaigns/Glass/Handouts/A.md": "handout",
    "Campaigns/Glass/Campaign.md": "campaign", "Parties/Watch/Party.md": "party", "Parties/Watch/Aria.md": "pc",
    "Library/Mechanics/dnd5e/Rules/A.md": "rules",
  }
  for (const [file, kind] of Object.entries(cases)) assert.equal(rules.find(rule => new RegExp(rule.regex).test(file))?.template, `_system/templates/${kind}.md`, file)
  assert.deepEqual(JSON.parse(await read(".obsidian/plugins/templater-obsidian/data.json")).file_templates, rules)
})

test("templates and note types are only ever added to, never removed from, since the last release", async () => {
  const exec = promisify(execFile)
  const tags = (await exec("git", ["tag", "--merged", "HEAD", "--sort=-v:refname"], { cwd: root })).stdout.split("\n").filter(tag => /^v\d+\.\d+\.\d+$/.test(tag))
  if (!tags.length) return
  const keys = body => (body.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n").map(line => line.match(/^([A-Za-z_][\w-]*):/)?.[1]).filter(Boolean)
  const listed = (await exec("git", ["ls-tree", "--name-only", `${tags[0]}:_system/templates`], { cwd: root })).stdout.split("\n").filter(name => name.endsWith(".md"))
  for (const file of listed) {
    const before = keys((await exec("git", ["show", `${tags[0]}:_system/templates/${file}`], { cwd: root })).stdout)
    const now = keys(await read(`_system/templates/${file}`).catch(() => ""))
    assert.ok(now.length, `${file} from ${tags[0]} still ships`)
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

await run("53-note-contract")
