import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assert, boot, createVault, idle, run, startObsidian, test, unload, until } from "./support.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const exists = item => access(item).then(() => true).catch(() => false)
const find = (element, predicate, found = []) => {
  if (predicate(element)) found.push(element)
  for (const child of element.children ?? []) find(child, predicate, found)
  return found
}

test("new and old library paths classify and scope correctly", async () => {
  const env = createVault()
  env.files.get("Campaigns/Glass/Campaign.md").frontmatter.system = "generic"
  env.files.get("Campaigns/Glass/Campaign.md").frontmatter.world = "[[Library/generic/Worlds/Coast/World]]"
  const world = env.addFile("Library/generic/Worlds/Coast/World.md", "Coast world keyword", { type: "world", system: "generic" })
  const place = env.addFile("Library/generic/Worlds/Coast/Locations/Harbor.md", "Harbor keyword")
  const brew = env.addFile("Library/generic/Worlds/Coast/Mechanics/Tide.md", "Tide keyword")
  const creature = env.addFile("Library/generic/Worlds/Coast/Lore/Creatures/Wisp.md", "Wisp keyword", { type: "creature", system: "generic" })
  const rules = env.addFile("Library/generic/Mechanics/Rules/Turn.md", "Turn keyword")
  const oldRules = env.addFile("Library/Mechanics/generic/Rules/Old.md", "Old keyword")
  const oldWorldsSystem = env.addFile("Library/Mechanics/Worlds/Rules/Old.md", "Old worlds keyword")
  const other = env.addFile("Library/generic/Worlds/Other/World.md", "Other keyword")
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  assert.equal(plugin.index.globalKind(world), "campaign")
  assert.equal(plugin.index.globalKind(place), "campaign")
  assert.equal(plugin.index.globalKind(brew), "homebrew")
  assert.equal(plugin.index.globalKind(creature), "campaign")
  assert.equal(plugin.index.globalKind(rules), "system")
  assert.equal(plugin.index.globalKind(oldRules), "system")
  assert.equal(plugin.index.globalKind(oldWorldsSystem), "system")
  assert.equal(plugin.index.scope().worldPath, world.path)
  assert.ok(plugin.index.scope().roots.some(entry => entry.path === "Library/generic/Mechanics"))
  assert.ok(plugin.index.scope().roots.some(entry => entry.path === "Library/Mechanics/generic"))
  assert.ok(plugin.bestiaryPaths().includes("Library/generic/Worlds/Coast/Mechanics/Bestiary"))
  assert.ok(plugin.bestiaryPaths().includes("Library/Mechanics/generic/Bestiary"))
  assert.ok(!plugin.index.scope().roots.some(entry => entry.path === "Library/generic/Worlds"))
  assert.ok(plugin.index.search("Harbor keyword").some(hit => hit.chunk.path === place.path))
  assert.ok(!plugin.index.search("Other keyword").some(hit => hit.chunk.path === other.path))
  await unload(plugin)
})

test("character options are system rules in the matching run", async () => {
  const env = createVault()
  const campaign = env.files.get("Campaigns/Glass/Campaign.md")
  campaign.frontmatter.system = "dnd5e"
  const subclass = env.addFile("Library/dnd5e/Mechanics/Classes/Fighter/Battle Master.md", "Battle Master maneuvers keyword", { type: "subclass", system: "dnd5e", class: "[[Library/dnd5e/Mechanics/Classes/Fighter/Fighter]]" })
  const feat = env.addFile("Library/dnd5e/Mechanics/Feats/Alert.md", "Alert feat keyword", { type: "feat", system: "dnd5e" })
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  for (const file of [subclass, feat]) {
    assert.equal(plugin.index.globalKind(file), "system")
    assert.ok(plugin.index.byPath(file.path).length, file.path)
  }
  campaign.frontmatter.system = "generic"
  for (const file of [subclass, feat]) assert.equal(plugin.index.byPath(file.path).length, 0, file.path)
  await unload(plugin)
})

test("shipped Markdown outside templates stays in dot folders", async () => {
  const visible = new Set(["_system/assistant/skills/consequences.md", "_system/assistant/skills/npc-improvisation.md", "_system/assistant/skills/passer-by.md", "_system/assistant/skills/rules-adjudication.md", "_system/assistant/skills/scene-description.md", "_system/assistant/skills/session-summary.md", "_system/obsidian/plugins/obsidian-style-settings/LICENSE.md"])
  const visit = async relative => {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`
      if (entry.isDirectory() && entry.name !== "node_modules") await visit(file)
      else if (entry.name.endsWith(".md")) assert.ok(file.startsWith("_system/templates/") || file.split("/").slice(1).some(part => part.startsWith(".")) || visible.has(file), file)
    }
  }
  await visit("_system")
  assert.equal(await exists(path.join(root, "_system/demo")), false)
  assert.ok(await exists(path.join(root, "_system/.demo/Library/generic/Campaigns/Glassgate/Campaign.md")))
})

test("Home creates a world in the chosen system with the ADR folders", async () => {
  const env = createVault()
  for (const id of ["generic", "dnd5e"]) env.adapterFiles.set(`_system/systems/${id}/package.json`, await readFile(path.join(root, `_system/systems/${id}/package.json`), "utf8"))
  env.adapterFiles.set("_system/templates/world.md", await readFile(path.join(root, "_system/templates/world.md"), "utf8"))
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  await plugin.commands.find(command => command.id === "open-home").callback()
  await until(() => env.leaves.some(leaf => leaf.type === "tt-home"), 2000, "home")
  const view = env.leaves.find(leaf => leaf.type === "tt-home").view
  await find(view.contentEl, node => node.attributes?.["aria-label"] === plugin.strings.homeNewWorld)[0].click()
  const modal = env.modals.at(-1)
  env.settingByName(modal.contentEl, plugin.strings.homeFieldName).components[0].change("Coast")
  env.settingByName(modal.contentEl, plugin.strings.homeFieldSystem).components[0].change("dnd5e")
  await env.buttonComponent(modal.contentEl, plugin.strings.homeCreate).click()
  const base = "Library/dnd5e/Worlds/Coast"
  await until(() => env.files.has(`${base}/World.md`), 2000, "world created")
  assert.equal(env.files.get(`${base}/World.md`).frontmatter.system, "dnd5e")
  for (const section of ["Locations", "Factions", "NPCs", "Events", "Mechanics", "Lore"]) assert.ok(env.folders.has(`${base}/${section}`), section)
  assert.ok(!env.folders.has(`${base}/Lore/Religion`))
  await find(view.contentEl, node => node.attributes?.["aria-label"] === plugin.strings.homeNewCampaign)[0].click()
  const campaign = env.modals.at(-1)
  env.settingByName(campaign.contentEl, plugin.strings.homeFieldWorld).components[0].change(`${base}/World.md`)
  assert.equal(env.settingByName(campaign.contentEl, plugin.strings.homeFieldSystem).components[0].value, "dnd5e")
  env.settingByName(campaign.contentEl, plugin.strings.homeFieldName).components[0].change("Coast Story")
  await env.buttonComponent(campaign.contentEl, plugin.strings.homeCreate).click()
  const campaignBase = "Library/dnd5e/Campaigns/Coast Story"
  await until(() => env.files.has(`${campaignBase}/Campaign.md`), 2000, "campaign created")
  for (const section of ["Quests", "Encounters", "Handouts"]) assert.ok(env.folders.has(`${campaignBase}/${section}`), section)
  for (const section of ["NPCs", "Locations", "Factions", "Lore", "Mechanics", "Lore/Creatures"]) assert.ok(!env.folders.has(`${campaignBase}/${section}`), section)
  await find(view.contentEl, node => node.attributes?.["aria-label"] === plugin.strings.homeNewCampaign)[0].click()
  const solo = env.modals.at(-1)
  env.settingByName(solo.contentEl, plugin.strings.homeFieldName).components[0].change("Solo")
  await env.buttonComponent(solo.contentEl, plugin.strings.homeCreate).click()
  const soloBase = "Library/generic/Campaigns/Solo"
  await until(() => env.files.has(`${soloBase}/Campaign.md`), 2000, "solo campaign created")
  for (const section of ["NPCs", "Locations", "Factions", "Quests", "Encounters", "Handouts"]) assert.ok(env.folders.has(`${soloBase}/${section}`), section)
  await unload(plugin)
})

test("migration previews, backs up and rewrites, then becomes a no-op", async () => {
  await mkdir("/tmp/claude-1000", { recursive: true })
  const vault = await mkdtemp("/tmp/claude-1000/system-library-")
  try {
    await cp(root, vault, { recursive: true, filter: item => !item.includes(`${path.sep}.git`) && !item.includes(`${path.sep}node_modules`) && !item.includes(`${path.sep}.agents`) && !item.includes(`${path.sep}.gmvault${path.sep}backups`) })
    const write = async (relative, body) => { const item = path.join(vault, relative); await mkdir(path.dirname(item), { recursive: true }); await writeFile(item, body) }
    await write("Worlds/X/World.md", "---\ntype: world\n---\n\n# X\n")
    await write("Worlds/X/Locations/A.md", "---\ntype: location\nworld: \"[[Worlds/X/World]]\"\n---\n")
    await write("Campaigns/X/Campaign.md", "---\ntype: campaign\nsystem: dnd5e\nworld: \"[[Worlds/X/World]]\"\n---\n")
    await write("Campaigns/X/Quests/Q.md", "---\ntype: quest\n---\n\nSee [[Worlds/X/World#History|the past]].\n")
    await write("Library/Mechanics/generic/Spells/S.md", "---\ntype: spell\n---\n\n[[Worlds/X/World]]\n")
    await write("Parties/P/Party.md", "---\ntype: party\ncampaign: \"[[Campaigns/X/Campaign]]\"\n---\n")
    await write("Runs/R/Run.md", "---\ntype: run\ncampaign: \"[[X]]\"\n---\n")
    let sequence = 0
    const cli = async (...args) => {
      const argv = process.argv
      const log = console.log
      const error = console.error
      const code = process.exitCode
      const lines = []
      const errors = []
      process.argv = [argv[0], path.join(vault, "_system/bin/gmvault.mjs"), ...args]
      console.log = (...values) => lines.push(values.join(" "))
      console.error = (...values) => errors.push(values.join(" "))
      process.exitCode = 0
      try { await import(`file://${path.join(vault, "_system/bin/gmvault.mjs")}?run=${++sequence}`) }
      finally { process.argv = argv; console.log = log; console.error = error }
      const result = { stdout: lines.join("\n"), stderr: errors.join("\n"), code: process.exitCode }
      process.exitCode = code
      assert.equal(result.code, 0, result.stderr)
      return result
    }
    assert.match((await cli("doctor")).stdout, /doctor: clean/)
    const before = await readFile(path.join(vault, "Campaigns/X/Campaign.md"), "utf8")
    const preview = await cli("migrate", "system-library", "--dry-run")
    assert.match(preview.stdout, /would migrate/, preview.stderr)
    assert.equal(await readFile(path.join(vault, "Campaigns/X/Campaign.md"), "utf8"), before)
    assert.ok(await exists(path.join(vault, "Worlds/X/World.md")))
    assert.equal(await exists(path.join(vault, "Library/dnd5e/Worlds/X/World.md")), false)
    const moved = await cli("migrate", "system-library")
    assert.match(moved.stdout, /backup \.gmvault\/backups\//)
    assert.ok(await exists(path.join(vault, "Library/dnd5e/Worlds/X/World.md")))
    assert.ok(await exists(path.join(vault, "Library/generic/Mechanics/Spells/S.md")))
    assert.match(await readFile(path.join(vault, "Library/dnd5e/Worlds/X/World.md"), "utf8"), /system: dnd5e/)
    assert.match(await readFile(path.join(vault, "Library/dnd5e/Campaigns/X/Campaign.md"), "utf8"), /\[\[Library\/dnd5e\/Worlds\/X\/World\]\]/)
    assert.match(await readFile(path.join(vault, "Library/dnd5e/Campaigns/X/Quests/Q.md"), "utf8"), /\[\[Library\/dnd5e\/Worlds\/X\/World#History\|the past\]\]/)
    assert.equal(await exists(path.join(vault, "Campaigns")), false)
    assert.equal(await exists(path.join(vault, "Worlds")), false)
    const backups = await readdir(path.join(vault, ".gmvault/backups"))
    const backup = backups.find(name => name.endsWith("-system-library"))
    assert.ok(backup)
    assert.ok(await exists(path.join(vault, ".gmvault/backups", backup, "Worlds/X/World.md")))
    assert.ok(await exists(path.join(vault, ".gmvault/backups", backup, "Campaigns/X/Campaign.md")))
    assert.match(await readFile(path.join(vault, "Parties/P/Party.md"), "utf8"), /Library\/dnd5e\/Campaigns\/X\/Campaign/)
    assert.match(await readFile(path.join(vault, "Runs/R/Run.md"), "utf8"), /Library\/dnd5e\/Campaigns\/X\/Campaign/)
    assert.match((await cli("doctor")).stdout, /doctor: clean/)
    await write("Campaigns/Y/Campaign.md", "---\ntype: campaign\nsystem: dnd5e\n---\n")
    await write("Library/dnd5e/Campaigns/Y/Campaign.md", "---\ntype: campaign\nsystem: dnd5e\n---\n")
    await assert.rejects(() => cli("migrate", "system-library", "--dry-run"), /target already exists/)
    await rm(path.join(vault, "Campaigns/Y"), { recursive: true })
    await rm(path.join(vault, "Library/dnd5e/Campaigns/Y"), { recursive: true })
    await rm(path.join(vault, "Campaigns"), { recursive: true })
    assert.match((await cli("migrate", "system-library")).stdout, /no changes/)
    await cli("demo", "install")
    assert.match((await cli("demo", "status")).stdout, /demo notes: [1-9]/)
    await cli("demo", "remove")
    assert.match((await cli("demo", "status")).stdout, /demo notes: 0/)
  } finally { await rm(vault, { recursive: true, force: true }) }
}, 120000)

test("a nested location template uses the layout dispatcher", async () => {
  const body = await readFile(path.join(root, "_system/templates/location.md"), "utf8")
  assert.match(body, /gmvault_layout\(tp, "locationParent"\)/)
})

await run("55-system-library")
