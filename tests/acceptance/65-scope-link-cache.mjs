import { assert, boot, createVault, idle, run, startObsidian, test, unload } from "./support.mjs"

test("scope link resolution is cached once per note and invalidated on metadata change", async () => {
  const env = createVault()
  for (let index = 0; index < 900; index++) env.addFile(`Campaigns/Glass/NPCs/N${index}.md`, "# About\nHarbor clue.\n\n# Motive\nHarbor secret.\n\n# History\nHarbor memory.", { type: "npc", campaign: "[[Campaigns/Glass/Campaign]]" })
  const plugin = await boot(env)
  startObsidian(env)
  await idle(plugin, 15000)
  const original = env.app.metadataCache.getFirstLinkpathDest
  let calls = 0
  env.app.metadataCache.getFirstLinkpathDest = (...args) => { calls++; return original(...args) }
  plugin.index.search("harbor")
  const first = calls
  assert.ok(first >= 900 && first <= 910, `resolved ${first} links for 900 notes`)
  plugin.index.search("harbor")
  assert.equal(calls, first, "repeated queries reuse the links")
  const campaign = env.files.get("Campaigns/Glass/Campaign.md")
  env.emit("changed", campaign.file, campaign.content, { frontmatter: campaign.frontmatter })
  plugin.index.search("harbor")
  assert.ok(calls >= first + 900 && calls <= first + 910, `resolved ${calls - first} links after metadata changed`)
  env.app.metadataCache.getFirstLinkpathDest = original
  await unload(plugin)
})

await run("65-scope-link-cache")
