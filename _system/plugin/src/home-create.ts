import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type TableTools from "./main";
import { HomePanel, folderName } from "./home";
import { createNote, ensureFolder, isGameNotePath, linkTarget, noteFields, noteStem, quotedLink } from "./notes";
abstract class HomeCreateModal extends Modal {
  protected name = "";
  constructor(app: App, protected readonly plugin: TableTools, protected readonly view: HomePanel) { super(app); }
  protected nameField(): void {
    new Setting(this.contentEl).setName(this.plugin.strings.homeFieldName).addText(text => {
      text.setValue(this.name).onChange(value => { this.name = value; });
    });
  }
  protected submit(action: () => Promise<void>): void {
    new Setting(this.contentEl).addButton(button => button.setButtonText(this.plugin.strings.homeCreate).setCta().onClick(() => void action()));
  }
  protected validName(): string | null {
    const name = this.name.trim();
    if (!name || /[\\/:*?"<>|#^\[\]]/.test(name)) {
      new Notice(this.plugin.strings.homeInvalidName);
      return null;
    }
    return name;
  }
  protected folderAvailable(folder: string): boolean {
    if (this.app.vault.getAbstractFileByPath(folder)) return false;
    return !this.app.vault.getMarkdownFiles().some(file => file.path.startsWith(`${folder}/`));
  }
  protected async createFromTemplate(kind: "world" | "campaign" | "party" | "pc" | "run", folder: string, fileName: string, values: Record<string, string>): Promise<TFile> {
    return createNote(this.app, { template: kind, folder, name: noteStem(fileName), title: this.name.trim(), values, exact: true });
  }
  protected async complete(file: TFile): Promise<void> {
    this.close();
    await this.app.workspace.openLinkText(file.path, "");
    await this.view.render();
  }
}
export class WorldModal extends HomeCreateModal {
  private system = "generic";
  async onOpen(): Promise<void> {
    this.contentEl.createEl("h3", { text: this.plugin.strings.homeNewWorld });
    this.nameField();
    const systems = await this.plugin.systemPackages();
    const campaign = this.app.vault.getMarkdownFiles().find(file => noteFields(this.app, file).type === "campaign");
    const preferred = campaign ? String(noteFields(this.app, campaign).system ?? "") : "";
    this.system = systems.some(system => system.id === preferred) ? preferred : systems[0]?.id ?? "generic";
    new Setting(this.contentEl).setName(this.plugin.strings.homeFieldSystem).addDropdown(dropdown => {
      systems.forEach(system => dropdown.addOption(system.id, system.name));
      dropdown.setValue(this.system).onChange(value => { this.system = value; });
    });
    this.submit(() => this.create());
  }
  private async create(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    const folder = `Library/${this.system}/Worlds/${name}`;
    if (!this.folderAvailable(folder)) { new Notice(this.plugin.strings.homeExists); return; }
    const file = await this.createFromTemplate("world", folder, "World.md", { type: "world", system: this.system });
    for (const section of ["Locations", "Factions", "NPCs", "Events", "Mechanics", "Lore", ...["Religion", "History", "Culture", "Peoples", "Languages", "Magic", "Cosmology", "Economy", "Creatures", "Other"].map(name => `Lore/${name}`)]) await ensureFolder(this.app, `${folder}/${section}`);
    await this.complete(file);
  }
}
export class CharacterModal extends HomeCreateModal {
  constructor(app: App, plugin: TableTools, view: HomePanel, private readonly party: TFile) { super(app, plugin, view); }
  onOpen(): void {
    this.contentEl.createEl("h3", { text: this.plugin.strings.homeNewCharacter });
    this.nameField();
    this.submit(() => this.create());
  }
  private async create(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    const folder = this.party.parent?.path ?? "";
    if (this.app.vault.getAbstractFileByPath(`${folder}/${name}.md`)) { new Notice(this.plugin.strings.homeExists); return; }
    const file = await this.createFromTemplate("pc", folder, `${name}.md`, { type: "pc", party: quotedLink(this.party) });
    await this.complete(file);
  }
}
export class CampaignModal extends HomeCreateModal {
  private system = "generic";
  private world = "";
  async onOpen(): Promise<void> {
    this.contentEl.createEl("h3", { text: this.plugin.strings.homeNewCampaign });
    this.nameField();
    const systems = await this.plugin.systemPackages();
    if (!systems.some(system => system.id === this.system)) this.system = systems[0]?.id ?? "generic";
    let systemDropdown: { setValue: (value: string) => unknown } | null = null;
    new Setting(this.contentEl).setName(this.plugin.strings.homeFieldSystem).addDropdown(dropdown => {
      systemDropdown = dropdown;
      systems.forEach(system => dropdown.addOption(system.id, system.name));
      dropdown.setValue(this.system).onChange(value => { this.system = value; });
    });
    new Setting(this.contentEl).setName(this.plugin.strings.homeFieldWorld).addDropdown(dropdown => {
      dropdown.addOption("", this.plugin.strings.homeNoWorld);
      this.app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path) && noteFields(this.app, file).type === "world")
        .forEach(file => dropdown.addOption(file.path, folderName(file)));
      dropdown.setValue(this.world).onChange(value => {
        this.world = value;
        const file = this.app.vault.getAbstractFileByPath(value);
        if (file instanceof TFile) {
          const system = String(noteFields(this.app, file).system ?? "");
          if (system && systems.some(entry => entry.id === system)) { this.system = system; systemDropdown?.setValue(system); }
        }
      });
    });
    this.submit(() => this.create());
  }
  private async create(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    const folder = `Campaigns/${name}`;
    if (!this.folderAvailable(folder)) { new Notice(this.plugin.strings.homeExists); return; }
    const world = this.world ? quotedLink(this.world) : '""';
    const file = await this.createFromTemplate("campaign", folder, "Campaign.md", { type: "campaign", system: this.system, world });
    for (const section of this.world ? ["Quests", "Encounters", "Handouts"] : ["NPCs", "Locations", "Quests", "Factions", "Encounters", "Handouts"]) await ensureFolder(this.app, `${folder}/${section}`);
    await this.complete(file);
  }
}
export class PartyModal extends HomeCreateModal {
  onOpen(): void {
    this.contentEl.createEl("h3", { text: this.plugin.strings.homeNewParty });
    this.nameField();
    this.submit(() => this.create());
  }
  private async create(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    const folder = `Parties/${name}`;
    if (!this.folderAvailable(folder)) { new Notice(this.plugin.strings.homeExists); return; }
    const file = await this.createFromTemplate("party", folder, "Party.md", { type: "party" });
    await this.complete(file);
  }
}
export class RunModal extends HomeCreateModal {
  private role = "gm";
  private campaign = "";
  private party = "";
  private makeActive = true;
  onOpen(): void {
    const s = this.plugin.strings;
    this.contentEl.createEl("h3", { text: s.homeNewRun });
    this.nameField();
    new Setting(this.contentEl).setName(s.homeFieldRole).addDropdown(dropdown => {
      dropdown.addOption("gm", s.homeRoleGm).addOption("player", s.homeRolePlayer);
      dropdown.setValue(this.role).onChange(value => { this.role = value; });
    });
    this.noteDropdown(s.homeFieldCampaign, "campaign", value => { this.campaign = value; });
    this.noteDropdown(s.homeFieldParty, "party", value => { this.party = value; });
    new Setting(this.contentEl).setName(s.homeFieldMakeActive).addToggle(toggle => {
      toggle.setValue(this.makeActive).onChange(value => { this.makeActive = value; });
    });
    this.submit(() => this.create());
  }
  private noteDropdown(label: string, type: string, change: (value: string) => void): void {
    new Setting(this.contentEl).setName(label).addDropdown(dropdown => {
      dropdown.addOption("", "");
      this.app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path) && noteFields(this.app, file).type === type)
        .forEach(file => dropdown.addOption(file.path, folderName(file)));
      dropdown.setValue("").onChange(change);
    });
  }
  private async create(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    if (!this.campaign || !this.party) { new Notice(this.plugin.strings.homeRunNeedsCampaignParty); return; }
    const folder = `Runs/${name}`;
    if (!this.folderAvailable(folder)) { new Notice(this.plugin.strings.homeExists); return; }
    const campaign = linkTarget(this.campaign);
    const party = linkTarget(this.party);
    const run = await this.createFromTemplate("run", folder, "Run.md", {
      type: "run",
      role: this.role,
      campaign: quotedLink(campaign),
      party: quotedLink(party),
    });
    await this.app.vault.create(`${folder}/State.md`, `---\ntype: state\nrun: "[[${folder}/Run]]"\n---\n\n# State\n\n## What players know\n\n## World changes\n`);
    await this.app.vault.create(`${folder}/World Day.md`, "---\ntype: world-day\n---\n\n# World Day\n");
    if (this.makeActive) await this.plugin.setActiveRun(run.path);
    await this.complete(run);
  }
}
