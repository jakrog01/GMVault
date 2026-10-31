import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { createEnvironment, root } from "../support/obsidian.mjs"

const env = createEnvironment()
const { addFile, app, workspace, files, adapterFiles, modals, notices, requests, byLabel } = env
addFile("Active.md", "", { run: "[[Runs/Harbor/Run]]" })
addFile("Runs/Harbor/Run.md", "# Run", { type: "run", campaign: "[[Campaigns/Glass/Campaign]]", party: "[[Parties/Watch/Party]]" })
addFile("Campaigns/Glass/Campaign.md", "# Campaign", { type: "campaign" })
addFile("Parties/Watch/Party.md", "# Party", { type: "party" })
addFile("Runs/Harbor/State.md", "---\ntype: state\n---\n\n## World changes\n\n- Gate opened ([[Session 2026-10-30]])\n", { type: "state" })
const session = addFile("Runs/Harbor/Session 2026-10-30.md", "# Session\nMet [[Campaigns/Glass/NPCs/Guide]].", { type: "session", date: "2026-10-30" })
addFile("Campaigns/Glass/NPCs/Guide.md", "SECRET BODY", { type: "npc", status: "missing" })
adapterFiles.set("_system/templates/claim.md", readFileSync(path.join(root, "_system/templates/claim.md"), "utf8"))
const TableTools = env.load()
const plugin = new TableTools(app, { id: "table-tools" })
workspace.plugin = plugin
await plugin.onload()
plugin.settings.apiKey = "test-key"
const writes = []
const modify = app.vault.modify
app.vault.modify = async (file, content) => { writes.push(file.path); await modify(file, content) }
const create = app.vault.create
app.vault.create = async (filePath, content) => { writes.push(filePath); return create(filePath, content) }
env.network.requestUrl = async () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify({
  worldChanges: [{ text: "Gate opened", links: [] }, { text: "The guide left", links: ["Guide"] }, { text: "The docks flooded", links: ["Docks"] }],
  playersKnow: [{ text: "The guide is missing" }],
  claims: [{ about: "Guide", what: "The guide has a map", from: "Guide" }, { about: "Unknown", what: "The guide has a map", from: "" }],
}) + "\n```" }] } }] } })
workspace.activeFile = session
const command = plugin.commands.find(entry => entry.id === "wrap-up-session")
assert.equal(command.name, plugin.strings.wrapUpSession)
await plugin.wrapUp()
let modal = modals.at(-1)
assert.ok(modal)
for (const label of [plugin.strings.wrapUpWorldChanges, plugin.strings.wrapUpPlayersKnow, plugin.strings.wrapUpRumours]) assert.equal(env.byText(modal.contentEl, label).length, 1)
const rows = env.byClass(modal.contentEl, "tt-wrap-item")
assert.equal(rows.length, 6)
assert.ok(rows.every(row => row.children[0].checked))
rows[1].children[0].checked = false
rows[1].children[0].onchange()
rows[3].children[1].value = "Players know the guide vanished"
rows[3].children[1].onchange()
await byLabel(modal.contentEl, plugin.strings.wrapUpApply)[0].click()
for (let attempt = 0; attempt < 100 && !files.has("Runs/Harbor/Claim The guide has a map 2.md"); attempt++) await new Promise(resolve => setTimeout(resolve, 0))
const state = files.get("Runs/Harbor/State.md").content
assert.equal(state.split("- Gate opened ([[Session 2026-10-30]])").length - 1, 1)
assert.ok(!state.includes("The guide left"))
assert.ok(state.includes("- The docks flooded ([[Session 2026-10-30]])"))
assert.ok(state.includes("## What players know"))
assert.ok(state.includes("- Players know the guide vanished ([[Session 2026-10-30]])"))
assert.deepEqual(writes, ["Runs/Harbor/State.md", "Runs/Harbor/Claim The guide has a map.md", "Runs/Harbor/Claim The guide has a map 2.md"])
const claim = files.get("Runs/Harbor/Claim The guide has a map.md").content
for (const text of ["type: claim", 'about: "[[Guide]]"', 'what: "The guide has a map"', 'from: "[[Guide]]"', 'session: "[[Session 2026-10-30]]"', "status: current"]) assert.ok(claim.includes(text), text)
assert.ok(files.get("Runs/Harbor/Claim The guide has a map 2.md").content.includes('about: "Unknown"'))
const request = requests.find(item => item.method === "POST")
assert.ok(request.url.includes("generateContent"))
const sent = JSON.parse(request.body)
assert.equal(sent.system_instruction.parts[0].text, plugin.strings.wrapUpPrompt)
assert.ok(sent.contents[0].parts[0].text.includes('"status":"missing"'))
assert.ok(!sent.contents[0].parts[0].text.includes("SECRET BODY"))
assert.ok(notices.includes("Added 1 world changes, 1 known facts, and 2 rumours."))

writes.length = 0
await plugin.wrapUp()
modal = modals.at(-1)
byLabel(modal.contentEl, plugin.strings.cancel)[0].click()
assert.deepEqual(writes, [])

addFile("Runs/Harbor/Session 2026-10-31.md", "Latest session", { type: "session", date: "2026-10-31" })
workspace.activeFile = null
await plugin.wrapUp()
modal = modals.at(-1)
assert.ok(JSON.parse(requests.at(-1).body).contents[0].parts[0].text.includes("Latest session"))
byLabel(modal.contentEl, plugin.strings.cancel)[0].click()
workspace.activeFile = session

env.network.requestUrl = async () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: "invalid" }] } }] } })
await plugin.wrapUp()
assert.ok(notices.includes(plugin.strings.wrapUpInvalid))
assert.deepEqual(writes, [])

plugin.settings.apiKey = ""
const count = requests.length
await plugin.wrapUp()
assert.ok(notices.includes(plugin.strings.noApiKey))
assert.equal(requests.length, count)
assert.deepEqual(writes, [])
