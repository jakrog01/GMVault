import { assert, boot, createVault, idle, paths, run, startObsidian, test, unload, until } from "./support.mjs"

const find = (node, predicate, found = []) => {
  if (predicate(node)) found.push(node)
  for (const child of node.children ?? []) find(child, predicate, found)
  return found
}
const cards = (view, className) => find(view.contentEl, node => node.classes?.has(className))

async function openHome(env, plugin) {
  await plugin.commands.find(command => command.id === "open-home").callback()
  await until(() => env.leaves.some(leaf => leaf.type === "tt-home"), 2000, "home")
  return env.leaves.find(leaf => leaf.type === "tt-home").view
}

test("GM scope follows type and campaign or world links across folders", async () => {
  const env = createVault()
  env.addFile("Worlds/Glass Coast/World.md", "# Glass Coast\nStorm lore keyword.", { type: "world" })
  env.files.get("Campaigns/Glass/Campaign.md").frontmatter.world = "[[Worlds/Glass Coast/World]]"
  env.addFile("Library/People/Harbor Guide.md", "Harbor guide keyword.", { type: "npc", campaign: "[[Campaigns/Glass/Campaign]]" })
  env.addFile("Library/People/Coast Pilot.md", "Coast pilot keyword.", { type: "npc", world: "[[Worlds/Glass Coast/World]]" })
  env.addFile("Campaigns/Glass/NPCs/Ember Spy.md", "Ember spy keyword.", { type: "npc", campaign: "[[Campaigns/Ember/Campaign]]" })
  env.addFile("Campaigns/Ember/Campaign.md", "# Ember", { type: "campaign" })
  env.addFile("Worlds/Ember/World.md", "# Ember", { type: "world" })
  env.addFile("Campaigns/Glass/NPCs/Ember Envoy.md", "Ember envoy keyword.", { type: "npc", world: "[[Worlds/Ember/World]]" })
  env.addFile("Library/Mechanics/Glass Charm.md", "Glass charm keyword.", { type: "item", campaign: "[[Campaigns/Glass/Campaign]]" })
  env.addFile("Worlds/Glass Coast/Mechanics/Storm Rule.md", "Storm rule keyword.", { type: "rules", world: "[[Worlds/Glass Coast/World]]" })
  env.addFile("Worlds/Glass Coast/Mechanics/Old Rule.md", "Old rule keyword.")
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  assert.ok(paths(plugin.index.search("storm lore keyword")).includes("Worlds/Glass Coast/World.md"))
  assert.ok(paths(plugin.index.search("harbor guide keyword")).includes("Library/People/Harbor Guide.md"))
  assert.ok(paths(plugin.index.search("coast pilot keyword")).includes("Library/People/Coast Pilot.md"))
  assert.ok(!paths(plugin.index.search("ember spy keyword")).includes("Campaigns/Glass/NPCs/Ember Spy.md"))
  assert.ok(!paths(plugin.index.search("ember envoy keyword")).includes("Campaigns/Glass/NPCs/Ember Envoy.md"))
  assert.ok(paths(plugin.index.search("glass charm keyword")).includes("Library/Mechanics/Glass Charm.md"))
  assert.ok(paths(plugin.index.search("storm rule keyword")).includes("Worlds/Glass Coast/Mechanics/Storm Rule.md"))
  assert.ok(paths(plugin.index.search("old rule keyword")).includes("Worlds/Glass Coast/Mechanics/Old Rule.md"))
  assert.equal(plugin.index.scope().worldPath, "Worlds/Glass Coast/World.md")
  await unload(plugin)
})

test("Home counts linked characters and falls back to legacy Members lists", async () => {
  const env = createVault()
  env.files.get("Parties/Watch/Party.md").content = "# Watch\n\n## Members\n\n- One\n- Two\n- Three"
  env.addFile("Parties/Other/Party.md", "# Other\n\n## Members\n\n- Legacy", { type: "party" })
  env.addFile("Library/Characters/Mira.md", "# Mira", { type: "pc", party: "[[Parties/Watch/Party]]" })
  env.addFile("Library/Characters/Ari.md", "# Ari", { type: "npc", subtype: "pc", party: "[[Parties/Watch/Party]]" })
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  const view = await openHome(env, plugin)
  const count = path => cards(view, "tt-home-party").find(card => card.attributes["data-path"] === path).textContent
  assert.ok(count("Parties/Watch/Party.md").includes("Members: 2"))
  assert.ok(count("Parties/Other/Party.md").includes("Members: 1"))
  const newCharacter = env.addFile("Library/Characters/Sol.md", "# Sol", { type: "pc", party: "[[Parties/Watch/Party]]" })
  env.emit("create", newCharacter)
  await until(() => count("Parties/Watch/Party.md").includes("Members: 3"), 2000, "linked character refresh")
  const newWorld = env.addFile("Worlds/Glass Coast/World.md", "# Glass Coast", { type: "world" })
  env.emit("create", newWorld)
  await until(() => cards(view, "tt-home-world").some(card => card.attributes["data-path"] === newWorld.path), 2000, "world refresh")
  await unload(plugin)
})

test("combat offers linked player characters and uses the old folder rule as fallback", async () => {
  const env = createVault()
  env.addFile("Library/Characters/Mira.md", "# Mira", { type: "pc", party: "[[Parties/Watch/Party]]", ac: 15, hp: 20 })
  env.addFile("Parties/Watch/Old.md", "# Old", { ac: 10, hp: 10 })
  env.addFile("Library/Characters/Other.md", "# Other", { type: "pc", party: "[[Parties/Other/Party]]" })
  env.addFile("Parties/Other/Party.md", "# Other", { type: "party" })
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin)
  await plugin.commands.find(command => command.id === "open-combat").callback()
  await until(() => env.leaves.some(leaf => leaf.type === "tt-combat"), 2000, "combat")
  const view = env.leaves.find(leaf => leaf.type === "tt-combat").view
  await env.byLabel(view.contentEl, plugin.strings.toolbarPlayers)[0].click()
  let modal = env.modals.at(-1)
  assert.ok(env.settingByName(modal.contentEl, "Mira"))
  assert.equal(env.settingByName(modal.contentEl, "Old"), undefined)
  assert.equal(env.settingByName(modal.contentEl, "Other"), undefined)
  modal.close()
  env.files.get("Library/Characters/Mira.md").frontmatter.party = ""
  await env.byLabel(view.contentEl, plugin.strings.toolbarPlayers)[0].click()
  modal = env.modals.at(-1)
  assert.ok(env.settingByName(modal.contentEl, "Old"))
  modal.close()
  await unload(plugin)
})

await run("54-note-behaviour")
