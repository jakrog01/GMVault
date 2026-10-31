import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { createEnvironment, root } from "../support/obsidian.mjs"

const env = createEnvironment()
const { addFile, app, workspace, adapterFiles, files, opened, byText, byClass } = env
addFile("Active.md", "", { run: "[[Runs/Harbor/Run]]" })
addFile("Runs/Harbor/Run.md", "", { type: "run", campaign: "[[Campaigns/Glass/Campaign]]", party: "[[Parties/Watch/Party]]" })
addFile("Runs/Harbor/State.md", "", { type: "state" })
addFile("Runs/Harbor/World Day.md", "", { type: "world-day", world_date: "1492-03-14" })
addFile("Parties/Watch/Party.md", "", { type: "party" })
addFile("Campaigns/Glass/Campaign.md", "", { type: "campaign", world: "[[Worlds/Coast/World]]" })
addFile("Worlds/Coast/World.md", "", { type: "world" })
addFile("Worlds/Other/World.md", "", { type: "world" })
const event = (name, folder, fields) => addFile(`${folder}/${name}.md`, "", { type: "event", ...fields })
event("Old", "Worlds/Coast/Events", { world: "[[Worlds/Coast/World]]", world_date: "-200" })
event("Year", "Campaigns/Glass/Events", { campaign: "[[Campaigns/Glass/Campaign]]", world_date: "1492" })
event("Month", "Worlds/Coast/Events", { world_date: "1492-03" })
event("Day", "Campaigns/Glass/Events", { campaign: "[[Campaigns/Glass/Campaign]]", world_date: "1492-03-14 DR" })
event("No date", "Campaigns/Glass/Events", { campaign: "[[Campaigns/Glass/Campaign]]", world_date: "the second moon" })
event("Other world", "Worlds/Other/Events", { world: "[[Worlds/Other/World]]", world_date: "1" })
event("Other campaign", "Campaigns/Other/Events", { campaign: "[[Campaigns/Other/Campaign]]", world_date: "2" })
addFile("Runs/Harbor/Session One.md", "", { type: "session", run: "[[Runs/Harbor/Run]]", world_date: "1492-03-14", date: "2026-10-31" })
addFile("Runs/Other/Session Two.md", "", { type: "session", world_date: "1492" })
adapterFiles.set("_system/templates/event.md", readFileSync(path.join(root, "_system/templates/event.md"), "utf8"))
const TableTools = env.load()
const plugin = new TableTools(app, { id: "table-tools" })
workspace.plugin = plugin
await plugin.onload()
assert.ok(plugin.commands.some(item => item.id === "open-timeline" && item.name === plugin.strings.commandOpenTimeline))
await plugin.commands.find(item => item.id === "open-timeline").callback()
const view = env.leaves.find(leaf => leaf.type === "tt-timeline").view
assert.deepEqual(view.rows().map(row => row.file.basename), ["Old", "Year", "Month", "Day", "Session One", "No date"])
assert.ok(byText(view.contentEl, plugin.strings.timelineUndated).length)
assert.ok(view.contentEl.textContent.includes("2026-10-31"))
assert.ok(!view.contentEl.textContent.includes("Other world"))
await byText(view.contentEl, "Year")[0].click()
assert.ok(opened.includes("Campaigns/Glass/Events/Year.md"))
await byText(view.contentEl, plugin.strings.timelineNewEvent)[0].click()
for (let attempt = 0; attempt < 100 && !files.has("Worlds/Coast/Events/Event.md"); attempt++) await new Promise(resolve => setTimeout(resolve, 0))
const created = files.get("Worlds/Coast/Events/Event.md").content
assert.ok(created.includes('world: "[[Worlds/Coast/World]]"'))
assert.ok(created.includes('world_date: "1492-03-14"'))
assert.ok(opened.includes("Worlds/Coast/Events/Event.md"))
files.get("Worlds/Coast/Events/Event.md").frontmatter = { type: "event", world: "[[Worlds/Coast/World]]", world_date: "1492-03-14" }
view.render()
assert.equal(byClass(view.contentEl, "tt-timeline-row").length, 7)
files.get("Campaigns/Glass/Campaign.md").frontmatter.world = ""
files.get("Runs/Harbor/World Day.md").frontmatter = { type: "world-day", world_date: "", date: "1493" }
event("Legacy world", "Campaigns/Glass/Events", { world: "[[Campaigns/Glass/Campaign]]", world_date: "1493" })
assert.ok(view.rows().some(row => row.file.basename === "Legacy world"))
await view.newEvent()
assert.ok(files.get("Campaigns/Glass/Events/Event.md").content.includes('world_date: "1493"'))
