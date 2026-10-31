import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type TableTools from "./main";
import { createNote, isGameNotePath, linkTarget, noteFields, quotedLink, resolveLink } from "./notes";

export const TIMELINE_VIEW = "tt-timeline";

interface TimelineRow { file: TFile; type: "event" | "session"; worldDate: string; date: string; sort: number[] | null }

export function timelineDate(value: string): number[] | null {
  const match = value.trim().match(/^(-?\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?(?:\s+.*)?$/);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

export class TimelineView extends ItemView {
  private timer?: number;
  private unsubscribe?: () => void;
  constructor(leaf: WorkspaceLeaf, readonly plugin: TableTools) { super(leaf); }
  getViewType(): string { return TIMELINE_VIEW; }
  getDisplayText(): string { return this.plugin.strings.timelineTitle; }
  getIcon(): string { return "calendar-days"; }
  async onOpen(): Promise<void> { this.plugin.timelineViews.add(this); this.unsubscribe = this.plugin.onNotesChanged(() => this.schedule()); this.render(); }
  async onClose(): Promise<void> { this.unsubscribe?.(); this.plugin.timelineViews.delete(this); if (this.timer) clearTimeout(this.timer); }
  schedule(): void { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = undefined; this.render(); }, 200) as unknown as number; }

  rows(): TimelineRow[] {
    const context = this.plugin.context();
    if (!context) return [];
    const app = this.app;
    const campaign = context.campaign;
    const world = context.world;
    const belongs = (value: unknown, file: TFile, target: TFile | null): boolean => !!target && resolveLink(app, value, file)?.path === target.path;
    return app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path)).flatMap(file => {
      const fields = noteFields(app, file);
      const type = fields.type;
      const folder = file.parent?.path ?? "";
      const event = type === "event" && (belongs(fields.world, file, world) || belongs(fields.campaign, file, campaign)
        || (!linkTarget(fields.world) && !linkTarget(fields.campaign) && (folder.startsWith(`${campaign.parent?.path}/`) || !!world && folder.startsWith(`${world.parent?.path}/`))));
      const session = type === "session" && (belongs(fields.run, file, context.run) || !linkTarget(fields.run) && folder === context.run.parent?.path);
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
    const context = this.plugin.context();
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
    const context = this.plugin.context();
    if (!context) return;
    const world = context.world.path === context.campaign.path ? null : context.world;
    const folder = `${(world ?? context.campaign).parent?.path ?? "Campaigns"}/Events`;
    const day = context.day ? noteFields(this.app, context.day) : {};
    const worldDate = String(day.world_date || day.date || "");
    const target = world ?? context.campaign;
    const values = { type: "event", world: world ? quotedLink(target) : '""', campaign: world ? '""' : quotedLink(target), world_date: JSON.stringify(worldDate) };
    const file = await createNote(this.app, { template: "event", folder, name: this.plugin.strings.timelineEvent, values });
    await this.app.workspace.openLinkText(file.path, "");
    this.render();
  }
}
