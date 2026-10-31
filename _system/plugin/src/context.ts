import { App, TFile } from "obsidian";
import { noteFields, resolveLink } from "./notes";

export interface GameContext {
  run: TFile;
  campaign: TFile;
  world: TFile;
  party: TFile | null;
  state: TFile | null;
  day: TFile | null;
  system: string;
  role: "gm" | "player";
  folders: { run: string; campaign: string; world: string; party: string };
}

export function resolveGameContext(app: App, pointerPath: string): GameContext | null {
  const pointer = app.vault.getAbstractFileByPath(pointerPath);
  if (!(pointer instanceof TFile)) return null;
  const run = resolveLink(app, noteFields(app, pointer).run, pointer);
  if (!run?.parent?.path) return null;
  const fields = noteFields(app, run);
  const campaign = resolveLink(app, fields.campaign, run);
  if (!campaign) return null;
  const party = resolveLink(app, fields.party, run);
  const campaignFields = noteFields(app, campaign);
  const world = resolveLink(app, campaignFields.world, campaign) ?? campaign;
  const state = app.vault.getAbstractFileByPath(`${run.parent.path}/State.md`);
  const day = app.vault.getAbstractFileByPath(`${run.parent.path}/World Day.md`);
  return {
    run, campaign, world, party, state: state instanceof TFile ? state : null, day: day instanceof TFile ? day : null,
    system: String(campaignFields.system ?? "generic"), role: String(fields.role ?? "gm").toLowerCase() === "player" ? "player" : "gm",
    folders: { run: run.parent.path, campaign: campaign.parent?.path ?? "", world: world.parent?.path ?? "", party: party?.parent?.path ?? "" },
  };
}

export function contextStamp(app: App, pointerPath: string, context: GameContext | null): string {
  const pointer = app.vault.getAbstractFileByPath(pointerPath);
  const pointerLink = pointer instanceof TFile ? noteFields(app, pointer).run : null;
  const pendingRun = !context && pointer instanceof TFile ? resolveLink(app, pointerLink, pointer) : null;
  const pendingCampaign = pendingRun ? resolveLink(app, noteFields(app, pendingRun).campaign, pendingRun) : null;
  const run = context ? noteFields(app, context.run) : null;
  const campaign = context ? noteFields(app, context.campaign) : null;
  const folder = context?.folders.run ?? "";
  return JSON.stringify([pointerPath, pointer instanceof TFile, pointerLink, pendingRun?.path, pendingCampaign?.path, context?.run.path, run?.campaign, run?.party, run?.role,
    context?.campaign.path, campaign?.world, campaign?.system, folder && !!app.vault.getAbstractFileByPath(`${folder}/State.md`), folder && !!app.vault.getAbstractFileByPath(`${folder}/World Day.md`)]);
}
