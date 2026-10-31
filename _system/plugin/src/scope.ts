import { TFile } from "obsidian";
import { App } from "obsidian";
import { GameContext } from "./context";
import { Scope, ScopePolicy, SourceKind } from "./types";
import { isBuiltInExcluded, noteFields, pathLink, resolveLink } from "./notes";
export { isBuiltInExcluded } from "./notes";

export const assistantLayerPaths = (name: string): string[] => [`_local/assistant/${name}`, `_system/assistant/${name}`];
const builtInExclusions = ["Archive/", "_local/", "_system/", ".obsidian/", ".gmvault/"];
const excluded = (path: string, prefixes: string[] = []): boolean => isBuiltInExcluded(path) || prefixes.some(prefix => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
export const defaultScopePolicy: ScopePolicy = {
  version: 1,
  exclude: [...builtInExclusions],
  gm: ["run", "state", "campaign", "party", "system", "homebrew", "house-rule", "note"],
  player: ["run", "state", "party", "note"],
};

const digest = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
};

const folderOf = (file: TFile | null | undefined): string => file?.parent?.path ?? "";

const add = (roots: { path: string; kind: SourceKind }[], enabled: SourceKind[], path: string, kind: SourceKind): void => {
  if (enabled.includes(kind) && path && !excluded(path) && !roots.some(root => root.path === path)) roots.push({ path, kind });
};

export function sourceKind(scope: Scope, path: string): SourceKind | null {
  if (excluded(path, scope.exclude) || !path.endsWith(".md")) return null;
  const root = scope.roots.filter(entry => path === entry.path || path.startsWith(`${pathLink(entry.path).slice(2, -2)}/`)).sort((left, right) => right.path.length - left.path.length)[0];
  return root?.kind ?? null;
}

export function resolveScope(context: GameContext | null, policy: ScopePolicy, app: App, campaignOverride = "", partyOverride = ""): Scope {
  const roots: { path: string; kind: SourceKind }[] = [];
  const role = context?.role ?? "gm";
  const enabled = (policy ?? defaultScopePolicy)[role];
  const exclude = [...new Set((policy ?? defaultScopePolicy).exclude ?? [])];
  const campaign = context?.campaign ?? (app.vault.getAbstractFileByPath(campaignOverride) as TFile | null);
  const party = context?.party ?? (app.vault.getAbstractFileByPath(partyOverride) as TFile | null);
  const system = context?.system ?? String(campaign ? noteFields(app, campaign).system ?? "generic" : "generic");
  const runFolder = context?.folders.run ?? "";
  const campaignFolder = context?.folders.campaign ?? folderOf(campaign);
  const world = context?.world ?? (campaign ? resolveLink(app, noteFields(app, campaign).world, campaign) ?? campaign : null);
  const worldFolder = context?.folders.world ?? folderOf(world);
  const partyFolder = context?.folders.party ?? folderOf(party);
  if (context) {
    add(roots, enabled, runFolder, "run");
    add(roots, enabled, partyFolder, "party");
    if (role === "gm") {
      add(roots, enabled, campaignFolder, "campaign");
      add(roots, enabled, worldFolder, "campaign");
      add(roots, enabled, `${campaignFolder}/Mechanics`, "homebrew");
      add(roots, enabled, `${worldFolder}/Mechanics`, "homebrew");
      add(roots, enabled, `Library/Mechanics/${system}`, "system");
      add(roots, enabled, `Library/${system}/Mechanics`, "system");
    }
  } else {
    add(roots, enabled, campaignFolder, "campaign");
    add(roots, enabled, partyFolder, "party");
  }
  const key = digest(JSON.stringify({ role, system, runFolder, campaignFolder, worldFolder, worldPath: world?.path ?? "", partyFolder, roots, enabled, exclude }));
  return { role, system, runFolder, campaignFolder, worldFolder, partyFolder, campaignPath: campaign?.path ?? "", worldPath: world?.path ?? "", roots, kinds: enabled, exclude, key };
}
