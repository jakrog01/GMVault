import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { assert, run, test } from "./support.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const require = createRequire(import.meta.url)
const layout = require("../../_system/scripts/gmvault_layout.js")
const read = relative => readFile(path.join(root, relative), "utf8")
const packages = {}
for (const id of ["generic", "dnd5e", "tor2e"]) packages[id] = JSON.parse(await read(`_system/systems/${id}/package.json`))
const pkg = id => layout.merge(packages[id], null, packages.generic)
const resolved = file => layout.resolve(file, { generic: pkg("generic"), dnd5e: pkg("dnd5e"), tor2e: pkg("tor2e") })

test("D&D class and subclass resolve with the parent link", () => {
  const base = "Library/dnd5e/Mechanics/Classes/Wizard"
  assert.equal(resolved(`${base}.md`).type, "class")
  assert.equal(resolved(`${base}/Wizard.md`).type, "class")
  const child = resolved(`${base}/Evoker.md`)
  assert.equal(child.type, "subclass")
  assert.equal(child.parent, `[[${base}/Wizard]]`)
})

test("The One Ring folders select their package types", () => {
  assert.equal(resolved("Library/tor2e/Mechanics/Callings/Warden.md").type, "class")
  assert.equal(resolved("Library/tor2e/Mechanics/Virtues/Brave.md").type, "feat")
  assert.equal(resolved("Library/tor2e/Mechanics/Rewards/Sword.md").type, "feat")
})

test("local layout list replaces one shipped list", () => {
  const changed = layout.merge(packages.tor2e, { layout: { mechanics: [{ folder: "Ways", type: "class" }] } }, packages.generic)
  assert.equal(layout.resolve("Library/tor2e/Mechanics/Ways/Scholar.md", { tor2e: changed }).type, "class")
  assert.equal(layout.resolve("Library/tor2e/Mechanics/Callings/Scholar.md", { tor2e: changed }).type, "")
  assert.equal(changed.layout.world[0].folder, "Locations")
})

test("legacy campaigns and creature lore resolve", () => {
  assert.equal(resolved("Campaigns/Old/Quests/Find It.md").type, "quest")
  assert.equal(resolved("Library/dnd5e/Worlds/Faerun/Lore/Creatures/Dragon.md").type, "creature")
  assert.equal(resolved("Library/dnd5e/Campaigns/Old/Lore/Creatures/Dragon.md").type, "creature")
})

test("dispatcher selects template from merged package", async () => {
  const files = new Map(await Promise.all(["generic", "tor2e"].map(async id => [`_system/systems/${id}/package.json`, await read(`_system/systems/${id}/package.json`)])))
  files.set("_local/systems/tor2e/package.json", JSON.stringify({ layout: { mechanics: [{ folder: "Ways", type: "class" }] } }))
  globalThis.app = { vault: { adapter: { read: async file => { if (!files.has(file)) throw new Error("missing"); return files.get(file) } } } }
  try {
    const tp = { file: { path: () => "Library/tor2e/Mechanics/Ways/Scholar.md" } }
    assert.equal(await layout(tp, "template"), "class")
    assert.equal(await layout(tp, "system"), "tor2e")
    const auto = await read("_system/templates/auto.md")
    assert.match(auto, /_local\/templates\/\$\{kind\}\.md/)
    assert.match(auto, /tp\.file\.include/)
  } finally { delete globalThis.app }
})

await run("67-system-layouts")
