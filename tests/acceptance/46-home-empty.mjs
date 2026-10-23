
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assert, boot, createVault, idle, run, startObsidian, test, unload, until } from "./support.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const HOME = "tt-home"

function emptyVault() {
  const env = createVault()
  env.files.clear()
  env.addFile("Active.md", readFileSync(path.join(root, "Active.md"), "utf8"), { run: "" })
  env.addFile("Home.md", readFileSync(path.join(root, "Home.md"), "utf8"))
  for (const folder of ["Campaigns", "Parties", "Runs"]) env.adapterFiles.set(`${folder}/.gmvault-keep`, "")
  for (const id of ["generic", "dnd5e", "coc7e"]) env.adapterFiles.set(`_system/systems/${id}/package.json`, readFileSync(path.join(root, `_system/systems/${id}/package.json`), "utf8"))
  env.adapterFiles.set("_system/templates/campaign.md", readFileSync(path.join(root, "_system/templates/campaign.md"), "utf8"))
  env.adapterFiles.set("_system/VERSION", "1.1.0\n")
  env.adapterFiles.set(".gmvault/state.json", JSON.stringify({ installedVersion: "1.1.0", appliedMigrations: [] }))
  return env
}

function shell(env, plugin, view) {
  assert.equal(env.byText(view.contentEl, plugin.strings.homeTitle).filter(node => node.tag === "h2").length, 1)
  for (const label of [plugin.strings.homeNewCampaign, plugin.strings.homeNewParty, plugin.strings.homeNewRun]) {
    assert.equal(env.byLabel(view.contentEl, label).length, 1, `create button ${label}`)
  }
}

async function ready(env) {
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  await plugin.commands.find(command => command.id === "open-home").callback()
  return { plugin, view: env.leaves.find(leaf => leaf.type === HOME).view }
}

test("the exact post-demo-remove state shows the heading, create buttons, and empty message", async () => {
  const env = emptyVault()
  const { plugin, view } = await ready(env)
  shell(env, plugin, view)
  assert.ok(view.contentEl.textContent.includes(plugin.strings.homeEmpty))
  assert.equal(env.byClass(view.contentEl, "tt-home-active").length, 0)
  assert.equal(plugin.currentContext(), null)
  await unload(plugin)
})

test("New campaign then Create writes and lists the first campaign", async () => {
  const env = emptyVault()
  const { plugin, view } = await ready(env)
  await env.byLabel(view.contentEl, plugin.strings.homeNewCampaign)[0].click()
  const modal = env.modals.at(-1)
  await until(() => env.buttonComponent(modal.contentEl, plugin.strings.homeCreate), 2000, "campaign form")
  env.settingByName(modal.contentEl, plugin.strings.homeFieldName).components[0].change("First Light")
  await env.buttonComponent(modal.contentEl, plugin.strings.homeCreate).click()
  const target = "Campaigns/First Light/Campaign.md"
  await until(() => env.files.has(target), 2000, "campaign written")
  assert.equal(env.files.get(target).frontmatter.type, "campaign")
  assert.equal(env.files.get(target).frontmatter.system, "generic")
  await until(() => env.byClass(view.contentEl, "tt-home-campaign").some(node => node.attributes["data-path"] === target), 2000, "campaign listed")
  assert.ok(env.opened.includes(target))
  await unload(plugin)
})

test("a stalled first model and a superseded render keep the creation shell visible", async () => {
  const env = emptyVault()
  const plugin = await boot(env)
  const leaf = env.workspace.getLeaf()
  const view = plugin.viewFactories.get(HOME)(leaf)
  let release
  const read = env.app.vault.adapter.read
  env.app.vault.adapter.read = filePath => filePath === ".gmvault/state.json" ? new Promise(resolve => { release = resolve }) : read(filePath)
  const pending = view.onOpen()
  shell(env, plugin, view)
  env.app.vault.adapter.read = read
  await view.render()
  release("{}")
  await pending
  shell(env, plugin, view)
  assert.ok(view.contentEl.textContent.includes(plugin.strings.homeEmpty))
  await view.onClose()
  await unload(plugin)
})

test("a rejected model read keeps buttons and shows an overridable error line", async () => {
  const env = emptyVault()
  env.addFile("_local/plugins/table-tools/strings.json", JSON.stringify({ homeLoadError: "Home data could not be read." }))
  const plugin = await boot(env)
  env.addFile("Parties/Unreadable/Party.md", "", { type: "party" })
  const cause = new Error("party read failed")
  const read = env.app.vault.cachedRead
  env.app.vault.cachedRead = async file => { if (file.path === "Parties/Unreadable/Party.md") throw cause; return read(file) }
  const errors = []
  const log = console.error
  console.error = (...args) => errors.push(args)
  try {
    await plugin.openHome()
    const view = env.leaves.find(leaf => leaf.type === HOME).view
    shell(env, plugin, view)
    assert.ok(view.contentEl.textContent.includes("Home data could not be read."))
    assert.ok(errors.some(args => args.includes(cause)), "original error logged")
  } finally {
    console.error = log
    await unload(plugin)
  }
})

test("empty run, campaign, and party links never resolve to their source note", async () => {
  const env = emptyVault()
  const { plugin, view } = await ready(env)
  const pointer = env.files.get("Active.md").file
  assert.equal(env.app.metadataCache.getFirstLinkpathDest("", pointer.path), pointer, "mock matches Obsidian's empty-link behavior")
  for (const value of [undefined, "", "   ", "[[]]", "[[#Heading]]", "[[|Label]]"]) {
    assert.equal(plugin.resolve(value, pointer), null, `unset link ${JSON.stringify(value)}`)
    env.files.get("Active.md").frontmatter.run = value
    assert.equal(plugin.currentContext(), null)
  }
  const run = env.addFile("Runs/Incomplete/Run.md", "", { type: "run", campaign: "", party: "" })
  env.addFile("Runs/Incomplete/State.md")
  env.files.get("Active.md").frontmatter.run = "[[Runs/Incomplete/Run]]"
  assert.equal(plugin.currentContext(), null)
  assert.equal(view.resolvesTo("", run, run), false)
  await view.render()
  const card = env.byClass(view.contentEl, "tt-home-run")[0]
  assert.equal(env.byClass(card, "tt-muted").length, 0, "unset party adds no source-note label")
  assert.equal(env.byClass(view.contentEl, "tt-home-active").length, 0)
  await unload(plugin)
})

test("a Home leaf restored before registration is loaded at layout readiness", async () => {
  const env = emptyVault()
  const leaf = env.restoreLeaf(HOME)
  const plugin = await boot(env)
  startObsidian(env)
  await until(() => leaf.view.contentEl.textContent.includes(plugin.strings.homeEmpty), 2000, "restored Home rendered")
  shell(env, plugin, leaf.view)
  assert.equal(env.leaves.filter(entry => entry.type === HOME).length, 1)
  await unload(plugin)
})

test("openHome and openView load deferred leaves and await their reveal", async () => {
  const env = emptyVault()
  const plugin = await boot(env)
  for (const type of [HOME, "tt-combat", "tt-assistant"]) {
    const leaf = env.restoreLeaf(type)
    await (type === HOME ? plugin.openHome() : plugin.openView(type))
    assert.equal(leaf.deferred, false, `${type} loaded`)
    assert.equal(leaf.revealed, true, `${type} reveal awaited`)
    assert.equal(leaf.view.getViewType(), type)
    if (type === HOME) shell(env, plugin, leaf.view)
    await leaf.view.onClose?.()
  }
  await unload(plugin)
})

await run("46-home-empty")
