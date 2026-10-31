import { App, TFile, parseYaml } from "obsidian";
import { EXPERIENCE_BY_CHALLENGE } from "./rules";
import { Statblock } from "./types";
import { isGameNotePath, noteFields, resolveLink } from "./notes";


export async function readStatblock(app: App, file: TFile, onInvalid?: (path: string) => void): Promise<Statblock | null> {
  const text = await app.vault.cachedRead(file);
  const block = text.match(/```statblock\s*\n([\s\S]*?)```/);
  const fields = noteFields(app, file);
  let statblock: Statblock | null = null;
  if (block) {
    try { statblock = parseYaml(block[1]) as Statblock; } catch { onInvalid?.(file.path); }
  }
  if (!statblock && fields.monster) statblock = fields.monster as Statblock;
  if (!statblock) return null;
  if (!statblock.name) statblock.name = file.basename;
  if (statblock.cr == null && fields.cr != null) statblock.cr = String(fields.cr);
  return statblock;
}

export function experienceForChallenge(cr: string | number | undefined): number {
  if (cr == null) return 0;
  return EXPERIENCE_BY_CHALLENGE[String(cr).trim()] ?? 0;
}

export function armorClass(statblock: Statblock | undefined): number {
  if (!statblock) return 10;
  const value = parseInt(String(statblock.ac ?? 10), 10);
  return isNaN(value) ? 10 : value;
}

export function dexterityModifier(statblock: Statblock | undefined): number {
  const dexterity = statblock?.stats?.[1];
  return typeof dexterity === "number" ? Math.floor((dexterity - 10) / 2) : 0;
}

const byName = (left: TFile, right: TFile): number => left.basename.localeCompare(right.basename);


export function creatureFiles(app: App, folders: string[]): TFile[] {
  return app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path)).filter(file => {
    const fields = noteFields(app, file);
    return fields?.type === "creature" || folders.some(folder => file.path.startsWith(folder + "/"));
  }).sort(byName);
}


export function playerFiles(app: App, folder: string): TFile[] {
  const party = app.vault.getMarkdownFiles().find(file => file.path === `${folder}/Party.md` || file.path === `${folder}/${folder.split("/").pop()}.md`);
  const linked = party ? app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path)).filter(file => {
    const fields = noteFields(app, file);
    if (fields?.type !== "pc" && !(fields?.type === "npc" && fields?.subtype === "pc")) return false;
    return resolveLink(app, fields.party, file)?.path === party.path;
  }) : [];
  if (linked.length) return linked.sort(byName);
  const folderName = folder.split("/").pop() ?? "";
  return app.vault.getMarkdownFiles().filter(file => isGameNotePath(file.path)).filter(file => {
    const fields = noteFields(app, file);
    if (fields?.type === "npc" && fields?.subtype === "pc") return true;
    if (!folder || !file.path.startsWith(folder + "/")) return false;
    return file.path !== `${folder}/${folderName}.md` && file.path !== `${folder}/Party.md`;
  }).sort(byName);
}

export function savesText(value: Statblock["saves"]): string {
  if (!value) return "";
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap(entry => Object.entries(entry).map(([name, bonus]) => `${name} ${bonus >= 0 ? "+" : ""}${bonus}`)).join(", ");
}
