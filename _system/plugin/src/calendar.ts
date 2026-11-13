import { App, TFile } from "obsidian";
import { noteFields } from "./notes";

/*
 * World calendars. A world note names a Calendarium calendar (`calendar: <name>`); each run keeps its
 * own date in `World Day.md` (`world_date: YYYY-MM-DD`, month = 1-based index into the calendar's month
 * list, intercalary days included, so dates sort as plain numbers). Calendarium supplies the definition
 * (months, leap days, moons, seasons, holidays); day counting here includes every day, unlike Calendarium,
 * whose earlier-year count skips intercalary days and lets seasons drift.
 */

export interface CalendarMonth { name: string; short: string; subtitle: string; intercalary: boolean; length: number }
interface LeapRule { interval: number; exclusive: boolean }
interface LeapDay { month: number; offset: number; rules: LeapRule[] }
export interface CalendarSeason { name: string; kind: string; duration: number }
export interface CalendarEvent { name: string; month: number; day: number; description: string }
export interface WorldCalendar {
  name: string;
  months: CalendarMonth[];
  weekdays: string[];
  overflow: boolean;
  leapDays: LeapDay[];
  moons: { name: string; cycle: number; offset: number }[];
  seasons: CalendarSeason[];
  seasonOffset: number;
  weather: boolean;
  seed: number;
  events: CalendarEvent[];
  current: WorldDate | null;
}
export interface WorldDate { year: number; month: number; day: number }
export type Precipitation = "none" | "light" | "moderate" | "heavy";
export interface DayInfo {
  date: WorldDate;
  month: CalendarMonth;
  weekday: string;
  dayOfWeek: number;
  week: number;
  season: string;
  seasonKind: string;
  moons: { name: string; phase: number }[];
  events: CalendarEvent[];
  weather: { temp: number; precipitation: Precipitation; cloudy: boolean; windy: boolean; snow: boolean } | null;
}

const num = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function parseCalendar(raw: Record<string, unknown>): WorldCalendar | null {
  const stat = (raw.static ?? {}) as Record<string, unknown>;
  const months = ((stat.months ?? []) as Record<string, unknown>[]).map(month => ({
    name: String(month.name ?? ""), short: String(month.short ?? month.name ?? ""), subtitle: String(month.subtitle ?? ""),
    intercalary: month.type === "intercalary", length: Math.max(0, num(month.length)),
  }));
  if (!months.length) return null;
  const seasonal = (raw.seasonal ?? {}) as Record<string, unknown>;
  const weather = (seasonal.weather ?? {}) as Record<string, unknown>;
  const current = (raw.current ?? {}) as Record<string, unknown>;
  return {
    name: String(raw.name ?? ""),
    months,
    weekdays: ((stat.weekdays ?? []) as Record<string, unknown>[]).map(day => String(day.name ?? "")),
    overflow: stat.overflow !== false,
    leapDays: ((stat.leapDays ?? []) as Record<string, unknown>[]).map(leap => ({
      month: num(leap.timespan), offset: num(leap.offset),
      rules: ((leap.interval ?? []) as Record<string, unknown>[]).filter(rule => num(rule.interval) > 0)
        .map(rule => ({ interval: num(rule.interval), exclusive: !!rule.exclusive })).sort((a, b) => a.interval - b.interval),
    })),
    moons: ((stat.moons ?? []) as Record<string, unknown>[]).filter(moon => num(moon.cycle) > 0)
      .map(moon => ({ name: String(moon.name ?? ""), cycle: num(moon.cycle), offset: num(moon.offset) })),
    seasons: seasonal.type === "Periodic" ? ((seasonal.seasons ?? []) as Record<string, unknown>[])
      .map(season => ({ name: String(season.name ?? ""), kind: String(season.kind ?? ""), duration: num(season.duration) + num(season.peak) }))
      .filter(season => season.duration > 0) : [],
    seasonOffset: num(seasonal.offset),
    weather: !!weather.enabled,
    seed: num(weather.seed, 1),
    events: ((raw.events ?? []) as Record<string, unknown>[]).flatMap(event => {
      const date = (event.date ?? {}) as Record<string, unknown>;
      if (event.type !== "Recurring" || date.month == null || date.day == null) return [];
      return [{ name: String(event.name ?? ""), month: num(date.month), day: num(date.day), description: String(event.description ?? "") }];
    }),
    current: current.year != null && current.month != null && current.day != null ? { year: num(current.year, 1), month: num(current.month), day: num(current.day, 1) } : null,
  };
}

/** Calendarium's leap rule: rules sorted by interval, an exclusive rule cancels the one before it. */
function leapApplies(leap: LeapDay, year: number): boolean {
  const y = year - leap.offset;
  return leap.rules.some((rule, index, rules) => {
    if (rule.exclusive && index === 0) return y % rule.interval !== 0;
    if (rule.exclusive) return false;
    const next = rules[index + 1];
    return next?.exclusive ? y % rule.interval === 0 && y % next.interval !== 0 : y % rule.interval === 0;
  });
}

export function monthLength(calendar: WorldCalendar, year: number, month: number): number {
  const base = calendar.months[month]?.length ?? 0;
  return base + calendar.leapDays.filter(leap => leap.month === month && leapApplies(leap, year)).length;
}

function leapDaysBefore(calendar: WorldCalendar, year: number): number {
  let total = 0;
  for (let y = 1; y < year; y++) for (const leap of calendar.leapDays) if (leapApplies(leap, y)) total++;
  return total;
}

/** Days since 1 Jan of year 1 (every day counts, intercalary days and leap days included). */
export function daysBefore(calendar: WorldCalendar, date: WorldDate): number {
  const base = calendar.months.reduce((sum, month) => sum + month.length, 0);
  let days = date.year <= 1 ? 0 : (date.year - 1) * base + leapDaysBefore(calendar, date.year);
  for (let m = 0; m < date.month; m++) days += monthLength(calendar, date.year, m);
  return days + date.day - 1;
}

export function clampDate(calendar: WorldCalendar, date: WorldDate): WorldDate {
  const month = Math.min(Math.max(0, Math.trunc(date.month)), calendar.months.length - 1);
  const year = Math.trunc(date.year) || 1;
  const day = Math.min(Math.max(1, Math.trunc(date.day)), Math.max(1, monthLength(calendar, year, month)));
  return { year, month, day };
}

export function addDays(calendar: WorldCalendar, start: WorldDate, delta: number): WorldDate {
  let { year, month, day } = clampDate(calendar, start);
  day += Math.trunc(delta);
  while (day < 1) {
    month--;
    if (month < 0) { month = calendar.months.length - 1; year--; }
    day += monthLength(calendar, year, month);
  }
  while (day > monthLength(calendar, year, month)) {
    day -= monthLength(calendar, year, month);
    month++;
    if (month >= calendar.months.length) { month = 0; year++; }
  }
  return { year, month, day };
}

export function parseWorldDate(value: unknown): WorldDate | null {
  const match = String(value ?? "").trim().match(/^(-?\d+)-(\d{1,2})-(\d{1,2})$/);
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
}

export function formatWorldDate(date: WorldDate): string {
  return `${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/** Small deterministic PRNG so the weather of a day never changes between renders. */
function random(seed: number, day: number, salt: number): number {
  let x = (Math.imul(seed | 0, 2654435761) ^ Math.imul(day + 1, 40503) ^ Math.imul(salt, 2246822519)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Calendarium's default weather per season kind (Celsius).
const SEASON_WEATHER: Record<string, { temp: [number, number]; rain: number; intensity: number; cloudy: number; windy: number }> = {
  Winter: { temp: [-7, 2], rain: 0.5, intensity: 0.375, cloudy: 0.75, windy: 0.25 },
  Spring: { temp: [9.5, 21], rain: 0.75, intensity: 0.25, cloudy: 0.55, windy: 0.25 },
  Summer: { temp: [22, 30], rain: 0.55, intensity: 0.65, cloudy: 0.15, windy: 0.25 },
  Autumn: { temp: [1, 11], rain: 0.5, intensity: 0.25, cloudy: 0.65, windy: 0.35 },
};

export function describeDay(calendar: WorldCalendar, input: WorldDate): DayInfo {
  const date = clampDate(calendar, input);
  const month = calendar.months[date.month];
  const absolute = daysBefore(calendar, date);
  let dayOfWeek = -1;
  if (!month.intercalary && calendar.weekdays.length) {
    if (calendar.overflow) {
      const counted = absolute - calendar.months.slice(0, date.month).filter(m => m.intercalary).reduce((sum, m) => sum + m.length, 0);
      dayOfWeek = ((counted % calendar.weekdays.length) + calendar.weekdays.length) % calendar.weekdays.length;
    } else dayOfWeek = (date.day - 1) % calendar.weekdays.length;
  }
  let season = "", seasonKind = "";
  const yearLength = calendar.seasons.reduce((sum, s) => sum + s.duration, 0);
  if (yearLength > 0) {
    // Seasons follow the day of the year, so they never drift over centuries.
    const dayOfYear = absolute - daysBefore(calendar, { year: date.year, month: 0, day: 1 });
    let position = ((dayOfYear - calendar.seasonOffset) % yearLength + yearLength) % yearLength;
    for (const s of calendar.seasons) {
      if (position < s.duration) { season = s.name; seasonKind = s.kind; break; }
      position -= s.duration;
    }
  }
  const moons = calendar.moons.map(moon => {
    const cycles = (absolute - moon.offset) / moon.cycle;
    return { name: moon.name, phase: ((Math.round((cycles - Math.floor(cycles)) * 8) % 8) + 8) % 8 };
  });
  const events = calendar.events.filter(event => event.month === date.month && event.day === date.day);
  let weather: DayInfo["weather"] = null;
  const base = SEASON_WEATHER[seasonKind];
  if (calendar.weather && base) {
    // Smooth temperature: average today's roll with the previous two days.
    const roll = (d: number): number => random(calendar.seed, d, 1);
    const t = (roll(absolute) * 2 + roll(absolute - 1) + roll(absolute - 2)) / 4;
    const temp = Math.round(base.temp[0] + (base.temp[1] - base.temp[0]) * t);
    const wet = random(calendar.seed, absolute, 2) < base.rain * 0.6;
    const strength = random(calendar.seed, absolute, 3) * (0.5 + base.intensity);
    const precipitation: Precipitation = !wet ? "none" : strength < 0.35 ? "light" : strength < 0.75 ? "moderate" : "heavy";
    weather = { temp, precipitation, cloudy: wet || random(calendar.seed, absolute, 4) < base.cloudy, windy: random(calendar.seed, absolute, 5) < base.windy, snow: temp <= 0 };
  }
  return {
    date, month, weekday: dayOfWeek >= 0 ? calendar.weekdays[dayOfWeek] : "", dayOfWeek,
    week: dayOfWeek >= 0 && !calendar.overflow ? Math.floor((date.day - 1) / calendar.weekdays.length) + 1 : 0,
    season, seasonKind, moons, events, weather,
  };
}

const CALENDARIUM_DATA = "plugins/calendarium/data.json";

export async function loadCalendars(app: App): Promise<Map<string, WorldCalendar>> {
  const result = new Map<string, WorldCalendar>();
  try {
    const data = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/${CALENDARIUM_DATA}`)) as { calendars?: Record<string, unknown>[] };
    for (const raw of data.calendars ?? []) {
      const calendar = parseCalendar(raw);
      if (calendar?.name) result.set(calendar.name, calendar);
    }
  } catch { /* Calendarium missing or unreadable: no calendars */ }
  return result;
}

/** The calendar named by the world note (`calendar:` field), if Calendarium has it. */
export async function worldCalendar(app: App, world: TFile | null | undefined): Promise<WorldCalendar | null> {
  const name = world ? String(noteFields(app, world).calendar ?? "").trim() : "";
  if (!name) return null;
  return (await loadCalendars(app)).get(name) ?? null;
}
