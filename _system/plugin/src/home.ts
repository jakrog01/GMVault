import { App, ItemView, MarkdownRenderChild, Modal, Platform, TFile, WorkspaceLeaf } from "obsidian";
import type TableTools from "./main";
import { format } from "./strings";
import { RecordedUpdate, recordedUpdate, shippedPath } from "./update";
import { newestRunSession, sessionLinks } from "./wrap-up";
import { CampaignModal, CharacterModal, PartyModal, RunModal, WorldModal } from "./home-create";
import { isGameNotePath, linkTarget, noteFields, resolveLink } from "./notes";
import { HOME_RECENT_TYPES } from "./contract";
export const HOME_VIEW = "tt-home";
interface NoteSummary {
  file: TFile;
  fields: Record<string, unknown>;
}
interface HomeModel {
  worlds: NoteSummary[];
  campaigns: NoteSummary[];
  runs: NoteSummary[];
  parties: NoteSummary[];
  context: ReturnType<TableTools["context"]>;
  worldDay: string;
  systems: Map<string, string>;
  members: Map<string, number>;
  update: RecordedUpdate | null;
}
export const folderName = (file: TFile): string => file.parent?.path.split("/").at(-1) ?? file.basename;
export class HomePanel {
  private readonly memberCounts = new Map<string, Promise<number>>();
  private readonly dayLines = new Map<string, Promise<string>>();
  private renderGeneration = 0;
  private renderedPaths = new Set<string>();
  private maintenance?: HTMLElement;
  private unsubscribe?: () => void;
  private timer?: number;
  private changedPaths = new Set<string>();
  constructor(readonly app: App, readonly plugin: TableTools, readonly contentEl: HTMLElement, private readonly showTitle = true) {}
  load(): Promise<void> {
    this.plugin.homeViews.add(this);
    this.unsubscribe = this.plugin.onNotesChanged(paths => {
      this.refreshMaintenance();
      if (!paths.some(path => {
        const file = this.app.vault.getAbstractFileByPath(path);
        return this.plugin.homeChangeAffects(file instanceof TFile ? file : undefined, path);
      })) return;
      paths.forEach(path => this.changedPaths.add(path));
      if (this.timer) return;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.changedPaths.forEach(path => this.invalidate(path));
        this.changedPaths.clear();
        void this.render();
      }, 200) as unknown as number;
    });
    return this.render();
  }
  unload(): void {
    this.unsubscribe?.();
    this.plugin.homeViews.delete(this);
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
  invalidate(path: string): void {
    this.memberCounts.clear();
    this.dayLines.delete(path);
  }
  hasRenderedPath(path: string): boolean { return this.renderedPaths.has(path); }
  async render(): Promise<void> {
    const generation = ++this.renderGeneration;
    const root = this.contentEl;
    const s = this.plugin.strings;
    root.empty();
    root.addClass("tt-home");
    if (this.showTitle) root.createEl("h2", { text: s.homeTitle });
    const create = root.createDiv("tt-home-actions");
    this.button(create, s.homeNewWorld, () => new WorldModal(this.app, this.plugin, this).open());
    this.button(create, s.homeNewCampaign, () => new CampaignModal(this.app, this.plugin, this).open());
    this.button(create, s.homeNewParty, () => new PartyModal(this.app, this.plugin, this).open());
    this.button(create, s.homeNewRun, () => new RunModal(this.app, this.plugin, this).open());
    let model: HomeModel;
    try { model = await this.model(); }
    catch (error) {
      if (generation !== this.renderGeneration) return;
      console.error("Home could not load", error);
      root.createDiv({ cls: "tt-empty", text: s.homeLoadError });
      return;
    }
    if (generation !== this.renderGeneration) return;
    if (model.update) this.renderUpdate(root, model.update);
    this.maintenance = root.createDiv("tt-home-maintenance");
    this.refreshMaintenance();
    const { worlds, campaigns, runs, parties, context, worldDay, systems, members } = model;
    if (context) this.renderActive(root, context, worldDay, systems.get(context.campaign.path) ?? "generic", this.notes());
    if (!worlds.length && !campaigns.length && !runs.length && !parties.length) root.createDiv({ cls: "tt-empty", text: s.homeEmpty });
    const worldSection = root.createDiv("tt-home-section");
    worldSection.createEl("h3", { text: s.homeWorlds });
    for (const world of worlds) {
      const card = worldSection.createDiv({ cls: "tt-home-world", attr: { "data-path": world.file.path } });
      card.createDiv({ cls: "tt-home-name", text: folderName(world.file) });
      card.createDiv({ cls: "tt-muted", text: format(s.homeCampaignCount, { count: campaigns.filter(campaign => this.resolvesTo(campaign.fields.world, campaign.file, world.file)).length }) });
      this.button(card, s.homeOpenWorld, () => this.openNote(world.file.path));
      this.button(card, s.mapOpen, () => void this.plugin.openMap(world.file));
    }
    const campaignSection = root.createDiv("tt-home-section");
    campaignSection.createEl("h3", { text: s.homeCampaigns });
    for (const campaign of campaigns) this.renderCampaign(campaignSection, campaign, runs, systems.get(campaign.file.path) ?? "generic");
    const assigned = new Set<string>();
    for (const campaign of campaigns) {
      const group = runs.filter(run => this.resolvesTo(run.fields.campaign, run.file, campaign.file));
      group.forEach(run => assigned.add(run.file.path));
      if (group.length) this.renderRuns(campaignSection, group, context?.run.path ?? "");
    }
    const loose = runs.filter(run => !assigned.has(run.file.path));
    if (loose.length) {
      const group = root.createDiv("tt-home-section");
      group.createEl("h3", { text: s.homeUnassignedRuns });
      this.renderRuns(group, loose, context?.run.path ?? "");
    }
    const partySection = root.createDiv("tt-home-section");
    partySection.createEl("h3", { text: s.homeParties });
    for (const party of parties) this.renderParty(partySection, party, members.get(party.file.path) ?? 0);
    this.renderedPaths = new Set([
      ...worlds.map(note => note.file.path),
      ...campaigns.map(note => note.file.path),
      ...runs.map(note => note.file.path),
      ...parties.map(note => note.file.path),
      ...(context ? [context.run.path, context.campaign.path, context.party?.path ?? "", context.state?.path ?? "", context.day?.path ?? ""] : []),
    ].filter(Boolean));
  }
  private async model(): Promise<HomeModel> {
    const updatePromise = recordedUpdate(this.app.vault.adapter);
    const notes = this.notes();
    const worlds = notes.filter(note => note.fields.type === "world");
    const campaigns = notes.filter(note => note.fields.type === "campaign");
    const runs = notes.filter(note => note.fields.type === "run");
    const parties = notes.filter(note => note.fields.type === "party");
    const context = this.plugin.context();
    const systemNotes = context ? [...campaigns, { file: context.campaign, fields: noteFields(this.app, context.campaign) }]
      : campaigns;
    const entries = await Promise.all(systemNotes.map(async note => [note.file.path, await this.systemName(note.fields.system)] as const));
    const memberEntries = await Promise.all(parties.map(async party => [party.file.path, await this.memberCountFor(party.file)] as const));
    const worldDay = context?.day ? await this.dayLine(context.day) : "";
    const update = await updatePromise;
    return { worlds, campaigns, runs, parties, context, worldDay, systems: new Map(entries), members: new Map(memberEntries), update };
  }
  private renderUpdate(root: HTMLElement, update: RecordedUpdate): void {
    const banner = root.createDiv("tt-home-update");
    banner.createDiv({ text: format(this.plugin.strings.homeUpdateAvailable, { version: update.latestVersion, installed: update.installedVersion }) });
    banner.createEl("code", { text: "node _system/bin/gmvault.mjs update --latest" });
    if (Platform.isDesktopApp) {
      this.button(banner, this.plugin.strings.homeUpdateInstall, () => new UpdateModal(this.app, this.plugin).open());
    }
  }
  private notes(): NoteSummary[] {
    return this.app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path)).map(file => ({
      file,
      fields: noteFields(this.app, file),
    }));
  }
  resolvesTo(value: unknown, source: TFile, target: TFile): boolean {
    return resolveLink(this.app, value, source)?.path === target.path;
  }
  private role(value: unknown): string {
    return value === "player" ? this.plugin.strings.homeRolePlayer : this.plugin.strings.homeRoleGm;
  }
  private button(parent: HTMLElement, label: string, action: () => void): void {
    const button = parent.createEl("button", { cls: "tt-btn", text: label, attr: { "aria-label": label } });
    button.onclick = action;
  }
  private openNote(path: string): void { void this.app.workspace.openLinkText(path, ""); }
  private async systemName(id: unknown): Promise<string> { return this.plugin.systemName(String(id || "generic")); }
  private renderActive(root: HTMLElement, context: NonNullable<ReturnType<TableTools["context"]>>, day: string, system: string, notes: NoteSummary[]): void {
    const s = this.plugin.strings;
    const card = root.createDiv("tt-home-active");
    card.createEl("h3", { text: s.homeActiveRun });
    card.createDiv({ cls: "tt-home-name", text: folderName(context.run) });
    card.createDiv({ cls: "tt-home-role", text: this.role(noteFields(this.app, context.run).role) });
    card.createDiv({ text: folderName(context.campaign) });
    card.createDiv({ cls: "tt-muted", text: system });
    if (context.party) card.createDiv({ text: folderName(context.party) });
    if (day) card.createDiv({ cls: "tt-home-day", text: day });
    const actions = card.createDiv("tt-home-actions");
    this.button(actions, s.homeOpenRun, () => this.openNote(context.run.path));
    this.button(actions, s.homeOpenCampaign, () => this.openNote(context.campaign.path));
    if (context.party) { const party = context.party; this.button(actions, s.homeOpenParty, () => this.openNote(party.path)); }
    this.button(actions, s.homeOpenAssistant, () => void this.plugin.openView("tt-assistant"));
    this.button(actions, s.homeOpenCombat, () => void this.plugin.openView("tt-combat"));
    this.button(actions, s.homeOpenTimeline, () => void this.plugin.openView("tt-timeline"));
    this.button(actions, s.lookUp, () => this.plugin.openLookup());
    this.button(actions, s.quickNpc, () => void this.plugin.openQuickNpc());
    const last = newestRunSession(this.app, context.run);
    const linked = last ? sessionLinks(this.app, last).filter(file => HOME_RECENT_TYPES.includes(String(noteFields(this.app, file).type ?? ""))).slice(0, 8) : [];
    const quests = notes.filter(note => note.fields.type === "quest" && !["done", "failed"].includes(String(note.fields.status ?? "").toLowerCase()) && (this.resolvesTo(note.fields.campaign, note.file, context.campaign) || !linkTarget(note.fields.campaign) && note.file.parent?.path.startsWith(`${context.campaign.parent?.path}/`))).slice(0, 8);
    const claims = notes.filter(note => note.fields.type === "claim" && note.file.parent?.path === context.run.parent?.path && ["", "current"].includes(String(note.fields.status ?? "").toLowerCase()));
    const next = card.createDiv("tt-home-next");
    next.createEl("h4", { text: s.homeNextSession });
    const list = (label: string, files: TFile[], count = 0): void => {
      if (!files.length && !count) return;
      const section = next.createDiv("tt-home-next-part");
      section.createDiv({ cls: "tt-muted", text: count ? format(label, { count }) : label });
      for (const file of files) this.button(section, file.basename, () => this.openNote(file.path));
    };
    if (last) {
      const date = noteFields(this.app, last).date;
      list(s.homeLastSession + (date ? `: ${date}` : ""), [last]);
    }
    list(s.homeLastPeoplePlaces, linked);
    list(s.homeOpenQuests, quests.map(note => note.file));
    list(s.homeRumours, claims.slice(0, 5).map(note => note.file), claims.length);
    const nextActions = next.createDiv("tt-home-actions");
    this.button(nextActions, s.homeNewSession, () => void this.plugin.newSession(context.run));
    this.button(nextActions, s.wrapUp, () => void this.plugin.wrapUp());
  }
  private async firstDayLine(file: TFile): Promise<string> {
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n").map(line => line.trim());
    const body = lines[0] === "---" ? lines.slice((lines.indexOf("---", 1) + 1) || lines.length) : lines;
    return body.find(line => line && !line.startsWith("#")) ?? "";
  }
  brokenLinks(): { source: string; target: string }[] {
    const cache = this.app.metadataCache as typeof this.app.metadataCache & { unresolvedLinks?: Record<string, Record<string, number>> };
    return Object.entries(cache.unresolvedLinks ?? {}).flatMap(([source, targets]) => {
      if (!isGameNotePath(source) || !this.app.vault.getAbstractFileByPath(source)) return [];
      return Object.entries(targets).filter(([, count]) => count > 0).map(([target]) => ({ source, target }));
    }).sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  }
  refreshMaintenance(): void {
    if (!this.maintenance) return;
    const rows = this.brokenLinks();
    this.maintenance.empty();
    if (!rows.length) return;
    const s = this.plugin.strings;
    const line = this.maintenance.createDiv("tt-maintenance-line");
    line.createSpan({ text: s.homeMaintenance + ": " });
    this.button(line, format(s.homeBrokenLinks, { count: rows.length }), () => new BrokenLinksModal(this.app, this.plugin, rows).open());
  }
  private dayLine(file: TFile): Promise<string> {
    const cached = this.dayLines.get(file.path);
    if (cached) return cached;
    const result = this.firstDayLine(file);
    this.dayLines.set(file.path, result);
    result.catch(() => this.dayLines.delete(file.path));
    return result;
  }
  private renderCampaign(parent: HTMLElement, campaign: NoteSummary, runs: NoteSummary[], system: string): void {
    const s = this.plugin.strings;
    const card = parent.createDiv({ cls: "tt-home-campaign", attr: { "data-path": campaign.file.path } });
    card.createDiv({ cls: "tt-home-name", text: folderName(campaign.file) });
    card.createDiv({ cls: "tt-muted", text: system });
    const count = runs.filter(run => this.resolvesTo(run.fields.campaign, run.file, campaign.file)).length;
    card.createDiv({ cls: "tt-muted", text: format(s.homeRunCount, { count }) });
    this.button(card, s.homeOpenCampaign, () => this.openNote(campaign.file.path));
  }
  private renderRuns(parent: HTMLElement, runs: NoteSummary[], activePath: string): void {
    for (const run of runs) {
      const card = parent.createDiv({ cls: "tt-home-run" + (run.file.path === activePath ? " tt-active" : ""), attr: { "data-path": run.file.path } });
      card.createDiv({ cls: "tt-home-name", text: folderName(run.file) });
      card.createDiv({ cls: "tt-home-role", text: this.role(run.fields.role) });
      const path = linkTarget(run.fields.party);
      const party = path ? this.app.metadataCache.getFirstLinkpathDest(path, run.file.path) : null;
      if (party) card.createDiv({ cls: "tt-muted", text: folderName(party) });
      this.button(card, this.plugin.strings.homeMakeActive, () => void this.plugin.setActiveRun(run.file.path));
      this.button(card, this.plugin.strings.homeNewSession, () => void this.plugin.newSession(run.file));
      this.button(card, this.plugin.strings.wrapUp, () => void this.plugin.wrapUp(run.file));
    }
  }
  private renderParty(parent: HTMLElement, party: NoteSummary, members: number): void {
    const s = this.plugin.strings;
    const card = parent.createDiv({ cls: "tt-home-party", attr: { "data-path": party.file.path } });
    card.createDiv({ cls: "tt-home-name", text: folderName(party.file) });
    card.createDiv({ cls: "tt-muted", text: format(s.homePartyMembers, { count: members }) });
    this.button(card, s.homeOpenParty, () => this.openNote(party.file.path));
    this.button(card, s.homeNewCharacter, () => new CharacterModal(this.app, this.plugin, this, party.file).open());
  }
  private async memberCount(file: TFile): Promise<number> {
    const linked = this.app.vault.getMarkdownFiles().filter(candidate => {
      const fields = noteFields(this.app, candidate);
      return (fields.type === "pc" || fields.type === "npc" && fields.subtype === "pc") && this.resolvesTo(fields.party, candidate, file);
    });
    if (linked.length) return linked.length;
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    const start = lines.findIndex(line => line.trim() === "## Members");
    if (start < 0) return 0;
    let count = 0;
    for (const line of lines.slice(start + 1)) {
      if (/^##\s/.test(line)) break;
      if (/^\s*[-*+]\s+\S/.test(line)) count++;
    }
    return count;
  }
  private memberCountFor(file: TFile): Promise<number> {
    const cached = this.memberCounts.get(file.path);
    if (cached) return cached;
    const result = this.memberCount(file);
    this.memberCounts.set(file.path, result);
    result.catch(() => this.memberCounts.delete(file.path));
    return result;
  }
}
export class HomeView extends ItemView {
  readonly panel: HomePanel;
  constructor(leaf: WorkspaceLeaf, readonly plugin: TableTools) {
    super(leaf);
    this.panel = new HomePanel(this.app, plugin, this.contentEl);
  }
  getViewType(): string { return HOME_VIEW; }
  getDisplayText(): string { return this.plugin.strings.homeTitle; }
  getIcon(): string { return "home"; }
  async onOpen(): Promise<void> { await this.panel.load(); }
  async onClose(): Promise<void> { this.panel.unload(); }
  render(): Promise<void> { return this.panel.render(); }
  invalidate(path: string): void { this.panel.invalidate(path); }
  resolvesTo(value: unknown, source: TFile, target: TFile): boolean { return this.panel.resolvesTo(value, source, target); }
}
export class HomeBlock extends MarkdownRenderChild {
  readonly panel: HomePanel;
  constructor(container: HTMLElement, app: App, plugin: TableTools) {
    super(container);
    this.panel = new HomePanel(app, plugin, container, false);
  }
  onload(): void { void this.panel.load(); }
  onunload(): void { this.panel.unload(); }
}
class BrokenLinksModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools, private readonly rows: { source: string; target: string }[]) { super(app); }
  onOpen(): void {
    this.contentEl.createEl("h3", { text: this.plugin.strings.homeMaintenance });
    for (const row of this.rows) {
      const button = this.contentEl.createEl("button", { cls: "tt-btn", text: `${row.source} -> ${row.target}` });
      button.onclick = () => { this.close(); void this.app.workspace.openLinkText(row.source, ""); };
    }
  }
}
class UpdateModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools) { super(app); }
  async onOpen(): Promise<void> {
    const s = this.plugin.strings;
    this.contentEl.createEl("h3", { text: s.homeUpdateRunning });
    const output = this.contentEl.createEl("pre", { cls: "tt-update-output" });
    try {
      const code = await this.plugin.commandRunner(shippedPath("bin/gmvault.mjs"), ["update", "--latest"], chunk => output.appendText(chunk));
      output.appendText(`\n${code === 0 ? s.homeUpdateReload : s.homeUpdateFailed}`);
    } catch (error) {
      output.appendText(`\n${s.homeUpdateFailed}\n${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
