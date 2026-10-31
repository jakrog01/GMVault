import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type TableTools from "./main";
import { abilityModifier, dicePattern, highlightDice, roll, Roll, signed } from "./dice";
import { experienceForChallenge, savesText } from "./statblock";
import { conditionDescription, conditionLabel, format, Strings } from "./strings";
import { Participant, Trait } from "./types";
import { CombatTracker, COMBAT_VIEW, sortedParticipants } from "./combat";
import { AddPlayersModal, ConditionsModal, ConfirmModal, CreaturePickerModal, EditParticipantModal, EncounterNameModal, EncounterNotePicker, EncounterSetsModal } from "./combat-modals";

function appendLogEntry(list: HTMLElement, entry: string): void {
  const item = list.createEl("li");
  entry.split(/(\*\*.+?\*\*)/g).forEach(part => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) item.createEl("b", { text: part.slice(2, -2) });
    else item.appendText(part);
  });
}

export class CombatView extends ItemView {
  constructor(leaf: WorkspaceLeaf, readonly plugin: TableTools) { super(leaf); }

  getViewType(): string { return COMBAT_VIEW; }
  getDisplayText(): string { return this.plugin.strings.combatTitle; }
  getIcon(): string { return "swords"; }

  async onOpen(): Promise<void> { this.plugin.views.add(this); this.render(); }
  async onClose(): Promise<void> { this.plugin.views.delete(this); }

  private get tracker(): CombatTracker { return this.plugin.tracker; }
  private get strings(): Strings { return this.plugin.strings; }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("tt-combat");
    const combat = this.plugin.combat;
    const s = this.strings;
    const order = sortedParticipants(combat);

    const toolbar = root.createDiv("tt-toolbar");
    const button = (icon: string, label: string, onClick: () => void, cls = ""): HTMLElement => {
      const element = toolbar.createEl("button", { cls: "tt-btn " + cls, attr: { "aria-label": label } });
      setIcon(element.createSpan("tt-btn-icon"), icon);
      element.createSpan({ text: label });
      element.onclick = onClick;
      return element;
    };
    button("users", s.toolbarPlayers, () => new AddPlayersModal(this.app, this.plugin).open());
    button("skull", s.toolbarEnemy, () => new CreaturePickerModal(this.app, this.plugin).open());
    button("dices", s.toolbarInitiative, () => this.tracker.rollInitiative(false));
    if (!combat.active) button("play", s.toolbarStart, () => this.tracker.start(), "tt-btn-primary");
    else {
      button("skip-back", s.toolbarPrevious, () => this.tracker.advance(-1));
      button("skip-forward", s.toolbarNext, () => this.tracker.advance(1), "tt-btn-primary");
    }
    const round = toolbar.createDiv("tt-round");
    round.createSpan({ cls: "tt-round-label", text: s.roundLabel });
    round.createSpan({ cls: "tt-round-number", text: combat.round ? String(combat.round) : "\u2014" });
    const right = toolbar.createDiv("tt-toolbar-right");
    const iconButton = (icon: string, title: string, onClick: () => void, disabled = false): void => {
      const element = right.createEl("button", { cls: "tt-btn tt-btn-icon-only", attr: { "aria-label": title, title } });
      setIcon(element, icon);
      element.disabled = disabled;
      element.onclick = onClick;
    };
    iconButton("book-open", s.encounterStart, () => new EncounterNotePicker(this.app, this.plugin).open());
    iconButton("save", s.encounterSaveCurrentNote, () => new EncounterNameModal(this.app, this.plugin, combat.name).open(), !combat.participants.some(participant => participant.kind !== "player"));
    iconButton("layers", s.encounterSetsTitle, () => new EncounterSetsModal(this.app, this.plugin).open());
    iconButton("file-down", s.exportToNote, () => void this.tracker.exportToActiveNote());
    iconButton("rotate-ccw", s.newCombat, () => {
      if (!combat.participants.length) this.tracker.clear();
      else new ConfirmModal(this.app, s, s.confirmClear, s.confirmClearAction, () => this.tracker.clear()).open();
    });

    const difficulty = this.tracker.difficulty();
    if (difficulty) {
      const bar = root.createDiv("tt-difficulty tt-difficulty-" + difficulty.level);
      bar.createSpan({ cls: "tt-difficulty-level", text: this.tracker.difficultyLabel(difficulty.level) });
      bar.createSpan({ text: " " + format(s.difficultyDetail, { xp: difficulty.xp, adjusted: difficulty.adjustedXp, players: difficulty.players, thresholds: difficulty.thresholds.join(" / ") }) });
    }

    if (!order.length) {
      const empty = root.createDiv("tt-empty");
      empty.createEl("p", { text: s.emptyCombat });
      empty.createEl("p", { cls: "tt-muted", text: s.emptyCombatHint });
    } else {
      const table = root.createEl("table", { cls: "tt-table" });
      const head = table.createEl("thead").createEl("tr");
      for (const title of ["", s.columnInitiative, s.columnName, s.columnAc, s.columnHp, s.columnDamage, s.columnConditions, ""]) head.createEl("th", { text: title });
      const body = table.createEl("tbody");
      order.forEach((participant, index) => this.renderRow(body, participant, combat.active && index === combat.turn));
    }

    const bottom = root.createDiv("tt-bottom");
    const card = bottom.createDiv("tt-card");
    const selected = combat.participants.find(participant => participant.id === combat.selected);
    if (selected?.statblock) this.renderCard(card, selected);
    else if (selected) {
      card.createDiv({ cls: "tt-card-header" }).createEl("h3", { text: selected.name });
      card.createEl("p", { cls: "tt-muted", text: selected.source ? s.noStatblock : s.manualParticipant });
      if (selected.source) {
        const link = card.createEl("a", { text: s.openNote, href: "#" });
        const source = selected.source;
        link.onclick = () => void this.app.workspace.openLinkText(source, "", true);
      }
    } else card.createEl("p", { cls: "tt-muted", text: s.selectRowHint });
    const log = bottom.createDiv("tt-log");
    log.createDiv({ cls: "tt-log-title", text: s.logTitle });
    const list = log.createEl("ul");
    for (const entry of [...combat.log].reverse().slice(0, 40)) appendLogEntry(list, entry);
  }

  private renderRow(body: HTMLElement, participant: Participant, current: boolean): void {
    const s = this.strings;
    const combat = this.plugin.combat;
    const classes = ["tt-row", `tt-${participant.kind}`];
    if (current) classes.push("tt-current");
    if (participant.hp <= 0) classes.push("tt-defeated");
    if (combat.selected === participant.id) classes.push("tt-selected");
    if (participant.hidden) classes.push("tt-hidden");
    const row = body.createEl("tr", { cls: classes.join(" ") });
    row.onclick = event => {
      if ((event.target as HTMLElement | null)?.closest?.("input,button,select")) return;
      this.tracker.select(participant);
    };

    const marker = row.createEl("td", { cls: "tt-col-marker" });
    if (current) setIcon(marker.createSpan("tt-arrow"), "chevron-right");

    const initiativeCell = row.createEl("td", { cls: "tt-col-initiative" });
    const initiative = initiativeCell.createEl("input", {
      type: "number", cls: "tt-input-initiative", value: participant.initiative == null ? "" : String(participant.initiative),
      attr: { placeholder: "\u2014", title: format(s.modifierTitle, { modifier: signed(participant.modifier) }) },
    });
    initiative.onchange = () => this.tracker.setInitiative(participant, initiative.value === "" ? null : Number(initiative.value));

    const nameCell = row.createEl("td", { cls: "tt-col-name" });
    const name = nameCell.createDiv("tt-name");
    name.createSpan({ cls: "tt-kind-dot tt-dot-" + participant.kind });
    name.createSpan({ cls: "tt-name-text", text: participant.name });
    if (participant.cr) name.createSpan({ cls: "tt-chip tt-chip-cr", text: format(s.chipCr, { cr: participant.cr }) });
    if (participant.level) name.createSpan({ cls: "tt-chip", text: format(s.chipLevel, { level: participant.level }) });
    if (participant.note) nameCell.createDiv({ cls: "tt-note", text: participant.note });

    row.createEl("td", { cls: "tt-col-ac" }).createSpan({ cls: "tt-shield", text: String(participant.ac) });

    const hpCell = row.createEl("td", { cls: "tt-col-hp" });
    const bar = hpCell.createDiv("tt-hp-bar");
    const percent = participant.hpMax ? Math.max(0, Math.min(100, Math.round(participant.hp / participant.hpMax * 100))) : 0;
    const fill = bar.createDiv("tt-hp-fill");
    fill.style.width = percent + "%";
    fill.addClass(percent > 50 ? "tt-hp-healthy" : percent > 25 ? "tt-hp-wounded" : "tt-hp-critical");
    const hpText = hpCell.createDiv("tt-hp-text");
    hpText.createSpan({ cls: "tt-hp-current", text: String(participant.hp) });
    hpText.createSpan({ cls: "tt-muted", text: ` / ${participant.hpMax}` });
    if (participant.temporaryHp) hpText.createSpan({ cls: "tt-chip tt-chip-temporary", text: `+${participant.temporaryHp}` });

    const damageCell = row.createEl("td", { cls: "tt-col-damage" });
    const damage = damageCell.createEl("input", { type: "text", cls: "tt-input-damage", attr: { placeholder: s.damagePlaceholder, title: s.damageTitle } });
    damage.onkeydown = event => {
      if (event.key !== "Enter") return;
      if (this.tracker.applyRowInput(participant, damage.value, event.shiftKey)) damage.value = "";
    };

    const conditionsCell = row.createEl("td", { cls: "tt-col-conditions" });
    for (const condition of participant.conditions) {
      const chip = conditionsCell.createSpan({
        cls: "tt-chip tt-chip-condition", text: conditionLabel(s, condition),
        attr: { title: format(s.conditionChipTitle, { description: conditionDescription(s, condition) }) },
      });
      chip.onclick = event => { event.stopPropagation(); this.tracker.toggleCondition(participant, condition); };
    }
    const add = conditionsCell.createEl("button", { cls: "tt-btn-mini", attr: { title: s.addCondition, "aria-label": s.addCondition } });
    setIcon(add, "plus");
    add.onclick = event => { event.stopPropagation(); new ConditionsModal(this.app, this.plugin, participant).open(); };

    const actions = row.createEl("td", { cls: "tt-col-actions" });
    const mini = (icon: string, title: string, onClick: () => void): void => {
      const element = actions.createEl("button", { cls: "tt-btn-mini", attr: { title, "aria-label": title } });
      setIcon(element, icon);
      element.onclick = event => { event.stopPropagation(); onClick(); };
    };
    mini("pencil", s.editParticipant, () => new EditParticipantModal(this.app, this.plugin, participant).open());
    mini(participant.hidden ? "eye-off" : "eye", participant.hidden ? s.hiddenFromPlayers : s.visibleToPlayers, () => this.tracker.setHidden(participant, !participant.hidden));
    mini("x", s.removeParticipant, () => this.tracker.remove(participant));
  }

  private renderCard(element: HTMLElement, participant: Participant): void {
    const s = this.strings;
    const statblock = participant.statblock;
    if (!statblock) return;
    const pattern = dicePattern(this.plugin.settings.attackBonusPhrases);
    const onRoll = (_expression: string, result: Roll): void => {
      const description = this.tracker.logRoll(participant, result);
      new Notice(description.replace(/\*\*/g, ""));
    };
    const highlight = (target: HTMLElement, text: string): void => highlightDice(target, text, pattern, s.clickToRoll, onRoll);

    const header = element.createDiv("tt-card-header");
    header.createEl("h3", { text: statblock.name ?? participant.name });
    header.createDiv({ cls: "tt-card-subtitle", text: [statblock.size, statblock.type, statblock.subtype ? `(${statblock.subtype})` : "", statblock.alignment].filter(Boolean).join(" ") });
    if (participant.source) {
      const source = participant.source;
      const link = header.createEl("a", { cls: "tt-card-link", text: s.cardNoteLink });
      link.onclick = () => void this.app.workspace.openLinkText(source, "", true);
    }

    const key = element.createDiv("tt-card-key");
    const keyValue = (label: string, value: string): void => {
      const item = key.createDiv("tt-key-value");
      item.createSpan({ cls: "tt-key", text: label });
      highlight(item.createSpan("tt-value"), value);
    };
    keyValue(s.cardAc, `${statblock.ac ?? "?"}${statblock.ac_class ? ` (${statblock.ac_class})` : ""}`);
    keyValue(s.cardHp, `${participant.hp}/${participant.hpMax}${statblock.hit_dice ? ` (${statblock.hit_dice})` : ""}`);
    if (statblock.speed) keyValue(s.cardSpeed, String(statblock.speed));

    const stats = statblock.stats;
    if (stats?.length === 6) {
      const grid = element.createDiv("tt-abilities");
      [s.abilityStrength, s.abilityDexterity, s.abilityConstitution, s.abilityIntelligence, s.abilityWisdom, s.abilityCharisma].forEach((label, index) => {
        const cell = grid.createDiv("tt-ability");
        cell.createDiv({ cls: "tt-ability-name", text: label });
        cell.createDiv({ cls: "tt-ability-score", text: String(stats[index]) });
        const modifier = abilityModifier(stats[index]);
        const bonus = cell.createDiv({ cls: "tt-ability-modifier tt-die", text: signed(modifier), attr: { title: s.rollAbilityTitle } });
        bonus.onclick = () => onRoll(`d20${signed(modifier)}`, roll(signed(modifier)));
      });
    }

    const info = element.createDiv("tt-card-info");
    const line = (label: string, value?: string): void => {
      if (!value) return;
      const item = info.createDiv("tt-line");
      item.createSpan({ cls: "tt-line-label", text: label + " " });
      highlight(item.createSpan(), value);
    };
    line(s.lineSaves, savesText(statblock.saves));
    line(s.lineSkills, savesText(statblock.skillsaves));
    line(s.lineVulnerabilities, statblock.damage_vulnerabilities);
    line(s.lineResistances, statblock.damage_resistances);
    line(s.lineImmunities, statblock.damage_immunities);
    line(s.lineConditionImmunities, statblock.condition_immunities);
    line(s.lineSenses, statblock.senses);
    line(s.lineLanguages, statblock.languages);
    if (statblock.cr != null) line(s.lineChallenge, format(s.challengeValue, { cr: statblock.cr, xp: experienceForChallenge(statblock.cr) }));

    const section = (title: string, traits?: Trait[]): void => {
      if (!traits?.length) return;
      const block = element.createDiv("tt-section");
      block.createDiv({ cls: "tt-section-title", text: title });
      for (const trait of traits) {
        const paragraph = block.createDiv("tt-trait");
        paragraph.createSpan({ cls: "tt-trait-name", text: (trait.name ?? "") + ". " });
        highlight(paragraph.createSpan(), String(trait.desc ?? ""));
      }
    };
    section(s.sectionTraits, statblock.traits);
    section(s.sectionActions, statblock.actions);
    section(s.sectionBonusActions, statblock.bonus_actions);
    section(s.sectionReactions, statblock.reactions);
    section(s.sectionLegendaryActions, statblock.legendary_actions);
    section(s.sectionLairActions, statblock.lair_actions);
    section(s.sectionHomebrew, statblock.homebrew_notes);
  }
}

