import { Notice, Platform, Plugin, TFile } from "obsidian";
import { AssistantView, ASSISTANT_VIEW } from "./assistant";
import { CombatTracker, COMBAT_VIEW, newCombat } from "./combat";
import { CombatView } from "./combat-view";
import { createStrings, englishStrings, format, Strings } from "./strings";
import { Combat, DEFAULTS, EncounterSet, ScopePolicy, Settings, SourceKind } from "./types";
import { AssistantIndex } from "./indexer";
import { Skill, loadSkills } from "./tools";
import { assistantLayerPaths, defaultScopePolicy } from "./scope";
import { HomeBlock, HomePanel, HomeView, HOME_VIEW } from "./home";
import { checkLatestRelease, checkedRecently, ReleaseCheck } from "./update";
import { LookupCard, LookupModal, lookupCandidate } from "./lookup";
import { addNoteActions, NoteActionsModal, noteActions } from "./actions";
import { AddPlayersModal, CreaturePickerModal, EncounterNameModal, EncounterNotePicker } from "./combat-modals";
import { QuickNpcModal } from "./quick-npc";
import { wrapUp } from "./wrap-up";
import { TimelineView, TIMELINE_VIEW } from "./timeline";
import { createNote, linkTarget, noteFields, pathLink, resolveLink } from "./notes";
import { MapBlock, MapPanel, MapView, MAP_VIEW } from "./map";
import { HOME_TYPES, MAP_TYPES } from "./contract";
import { GameContext, contextStamp, resolveGameContext } from "./context";
import { TableToolsSettingTab } from "./settings";
interface PluginData { settings: Settings; combat: Combat; encounterSets: EncounterSet[] }
const STRINGS_OVERRIDE = "_local/plugins/table-tools/strings.json";
const SCOPE_PATHS = assistantLayerPaths("scope.json");
const SOURCE_KINDS: SourceKind[] = ["run", "state", "campaign", "party", "system", "homebrew", "house-rule", "note"];
export default class TableTools extends Plugin {
  settings: Settings = { ...DEFAULTS };
  combat: Combat = newCombat();
  encounterSets: EncounterSet[] = [];
  strings: Strings = { ...englishStrings };
  tracker = new CombatTracker(this);
  views = new Set<CombatView>();
  homeViews = new Set<HomePanel>();
  timelineViews = new Set<TimelineView>();
  mapPanels = new Set<MapPanel>();
  index!: AssistantIndex;
  skills = new Map<string, Skill>();
  invalidSkillsKey = "";
  commandRunner = (file: string, args: string[], onOutput: (chunk: string) => void): Promise<number> => {
    return this.runDesktopCommand(file, args, onOutput);
  };
  scopePolicy: ScopePolicy = { ...defaultScopePolicy, exclude: [...(defaultScopePolicy.exclude ?? [])], gm: [...defaultScopePolicy.gm], player: [...defaultScopePolicy.player] };
  private skillReloadTimer?: number;
  private homeRelevantPaths = new Set<string>();
  private contextCache: GameContext | null = null;
  private contextCacheStamp = "";
  private noteListeners = new Set<(paths: string[]) => void>();
  async onload(): Promise<void> {
    await this.loadStrings();
    await this.loadSettings();
    await this.loadScopePolicy();
    this.index = new AssistantIndex(this);
    this.index.start();
    this.app.vault.getMarkdownFiles().forEach(file => this.homeChangeAffects(file, file.path));
    const vaultEvents = this.app.vault as typeof this.app.vault & { on: (event: string, callback: (file: TFile) => void) => unknown };
    for (const event of ["create", "modify", "delete"]) this.registerEvent(vaultEvents.on(event, file => { if (file instanceof TFile) this.notesChanged([file.path]); }) as never);
    this.skills = await loadSkills(this);
    this.registerEvent(this.app.metadataCache.on("changed", file => { if (file instanceof TFile) this.notesChanged([file.path]); }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => { if (file instanceof TFile) this.notesChanged([file.path, oldPath]); }));
    this.onNotesChanged(paths => {
      if (paths.some(path => SCOPE_PATHS.includes(path))) void this.loadScopePolicy();
      if (paths.some(path => this.isSkillPath(path))) this.reloadSkills();
    });
    const s = this.strings;
    this.registerView(COMBAT_VIEW, leaf => new CombatView(leaf, this));
    this.registerView(ASSISTANT_VIEW, leaf => new AssistantView(leaf, this));
    this.registerView(HOME_VIEW, leaf => new HomeView(leaf, this));
    this.registerView(TIMELINE_VIEW, leaf => new TimelineView(leaf, this));
    this.registerView(MAP_VIEW, leaf => new MapView(leaf, this));
    this.registerMarkdownCodeBlockProcessor("gmvault-home", (_source, element, context) => {
      context.addChild(new HomeBlock(element, this.app, this));
    });
    this.registerMarkdownCodeBlockProcessor("gmvault-map", (source, element, context) => {
      const path = source.match(/^note:\s*(.+)$/m)?.[1];
      const owner = path ? this.app.metadataCache.getFirstLinkpathDest(linkTarget(path), context.sourcePath) : this.app.vault.getAbstractFileByPath(context.sourcePath);
      if (owner instanceof TFile) context.addChild(new MapBlock(element, this.app, this, owner.path));
    });
    this.addRibbonIcon("home", s.ribbonHome, () => this.openHome());
    this.addRibbonIcon("swords", s.ribbonCombat, () => void this.openView(COMBAT_VIEW));
    this.addRibbonIcon("sparkles", s.ribbonAssistant, () => void this.openView(ASSISTANT_VIEW));
    this.addRibbonIcon("search", s.lookUp, () => this.openLookup());
    this.addCommand({ id: "open-combat", name: s.commandOpenCombat, callback: () => void this.openView(COMBAT_VIEW) });
    this.addCommand({ id: "open-assistant", name: s.commandOpenAssistant, callback: () => void this.openView(ASSISTANT_VIEW) });
    this.addCommand({ id: "open-home", name: s.commandOpenHome, callback: () => this.openHome() });
    this.addCommand({ id: "open-timeline", name: s.commandOpenTimeline, callback: () => void this.openView(TIMELINE_VIEW) });
    this.addCommand({ id: "open-map", name: s.mapOpen, callback: () => this.openDefaultMap() });
    this.addCommand({ id: "look-up", name: s.lookUp, callback: () => this.openLookup() });
    this.addCommand({ id: "quick-npc", name: s.quickNpc, callback: () => void this.openQuickNpc() });
    this.addCommand({ id: "new-session", name: s.homeNewSession, callback: () => void this.newSession() });
    this.addCommand({ id: "note-actions", name: s.noteActions, checkCallback: checking => {
      const file = this.app.workspace.getActiveFile();
      const actions = file ? noteActions(this, file) : [];
      if (!actions.length) return false;
      if (!checking) new NoteActionsModal(this.app, this, actions).open();
      return true;
    } });
    this.addCommand({ id: "wrap-up-session", name: s.wrapUpSession, callback: () => void this.wrapUp() });
    this.addCommand({ id: "assistant-rebuild-index", name: s.commandRebuildAssistantIndex, callback: () => void this.index.rebuild(true) });
    this.addCommand({ id: "combat-next-turn", name: s.commandNextTurn, callback: () => this.tracker.advance(1) });
    this.addCommand({ id: "combat-previous-turn", name: s.commandPreviousTurn, callback: () => this.tracker.advance(-1) });
    this.addCommand({ id: "combat-roll-initiative", name: s.commandRollInitiative, callback: () => this.tracker.rollInitiative(false) });
    this.addCommand({ id: "combat-add-players", name: s.commandAddPlayers, callback: () => new AddPlayersModal(this.app, this).open() });
    this.addCommand({ id: "combat-add-creature", name: s.commandAddEnemy, callback: () => new CreaturePickerModal(this.app, this).open() });
    this.addCommand({ id: "combat-start-encounter", name: s.commandStartEncounter, callback: () => new EncounterNotePicker(this.app, this).open() });
    this.addCommand({ id: "combat-save-encounter", name: s.commandSaveEncounter, callback: () => new EncounterNameModal(this.app, this, this.combat.name).open() });
    this.addCommand({ id: "combat-clear", name: s.commandClearCombat, callback: () => this.tracker.clear() });
    this.addCommand({
      id: "assistant-ask-selection", name: s.commandAskSelection, editorCallback: async editor => {
        const selection = editor.getSelection();
        if (!selection) { new Notice(s.selectTextFirst); return; }
        await this.openView(ASSISTANT_VIEW);
        await this.assistant()?.send(selection);
      },
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => { if (file instanceof TFile) addNoteActions(this, menu, file); }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => { if (info.file) addNoteActions(this, menu, info.file); }));
    this.addSettingTab(new TableToolsSettingTab(this.app, this));
    const workspace = this.app.workspace as typeof this.app.workspace & { onLayoutReady?: (callback: () => void) => void };
    workspace.onLayoutReady?.(async () => {
      void this.checkForUpdatesOnStart();
      const home = this.app.workspace.getLeavesOfType(HOME_VIEW)[0];
      if (home) await home.loadIfDeferred?.();
      else if (this.settings.openHomeOnStartup) await this.openHome();
    });
  }
  async onunload(): Promise<void> { await this.index?.dispose(); }
  onNotesChanged(listener: (paths: string[]) => void): () => void {
    this.noteListeners.add(listener);
    return () => this.noteListeners.delete(listener);
  }
  notesChanged(paths: string[]): void {
    this.contextCacheStamp = "";
    for (const listener of this.noteListeners) listener(paths);
  }
  homeChangeAffects(file: TFile | undefined, path: string): boolean {
    const shipped = "_system/";
    if (path === this.settings.activePointerPath || path.startsWith("_local/systems/") || path.startsWith(`${shipped}systems/`)) return true;
    if ([...this.homeViews].some(view => view.hasRenderedPath(path))) return true;
    if (this.homeRelevantPaths.has(path)) return true;
    const type = file ? noteFields(this.app, file).type : undefined;
    const partyMembers = /^Parties\/[^/]+\/Party\.md$/.test(path);
    if (!HOME_TYPES.includes(String(type)) && !(type === "npc" && noteFields(this.app, file!).subtype === "pc") && !partyMembers) return false;
    this.homeRelevantPaths.add(path);
    return true;
  }
  async loadStrings(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(STRINGS_OVERRIDE);
    if (!(file instanceof TFile)) return;
    try {
      this.strings = createStrings(JSON.parse(await this.app.vault.cachedRead(file)));
    } catch {
      this.strings = { ...englishStrings };
      new Notice(this.strings.stringsOverrideInvalid);
    }
  }
  async loadScopePolicy(): Promise<void> {
    for (const path of SCOPE_PATHS) {
      try {
        const value = JSON.parse(await this.app.vault.adapter.read(path)) as Partial<ScopePolicy>;
        if (value.version !== 1 || !this.validKinds(value.gm) || !this.validKinds(value.player)) throw new Error("invalid policy");
        if (value.exclude !== undefined && (!Array.isArray(value.exclude) || !value.exclude.every(prefix => typeof prefix === "string"))) throw new Error("invalid policy");
        this.scopePolicy = { version: 1, exclude: value.exclude, gm: value.gm, player: value.player };
        return;
      } catch {
        if (path.startsWith("_local") && await this.app.vault.adapter.exists(path)) new Notice(this.strings.assistantScopePolicyInvalid);
      }
    }
    this.scopePolicy = { ...defaultScopePolicy, exclude: [...(defaultScopePolicy.exclude ?? [])], gm: [...defaultScopePolicy.gm], player: [...defaultScopePolicy.player] };
  }
  private validKinds(value: unknown): value is SourceKind[] {
    return Array.isArray(value) && value.every(kind => SOURCE_KINDS.includes(kind as SourceKind));
  }
  private isSkillPath(path: string): boolean {
    if (assistantLayerPaths("skills").some(folder => path.startsWith(`${folder}/`))) return true;
    const scope = this.index?.scope();
    if (scope?.campaignFolder && path.startsWith(`${scope.campaignFolder}/Assistant/skills/`)) return true;
    return path === this.settings.activePointerPath || path === this.context()?.run.path;
  }
  private reloadSkills(): void {
    if (this.skillReloadTimer) clearTimeout(this.skillReloadTimer);
    this.skillReloadTimer = setTimeout(() => {
      this.skillReloadTimer = undefined;
      void loadSkills(this).then(skills => { this.skills = skills; });
    }, 200) as unknown as number;
  }
  async loadSettings(): Promise<void> {
    const data = await this.loadData() as Partial<PluginData> | null;
    this.settings = { ...DEFAULTS, ...(data?.settings ?? {}) };
    this.combat = data?.combat ?? newCombat(this.strings.defaultCombatName);
    this.encounterSets = data?.encounterSets ?? [];
  }
  async save(): Promise<void> {
    await this.saveData({ settings: this.settings, combat: this.combat, encounterSets: this.encounterSets } satisfies PluginData);
  }
  async applyEmbeddingSettings(): Promise<void> {
    await this.index.applyEmbeddingSettings();
    await this.save();
  }
  async checkForUpdates(): Promise<ReleaseCheck> {
    return checkLatestRelease(this.app.vault.adapter);
  }
  private async runDesktopCommand(file: string, args: string[], onOutput: (chunk: string) => void): Promise<number> {
    if (!Platform.isDesktopApp) throw new Error("The desktop runtime is unavailable");
    const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & {
      getBasePath?: () => string;
      basePath?: string;
    };
    const cwd = adapter.getBasePath?.() ?? adapter.basePath;
    if (!cwd) throw new Error("The vault folder is unavailable");
    const { spawn } = await import("node:child_process");
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file, ...args], { cwd, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
      child.stdout.on("data", chunk => onOutput(String(chunk)));
      child.stderr.on("data", chunk => onOutput(String(chunk)));
      child.once("error", reject);
      child.once("close", code => resolve(code ?? 1));
    });
  }
  private async checkForUpdatesOnStart(): Promise<void> {
    if (!this.settings.checkForUpdatesOnStart) return;
    if (await checkedRecently(this.app.vault.adapter, 24 * 60 * 60 * 1000)) return;
    try {
      const result = await this.checkForUpdates();
      if (result.newer) new Notice(format(this.strings.settingsUpdateAvailable, { version: result.latestVersion, installed: result.installedVersion }));
    } catch {}
  }
  refreshViews(): void {
    for (const view of this.views) view.render();
  }
  async openView(type: string): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    if (existing) { await existing.loadIfDeferred?.(); await this.app.workspace.revealLeaf(existing); return; }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async openHome(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(HOME_VIEW)[0];
    if (existing) { await existing.loadIfDeferred?.(); await this.app.workspace.revealLeaf(existing); return; }
    const workspace = this.app.workspace as typeof this.app.workspace & { getLeaf?: (newLeaf?: boolean) => ReturnType<typeof this.app.workspace.getRightLeaf> };
    const leaf = workspace.getLeaf?.(true) ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: HOME_VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async openMap(owner: TFile, highlight?: TFile): Promise<void> {
    let leaf: import("obsidian").WorkspaceLeaf | undefined = this.app.workspace.getLeavesOfType(MAP_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf("tab"); await leaf.setViewState({ type: MAP_VIEW, active: true, state: { owner: owner.path } }); }
    else await leaf.loadIfDeferred?.();
    (leaf.view as MapView).setOwner(owner, highlight);
    await this.app.workspace.revealLeaf(leaf);
  }
  async openDefaultMap(): Promise<void> {
    const context = this.context();
    const world = context?.world.path === context?.campaign.path ? null : context?.world;
    const active = this.app.workspace.getActiveFile();
    const owner = world ?? (active && MAP_TYPES.includes(String(noteFields(this.app, active).type)) ? active : null);
    if (owner) await this.openMap(owner);
    else new Notice(this.strings.mapNoOwner);
  }
  async setActiveRun(runPath: string): Promise<void> {
    const target = pathLink(runPath).slice(2, -2);
    let pointer = this.app.vault.getAbstractFileByPath(this.settings.activePointerPath);
    if (!(pointer instanceof TFile)) {
      pointer = await this.app.vault.create(this.settings.activePointerPath, `---\nrun: "[[${target}]]"\n---\n\n# Active Run\n`);
    } else await this.app.fileManager.processFrontMatter(pointer, fields => { fields.run = `[[${target}]]`; });
    this.reloadSkills();
    this.refreshViews();
    this.notesChanged([this.settings.activePointerPath]);
  }
  async systemName(id: string): Promise<string> {
    for (const root of ["_local/", "_system/"]) {
      try {
        const value = JSON.parse(await this.app.vault.adapter.read(`${root}systems/${id}/package.json`)) as { name?: unknown };
        if (typeof value.name === "string" && value.name) return value.name;
      } catch {}
    }
    return id;
  }
  async systemPackages(): Promise<{ id: string; name: string }[]> {
    const packages = new Map<string, string>();
    const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & { list?: (path: string) => Promise<{ folders: string[] }> };
    for (const root of ["_system/", "_local/"]) {
      try {
        const listed = await adapter.list?.(`${root}systems`);
        for (const folder of listed?.folders ?? []) {
          const id = folder.split("/").at(-1) ?? "";
          if (id) packages.set(id, await this.systemName(id));
        }
      } catch {}
    }
    if (!packages.size) packages.set("generic", await this.systemName("generic"));
    return [...packages].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }
  assistant(): AssistantView | undefined {
    return this.app.workspace.getLeavesOfType(ASSISTANT_VIEW)[0]?.view as AssistantView | undefined;
  }
  openLookup(): void { new LookupModal(this.app, this).open(); }
  openLookupCard(file: TFile): void { const candidate = lookupCandidate(this.app, file); if (candidate) new LookupCard(this.app, this, candidate).open(); }
  async newSession(run = this.context()?.run): Promise<void> {
    if (!run) { new Notice(this.strings.quickNpcNeedsRun); return; }
    const folder = run.parent?.path ?? run.path.slice(0, run.path.lastIndexOf("/"));
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const file = await createNote(this.app, { template: "session", folder, name: `Session ${date}`, values: { type: "session", run: `"[[${folder}/Run]]"`, date }, date });
    await this.app.workspace.openLinkText(file.path, "");
  }
  openQuickNpc(): void { new QuickNpcModal(this.app, this).open(); }
  wrapUp(run?: TFile, session?: TFile): Promise<void> { return wrapUp(this, run, session); }
  resolve(value: unknown, source: TFile): TFile | null { return resolveLink(this.app, value, source); }
  context(): GameContext | null {
    const stamp = contextStamp(this.app, this.settings.activePointerPath, this.contextCache);
    if (stamp !== this.contextCacheStamp) {
      this.contextCache = resolveGameContext(this.app, this.settings.activePointerPath);
      this.contextCacheStamp = contextStamp(this.app, this.settings.activePointerPath, this.contextCache);
    }
    return this.contextCache;
  }
  partyPath(): string {
    return this.settings.partyPath || this.context()?.folders.party || "";
  }
  bestiaryPaths(): string[] {
    if (this.settings.bestiaryPath) return [this.settings.bestiaryPath];
    const context = this.context();
    const system = context?.system ?? "generic";
    const world = context?.world.path === context?.campaign.path ? null : context?.world;
    return [`Library/${system}/Mechanics/Bestiary`, `Library/Mechanics/${system}/Bestiary`, ...(context?.campaign.parent ? [`${context.campaign.parent.path}/Mechanics/Bestiary`] : []), ...(world?.parent ? [`${world.parent.path}/Mechanics/Bestiary`] : [])];
  }
}
