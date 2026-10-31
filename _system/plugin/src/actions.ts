import { App, Menu, SuggestModal, TFile } from "obsidian";
import type TableTools from "./main";
import { isGameNotePath, linkTarget, noteFields } from "./notes";
import { MAP_TYPES, NOTE_TYPES } from "./contract";
import { chooseMapOwner, mapOwnersFor } from "./map";

export interface NoteAction { label: string; icon: string; run: () => void }
const validTypes = new Set<string>(NOTE_TYPES);

export function noteType(app: App, file: TFile): string {
  if (file.extension !== "md" || !isGameNotePath(file.path)) return "";
  const type = String(noteFields(app, file).type ?? "");
  return validTypes.has(type) ? type : "";
}

export function noteActions(plugin: TableTools, file: TFile, type = noteType(plugin.app, file)): NoteAction[] {
  const { app, strings: s } = plugin;
  if (!type) return [];
  const actions: NoteAction[] = [];
  if (type === "session") actions.push({ label: s.wrapUp, icon: "notebook-pen", run: () => void plugin.wrapUp(undefined, file) });
  if (type === "encounter") actions.push({ label: s.encounterStart, icon: "swords", run: () => void plugin.tracker.loadEncounterNote(file) });
  if (type === "creature" || type === "npc") actions.push({ label: s.lookupAddCombat, icon: "skull", run: () => void plugin.tracker.addCreature(file, 1, true) });
  if (MAP_TYPES.includes(type) && linkTarget(noteFields(app, file).map)) actions.push({ label: s.mapOpen, icon: "map", run: () => void plugin.openMap(file) });
  const owners = mapOwnersFor(app, file);
  if (owners.length) actions.push({ label: s.mapShowOn, icon: "map-pin", run: () => chooseMapOwner(app, plugin, owners, file) });
  return actions;
}

export function addNoteActions(plugin: TableTools, menu: Menu, file: TFile): void {
  const type = noteType(plugin.app, file);
  if (!type) return;
  const actions = [...noteActions(plugin, file, type), { label: plugin.strings.lookUp, icon: "search", run: () => plugin.openLookupCard(file) }];
  for (const action of actions) menu.addItem(item => { item.setTitle(action.label).setIcon(action.icon).onClick(action.run); item.setSection?.("action"); });
}

export class NoteActionsModal extends SuggestModal<NoteAction> {
  constructor(app: App, plugin: TableTools, private readonly actions: NoteAction[]) { super(app); this.setPlaceholder(plugin.strings.noteActions); }
  getSuggestions(query: string): NoteAction[] { const q = query.trim().toLowerCase(); return this.actions.filter(action => action.label.toLowerCase().includes(q)); }
  renderSuggestion(action: NoteAction, el: HTMLElement): void { el.setText(action.label); }
  onChooseSuggestion(action: NoteAction): void { action.run(); }
}
