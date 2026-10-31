import { App, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type TableTools from "./main";
import { homeTemplate, linkPath, mergeHomeTemplate } from "./home";

export const TIMELINE_VIEW = "tt-timeline";

interface TimelineRow { file: TFile; type: "event" | "session"; worldDate: string; date: string; sort: number[] | null }

export function timelineDate(value: string): number[] | null {
  const match = value.trim().match(/^(-?\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?(?:\s+.*)?$/);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

export class TimelineView extends ItemView {
  private timer?: number;
  constructor(leaf: WorkspaceLeaf, readonly plugin: TableTools) { super(leaf); }
  getViewType(): string { return TIMELINE_VIEW; }
  getDisplayText(): string { return this.plugin.strings.timelineTitle; }
  getIcon(): string { return "calendar-days"; }
  async onOpen(): Promise<void> { this.plugin.timelineViews.add(this); this.render(); }
  async onClose(): Promise<void> { this.plugin.timelineViews.delete(this); if (this.timer) clearTimeout(this.timer); }
  schedule(): void { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = undefined; this.render(); }, 200) as unknown as number; }

  rows(): TimelineRow[] {
    const context = this.plugin.currentContext();
    if (!context) return [];
    const app = this.app;
    const campaign = context.campaign;
    const worldPath = linkPath(app.metadataCache.getFileCache(campaign)?.frontmatter?.world);
    const world = worldPath ? app.metadataCache.getFirstLinkpathDest(worldPath, campaign.path) ?? campaign : campaign;
    const belongs = (value: unknown, file: TFile, target: TFile | null): boolean => !!target && !!linkPath(value) && app.metadataCache.getFirstLinkpathDest(linkPath(value), file.path)?.path === target.path;
    return app.vault.getMarkdownFiles().flatMap(file => {
      const fields = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const type = fields.type;
      const folder = file.parent?.path ?? "";
      const event = type === "event" && (belongs(fields.world, file, world) || belongs(fields.campaign, file, campaign)
        || (!linkPath(fields.world) && !linkPath(fields.campaign) && (folder.startsWith(`${campaign.parent?.path}/`) || !!world && folder.startsWith(`${world.parent?.path}/`))));
      const session = type === "session" && (belongs(fields.run, file, context.run) || !linkPath(fields.run) && folder === context.run.parent?.path);
      if (!event && !session) return [];
      const worldDate = String(fields.world_date ?? "");
      return [{ file, type: session ? "session" as const : "event" as const, worldDate, date: session ? String(fields.date ?? "") : "", sort: timelineDate(worldDate) }];
    }).sort((a, b) => {
      if (!a.sort || !b.sort) return Number(!a.sort) - Number(!b.sort) || a.file.basename.localeCompare(b.file.basename);
      return a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2] || a.file.basename.localeCompare(b.file.basename);
    });
  }

  render(): void {
    const root = this.contentEl;
    const s = this.plugin.strings;
    root.empty();
    root.addClass("tt-timeline");
    root.createEl("h2", { text: s.timelineTitle });
    const context = this.plugin.currentContext();
    if (!context) { root.createDiv({ cls: "tt-empty", text: s.timelineNoRun }); return; }
    const button = root.createEl("button", { cls: "tt-btn", text: s.timelineNewEvent });
    button.onclick = () => void this.newEvent();
    const rows = this.rows();
    if (!rows.length) root.createEl("p", { cls: "tt-muted", text: s.timelineEmpty });
    let undated = false;
    for (const row of rows) {
      if (!row.sort && !undated) { root.createEl("h3", { text: s.timelineUndated }); undated = true; }
      const item = root.createDiv("tt-timeline-row");
      item.createSpan({ cls: "tt-timeline-date", text: row.worldDate });
      const link = item.createEl("button", { cls: "tt-btn", text: row.file.basename });
      link.onclick = () => void this.app.workspace.openLinkText(row.file.path, "");
      item.createSpan({ cls: "tt-chip", text: row.type === "session" ? s.timelineSession : s.timelineEvent });
      if (row.date) item.createSpan({ cls: "tt-muted", text: row.date });
    }
  }

  async newEvent(): Promise<void> {
    const context = this.plugin.currentContext();
    if (!context) return;
    const worldPath = linkPath(this.app.metadataCache.getFileCache(context.campaign)?.frontmatter?.world);
    const world = worldPath ? this.app.metadataCache.getFirstLinkpathDest(worldPath, context.campaign.path) : null;
    const folder = `${(world ?? context.campaign).parent?.path ?? "Campaigns"}/Events`;
    const day = context.day ? this.app.metadataCache.getFileCache(context.day)?.frontmatter ?? {} : {};
    const worldDate = String(day.world_date || day.date || "");
    const base = this.plugin.strings.timelineEvent;
    let name = base;
    for (let number = 2; this.app.vault.getAbstractFileByPath(`${folder}/${name}.md`); number++) name = `${base} ${number}`;
    const target = world ?? context.campaign;
    const values = { type: "event", world: world ? `"[[${target.path.replace(/\.md$/, "")}]]"` : '""', campaign: world ? '""' : `"[[${target.path.replace(/\.md$/, "")}]]"`, world_date: JSON.stringify(worldDate) };
    const content = mergeHomeTemplate(await homeTemplate(this.app, "event"), name, folder, values);
    const vault = this.app.vault as typeof this.app.vault & { createFolder?: (path: string) => Promise<void> };
    if (!vault.getAbstractFileByPath(folder)) await vault.createFolder?.(folder);
    const file = await this.app.vault.create(`${folder}/${name}.md`, content);
    await this.app.workspace.openLinkText(file.path, "");
    this.render();
  }
}
