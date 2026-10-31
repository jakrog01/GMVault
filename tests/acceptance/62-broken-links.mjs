import assert from "node:assert/strict"
import { createEnvironment } from "../support/obsidian.mjs"

const env = createEnvironment()
const { addFile, app, workspace, byText, modals, opened } = env
addFile("Campaigns/Glass/Campaign.md", "", { type: "campaign" })
addFile("Runs/Harbor/State.md", "", { type: "state" })
addFile("_system/templates/event.md", "")
addFile("_local/example.md", "")
addFile("Archive/Old.md", "")
addFile(".hidden/Draft.md", "")
app.metadataCache.unresolvedLinks = {
  "Campaigns/Glass/Campaign.md": { "Absent A": 1, "Absent B": 2 },
  "Runs/Harbor/State.md": { "Absent C": 1 },
  "_system/templates/event.md": { "System target": 1 },
  "_local/example.md": { "Local target": 1 },
  "Archive/Old.md": { "Archived target": 1 },
  ".hidden/Draft.md": { "Hidden target": 1 },
}
const TableTools = env.load()
const plugin = new TableTools(app, { id: "table-tools" })
workspace.plugin = plugin
await plugin.onload()
await plugin.openHome()
const home = env.leaves.find(leaf => leaf.type === "tt-home").view
assert.equal(home.panel.brokenLinks().length, 3)
assert.ok(home.contentEl.textContent.includes("Broken links: 3"))
await byText(home.contentEl, "Broken links: 3")[0].click()
const modal = modals.at(-1)
assert.ok(modal.contentEl.textContent.includes("Campaigns/Glass/Campaign.md -> Absent A"))
assert.ok(!modal.contentEl.textContent.includes("System target"))
await byText(modal.contentEl, "Campaigns/Glass/Campaign.md -> Absent A")[0].click()
assert.ok(opened.includes("Campaigns/Glass/Campaign.md"))
app.metadataCache.unresolvedLinks = {}
home.panel.refreshMaintenance()
assert.ok(!home.contentEl.textContent.includes("Maintenance"))
