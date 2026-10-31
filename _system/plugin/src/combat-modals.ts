import { App, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";
import { noteFields } from "./notes";
import type TableTools from "./main";
import { signed } from "./dice";
import { CONDITIONS } from "./rules";
import { creatureFiles, playerFiles } from "./statblock";
import { conditionDescription, conditionLabel, format, Strings } from "./strings";
import { Participant, ParticipantKind } from "./types";

export class CreaturePickerModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly plugin: TableTools) {
    super(app);
    this.setPlaceholder(plugin.strings.searchBestiary);
  }
  getItems(): TFile[] { return creatureFiles(this.app, this.plugin.bestiaryPaths()); }
  getItemText(file: TFile): string {
    const cr = noteFields(this.app, file).cr;
    return cr != null ? format(this.plugin.strings.creatureOption, { name: file.basename, cr: String(cr) }) : file.basename;
  }
  onChooseItem(file: TFile): void { new QuantityModal(this.app, this.plugin, file).open(); }
}

class QuantityModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools, private readonly file: TFile) { super(app); }
  onOpen(): void {
    const s = this.plugin.strings;
    const { contentEl } = this;
    contentEl.addClass("tt-modal");
    contentEl.createEl("h3", { text: this.file.basename });
    let quantity = 1, shareInitiative = true;
    new Setting(contentEl).setName(s.quantity).addSlider(slider => slider.setLimits(1, 12, 1).setValue(1).setDynamicTooltip().onChange(value => { quantity = value; }));
    new Setting(contentEl).setName(s.sharedInitiativeForGroup).addToggle(toggle => toggle.setValue(true).onChange(value => { shareInitiative = value; }));
    new Setting(contentEl).addButton(button => button.setButtonText(s.add).setCta().onClick(async () => {
      await this.plugin.tracker.addCreature(this.file, quantity, shareInitiative);
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

interface TrackerPlayer { name: string; ac?: number; hp?: number; modifier?: number; level?: number; note?: string }

export class AddPlayersModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools) { super(app); }
  async onOpen(): Promise<void> {
    const s = this.plugin.strings;
    const { contentEl } = this;
    contentEl.addClass("tt-modal");
    contentEl.createEl("h3", { text: s.addPlayersTitle });
    const files = playerFiles(this.app, this.plugin.partyPath());
    const selected = new Set<string>(files.map(file => file.path));
    if (files.length) {
      contentEl.createEl("p", { cls: "tt-muted", text: s.fromPartyNotes });
      for (const file of files) {
        const fields = noteFields(this.app, file);
        new Setting(contentEl).setName(file.basename)
          .setDesc(format(s.playerSummary, { ac: String(fields.ac ?? "?"), hp: String(fields.hp ?? "?"), modifier: signed(Number(fields.init_mod ?? 0)), level: String(fields.level ?? "?") }))
          .addToggle(toggle => toggle.setValue(true).onChange(value => { if (value) selected.add(file.path); else selected.delete(file.path); }));
      }
    }
    let trackerPlayers: TrackerPlayer[] = [];
    try {
      const raw = await this.app.vault.adapter.read(this.app.vault.configDir + "/plugins/initiative-tracker/data.json");
      trackerPlayers = (JSON.parse(raw) as { players?: TrackerPlayer[] }).players ?? [];
    } catch {}
    const selectedTracker = new Set<string>();
    if (trackerPlayers.length) {
      contentEl.createEl("p", { cls: "tt-muted", text: s.fromInitiativeTracker });
      for (const player of trackerPlayers) {
        new Setting(contentEl).setName(player.name)
          .setDesc(format(s.playerSummary, { ac: player.ac ?? "?", hp: player.hp ?? "?", modifier: signed(player.modifier ?? 0), level: player.level ?? "?" }))
          .addToggle(toggle => toggle.setValue(false).onChange(value => { if (value) selectedTracker.add(player.name); else selectedTracker.delete(player.name); }));
      }
    }
    contentEl.createEl("p", { cls: "tt-muted", text: s.manualEntry });
    let name = "", ac = 14, hp = 30, modifier = 2, level = 3;
    new Setting(contentEl).setName(s.nameLabel).addText(text => text.onChange(value => { name = value; }));
    new Setting(contentEl).setName(s.playerNumbers)
      .addText(text => text.setValue("14").onChange(value => { ac = Number(value); }))
      .addText(text => text.setValue("30").onChange(value => { hp = Number(value); }))
      .addText(text => text.setValue("2").onChange(value => { modifier = Number(value); }))
      .addText(text => text.setValue("3").onChange(value => { level = Number(value); }));
    new Setting(contentEl).addButton(button => button.setButtonText(s.addSelected).setCta().onClick(() => {
      const tracker = this.plugin.tracker;
      for (const file of files) {
        if (!selected.has(file.path)) continue;
        const fields = noteFields(this.app, file);
        tracker.addPlayer({ name: file.basename, ac: Number(fields.ac ?? 10), hp: Number(fields.hp ?? 10), modifier: Number(fields.init_mod ?? 0), level: Number(fields.level ?? 1), source: file.path });
      }
      for (const player of trackerPlayers) {
        if (selectedTracker.has(player.name)) tracker.addPlayer({ name: player.name, ac: Number(player.ac ?? 10), hp: Number(player.hp ?? 10), modifier: Number(player.modifier ?? 0), level: Number(player.level ?? 1), source: player.note });
      }
      if (name.trim()) tracker.addPlayer({ name: name.trim(), ac, hp, modifier, level });
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class ConditionsModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools, private readonly participant: Participant) { super(app); }
  onOpen(): void {
    const s = this.plugin.strings;
    const { contentEl } = this;
    contentEl.addClass("tt-modal");
    contentEl.createEl("h3", { text: format(s.conditionsTitle, { name: this.participant.name }) });
    const grid = contentEl.createDiv("tt-conditions-grid");
    const pending = new Set(this.participant.conditions);
    for (const condition of CONDITIONS) {
      const toggle = grid.createEl("button", {
        cls: "tt-condition-button" + (pending.has(condition) ? " tt-condition-on" : ""),
        text: conditionLabel(s, condition), attr: { title: conditionDescription(s, condition) },
      });
      toggle.onclick = () => {
        if (pending.has(condition)) pending.delete(condition); else pending.add(condition);
        toggle.toggleClass("tt-condition-on", pending.has(condition));
      };
    }
    new Setting(contentEl).addButton(button => button.setButtonText(s.done).setCta().onClick(() => {
      for (const condition of CONDITIONS) {
        if (pending.has(condition) !== this.participant.conditions.includes(condition)) this.plugin.tracker.toggleCondition(this.participant, condition);
      }
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class EditParticipantModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools, private readonly participant: Participant) { super(app); }
  onOpen(): void {
    const s = this.plugin.strings;
    const participant = this.participant;
    const changes: { name: string; ac: number; hpMax: number; modifier: number; level?: number; kind: ParticipantKind; note: string } = {
      name: participant.name, ac: participant.ac, hpMax: participant.hpMax, modifier: participant.modifier, level: participant.level, kind: participant.kind, note: participant.note,
    };
    const { contentEl } = this;
    contentEl.addClass("tt-modal");
    contentEl.createEl("h3", { text: s.editTitle });
    new Setting(contentEl).setName(s.nameLabel).addText(text => text.setValue(changes.name).onChange(value => { changes.name = value; }));
    new Setting(contentEl).setName(s.cardAc).addText(text => text.setValue(String(changes.ac)).onChange(value => { changes.ac = Number(value) || 10; }));
    new Setting(contentEl).setName(s.editMaximumHp).addText(text => text.setValue(String(changes.hpMax)).onChange(value => { changes.hpMax = Number(value) || 1; }));
    new Setting(contentEl).setName(s.editInitiativeModifier).addText(text => text.setValue(String(changes.modifier)).onChange(value => { changes.modifier = Number(value) || 0; }));
    if (participant.kind === "player") new Setting(contentEl).setName(s.editLevel).addText(text => text.setValue(String(changes.level ?? 1)).onChange(value => { changes.level = Number(value) || 1; }));
    new Setting(contentEl).setName(s.editKind).addDropdown(dropdown => dropdown
      .addOptions({ player: s.kindPlayer, enemy: s.kindEnemy, ally: s.kindAlly })
      .setValue(changes.kind)
      .onChange(value => { changes.kind = value as ParticipantKind; }));
    new Setting(contentEl).setName(s.editNote).setDesc(s.editNoteHint).addTextArea(text => text.setValue(changes.note).onChange(value => { changes.note = value; }));
    new Setting(contentEl).addButton(button => button.setButtonText(s.save).setCta().onClick(() => {
      this.plugin.tracker.update(participant, changes);
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class EncounterSetsModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools) { super(app); }
  onOpen(): void {
    const s = this.plugin.strings;
    const tracker = this.plugin.tracker;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tt-modal");
    contentEl.createEl("h3", { text: s.encounterSetsTitle });
    new Setting(contentEl).addButton(button => button.setButtonText(s.encounterStart).onClick(() => { this.close(); new EncounterNotePicker(this.app, this.plugin).open(); }))
      .addButton(button => button.setButtonText(s.encounterSaveCurrentNote).onClick(() => { this.close(); new EncounterNameModal(this.app, this.plugin, this.plugin.combat.name).open(); }));
    contentEl.createEl("p", { cls: "tt-muted", text: s.encounterSetsHint });
    const sets = this.plugin.encounterSets;
    if (!sets.length) contentEl.createEl("p", { text: s.noEncounterSets });
    for (const set of sets) {
      const members = set.members.map(member => format(s.memberSummary, { name: member.name, quantity: member.quantity })).join(", ");
      new Setting(contentEl).setName(set.name).setDesc(members + (set.description ? " \u2014 " + set.description : ""))
        .addButton(button => button.setButtonText(s.load).setCta().onClick(async () => { await tracker.loadEncounterSet(set); this.close(); }))
        .addButton(button => button.setButtonText(s.encounterSaveAsNote).onClick(() => new EncounterNameModal(this.app, this.plugin, set.name, set.members.flatMap(member => Array.from({ length: member.quantity }, () => ({ name: member.name, kind: "enemy" as const, source: member.source } as Participant)))).open()))
        .addExtraButton(button => button.setIcon("trash").setTooltip(s.deleteEncounterSet).onClick(() => { tracker.deleteEncounterSet(set); this.onOpen(); }));
    }
    const enemies = this.plugin.combat.participants.filter(participant => participant.kind === "enemy" && participant.source);
    if (enemies.length) {
      contentEl.createEl("h4", { text: s.saveCurrentEnemies });
      let name = this.plugin.combat.name, description = "";
      new Setting(contentEl).setName(s.nameLabel).addText(text => text.setValue(name).onChange(value => { name = value; }));
      new Setting(contentEl).setName(s.descriptionLabel).addText(text => text.onChange(value => { description = value; }));
      new Setting(contentEl).addButton(button => button.setButtonText(s.saveEncounterSet).onClick(() => {
        if (tracker.saveEncounterSet(name, description)) this.close();
      }));
    }
  }
  onClose(): void { this.contentEl.empty(); }
}

class EncounterNotePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly plugin: TableTools) { super(app); this.setPlaceholder(plugin.strings.encounterStart); }
  getItems(): TFile[] {
    const campaign = this.plugin.context()?.campaign;
    return this.app.vault.getMarkdownFiles().filter(file => noteFields(this.app, file).type === "encounter")
      .sort((a, b) => Number(!!campaign && b.path.startsWith(`${campaign.parent?.path}/`)) - Number(!!campaign && a.path.startsWith(`${campaign.parent?.path}/`)) || a.basename.localeCompare(b.basename));
  }
  getItemText(file: TFile): string { return file.basename; }
  onChooseItem(file: TFile): void { void this.plugin.tracker.loadEncounterNote(file); }
}

class EncounterNameModal extends Modal {
  constructor(app: App, private readonly plugin: TableTools, private name: string, private readonly participants?: Participant[]) { super(app); }
  onOpen(): void {
    const s = this.plugin.strings;
    this.contentEl.createEl("h3", { text: s.encounterSaveCurrentNote });
    new Setting(this.contentEl).setName(s.nameLabel).addText(text => text.setValue(this.name).onChange(value => { this.name = value; }));
    new Setting(this.contentEl).addButton(button => button.setButtonText(s.save).setCta().onClick(async () => {
      const file = await this.plugin.tracker.saveEncounterNote(this.name, this.participants);
      if (file) { this.close(); await this.app.workspace.openLinkText(file.path, ""); }
    }));
  }
}

export class ConfirmModal extends Modal {
  constructor(app: App, private readonly strings: Strings, private readonly message: string, private readonly action: string, private readonly onConfirm: () => void) { super(app); }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("tt-modal");
    contentEl.createEl("p", { text: this.message });
    new Setting(contentEl)
      .addButton(button => button.setButtonText(this.strings.cancel).onClick(() => this.close()))
      .addButton(button => button.setButtonText(this.action).setWarning().onClick(() => { this.onConfirm(); this.close(); }));
  }
  onClose(): void { this.contentEl.empty(); }
}
