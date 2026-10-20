import { assert, boot, createVault, run, startObsidian, test, unload, until } from "./support.mjs"

const HOME = "tt-home"

test("Table home lists only game notes, not shipped or local templates and demos", async () => {
  const env = createVault()
  env.files.clear()
  env.addFile("Active.md", "", { run: "" })
  env.addFile("Campaigns/Real/Campaign.md", "", { type: "campaign", system: "generic" })
  env.addFile("Parties/Crew/Party.md", "", { type: "party" })
  env.addFile("_system/templates/campaign.md", "", { type: "campaign" })
  env.addFile("_system/demo/Parties/Clockmakers/Party.md", "", { type: "party" })
  env.addFile("_system/demo/Runs/Demo/Run.md", "", { type: "run" })
  env.addFile("_local/templates/party.md", "", { type: "party" })
  env.adapterFiles.set("_system/VERSION", "2.1.1\n")
  env.adapterFiles.set(".gmvault/state.json", JSON.stringify({ installedVersion: "2.1.1", appliedMigrations: [] }))
  const plugin = await boot(env)
  startObsidian(env)
  await plugin.openHome()
  const view = env.leaves.find(leaf => leaf.type === HOME).view
  const listed = cls => env.byClass(view.contentEl, cls).map(node => node.attributes["data-path"])
  await until(() => listed("tt-home-campaign").length, 2000, "campaigns listed")
  assert.deepEqual(listed("tt-home-campaign"), ["Campaigns/Real/Campaign.md"])
  assert.deepEqual(listed("tt-home-party"), ["Parties/Crew/Party.md"])
  assert.deepEqual(listed("tt-home-run"), [])
  await unload(plugin)
})

test("a Home view opened through Obsidian's View.open renders its shell", async () => {
  const env = createVault()
  const plugin = await boot(env)
  startObsidian(env)
  await plugin.openHome()
  const view = env.leaves.find(leaf => leaf.type === HOME).view
  assert.equal(env.byText(view.contentEl, plugin.strings.homeTitle).filter(node => node.tag === "h2").length, 1)
  assert.equal(env.byLabel(view.contentEl, plugin.strings.homeNewCampaign).length, 1)
  await unload(plugin)
})

await run("41-home-game-notes")
