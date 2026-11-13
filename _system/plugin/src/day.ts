import { App, MarkdownRenderChild, TFile } from "obsidian";
import type TableTools from "./main";
import { DayInfo, WorldCalendar, WorldDate, addDays, clampDate, describeDay, formatWorldDate, monthLength, parseWorldDate, worldCalendar } from "./calendar";
import { noteFields, resolveLink, runFolderOf } from "./notes";
import { format } from "./strings";

/** Calendar of the world of the run that owns the given folder (Run.md -> campaign -> world). */
export async function runCalendar(app: App, runFolder: string): Promise<WorldCalendar | null> {
  const run = app.vault.getAbstractFileByPath(`${runFolder}/Run.md`);
  if (!(run instanceof TFile)) return null;
  const campaign = resolveLink(app, noteFields(app, run).campaign, run);
  if (!campaign) return null;
  const world = resolveLink(app, noteFields(app, campaign).world, campaign) ?? campaign;
  return worldCalendar(app, world);
}

export function dayDate(app: App, day: TFile, calendar: WorldCalendar): WorldDate {
  const stored = parseWorldDate(noteFields(app, day).world_date);
  return clampDate(calendar, stored ?? calendar.current ?? { year: 1, month: 0, day: 1 });
}

const pick = (list: string, index: number): string => list.split("|")[index] ?? "";

export function dateTitle(info: DayInfo): string {
  const { date, month } = info;
  return month.intercalary && month.length <= 1 && date.day === 1 ? `${month.name} ${date.year}` : `${date.day} ${month.name} ${date.year}`;
}

export function weatherText(plugin: TableTools, info: DayInfo): string {
  const w = info.weather;
  if (!w) return "";
  const s = plugin.strings;
  const level = w.precipitation === "light" ? 0 : w.precipitation === "moderate" ? 1 : 2;
  const sky = w.precipitation !== "none" ? pick(w.snow ? s.dayWeatherSnow : s.dayWeatherRain, level) : w.cloudy ? s.dayWeatherCloudy : s.dayWeatherClear;
  return [`${w.temp}\u00b0C`, sky, w.windy ? s.dayWeatherWindy : ""].filter(Boolean).join(", ");
}

/** One-line summary used by Home and the assistant. */
export function daySummary(plugin: TableTools, info: DayInfo): string {
  const s = plugin.strings;
  return [
    dateTitle(info),
    ...info.events.map(event => event.name),
    info.season,
    ...info.moons.map(moon => format(s.dayMoon, { moon: moon.name, phase: pick(s.dayMoonPhases, moon.phase) })),
    weatherText(plugin, info),
  ].filter(Boolean).join(" \u00b7 ");
}

export async function describeRunDay(plugin: TableTools, day: TFile): Promise<DayInfo | null> {
  const calendar = await runCalendar(plugin.app, runFolderOf(day));
  return calendar ? describeDay(calendar, dayDate(plugin.app, day, calendar)) : null;
}

/** `gmvault-day` block: shows and changes the run's in-world date. */
export class DayBlock extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, private readonly plugin: TableTools, private readonly sourcePath: string) { super(containerEl); }

  onload(): void {
    this.registerEvent(this.plugin.app.metadataCache.on("changed", file => { if (file.path === this.dayPath()) void this.render(); }));
    void this.render();
  }

  private dayPath(): string {
    const source = this.plugin.app.vault.getAbstractFileByPath(this.sourcePath);
    return source instanceof TFile ? `${runFolderOf(source)}/World Day.md` : "";
  }

  private async render(): Promise<void> {
    const app = this.plugin.app;
    const s = this.plugin.strings;
    const root = this.containerEl;
    const day = app.vault.getAbstractFileByPath(this.dayPath());
    const calendar = day instanceof TFile ? await runCalendar(app, runFolderOf(day)) : null;
    root.empty();
    root.addClass("tt-day");
    if (!(day instanceof TFile)) { root.createDiv({ cls: "tt-muted", text: s.dayNoRun }); return; }
    if (!calendar) { root.createDiv({ cls: "tt-muted", text: s.dayNoCalendar }); return; }
    const info = describeDay(calendar, dayDate(app, day, calendar));
    const save = (date: WorldDate): Promise<void> => app.fileManager.processFrontMatter(day, frontmatter => {
      frontmatter.world_date = formatWorldDate(clampDate(calendar, date));
    });

    root.createDiv({ cls: "tt-day-title", text: dateTitle(info) });
    if (info.month.subtitle && !info.month.name.includes(info.month.subtitle)) root.createDiv({ cls: "tt-muted", text: info.month.subtitle });
    if (info.weekday) root.createDiv({ text: info.week ? format(s.dayWeekday, { weekday: info.weekday, week: info.week }) : format(s.dayWeekdayOnly, { weekday: info.weekday }) });
    const facts = root.createDiv("tt-day-facts");
    const fact = (label: string, value: string, title = ""): void => {
      if (!value) return;
      const row = facts.createDiv("tt-day-fact");
      row.createSpan({ cls: "tt-muted", text: `${label}: ` });
      row.createSpan({ text: value, attr: title ? { title } : {} });
    };
    for (const event of info.events) fact(s.dayHoliday, event.name, event.description);
    fact(s.daySeason, info.season);
    for (const moon of info.moons) facts.createDiv({ cls: "tt-day-fact", text: format(s.dayMoon, { moon: moon.name, phase: pick(s.dayMoonPhases, moon.phase) }) });
    fact(s.dayWeather, weatherText(this.plugin, info));

    const controls = root.createDiv("tt-day-controls");
    const week = Math.max(1, calendar.weekdays.length);
    const step = (label: string, delta: number): void => {
      const button = controls.createEl("button", { cls: "tt-btn", text: label });
      button.onclick = () => void save(addDays(calendar, info.date, delta));
    };
    step(s.dayPreviousWeek, -week);
    step(s.dayPrevious, -1);
    step(s.dayNext, 1);
    step(s.dayNextWeek, week);

    const picker = root.createDiv("tt-day-picker");
    const year = picker.createEl("input", { type: "number", value: String(info.date.year), attr: { "aria-label": s.dayYear } });
    const month = picker.createEl("select", { attr: { "aria-label": s.dayMonth } });
    calendar.months.forEach((entry, index) => month.createEl("option", { value: String(index), text: entry.name }));
    month.value = String(info.date.month);
    const dayInput = picker.createEl("input", { type: "number", value: String(info.date.day), attr: { "aria-label": s.dayDay, min: "1", max: String(monthLength(calendar, info.date.year, info.date.month)) } });
    const apply = (): void => void save({ year: Number(year.value) || info.date.year, month: Number(month.value), day: Number(dayInput.value) || 1 });
    year.onchange = apply;
    month.onchange = apply;
    dayInput.onchange = apply;
  }
}
