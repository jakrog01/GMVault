import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { createEnvironment, root } from "../support/obsidian.mjs"

const env = createEnvironment()
const { addFile, app, workspace, files, adapterFiles, modals, notices, opened, menus, Menu, emit } = env
addFile("Active.md", "", { run: "[[Runs/Harbor/Run]]" })
const runNote = addFile("Runs/Harbor/Run.md", "", { type: "run", campaign: "[[Campaigns/Glass/Campaign]]" })
addFile("Campaigns/Glass/Campaign.md", "", { type: "campaign" })
const goblin = addFile("Library/Bestiary/Goblin.md", "", { type: "creature" })
const guide = addFile("Worlds/Coast/NPCs/Guide.md", "", { type: "npc" })
addFile("Worlds/Coast/World.md", "", { type: "world", map: "[[coast.jpg]]", pins: [{ note: "[[Guide]]", x: 0.5, y: 0.5 }] })
addFile("coast.jpg")
const lore = addFile("Worlds/Coast/Lore/Tides.md", "", { type: "lore" })
const shipped = addFile("_system/templates/npc.md", "", { type: "npc" })
const plain = addFile("Scratch.md", "", {})
adapterFiles.set("_system/templates/session.md", readFileSync(path.join(root, "_system/templates/session.md"), "utf8"))
const TableTools = env.load()
const plugin = new TableTools(app, { id: "table-tools" })
workspace.plugin = plugin
await plugin.onload()
const command = id => plugin.commands.find(item => item.id === id)
for (const id of ["new-session", "note-actions", "combat-add-players", "combat-add-creature", "combat-start-encounter", "combat-save-encounter"]) assert.ok(command(id), id)
assert.equal(new Set(plugin.commands.map(item => item.name)).size, plugin.commands.length)

await command("new-session").callback()
const now = new Date()
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
for (let attempt = 0; attempt < 100 && !files.has(`Runs/Harbor/Session ${date}.md`); attempt++) await new Promise(resolve => setTimeout(resolve, 0))
assert.ok(files.has(`Runs/Harbor/Session ${date}.md`))
assert.equal(opened.at(-1), `Runs/Harbor/Session ${date}.md`)
assert.ok(files.get(`Runs/Harbor/Session ${date}.md`).content.includes("[[Runs/Harbor/Run]]"))

workspace.activeFile = goblin
assert.equal(command("note-actions").checkCallback(true), true)
command("note-actions").checkCallback(false)
const picker = modals.at(-1)
assert.deepEqual(picker.query("").map(action => action.label), [plugin.strings.lookupAddCombat])
picker.choose(0)
for (let attempt = 0; attempt < 100 && !plugin.combat.participants.length; attempt++) await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(plugin.combat.participants[0].name, "Goblin")
for (const file of [lore, shipped, plain, runNote]) { workspace.activeFile = file; if (file !== lore) assert.equal(command("note-actions").checkCallback(true), false, file.path) }
workspace.activeFile = null
assert.equal(command("note-actions").checkCallback(true), false)

const fileMenu = file => { const menu = new Menu(); emit("file-menu", menu, file, "file-explorer"); return menu.items.map(item => item.title) }
assert.ok(fileMenu(goblin).includes(plugin.strings.lookupAddCombat))
assert.ok(fileMenu(guide).includes(plugin.strings.mapShowOn))
assert.ok(fileMenu(guide).includes(plugin.strings.lookupAddCombat))
assert.deepEqual(fileMenu(lore), [plugin.strings.lookUp])
assert.deepEqual(fileMenu(shipped), [])
assert.deepEqual(fileMenu(plain), [])
assert.deepEqual(fileMenu(app.vault.getAbstractFileByPath("coast.jpg")), [])
const editorMenu = new Menu()
emit("editor-menu", editorMenu, {}, { file: guide })
assert.ok(editorMenu.items.some(item => item.title === plugin.strings.mapShowOn))
const lookUp = new Menu()
emit("file-menu", lookUp, lore, "file-explorer")
lookUp.item(plugin.strings.lookUp).click()
await new Promise(resolve => setTimeout(resolve, 0))
assert.ok(env.byText(modals.at(-1).contentEl, "Tides").length)

workspace.activeFile = null
for (const leaf of [...env.leaves]) env.leaves.splice(env.leaves.indexOf(leaf), 1)
await app.fileManager.processFrontMatter(runNote, fields => { fields.campaign = "" })
await app.vault.modify(app.vault.getAbstractFileByPath("Active.md"), "")
files.get("Active.md").frontmatter = {}
const before = files.size
await command("new-session").callback()
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(files.size, before)
assert.equal(notices.at(-1), plugin.strings.quickNpcNeedsRun)
assert.equal(menus.length, 0)
console.log("at hand: clean")
