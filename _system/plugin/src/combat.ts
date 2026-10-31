import { MarkdownView, Notice, TFile } from "obsidian";
import type TableTools from "./main";
import { describeRoll, roll, Roll, signed } from "./dice";
import { DifficultyLevel, encounterMultiplier, THRESHOLDS } from "./rules";
import { armorClass, dexterityModifier, experienceForChallenge, playerFiles, readStatblock } from "./statblock";
import { conditionLabel, format, Strings } from "./strings";
import { Combat, EncounterMember, EncounterSet, Participant } from "./types";
import { createNote, linkTarget, noteFields, pathLink, quotedLink, resolveLink } from "./notes";
export const COMBAT_VIEW = "tt-combat";
const DYING = "dying";
const LOG_LIMIT = 200;
const uid = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export function newCombat(name = "Encounter"): Combat {
  return { name, active: false, round: 0, turn: 0, participants: [], log: [] };
}
export function sortedParticipants(combat: Combat): Participant[] {
  return [...combat.participants].sort((left, right) => {
    const leftInitiative = left.initiative ?? -999, rightInitiative = right.initiative ?? -999;
    if (rightInitiative !== leftInitiative) return rightInitiative - leftInitiative;
    if (left.kind !== right.kind) return left.kind === "player" ? -1 : 1;
    return right.modifier - left.modifier;
  });
}
export interface Difficulty { xp: number; adjustedXp: number; level: DifficultyLevel; thresholds: number[]; players: number }
export interface PlayerInput { name: string; ac: number; hp: number; modifier: number; level: number; source?: string }
export class CombatTracker {
  constructor(private readonly plugin: TableTools) {}
  get combat(): Combat { return this.plugin.combat; }
  private get strings(): Strings { return this.plugin.strings; }
  private changed(): void {
    void this.plugin.save();
    this.plugin.refreshViews();
  }
  log(entry: string): void {
    this.combat.log.push(entry);
    if (this.combat.log.length > LOG_LIMIT) this.combat.log.shift();
  }
  async addCreature(file: TFile, quantity: number, shareInitiative: boolean): Promise<void> {
    const statblock = await readStatblock(this.plugin.app, file, path => new Notice(format(this.strings.invalidStatblock, { path })));
    const fields = noteFields(this.plugin.app, file);
    const baseName = statblock?.name ?? file.basename;
    const existing = this.combat.participants.filter(participant => participant.group === baseName || participant.name === baseName).length;
    const modifier = dexterityModifier(statblock ?? undefined);
    const groupInitiative = shareInitiative && this.plugin.settings.groupInitiative ? roll(signed(modifier)).total : null;
    for (let index = 0; index < quantity; index++) {
      const hpMax = statblock?.hit_dice && !this.plugin.settings.useAverageHitPoints
        ? (roll(statblock.hit_dice).total || statblock.hp || 10)
        : (statblock?.hp ?? 10);
      const cr = statblock?.cr != null ? String(statblock.cr) : fields.cr != null ? String(fields.cr) : undefined;
      this.combat.participants.push({
        id: uid(),
        name: quantity > 1 || existing > 0 ? `${baseName} ${existing + index + 1}` : baseName,
        kind: "enemy",
        initiative: groupInitiative ?? (this.combat.active ? roll(signed(modifier)).total : null),
        modifier,
        ac: armorClass(statblock ?? undefined),
        hpMax, hp: hpMax, temporaryHp: 0, conditions: [], note: "", hidden: false,
        group: quantity > 1 ? baseName : undefined,
        source: file.path,
        statblock: statblock ?? undefined,
        cr,
        xp: experienceForChallenge(cr),
      });
    }
    this.log(format(this.strings.logAdded, { name: baseName, quantity }));
    this.changed();
  }
  addPlayer(input: PlayerInput): boolean {
    if (this.combat.participants.some(participant => participant.name === input.name && participant.kind === "player")) {
      new Notice(format(this.strings.playerAlreadyInCombat, { name: input.name }));
      return false;
    }
    this.combat.participants.push({
      id: uid(), name: input.name, kind: "player", initiative: null, modifier: input.modifier, ac: input.ac,
      hpMax: input.hp, hp: input.hp, temporaryHp: 0, conditions: [], note: "", hidden: false, source: input.source, level: input.level,
    });
    this.changed();
    return true;
  }
  rollInitiative(onlyMissing = false): void {
    const groups = new Map<string, number>();
    for (const participant of this.combat.participants) {
      if (onlyMissing && participant.initiative != null) continue;
      if (participant.group && this.plugin.settings.groupInitiative) {
        if (!groups.has(participant.group)) groups.set(participant.group, roll(signed(participant.modifier)).total);
        participant.initiative = groups.get(participant.group) ?? null;
      } else participant.initiative = roll(signed(participant.modifier)).total;
    }
    this.log(this.strings.logInitiative);
    this.changed();
  }
  start(): void {
    const missing = this.combat.participants.filter(participant => participant.initiative == null);
    if (missing.length) {
      this.rollInitiative(true);
      new Notice(format(this.strings.initiativeRolledFor, { names: missing.map(participant => participant.name).join(", ") }));
    }
    this.combat.active = true;
    this.combat.round = 1;
    this.combat.turn = 0;
    this.log(format(this.strings.logRound, { round: 1 }));
    this.changed();
  }
  advance(step = 1): void {
    if (!this.combat.active) return;
    const order = sortedParticipants(this.combat);
    if (!order.length) return;
    let turn = this.combat.turn, guard = 0;
    do {
      turn += step;
      if (turn >= order.length) { turn = 0; this.combat.round++; this.log(format(this.strings.logRound, { round: this.combat.round })); }
      if (turn < 0) { turn = order.length - 1; this.combat.round = Math.max(1, this.combat.round - 1); }
      guard++;
    } while (guard < order.length && order[turn].kind !== "player" && order[turn].hp <= 0);
    this.combat.turn = turn;
    this.combat.selected = order[turn].id;
    this.changed();
  }
  applyDamage(participant: Participant, amount: number): void {
    if (amount > 0) {
      let remaining = amount;
      if (participant.temporaryHp > 0) {
        const absorbed = Math.min(participant.temporaryHp, remaining);
        participant.temporaryHp -= absorbed;
        remaining -= absorbed;
      }
      participant.hp = Math.max(0, participant.hp - remaining);
      this.log(format(this.strings.logDamage, { name: participant.name, amount, hp: participant.hp, max: participant.hpMax }));
      if (participant.hp === 0) {
        this.log(format(this.strings.logFalls, { name: participant.name }));
        if (participant.kind === "player" && !participant.conditions.includes(DYING)) participant.conditions.push(DYING);
      }
    } else if (amount < 0) {
      participant.hp = Math.min(participant.hpMax, participant.hp - amount);
      participant.conditions = participant.conditions.filter(condition => condition !== DYING);
      this.log(format(this.strings.logHealing, { name: participant.name, amount: -amount, hp: participant.hp, max: participant.hpMax }));
    }
    this.changed();
  }
  setTemporaryHitPoints(participant: Participant, amount: number): void {
    participant.temporaryHp = Math.max(participant.temporaryHp, amount);
    this.log(format(this.strings.logTemporary, { name: participant.name, amount: participant.temporaryHp }));
    this.changed();
  }
  applyRowInput(participant: Participant, raw: string, heal = false): boolean {
    const value = raw.trim().toLowerCase();
    if (!value) return true;
    const temporary = value.match(/^t\s*(\d+)$/);
    if (temporary) { this.setTemporaryHitPoints(participant, Number(temporary[1])); return true; }
    if (!/^\+?\d+$/.test(value)) { new Notice(this.strings.invalidAmount); return false; }
    const amount = Number(value.replace(/^\+/, ""));
    this.applyDamage(participant, value.startsWith("+") || heal ? -amount : amount);
    return true;
  }
  toggleCondition(participant: Participant, condition: string): void {
    participant.conditions = participant.conditions.includes(condition)
      ? participant.conditions.filter(value => value !== condition)
      : [...participant.conditions, condition];
    this.changed();
  }
  setHidden(participant: Participant, hidden: boolean): void {
    participant.hidden = hidden;
    this.changed();
  }
  update(participant: Participant, changes: Partial<Pick<Participant, "name" | "ac" | "hpMax" | "modifier" | "level" | "kind" | "note">>): void {
    Object.assign(participant, changes);
    participant.hp = Math.min(participant.hp, participant.hpMax);
    this.changed();
  }
  setInitiative(participant: Participant, initiative: number | null): void {
    participant.initiative = initiative;
    this.changed();
  }
  select(participant: Participant): void {
    this.combat.selected = participant.id;
    void this.plugin.save();
    this.plugin.refreshViews();
  }
  remove(participant: Participant): void {
    const order = sortedParticipants(this.combat);
    const index = order.findIndex(entry => entry.id === participant.id);
    this.combat.participants = this.combat.participants.filter(entry => entry.id !== participant.id);
    if (this.combat.active && index !== -1 && index < this.combat.turn) this.combat.turn--;
    if (this.combat.turn >= this.combat.participants.length) this.combat.turn = 0;
    if (this.combat.selected === participant.id) this.combat.selected = undefined;
    this.log(format(this.strings.logRemoved, { name: participant.name }));
    this.changed();
  }
  clear(): void {
    this.plugin.combat = newCombat(this.strings.defaultCombatName);
    this.changed();
  }
  logRoll(participant: Participant, result: Roll): string {
    const description = describeRoll(result, { critical: this.strings.rollCritical, naturalOne: this.strings.rollNaturalOne });
    this.log(format(this.strings.logRoll, { name: participant.name, roll: description }));
    this.changed();
    return description;
  }
  difficulty(): Difficulty | null {
    const players = this.combat.participants.filter(participant => participant.kind === "player");
    const enemies = this.combat.participants.filter(participant => participant.kind === "enemy");
    if (!players.length || !enemies.length) return null;
    const xp = enemies.reduce((sum, participant) => sum + (participant.xp ?? 0), 0);
    const adjustedXp = Math.round(xp * encounterMultiplier(enemies.length));
    const thresholds = [0, 0, 0, 0];
    for (const player of players) {
      const row = THRESHOLDS[Math.min(20, Math.max(1, player.level || 1))];
      for (let index = 0; index < 4; index++) thresholds[index] += row[index];
    }
    const level: DifficultyLevel = adjustedXp >= thresholds[3] ? "deadly" : adjustedXp >= thresholds[2] ? "hard"
      : adjustedXp >= thresholds[1] ? "medium" : adjustedXp >= thresholds[0] ? "easy" : "trivial";
    return { xp, adjustedXp, level, thresholds, players: players.length };
  }
  difficultyLabel(level: DifficultyLevel): string {
    return { trivial: this.strings.difficultyTrivial, easy: this.strings.difficultyEasy, medium: this.strings.difficultyMedium, hard: this.strings.difficultyHard, deadly: this.strings.difficultyDeadly }[level];
  }
  summary(): string {
    if (!this.combat.participants.length) return "";
    const lines = sortedParticipants(this.combat).map((participant, index) => {
      const current = this.combat.active && index === this.combat.turn ? "> " : "";
      const conditions = participant.conditions.length ? ` [${participant.conditions.join(", ")}]` : "";
      const temporary = participant.temporaryHp ? `+${participant.temporaryHp}` : "";
      const note = participant.note ? ` - ${participant.note}` : "";
      return `${current}${participant.name} (${participant.kind}) - initiative ${participant.initiative ?? "?"}, AC ${participant.ac}, HP ${participant.hp}/${participant.hpMax}${temporary}${conditions}${note}`;
    });
    const status = this.combat.active ? "" : " (not started)";
    return `Combat "${this.combat.name}", round ${this.combat.round}${status}:\n${lines.join("\n")}\nRecent events:\n${this.combat.log.slice(-8).join("\n")}`;
  }
  exportMarkdown(): string {
    const rows = sortedParticipants(this.combat).map(participant => {
      const name = participant.source ? `${pathLink(participant.source.split("/").pop() ?? "").slice(0, -2)}\\|${participant.name}]]` : participant.name;
      const conditions = participant.conditions.map(condition => conditionLabel(this.strings, condition)).join(", ");
      return `| ${participant.initiative ?? ""} | ${name} | ${participant.ac} | ${participant.hp}/${participant.hpMax} | ${conditions} |`;
    });
    const difficulty = this.difficulty();
    const difficultyText = difficulty ? format(this.strings.exportDifficulty, { level: this.difficultyLabel(difficulty.level), xp: difficulty.xp }) : "";
    const heading = format(this.strings.exportHeading, { name: this.combat.name, round: this.combat.round });
    const log = this.combat.log.slice(-12).map(entry => `- ${entry}`).join("\n> ");
    return `\n> [!note]- ${heading}${difficultyText}\n> ${this.strings.exportColumns}\n> |---|---|---|---|---|\n${rows.map(row => "> " + row).join("\n")}\n>\n> ${log}\n`;
  }
  async exportToActiveNote(): Promise<void> {
    const markdown = this.exportMarkdown();
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file ?? this.plugin.app.workspace.getActiveFile();
    if (!file) {
      await navigator.clipboard?.writeText?.(markdown);
      new Notice(this.strings.exportCopied);
      return;
    }
    await this.plugin.app.vault.append(file, markdown);
    new Notice(format(this.strings.exportSaved, { note: file.basename }));
  }
  saveEncounterSet(name: string, description: string): boolean {
    const enemies = this.combat.participants.filter(participant => participant.kind === "enemy" && participant.source);
    if (!enemies.length) return false;
    const members = new Map<string, EncounterMember>();
    for (const participant of enemies) {
      const source = participant.source as string;
      const member = members.get(source) ?? { source, name: participant.group ?? participant.name, quantity: 0, group: !!participant.group };
      member.quantity++;
      members.set(source, member);
    }
    this.plugin.encounterSets.push({ name: name || this.strings.defaultSetName, description, members: [...members.values()] });
    void this.plugin.save();
    new Notice(this.strings.encounterSetSaved);
    return true;
  }
  async loadEncounterSet(set: EncounterSet): Promise<void> {
    for (const member of set.members) {
      const file = this.plugin.app.vault.getAbstractFileByPath(member.source);
      if (file instanceof TFile) await this.addCreature(file, member.quantity, member.group);
      else new Notice(format(this.strings.noteMissing, { path: member.source }));
    }
  }
  async loadEncounterNote(note: TFile): Promise<void> {
    const entries = noteFields(this.plugin.app, note).creatures;
    const missing: string[] = [];
    if (Array.isArray(entries)) for (const entry of entries) {
      const path = linkTarget(entry?.creature);
      const file = resolveLink(this.plugin.app, entry?.creature, note);
      const count = Number(entry?.count);
      if (file instanceof TFile && noteFields(this.plugin.app, file).type === "creature") await this.addCreature(file, Number.isFinite(count) && count > 0 ? Math.floor(count) : 1, true);
      else if (path) missing.push(path);
    }
    const context = this.plugin.context();
    if (context) for (const file of playerFiles(this.plugin.app, this.plugin.partyPath())) {
      if (this.combat.participants.some(participant => participant.kind === "player" && (participant.source === file.path || participant.name === file.basename))) continue;
      const fields = noteFields(this.plugin.app, file);
      this.addPlayer({ name: file.basename, ac: Number(fields.ac ?? 10), hp: Number(fields.hp ?? 10), modifier: Number(fields.init_mod ?? 0), level: Number(fields.level ?? 1), source: file.path });
    }
    if (missing.length) new Notice(format(this.strings.encounterMissing, { links: missing.join(", ") }));
  }
  async saveEncounterNote(name: string, participants: Participant[] = this.combat.participants.filter(participant => participant.kind !== "player")): Promise<TFile | null> {
    const title = name.trim();
    if (!title || /[\\/:*?"<>|#^\[\]]/.test(title)) { new Notice(this.strings.homeInvalidName); return null; }
    const campaign = this.plugin.context()?.campaign;
    if (!campaign) { new Notice(this.strings.encounterNeedsCampaign); return null; }
    const folder = `${campaign.parent?.path ?? "Campaigns"}/Encounters`;
    const counts = new Map<string, number>();
    const manual: string[] = [];
    for (const participant of participants) {
      const source = participant.source ? this.plugin.app.vault.getAbstractFileByPath(participant.source) : null;
      if (source instanceof TFile && noteFields(this.plugin.app, source).type === "creature") counts.set(source.path, (counts.get(source.path) ?? 0) + 1);
      else manual.push(participant.name);
    }
    const rows = [...counts].map(([source, count]) => `  - creature: "${pathLink(source)}"\n    count: ${count}`);
    const file = await createNote(this.plugin.app, { template: "encounter", folder, name: title, values: {
      type: "encounter", campaign: quotedLink(campaign), creatures: rows.length ? `\n${rows.join("\n")}` : "[]",
    }, body: manual.map(value => `- ${value}`).join("\n") });
    new Notice(format(this.strings.encounterNoteSaved, { name: file.basename }));
    return file;
  }
  deleteEncounterSet(set: EncounterSet): void {
    this.plugin.encounterSets = this.plugin.encounterSets.filter(entry => entry !== set);
    void this.plugin.save();
  }
}
