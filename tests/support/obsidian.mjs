


import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

export function createEnvironment() {
  const rendered = []
  const notices = []
  const record = value => { if (value !== undefined && value !== null && value !== "") rendered.push(String(value)) }

  class MockElement {
    constructor(tag = "div", parent = null) {
      this.tag = tag
      this.parent = parent
      this.children = []
      this.ownText = ""
      this.classes = new Set()
      this.attributes = {}
      this.dataset = {}
      this.style = { setProperty(name, value) { this[name] = value } }
      this.listeners = {}
      this.settings = []
      this.value = ""
      this.checked = false
      this.scrollTop = 0
      this.scrollHeight = 0
      this.onclick = null
      this.onchange = null
      this.onkeydown = null
    }
    applyOptions(options) {
      if (typeof options === "string") { options.split(/\s+/).filter(Boolean).forEach(name => this.classes.add(name)); return this }
      if (!options) return this
      if (options.cls) options.cls.split(/\s+/).filter(Boolean).forEach(name => this.classes.add(name))
      if (options.text !== undefined) { this.ownText = String(options.text); record(options.text) }
      if (options.type !== undefined) this.type = options.type
      if (options.value !== undefined) this.value = String(options.value)
      if (options.href !== undefined) this.attributes.href = options.href
      for (const [name, value] of Object.entries(options.attr ?? {})) {
        this.attributes[name] = String(value)
        if (name.startsWith("data-")) this.dataset[name.slice(5)] = String(value)
        if (["title", "placeholder", "aria-label"].includes(name)) record(value)
      }
      return this
    }
    createEl(tag, options) { const child = new MockElement(tag, this).applyOptions(options); this.children.push(child); return child }
    createDiv(options) { return this.createEl("div", options) }
    createSpan(options) { return this.createEl("span", options) }
    setText(text) { this.children = []; this.ownText = String(text); record(text) }
    appendText(text) { const node = new MockElement("#text", this); node.ownText = String(text); record(text); this.children.push(node) }
    empty() { this.children = []; this.ownText = ""; this.settings = [] }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
    addClass(name) { this.classes.add(name) }
    removeClass(name) { this.classes.delete(name) }
    toggleClass(name, force) { if (force ?? !this.classes.has(name)) this.classes.add(name); else this.classes.delete(name) }
    hasClass(name) { return this.classes.has(name) }
    setAttribute(name, value) { this.attributes[name] = String(value) }
    focus() { this.focused = true }
    addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener) }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join("") }
    closest(selector) {
      const tags = selector.split(",").map(value => value.trim())
      for (let node = this; node; node = node.parent) if (tags.some(tag => tag.startsWith(".") ? node.classes.has(tag.slice(1)) : tag === node.tag)) return node
      return null
    }
    all(predicate, found = []) { for (const child of this.children) { if (predicate(child)) found.push(child); child.all(predicate, found) } return found }
    querySelector(selector) { const name = selector.replace(/^\./, ""); return this.all(element => element.classes.has(name))[0] ?? null }
    querySelectorAll(selector) { const name = selector.replace(/^\./, ""); return this.all(element => element.classes.has(name)) }
    getBoundingClientRect() { return this.rect ?? { left: 0, top: 0, width: 1000, height: 1000 } }
    dispatch(type, event = {}) { const payload = { target: event.target ?? this, button: 0, pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {}, ...event }; for (const listener of this.listeners[type] ?? []) listener(payload); return payload }
    setPointerCapture() {}
    click(event = {}) {
      const payload = { target: event.target ?? this, stopPropagation() {}, preventDefault() {}, ...event }
      for (const listener of this.listeners.click ?? []) listener(payload)
      return this.onclick?.(payload)
    }
  }

  const byLabel = (element, label) => element.all(child =>
    child.attributes["aria-label"] === label || child.attributes.title === label || (child.tag === "button" && child.textContent === label))
  const byClass = (element, name) => element.all(child => child.classes.has(name))
  const byText = (element, text) => element.all(child => child.ownText === text)

  class TFile {
    constructor(filePath) {
      this.path = filePath
      this.basename = filePath.split("/").pop().replace(/\.[^.]+$/, "")
      this.extension = filePath.split(".").pop()
      this.parent = { path: filePath.split("/").slice(0, -1).join("/") }
    }
  }

  const modals = []
  class Modal {
    constructor(app) { this.app = app; this.contentEl = new MockElement("div") }
    open() { modals.push(this); return this.onOpen?.() }
    close() { this.onClose?.(); const index = modals.indexOf(this); if (index >= 0) modals.splice(index, 1) }
  }
  class FuzzySuggestModal extends Modal {
    setPlaceholder(text) { this.placeholder = text; record(text) }
    open() { modals.push(this); this.items = this.getItems(); this.items.forEach(item => record(this.getItemText(item))) }
    choose(predicate) { const item = this.items.find(predicate); this.close(); return this.onChooseItem(item) }
  }
  class SuggestModal extends Modal {
    setPlaceholder(text) { this.placeholder = text; record(text) }
    query(text) { this.suggestions = this.getSuggestions(text); return this.suggestions }
    choose(index = 0, event = {}) { const item = this.suggestions[index]; this.close(); return this.onChooseSuggestion(item, event) }
  }
  const prepareFuzzySearch = query => value => {
    const target = String(value).toLowerCase()
    let at = -1, score = 0
    for (const letter of query.toLowerCase()) {
      const next = target.indexOf(letter, at + 1)
      if (next < 0) return null
      score += next === at + 1 ? 2 : 1
      at = next
    }
    return { score: score + (target === query.toLowerCase() ? 100 : 0), matches: [] }
  }

  class Component {
    constructor() { this.inputEl = new MockElement("input"); this.changeHandlers = [] }
    setValue(value) { this.value = value; if (typeof value === "string") record(value); return this }
    getValue() { return this.value }
    setPlaceholder(text) { record(text); return this }
    onChange(handler) { this.changeHandlers.push(handler); return this }
    change(value) { this.value = value; for (const handler of this.changeHandlers) handler(value); return this }
    setLimits() { return this }
    setDynamicTooltip() { return this }
    addOption(value, label) { (this.options ??= {})[value] = label; record(label); return this }
    addOptions(options) { for (const [value, label] of Object.entries(options)) this.addOption(value, label); return this }
    setButtonText(text) { this.text = text; record(text); return this }
    setCta() { return this }
    setWarning() { this.warning = true; return this }
    setIcon() { return this }
    setTooltip(text) { this.tooltip = text; record(text); return this }
    onClick(handler) { this.clickHandler = handler; return this }
    click() { return this.clickHandler?.() }
  }
  class Setting {
    constructor(container) {
      this.container = container
      this.settingEl = container.createDiv("setting-item")
      this.controlEl = this.settingEl.createDiv("setting-item-control")
      this.components = []
      container.settings.push(this)
    }
    setName(name) { this.name = name; record(name); return this }
    setDesc(description) { this.description = description; record(description); return this }
    setHeading() { this.heading = true; return this }
    add(kind, callback) { const component = new Component(); component.kind = kind; this.components.push(component); callback(component); return this }
    addText(callback) { return this.add("text", callback) }
    addTextArea(callback) { return this.add("textarea", callback) }
    addSlider(callback) { return this.add("slider", callback) }
    addToggle(callback) { return this.add("toggle", callback) }
    addDropdown(callback) { return this.add("dropdown", callback) }
    addButton(callback) { return this.add("button", callback) }
    addExtraButton(callback) { return this.add("extra", callback) }
  }
  const settingByName = (container, name) => container.settings.find(setting => setting.name === name)
  const buttonComponent = (container, text) => container.settings.flatMap(setting => setting.components).find(component => component.kind === "button" && component.text === text)

  class Notice { constructor(message) { notices.push(String(message)); record(message) } setMessage(message) { notices.push(String(message)); record(message); return this } hide() {} }
  class ItemView {
    constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.containerEl = new MockElement("div"); this.contentEl = new MockElement("div") }
    async open(containerEl) { this.containerEl = containerEl; await this.onOpen?.() }
  }
  class MarkdownView {}
  class MarkdownRenderChild {
    constructor(containerEl) { this.containerEl = containerEl }
    load() { this.onload?.() }
    unload() { this.onunload?.() }
  }
  class PluginSettingTab { constructor(app) { this.app = app; this.containerEl = new MockElement("div") } }

  const storage = { data: null }
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; this.viewFactories = new Map(); this.markdownCodeBlockProcessors = new Map(); this.commands = []; this.ribbons = []; this.settingTabs = [] }
    async loadData() { return storage.data ? JSON.parse(JSON.stringify(storage.data)) : null }
    async saveData(data) { storage.data = JSON.parse(JSON.stringify(data)) }
    registerView(type, factory) { this.viewFactories.set(type, factory) }
    registerMarkdownCodeBlockProcessor(language, processor) { this.markdownCodeBlockProcessors.set(language, processor) }
    registerEvent() {}
    addRibbonIcon(icon, title, callback) { record(title); this.ribbons.push({ icon, title, callback }) }
    addCommand(command) { record(command.name); this.commands.push(command) }
    addSettingTab(tab) { this.settingTabs.push(tab) }
  }


  const files = new Map()
  const addFile = (filePath, content = "", frontmatter = null) => { files.set(filePath, { file: new TFile(filePath), content, frontmatter }); return files.get(filePath).file }
  const adapterFiles = new Map()
  const listeners = new Map()
  const on = (event, callback) => { const entries = listeners.get(event) ?? []; entries.push(callback); listeners.set(event, entries); return { event, callback } }
  const emit = (event, ...args) => { for (const callback of listeners.get(event) ?? []) callback(...args) }
  const appended = []
  const opened = []
  const leaves = []
  const workspace = {
    activeFile: null,
    activeView: null,
    plugin: null,
    getLeavesOfType: type => leaves.filter(leaf => leaf.type === type),
    getRightLeaf: () => makeLeaf(),
    getLeaf: () => Object.assign(makeLeaf(), { openFile: async file => { opened.push(file.path) } }),
    revealLeaf: async leaf => { await Promise.resolve(); leaf.revealed = true },
    getActiveFile: () => workspace.activeFile,
    getActiveViewOfType: () => workspace.activeView,
    openLinkText: async target => { opened.push(target) },
  }
  const makeLeaf = (type = null, deferred = false) => ({
    app, type, deferred, view: type ? new ItemView({ app }) : null,
    async setViewState(state) {
      this.type = state.type
      this.deferred = false
      this.view = workspace.plugin.viewFactories.get(state.type)(this)
      if (!leaves.includes(this)) leaves.push(this)
      await this.view.open(this.view.containerEl)
    },
    async loadIfDeferred() {
      if (this.deferred) await this.setViewState({ type: this.type })
    },
  })
  const restoreLeaf = (type, { deferred = true } = {}) => {
    const leaf = makeLeaf(type, deferred)
    leaves.push(leaf)
    return leaf
  }
  const app = {
    vault: {
      configDir: ".obsidian",
      getMarkdownFiles: () => [...files.values()].filter(entry => entry.file.extension === "md").map(entry => entry.file),
      getFiles: () => [...files.values()].map(entry => entry.file),
      getResourcePath: file => `app://vault/${file.path}`,
      getAbstractFileByPath: filePath => files.get(filePath)?.file ?? null,
      cachedRead: async file => files.get(file.path)?.content ?? "",
      modify: async (file, content) => { files.get(file.path).content = content; emit("modify", file); emit("changed", file) },
      create: async (filePath, content) => { const block = content.match(/^---\n([\s\S]*?)\n---/); const frontmatter = block ? Object.fromEntries(block[1].split("\n").flatMap(line => { const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/); if (!match) return []; let value = match[2]; try { value = JSON.parse(value) } catch {} return [[match[1], value]] })) : null; return addFile(filePath, content, frontmatter) },
      createFolder: async () => {},
      append: async (file, text) => { files.get(file.path).content += text; appended.push(text); record(text) },
      adapter: { read: async filePath => { if (!adapterFiles.has(filePath)) throw new Error("missing"); return adapterFiles.get(filePath) }, write: async (filePath, value) => adapterFiles.set(filePath, value), mkdir: async () => {}, rmdir: async folder => { for (const key of [...adapterFiles.keys()]) if (key.startsWith(`${folder}/`)) adapterFiles.delete(key) }, exists: async filePath => adapterFiles.has(filePath) || [...adapterFiles.keys()].some(key => key.startsWith(`${filePath}/`)), rename: async (from, to) => { adapterFiles.set(to, adapterFiles.get(from)); adapterFiles.delete(from) } },
      on,
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: files.get(file.path)?.frontmatter ?? undefined, links: [...(files.get(file.path)?.content ?? "").matchAll(/\[\[([^\]]+)\]\]/g)].map(match => ({ link: match[1].split("|")[0] })) }),
      getFirstLinkpathDest: (link, sourcePath) => {
        if (link === "") return files.get(sourcePath)?.file ?? null
        const clean = String(link).replace(/\.md$/, "")
        return files.get(clean)?.file ?? files.get(`${clean}.md`)?.file ?? [...files.values()].find(entry => entry.file.basename === clean)?.file ?? null
      },
      on,
    },
    workspace,
    fileManager: { processFrontMatter: async (file, change) => { const entry = files.get(file.path); entry.frontmatter ??= {}; change(entry.frontmatter); emit("changed", file) } },
    setting: { open() { this.opened = true } },
  }

  const requests = []
  const network = { requestUrl: async () => ({ status: 200, json: {} }), fetch: null }
  const requestUrl = async options => { requests.push(options); return network.requestUrl(options) }

  const clipboard = []
  const platform = { isDesktopApp: true, isMobile: false }
  const obsidian = {
    Plugin, ItemView, Modal, FuzzySuggestModal, SuggestModal, prepareFuzzySearch, PluginSettingTab, Setting, Notice, TFile, MarkdownView, MarkdownRenderChild,
    Platform: platform,
    MarkdownRenderer: { render: async (_app, markdown, element) => { element.appendText(markdown) } },
    requestUrl,
    parseYaml: text => JSON.parse(text),
    setIcon: () => {},
  }

  const load = () => {
    const require = createRequire(import.meta.url)
    const moduleApi = require("node:module")
    const originalLoad = moduleApi._load
    moduleApi._load = (request, parent, isMain) => request === "obsidian" ? obsidian : originalLoad(request, parent, isMain)
    const bundle = path.join(root, "_system/plugin/main.js")
    delete require.cache[require.resolve(bundle)]
    try { return require(bundle).default } finally { moduleApi._load = originalLoad }
  }

  globalThis.fetch = (...args) => { requests.push({ url: args[0], ...args[1] }); return network.fetch(...args) }
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async text => { clipboard.push(text); record(text) } } }, configurable: true })

  return {
    app, workspace, files, addFile, adapterFiles, appended, opened, leaves, restoreLeaf, modals, notices, rendered, requests, network, platform, clipboard, storage, emit,
    MockElement, TFile, MarkdownView, load, byLabel, byClass, byText, settingByName, buttonComponent, record,
  }
}

export function sseResponse(payloads, { signal, hold = false } = {}) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      if (!hold) { controller.close(); return }
      signal?.addEventListener("abort", () => controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })))
    },
  })
  return { ok: true, status: 200, body: stream, json: async () => ({}) }
}
