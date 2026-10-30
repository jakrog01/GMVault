import { App, MarkdownView, Modal, Notice, Setting, TFile } from "obsidian";
import type TableTools from "./main";
import { linkPath, mergeHomeTemplate } from "./home";
import { format } from "./strings";
import { noteLink } from "./lookup";

const pick = (items: string[]): string => items[Math.floor(Math.random() * items.length)] ?? "";
const link = (file: TFile): string => `"[[${file.path.replace(/\.md$/, "")}]]"`;

export class QuickNpcModal extends Modal {
  private name = "";
  private trait = "";
  private where = "";
  private readonly editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  private readonly options: { folder: string; field: string; target: TFile }[] = [];
  private nameInput?: { setValue(value: string): unknown };
  private traitInput?: { setValue(value: string): unknown };
  private names: string[] = [];
  private traits: string[] = [];
  private creating = false;

  constructor(app: App, private readonly plugin: TableTools) { super(app); }

  async onOpen(): Promise<void> {
    const s = this.plugin.strings;
    const context = this.plugin.currentContext();
    if (!context?.campaign.parent) { new Notice(s.quickNpcNeedsRun); this.close(); return; }
    const worldPath = linkPath(this.app.metadataCache.getFileCache(context.campaign)?.frontmatter?.world);
    const world = worldPath ? this.app.metadataCache.getFirstLinkpathDest(worldPath, context.campaign.path) : null;
    if (world?.parent) this.options.push({ folder: `${world.parent.path}/NPCs`, field: "world", target: world });
    this.options.push({ folder: `${context.campaign.parent.path}/NPCs`, field: "campaign", target: context.campaign });
    this.where = this.options[0].folder;
    [this.names, this.traits] = await Promise.all([this.table("names"), this.table("traits")]);
    this.name = pick(this.names);
    this.trait = pick(this.traits);
    this.contentEl.addClass("tt-modal");
    this.contentEl.createEl("h3", { text: s.quickNpc });
    new Setting(this.contentEl).setName(s.homeFieldName).addText(input => {
      this.nameInput = input;
      input.setValue(this.name).onChange(value => { this.name = value; });
    }).addExtraButton(button => button.setIcon("dice").setTooltip(s.quickNpcReroll).onClick(() => {
      this.name = pick(this.names); this.nameInput?.setValue(this.name);
    }));
    new Setting(this.contentEl).setName(s.quickNpcTrait).addText(input => {
      this.traitInput = input;
      input.setValue(this.trait).onChange(value => { this.trait = value; });
    }).addExtraButton(button => button.setIcon("dice").setTooltip(s.quickNpcReroll).onClick(() => {
      this.trait = pick(this.traits); this.traitInput?.setValue(this.trait);
    }));
    new Setting(this.contentEl).setName(s.quickNpcWhere).addDropdown(input => {
      this.options.forEach(option => input.addOption(option.folder, option.field === "world" ? s.homeFieldWorld : s.homeFieldCampaign));
      input.setValue(this.where).onChange(value => { this.where = value; });
    });
    new Setting(this.contentEl).addButton(button => button.setButtonText(s.homeCreate).setCta().onClick(() => void this.create()));
    this.contentEl.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); void this.create(); } });
  }

  private async table(kind: string): Promise<string[]> {
    for (const root of ["_local", "_system"]) {
      try {
        const lines = (await this.app.vault.adapter.read(`${root}/tables/${kind}.txt`)).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length) return lines;
      } catch {}
    }
    return [];
  }

  private async create(): Promise<void> {
    const s = this.plugin.strings;
    const name = this.name.trim();
    if (!name || /[\\/:*?"<>|#^\[\]]/.test(name)) { new Notice(s.homeInvalidName); return; }
    const option = this.options.find(value => value.folder === this.where);
    if (!option || this.creating) return;
    this.creating = true;
    let title = name;
    for (let number = 2; this.app.vault.getAbstractFileByPath(`${option.folder}/${title}.md`); number++) title = `${name} ${number}`;
    let template = "";
    for (const root of ["_local", "_system"]) {
      try { template = await this.app.vault.adapter.read(`${root}/templates/npc.md`); break; } catch {}
    }
    const values = { type: "npc", world: '""', campaign: '""', [option.field]: link(option.target) };
    let content = mergeHomeTemplate(template, title, option.folder, values);
    const heading = content.match(/^# .+$/m);
    if (heading) content = content.replace(heading[0], `${heading[0]}\n\n${this.trait.trim()}`);
    else content += `\n# ${title}\n\n${this.trait.trim()}\n`;
    const vault = this.app.vault as typeof this.app.vault & { createFolder?: (path: string) => Promise<void> };
    let path = "";
    for (const part of option.folder.split("/")) {
      path = path ? `${path}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(path)) await vault.createFolder?.(path);
    }
    const file = await this.app.vault.create(`${option.folder}/${title}.md`, content);
    this.editor?.replaceSelection(noteLink(this.app, file, this.app.workspace.getActiveFile()?.path ?? ""));
    this.close();
    new Notice(format(s.quickNpcCreated, { name: title }));
  }
}
