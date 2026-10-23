import { assert, boot, createVault, idle, paths, run, sleep, startObsidian, test, unload, until, within } from "./support.mjs"

const GROUPS = [
  ["harbor", "sea", "captain", "master", "ship", "docks", "sailor", "kapitan", "portu"],
  ["forge", "fire", "smith", "anvil", "ember"],
]
const embed = text => {
  const words = String(text).toLowerCase().match(/\p{L}+/gu) ?? []
  return [...GROUPS.map(group => words.filter(word => group.includes(word)).length), 0.01, 0.01]
}

function fakeExtractor() {
  const calls = []
  const extract = async (texts, options) => {
    calls.push({ texts, options })
    const rows = texts.map(embed)
    return { dims: [rows.length, rows[0].length], data: new Float32Array(rows.flat()) }
  }
  return { calls, extract }
}

function vault() {
  const env = createVault()
  env.addFile("Campaigns/Glass/NPCs/Erin.md", "# Erin\nErin is the harbor master of Glassgate.", { type: "npc" })
  env.addFile("Campaigns/Glass/NPCs/Tom.md", "# Tom\nTom works the forge as a smith.", { type: "npc" })
  return env
}

async function withLocal(env, load) {
  const plugin = await boot(env)
  assert.equal(typeof plugin.index.loadLocalExtractor, "function", "contract: plugin.index.loadLocalExtractor(model) exists")
  if (load) plugin.index.loadLocalExtractor = async model => { assert.equal(plugin.settings.localModelApproved, model, "the model was approved"); return load(model) }
  plugin.settings.embeddingProvider = "local"
  plugin.settings.localModelApproved = plugin.settings.localModel
  await plugin.applyEmbeddingSettings()
  startObsidian(env)
  await idle(plugin)
  return plugin
}

test("the local provider defaults to a multilingual model and embeds with e5 prefixes in small batches", async () => {
  const env = vault()
  const fake = fakeExtractor()
  const models = []
  const plugin = await withLocal(env, async model => { models.push(model); return fake.extract })
  await within(8000, plugin.index.whenEmbedded(), "plugin.index.whenEmbedded()")
  assert.equal(plugin.settings.localModel, "Xenova/multilingual-e5-small")
  assert.deepEqual(models, ["Xenova/multilingual-e5-small"], "the model loads once")
  const documents = fake.calls.flatMap(call => call.texts)
  assert.ok(documents.length >= 2 && documents.every(text => text.startsWith("passage: ")), `document texts ${JSON.stringify(documents)}`)
  assert.ok(fake.calls.every(call => call.texts.length <= 8 && call.options.pooling === "mean" && call.options.normalize === true))
  const hits = await plugin.index.hybridSearch("kapitan portu")
  assert.ok(fake.calls.at(-1).texts[0] === "query: kapitan portu", `query text ${fake.calls.at(-1).texts[0]}`)
  assert.equal(paths(hits)[0], "Campaigns/Glass/NPCs/Erin.md", `hybrid results ${JSON.stringify(paths(hits))}`)
  assert.equal(env.requests.length, 0, "nothing is sent over the network once the model is loaded")
  await unload(plugin)
})

test("a runtime download that fails its integrity check is refused and search stays lexical", async () => {
  const env = vault()
  env.network.requestUrl = async () => ({ status: 200, arrayBuffer: new TextEncoder().encode("not the runtime").buffer, json: {} })
  const plugin = await withLocal(env)
  await until(() => env.notices.some(notice => notice.includes("integrity check")), 8000, "integrity notice")
  assert.ok(env.notices.some(notice => notice.includes("Downloading the local embedding model: 0%")), `notices ${JSON.stringify(env.notices)}`)
  assert.equal(await env.app.vault.adapter.exists(".gmvault/cache/models/ort-wasm-simd-threaded-1.22.0-dev.20250409-89f8206ba4.wasm"), false, "a rejected runtime is not cached")
  assert.ok(env.requests.some(request => request.url.startsWith("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/")), "the pinned runtime is requested")
  assert.deepEqual(paths(plugin.index.search("forge")).slice(0, 1), ["Campaigns/Glass/NPCs/Tom.md"])
  await unload(plugin)
})

test("a runtime download error names its status", async () => {
  const env = vault()
  env.network.requestUrl = async () => ({ status: 503, arrayBuffer: new ArrayBuffer(0), json: {} })
  const plugin = await withLocal(env)
  await until(() => env.notices.some(notice => notice.includes("could not be downloaded (503)")), 8000, "download notice")
  await unload(plugin)
})

test("changing the local model discards stored vectors and loads the new model", async () => {
  const env = vault()
  const fake = fakeExtractor()
  const models = []
  const plugin = await withLocal(env, async model => { models.push(model); return fake.extract })
  await within(8000, plugin.index.whenEmbedded(), "first embedding")
  plugin.settings.localModel = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
  plugin.settings.localModelApproved = plugin.settings.localModel
  await plugin.applyEmbeddingSettings()
  await within(8000, plugin.index.whenEmbedded(), "second embedding")
  assert.deepEqual(models, ["Xenova/multilingual-e5-small", "Xenova/paraphrase-multilingual-MiniLM-L12-v2"])
  assert.ok(fake.calls.at(-1).texts.every(text => !text.startsWith("passage: ")), "non-e5 models get no prefix")
  await unload(plugin)
})

function settings(env, plugin) {
  const tab = plugin.settingTabs[0]
  tab.display()
  return tab.containerEl
}

test("choosing Local asks before downloading, and cancelling downloads nothing", async () => {
  const env = vault()
  const plugin = await boot(env)
  const s = plugin.strings
  startObsidian(env)
  await idle(plugin)
  const container = settings(env, plugin)
  const provider = env.settingByName(container, s.settingsEmbeddingProvider).components[0]
  assert.ok(env.settingByName(container, s.settingsLocalDownload).description === s.settingsLocalNotDownloaded)
  provider.change("local")
  assert.equal(plugin.settings.embeddingProvider, "none", "nothing changes before consent")
  const modal = env.modals.at(-1)
  assert.ok(modal, "a confirmation opens")
  assert.ok(env.rendered.some(text => String(text).includes("about 130 MB")), "the size is stated")
  await env.buttonComponent(modal.contentEl, s.cancel).click()
  await sleep(50)
  assert.equal(plugin.settings.embeddingProvider, "none")
  assert.equal(plugin.settings.localModelApproved, "")
  assert.equal(env.requests.length, 0, "nothing was downloaded")
  await unload(plugin)
})

test("a local model that was never approved is not downloaded", async () => {
  const env = vault()
  const plugin = await boot(env)
  plugin.settings.embeddingProvider = "local"
  await plugin.applyEmbeddingSettings()
  startObsidian(env)
  await idle(plugin)
  await until(() => env.notices.some(notice => notice.includes(plugin.strings.localEmbeddingNotApproved)), 8000, "not approved notice")
  assert.equal(env.requests.length, 0, "nothing was downloaded")
  await unload(plugin)
})

test("confirming approves the download, and deleting removes the model and turns local search off", async () => {
  const env = vault()
  const fake = fakeExtractor()
  const plugin = await boot(env)
  const s = plugin.strings
  plugin.index.loadLocalExtractor = async () => fake.extract
  startObsidian(env)
  await idle(plugin)
  let container = settings(env, plugin)
  await env.buttonComponent(container, s.settingsLocalDownloadButton).click()
  await env.buttonComponent(env.modals.at(-1).contentEl, s.settingsLocalDownloadButton).click()
  assert.equal(plugin.settings.localModelApproved, "Xenova/multilingual-e5-small")
  plugin.settings.embeddingProvider = "local"
  await plugin.applyEmbeddingSettings()
  await within(8000, plugin.index.whenEmbedded(), "embedding")
  env.adapterFiles.set(".gmvault/cache/models/model.onnx", new ArrayBuffer(4))
  container = plugin.settingTabs[0].containerEl
  assert.equal(env.settingByName(container, s.settingsLocalDownload).description, s.settingsLocalDownloaded)
  await env.buttonComponent(container, s.settingsLocalDeleteButton).click()
  assert.equal(env.adapterFiles.has(".gmvault/cache/models/model.onnx"), false, "the model files are removed")
  assert.equal(plugin.settings.localModelApproved, "")
  assert.equal(plugin.settings.embeddingProvider, "none")
  assert.ok(env.notices.includes(s.localModelDeleted))
  await unload(plugin)
})

await run("52-local-embeddings")
