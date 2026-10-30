import { App, MarkdownRenderChild, MarkdownRenderer, MarkdownView, Modal, SuggestModal, TFile, prepareFuzzySearch } from "obsidian";
import type TableTools from "./main";
import { linkPath } from "./home";

interface Candidate { file: TFile; type: string; context: string; names: string[]; tier: number }
interface Match { candidate: Candidate; score: number; bucket: number }
const normal = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u0141\u0142]/g, "l").toLowerCase();
export const noteLink = (app: App, file: TFile, source = ""): string => `[[${app.metadataCache.getFirstLinkpathDest(file.basename, source)?.path === file.path ? file.basename : file.path.replace(/\.md$/, "")}]]`;
const excluded = (path: string): boolean => path.split("/").some(part => part.startsWith(".") || ["_system", "_local", "Archive"].includes(part));
const validTypes = new Set(["world", "campaign", "party", "pc", "run", "session", "state", "world-day", "npc", "location", "faction", "lore", "event", "quest", "encounter", "handout", "item", "creature", "spell", "rules", "claim", "class", "subclass", "race", "background", "feat"]);

export class LookupModal extends SuggestModal<Match> {
  readonly candidates: Candidate[];
  private readonly editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

  constructor(app: App, private readonly plugin: TableTools) {
    super(app);
    this.setPlaceholder(plugin.strings.lookupPlaceholder);
    const run = plugin.currentContext();
    const campaign = run?.campaign;
    const worldPath = campaign ? linkPath(app.metadataCache.getFileCache(campaign)?.frontmatter?.world) : "";
    const world = worldPath && campaign ? app.metadataCache.getFirstLinkpathDest(worldPath, campaign.path) : null;
    const system = String(campaign ? app.metadataCache.getFileCache(campaign)?.frontmatter?.system ?? "" : "");
    const folders = [run?.run.parent?.path, campaign?.parent?.path, run?.party.parent?.path, world?.parent?.path,
      system ? `Library/${system}` : "", system ? `Library/Mechanics/${system}` : ""].filter((value): value is string => !!value);
    this.candidates = app.vault.getMarkdownFiles().filter(file => !excluded(file.path)).flatMap(file => {
      const fields = app.metadataCache.getFileCache(file)?.frontmatter;
      const type = String(fields?.type ?? "");
      if (!validTypes.has(type)) return [];
      const alias = fields?.aliases;
      const names = [file.basename, ...(Array.isArray(alias) ? alias.map(String) : typeof alias === "string" ? [alias] : [])];
      const parent = file.parent?.path.split("/").at(-1);
      if (parent && parent !== file.basename) names.push(parent);
      const context = [fields?.status, fields?.location, fields?.faction, fields?.system, fields?.campaign, fields?.world]
        .map(value => Array.isArray(value) ? value.join(", ") : String(value ?? "")).filter(Boolean).map(value => linkPath(value).split("/").at(-1) ?? value);
      if (!context.length && parent) context.push(parent);
      const tier = folders.some(folder => file.path.startsWith(`${folder}/`) || file.path === `${folder}.md`) ? 0 : 1;
      return [{ file, type, names: names.map(normal), context: context.join(" / "), tier }];
    });
  }

  getSuggestions(query: string): Match[] {
    const q = normal(query.trim());
    if (!q) return this.candidates.map(candidate => ({ candidate, score: 0, bucket: 0 })).sort((a, b) => a.candidate.tier - b.candidate.tier || a.candidate.file.path.localeCompare(b.candidate.file.path)).slice(0, 50);
    const search = prepareFuzzySearch(q);
    return this.candidates.flatMap(candidate => {
      const scores = candidate.names.map(name => search(name)?.score).filter((score): score is number => score !== undefined);
      const bucket = Math.min(...candidate.names.map(name => name === q ? 0 : name.startsWith(q) ? 1 : name.split(/[\s-]+/).some(word => word.startsWith(q)) ? 2 : 3));
      return scores.length ? [{ candidate, score: Math.max(...scores), bucket }] : [];
    }).sort((a, b) => a.bucket - b.bucket || a.candidate.tier - b.candidate.tier || b.score - a.score || a.candidate.file.path.localeCompare(b.candidate.file.path)).slice(0, 50);
  }

  renderSuggestion(match: Match, el: HTMLElement): void {
    const { candidate } = match;
    const title = el.createDiv("tt-lookup-result");
    title.createSpan({ text: candidate.file.basename });
    title.createSpan({ cls: "tt-chip", text: candidate.type });
    if (candidate.context) el.createDiv({ cls: "tt-muted", text: candidate.context });
  }

  onChooseSuggestion(match: Match, event: MouseEvent | KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey) { void this.app.workspace.openLinkText(match.candidate.file.path, ""); return; }
    new LookupCard(this.app, this.plugin, match.candidate, this.editor).open();
  }
}

class LookupCard extends Modal {
  constructor(app: App, private readonly plugin: TableTools, private readonly note: Candidate, private readonly editor?: MarkdownView["editor"]) { super(app); }

  async onOpen(): Promise<void> {
    const s = this.plugin.strings;
    const { file, type, context } = this.note;
    this.contentEl.addClass("tt-lookup-card");
    this.contentEl.createEl("h2", { text: file.basename });
    this.contentEl.createSpan({ cls: "tt-chip", text: type });
    if (context) this.contentEl.createDiv({ cls: "tt-muted", text: context });
    const raw = await this.app.vault.cachedRead(file);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const lines = body.split("\n");
    const preview = lines.slice(0, 60).join("\n");
    const rendered = this.contentEl.createDiv("tt-lookup-body");
    await MarkdownRenderer.render(this.app, preview, rendered, file.path, new MarkdownRenderChild(rendered));
    if (lines.length > 60) this.button(s.lookupMore, () => void this.openFile());
    const table = this.contentEl.createDiv("tt-lookup-table");
    table.createEl("h3", { text: s.lookupAtTable });
    await this.renderMentions(table);
    const actions = this.contentEl.createDiv("tt-home-actions");
    this.button(s.lookupOpen, () => void this.openFile(), actions);
    this.button(s.lookupOpenSide, () => void this.app.workspace.getLeaf("split").openFile(file), actions);
    this.button(s.lookupInsert, () => { this.editor?.replaceSelection(noteLink(this.app, file, this.app.workspace.getActiveFile()?.path ?? "")); this.close(); }, actions, !this.editor);
    if (type === "creature" || type === "npc") this.button(s.lookupAddCombat, () => { void this.plugin.tracker.addCreature(file, 1, true); this.close(); }, actions);
  }

  private button(label: string, action: () => void, parent = this.contentEl, disabled = false): void {
    const el = parent.createEl("button", { cls: "tt-btn", text: label });
    el.disabled = disabled;
    el.onclick = action;
  }

  private async openFile(): Promise<void> { this.close(); await this.app.workspace.openLinkText(this.note.file.path, ""); }

  private linked(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    return !!cache?.links?.some(link => this.app.metadataCache.getFirstLinkpathDest(link.link, file.path)?.path === this.note.file.path);
  }

  private async renderMentions(parent: HTMLElement): Promise<void> {
    const run = this.plugin.currentContext();
    if (!run) return;
    const sessions = this.app.vault.getMarkdownFiles().filter(file => file.parent?.path === run.run.parent?.path && this.app.metadataCache.getFileCache(file)?.frontmatter?.type === "session" && this.linked(file))
      .sort((a, b) => b.path.localeCompare(a.path)).slice(0, 3);
    for (const file of [run.state, ...sessions]) {
      if (!this.linked(file)) continue;
      const raw = await this.app.vault.cachedRead(file);
      for (const line of raw.split("\n")) {
        if (!/\[\[[^\]]+\]\]/.test(line)) continue;
        const targets = [...line.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => this.app.metadataCache.getFirstLinkpathDest(linkPath(match[1]), file.path)?.path);
        if (targets.includes(this.note.file.path)) parent.createDiv({ cls: "tt-lookup-mention", text: `${file.basename}: ${line.trim()}` });
      }
    }
  }
}
