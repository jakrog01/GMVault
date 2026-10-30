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
  assert.ok(await exists(path.join(root, "_system/.demo/Campaigns/Glassgate/Campaign.md")))
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
  for (const section of ["Locations", "Factions", "NPCs", "Events", "Mechanics", "Lore", ...["Religion", "History", "Culture", "Peoples", "Languages", "Magic", "Cosmology", "Economy", "Creatures", "Other"].map(name => `Lore/${name}`)]) assert.ok(env.folders.has(`${base}/${section}`), section)
  await find(view.contentEl, node => node.attributes?.["aria-label"] === plugin.strings.homeNewCampaign)[0].click()
  const campaign = env.modals.at(-1)
  env.settingByName(campaign.contentEl, plugin.strings.homeFieldWorld).components[0].change(`${base}/World.md`)
  assert.equal(env.settingByName(campaign.contentEl, plugin.strings.homeFieldSystem).components[0].value, "dnd5e")
  campaign.close()
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
    await write("Campaigns/X/Campaign.md", "---\ntype: campaign\nsystem: generic\nworld: \"[[Worlds/X/World]]\"\n---\n")
    await write("Campaigns/X/Quests/Q.md", "---\ntype: quest\n---\n\nSee [[Worlds/X/World#History|the past]].\n")
    await write("Library/Mechanics/generic/Spells/S.md", "---\ntype: spell\n---\n\n[[Worlds/X/World]]\n")
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
    const before = await readFile(path.join(vault, "Campaigns/X/Campaign.md"), "utf8")
    const preview = await cli("migrate", "system-library", "--dry-run")
    assert.match(preview.stdout, /would migrate/, preview.stderr)
    assert.equal(await readFile(path.join(vault, "Campaigns/X/Campaign.md"), "utf8"), before)
    assert.ok(await exists(path.join(vault, "Worlds/X/World.md")))
    assert.equal(await exists(path.join(vault, "Library/generic/Worlds/X/World.md")), false)
    const moved = await cli("migrate", "system-library")
    assert.match(moved.stdout, /backup \.gmvault\/backups\//)
    assert.ok(await exists(path.join(vault, "Library/generic/Worlds/X/World.md")))
    assert.ok(await exists(path.join(vault, "Library/generic/Mechanics/Spells/S.md")))
    assert.match(await readFile(path.join(vault, "Library/generic/Worlds/X/World.md"), "utf8"), /system: generic/)
    assert.match(await readFile(path.join(vault, "Campaigns/X/Campaign.md"), "utf8"), /\[\[Library\/generic\/Worlds\/X\/World\]\]/)
    assert.match(await readFile(path.join(vault, "Campaigns/X/Quests/Q.md"), "utf8"), /\[\[Library\/generic\/Worlds\/X\/World#History\|the past\]\]/)
    const backups = await readdir(path.join(vault, ".gmvault/backups"))
    const backup = backups.find(name => name.endsWith("-system-library"))
    assert.ok(backup)
    assert.ok(await exists(path.join(vault, ".gmvault/backups", backup, "Worlds/X/World.md")))
    assert.ok(await exists(path.join(vault, ".gmvault/backups", backup, "Campaigns/X/Campaign.md")))
    assert.match((await cli("doctor")).stdout, /doctor: clean/)
    assert.match((await cli("migrate", "system-library")).stdout, /no changes/)
    await cli("demo", "install")
    assert.match((await cli("demo", "status")).stdout, /demo notes: [1-9]/)
    await cli("demo", "remove")
    assert.match((await cli("demo", "status")).stdout, /demo notes: 0/)
  } finally { await rm(vault, { recursive: true, force: true }) }
}, 120000)

test("a nested location template links its parent place", async () => {
  const body = await readFile(path.join(root, "_system/templates/location.md"), "utf8")
  const command = body.match(/^location: "<%\* ([\s\S]*?) %>"$/m)?.[1]
  assert.ok(command)
  const output = new Function("tp", `let tR = ""; ${command}; return tR`)({ file: { folder: () => "Library/generic/Worlds/Coast/Locations/A", title: "B" } })
  assert.equal(output, "[[A]]")
  const folderNote = new Function("tp", `let tR = ""; ${command}; return tR`)({ file: { folder: () => "Library/generic/Worlds/Coast/Locations/A", title: "A" } })
  assert.equal(folderNote, "")
  const nested = new Function("tp", `let tR = ""; ${command}; return tR`)({ file: { folder: () => "Library/generic/Worlds/Coast/Locations/A/B", title: "B" } })
  assert.equal(nested, "[[A]]")
})

await run("55-system-library")
