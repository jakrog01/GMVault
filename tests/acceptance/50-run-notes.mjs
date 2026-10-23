import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assert, boot, createVault, run, startObsidian, test, unload, until } from "./support.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = file => readFileSync(path.join(root, file), "utf8")
const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

async function home(env) {
  const plugin = await boot(env)
  plugin.settings.openHomeOnStartup = false
  startObsidian(env)
  await plugin.openHome()
  const view = env.leaves.find(leaf => leaf.type === "tt-home").view
  await until(() => env.byClass(view.contentEl, "tt-home-run").length, 2000, "run card")
  const card = env.byClass(view.contentEl, "tt-home-run")[0]
  return { plugin, button: env.byLabel(card, plugin.strings.homeNewSession)[0] }
}

test("New session creates dated, linked notes without Templater commands", async () => {
  const env = createVault()
  env.adapterFiles.set("_system/templates/session.md", read("_system/templates/session.md"))
  const { plugin, button } = await home(env)
  assert.ok(button)
  await button.click()
  const first = `Runs/Harbor/Session ${today()}.md`
  await until(() => env.files.has(first), 2000, "first session")
  const content = env.files.get(first).content
  assert.match(content, /^---\ntype: session\nrun: "\[\[Runs\/Harbor\/Run\]\]"\ndate: \d{4}-\d{2}-\d{2}\n---/)
  assert.ok(content.includes("![[Runs/Harbor/World Day]]"))
  assert.equal(content.includes("<%"), false)
  await button.click()
  await until(() => env.files.has(`Runs/Harbor/Session ${today()} 2.md`), 2000, "second session")
  await unload(plugin)
})

test("a local session template overrides the shipped template", async () => {
  const env = createVault()
  env.adapterFiles.set("_system/templates/session.md", read("_system/templates/session.md"))
  env.adapterFiles.set("_local/templates/session.md", "---\ntype: other\nrun: wrong\ndate: old\n---\n\n# <% tp.file.title %>\n\n## Local plan\n")
  const { plugin, button } = await home(env)
  await button.click()
  const file = `Runs/Harbor/Session ${today()}.md`
  await until(() => env.files.has(file), 2000, "local session")
  const content = env.files.get(file).content
  assert.ok(content.includes("## Local plan"))
  assert.ok(content.includes("run: \"[[Runs/Harbor/Run]]\""))
  assert.ok(content.includes(`date: ${today()}`))
  assert.ok(content.includes("type: session"))
  assert.equal(content.includes("<%"), false)
  await unload(plugin)
})

test("Templater uses ordered regex rules and every referenced template exists", () => {
  const config = JSON.parse(read("_system/obsidian/plugins/templater-obsidian/data.json"))
  const installed = JSON.parse(read(".obsidian/plugins/templater-obsidian/data.json"))
  assert.equal(config.trigger_on_file_creation, true)
  assert.equal(config.trigger_on_file_creation_mode, "regex")
  assert.deepEqual(config.folder_templates, [])
  assert.deepEqual(config.ignore_folders_on_creation, [{ folder: "_system" }, { folder: "_local" }, { folder: ".gmvault" }])
  for (const key of ["trigger_on_file_creation", "trigger_on_file_creation_mode", "ignore_folders_on_creation", "file_templates", "folder_templates"]) assert.deepEqual(installed[key], config[key])
  const selected = file => config.file_templates.find(rule => new RegExp(rule.regex).test(file))?.template ?? null
  for (const [file, kind] of [["Runs/X/Run.md", "run"], ["Runs/X/Notes.md", "session"], ["Campaigns/X/Campaign.md", "campaign"], ["Parties/X/Party.md", "party"], ["Campaigns/X/NPCs/Some NPC.md", "npc"], ["Campaigns/X/Locations/Place.md", "location"], ["Campaigns/X/Quests/Task.md", "quest"], ["Campaigns/X/Factions/Group.md", "faction"], ["Campaigns/X/Some NPC.md", null]]) assert.equal(selected(file), kind ? `_system/templates/${kind}.md` : null)
  for (const rule of config.file_templates) assert.ok(read(rule.template).length > 0)
  for (const kind of ["session", "quest", "npc", "location", "faction", "claim"]) assert.match(read(`_system/templates/${kind}.md`), /^---\ntype: /)
  for (const kind of ["npc", "location", "quest", "faction"]) {
    const template = read(`_system/templates/${kind}.md`)
    assert.ok(template.includes('tp.file.folder(true)'), `${kind} derives the campaign from its folder`)
    assert.ok(template.includes('[[Campaigns/'), `${kind} links to Campaign.md`)
  }
  const manifest = JSON.parse(read("_system/manifest.json"))
  const keys = manifest.managedObsidian.find(item => item.path === "plugins/templater-obsidian/data.json").keys
  for (const key of ["trigger_on_file_creation", "trigger_on_file_creation_mode", "ignore_folders_on_creation"]) assert.ok(keys.includes(key))
})

await run("50-run-notes")
