import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { createEnvironment, root } from "../support/obsidian.mjs"

const env = createEnvironment()
const { addFile, app, workspace, adapterFiles, modals, settingByName, buttonComponent, files, opened } = env
addFile("Active.md", "", { run: "[[Runs/Harbor/Run]]" })
addFile("Runs/Harbor/Run.md", "", { type: "run", campaign: "[[Campaigns/Glass/Campaign]]", party: "[[Parties/Watch/Party]]" })
addFile("Runs/Harbor/State.md", "", { type: "state" })
addFile("Campaigns/Glass/Campaign.md", "", { type: "campaign", world: "[[Library/dnd5e/Worlds/Coast/World]]" })
addFile("Parties/Watch/Party.md", "", { type: "party" })
addFile("Library/dnd5e/Worlds/Coast/World.md", "", { type: "world" })
adapterFiles.set("_system/templates/npc.md", readFileSync(path.join(root, "_system/templates/npc.md"), "utf8"))
adapterFiles.set("_system/tables/names.txt", "Shipped Name\n")
adapterFiles.set("_system/tables/traits.txt", "Has a bright scarf\n")
adapterFiles.set("_local/tables/names.txt", "Local Name\n")
const inserted = []
const activeView = new env.MarkdownView()
activeView.editor = { replaceSelection: text => inserted.push(text) }
workspace.activeView = activeView
const TableTools = env.load()
const plugin = new TableTools(app, { id: "table-tools" })
workspace.plugin = plugin
await plugin.onload()
await plugin.openQuickNpc()
await new Promise(resolve => setTimeout(resolve, 0))
let modal = modals.at(-1)
assert.equal(settingByName(modal.contentEl, plugin.strings.homeFieldName).components[0].value, "Local Name")
assert.equal(settingByName(modal.contentEl, plugin.strings.quickNpcWhere).components[0].value, "Library/dnd5e/Worlds/Coast/NPCs")
await buttonComponent(modal.contentEl, plugin.strings.homeCreate).click()
await new Promise(resolve => setTimeout(resolve, 0))
let file = files.get("Library/dnd5e/Worlds/Coast/NPCs/Local Name.md")
assert.ok(file)
assert.ok(file.content.includes("type: npc"))
assert.ok(file.content.includes('world: "[[Library/dnd5e/Worlds/Coast/World]]"'))
assert.ok(file.content.includes("# Local Name\n\nHas a bright scarf"))
assert.deepEqual(inserted, ["[[Local Name]]"])
assert.deepEqual(opened, [])
await plugin.openQuickNpc()
await new Promise(resolve => setTimeout(resolve, 0))
modal = modals.at(-1)
await buttonComponent(modal.contentEl, plugin.strings.homeCreate).click()
await new Promise(resolve => setTimeout(resolve, 0))
file = files.get("Library/dnd5e/Worlds/Coast/NPCs/Local Name 2.md")
assert.ok(file)
assert.equal(files.size > 0, true)
assert.deepEqual(opened, [])
