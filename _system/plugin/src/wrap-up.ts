import { App, Modal, Notice, TFile } from "obsidian";
import type TableTools from "./main";
import { requestResponse } from "./gemini";
import { createNote, linkTarget, noteFields, resolveLink, uniqueName, wikilink } from "./notes";
import { format } from "./strings";

interface Fact { text: string; links?: string[] }
interface Claim { about: string; what: string; from: string }
interface Proposals { worldChanges: Fact[]; playersKnow: Fact[]; claims: Claim[] }
interface Edit { checked: boolean; value: string; claim?: Claim; kind: "worldChanges" | "playersKnow" | "claims" }

export function newestRunSession(app: App, run: TFile): TFile | null {
  return app.vault.getMarkdownFiles().filter(file => file.parent?.path === run.parent?.path && noteFields(app, file).type === "session")
    .sort((a, b) => String(noteFields(app, b).date ?? "").localeCompare(String(noteFields(app, a).date ?? "")) || b.path.localeCompare(a.path))[0] ?? null;
}

export function sessionLinks(app: App, session: TFile): TFile[] {
  const found = new Map<string, TFile>();
  for (const link of app.metadataCache.getFileCache(session)?.links ?? []) {
    const file = app.metadataCache.getFirstLinkpathDest(linkTarget(link.link), session.path);
    if (file && file.path !== session.path) found.set(file.path, file);
  }
  return [...found.values()];
}

function parseProposals(raw: string): Proposals | null {
  try {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || !Array.isArray(data.worldChanges) || !Array.isArray(data.playersKnow) || !Array.isArray(data.claims)) return null;
    if (!data.worldChanges.every(item => item && typeof item.text === "string") || !data.playersKnow.every(item => item && typeof item.text === "string") || !data.claims.every(item => item && typeof item.about === "string" && typeof item.what === "string" && typeof item.from === "string")) return null;
    return data as unknown as Proposals;
  } catch { return null; }
}

function appendSection(content: string, heading: string, lines: string[]): { content: string; added: number } {
  if (!lines.length) return { content, added: 0 };
  const rows = content.split("\n");
  let start = rows.findIndex(row => row.trim() === `## ${heading}`);
  if (start < 0) { if (rows.at(-1) !== "") rows.push(""); rows.push(`## ${heading}`, ""); start = rows.length - 2; }
  let end = start + 1;
  while (end < rows.length && !/^#{1,2}\s/.test(rows[end])) end++;
  const existing = new Set(rows.map(row => row.trim()));
  let added = 0;
  for (const line of lines) if (!existing.has(line)) { rows.splice(end++, 0, line); existing.add(line); added++; }
  return { content: rows.join("\n"), added };
}

function resolvedLink(app: App, name: string, source: string): string {
  const file = resolveLink(app, name, source);
  return file ? wikilink(app, file, source) : name.trim();
}

export class WrapUpModal extends Modal {
  private edits: Edit[] = [];
  constructor(app: App, private readonly plugin: TableTools, private readonly session: TFile, private readonly state: TFile, private readonly proposals: Proposals) { super(app); }

  onOpen(): void {
    const s = this.plugin.strings;
    this.contentEl.createEl("h2", { text: s.wrapUpTitle });
    const group = (label: string, kind: Edit["kind"], items: (Fact | Claim)[]): void => {
      if (!items.length) return;
      this.contentEl.createEl("h3", { text: label });
      for (const item of items) {
        const edit: Edit = { kind, checked: true, value: kind === "claims" ? (item as Claim).what : (item as Fact).text, ...(kind === "claims" ? { claim: item as Claim } : {}) };
        this.edits.push(edit);
        const row = this.contentEl.createDiv("tt-wrap-item");
        const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": label } });
        checkbox.checked = true;
        checkbox.onchange = () => { edit.checked = checkbox.checked; };
        const input = row.createEl("input", { type: "text", attr: { "aria-label": kind === "claims" ? s.wrapUpRumourText : label } });
        input.value = edit.value;
        input.onchange = () => { edit.value = input.value; };
        if (edit.claim) row.createSpan({ text: edit.claim.about });
      }
    };
    group(s.wrapUpWorldChanges, "worldChanges", this.proposals.worldChanges);
    group(s.wrapUpPlayersKnow, "playersKnow", this.proposals.playersKnow);
    group(s.wrapUpRumours, "claims", this.proposals.claims);
    const actions = this.contentEl.createDiv("tt-home-actions");
    const apply = actions.createEl("button", { cls: "tt-btn", text: s.wrapUpApply });
    apply.onclick = () => void this.apply();
    const cancel = actions.createEl("button", { cls: "tt-btn", text: s.cancel });
    cancel.onclick = () => this.close();
  }

  private async apply(): Promise<void> {
    const s = this.plugin.strings;
    const selected = this.edits.filter(edit => edit.checked && edit.value.trim());
    const sessionLink = wikilink(this.app, this.session, this.state.path);
    const lines = (kind: Edit["kind"]): string[] => selected.filter(edit => edit.kind === kind).map(edit => `- ${edit.value.trim()} (${sessionLink})`);
    const original = await this.app.vault.cachedRead(this.state);
    const world = appendSection(original, "World changes", lines("worldChanges"));
    const known = appendSection(world.content, "What players know", lines("playersKnow"));
    if (known.content !== original) await this.app.vault.modify(this.state, known.content);
    const folder = this.state.parent?.path ?? "";
    let claims = 0;
    for (const edit of selected.filter(item => item.kind === "claims")) {
      const what = edit.value.trim();
      const short = what.replace(/[\\/:*?"<>|#^\[\]\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48) || "Rumour";
      const base = `Claim ${short}`;
      const claim = edit.claim!;
      const name = uniqueName(this.app, folder, base);
      const path = `${folder}/${name}.md`;
      await createNote(this.app, { template: "claim", folder, name, exact: true, values: {
        type: "claim", about: JSON.stringify(resolvedLink(this.app, claim.about, path)), what: JSON.stringify(what),
        from: JSON.stringify(claim.from ? resolvedLink(this.app, claim.from, path) : ""),
        session: JSON.stringify(wikilink(this.app, this.session, path)), status: "current",
      } });
      claims++;
    }
    this.close();
    new Notice(format(s.wrapUpApplied, { world: world.added, known: known.added, claims }));
  }
}

export async function wrapUp(plugin: TableTools, run?: TFile, selectedSession?: TFile): Promise<void> {
  const app = plugin.app;
  const active = app.workspace.getActiveFile();
  const targetRun = run ?? plugin.context()?.run;
  const session = selectedSession ?? (run ? newestRunSession(app, run) : active && noteFields(app, active).type === "session" ? active : targetRun ? newestRunSession(app, targetRun) : null);
  if (!session) { new Notice(plugin.strings.wrapUpNoSession); return; }
  const runPath = linkTarget(noteFields(app, session).run);
  const linkedRun = runPath ? app.metadataCache.getFirstLinkpathDest(runPath, session.path) : null;
  const runFile = linkedRun ?? app.vault.getAbstractFileByPath(`${session.parent?.path ?? ""}/Run.md`);
  const folder = runFile?.parent?.path ?? "";
  const state = app.vault.getAbstractFileByPath(`${folder}/State.md`);
  if (!(runFile instanceof TFile) || !(state instanceof TFile)) { new Notice(plugin.strings.wrapUpNoRun); return; }
  if (!plugin.settings.apiKey) { new Notice(plugin.strings.noApiKey); return; }
  let progress: Notice | undefined;
  try {
    const linked = sessionLinks(app, session).map(file => ({ name: file.basename, type: String(noteFields(app, file).type ?? ""), status: String(noteFields(app, file).status ?? "") }));
    const input = JSON.stringify({ session: await app.vault.cachedRead(session), state: await app.vault.cachedRead(state), run: await app.vault.cachedRead(runFile), linked });
    progress = new Notice(plugin.strings.wrapUpReading, 0);
    const response = await requestResponse({ apiKey: plugin.settings.apiKey, model: plugin.settings.model, temperature: plugin.settings.temperature, system: plugin.strings.wrapUpPrompt }, [{ role: "user", text: input, time: Date.now() }], plugin.strings, () => {});
    progress.hide();
    const proposals = parseProposals(response);
    if (!proposals) { new Notice(plugin.strings.wrapUpInvalid); return; }
    new WrapUpModal(app, plugin, session, state, proposals).open();
  } catch (error) { progress?.hide(); new Notice(error instanceof Error ? error.message : String(error)); }
}
