import { App, MarkdownView, Modal, Notice, Setting, TFile } from "obsidian";
import type TableTools from "./main";
import { createNote, quotedLink, wikilink } from "./notes";
import { format } from "./strings";

const pick = (items: string[]): string => items[Math.floor(Math.random() * items.length)] ?? "";

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
    const context = this.plugin.context();
    if (!context?.campaign.parent) { new Notice(s.quickNpcNeedsRun); this.close(); return; }
    const world = context.world.path === context.campaign.path ? null : context.world;
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
    const values = { type: "npc", world: '""', campaign: '""', [option.field]: quotedLink(option.target) };
    const file = await createNote(this.app, { template: "npc", folder: option.folder, name, values, body: this.trait.trim(), bodyWhenEmpty: true });
    const title = file.basename;
    this.editor?.replaceSelection(wikilink(this.app, file, this.app.workspace.getActiveFile()?.path ?? ""));
    this.close();
    new Notice(format(s.quickNpcCreated, { name: title }));
  }
}
