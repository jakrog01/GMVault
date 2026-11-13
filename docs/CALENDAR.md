# World calendar

Each run keeps its own in-world date. The world says which calendar it uses; the run's `World Day.md` says which day it is for that table.

## How it fits together

| Where | Field | Holds |
| --- | --- | --- |
| World note (`World.md`) | `calendar` | The name of a Calendarium calendar. New worlds start with `calendar: Calendar`. |
| Campaign note without a world | `calendar` | The same, when the campaign acts as its own world. |
| `Runs/<run>/World Day.md` | `world_date` | The run's current date as `YYYY-MM-DD`. |
| Session note | `world_date` | The date the session started, copied from `World Day.md` by **New session**. |

Calendarium supplies months, weekdays, leap days, moons, seasons, and holidays. GMVault ships with no calendar defined, so you create one once per world.

## Set up a calendar

1. Open **Settings → Calendarium** and create a calendar, either from a preset or from scratch.
2. Give it a name. The simplest choice is `Calendar`, which every new world already points at.
3. If you chose another name, or the world needs a different calendar, set `calendar: <name>` in the world note's properties.
4. Open the run's `World Day.md`. The date block now shows the calendar instead of the message **No calendar for this world.**

Two worlds can share one calendar, and two runs in the same world can sit on different days.

## The date block

`World Day.md`, `Run.md`, and every session note contain a `gmvault-day` block:

````markdown
```gmvault-day
```
````

It shows the run's date with its weekday, holidays, season, moon phases, and generated weather. Use **-1 week**, **-1 day**, **+1 day**, and **+1 week** to move the date, or type a year, choose a month, and enter a day. Every change is written to `world_date` in the run's `World Day.md`, so all blocks of that run show the same day.

The block works only inside a run folder or its `Sessions/` folder. Elsewhere it says **This block belongs in a run's World Day note.**

## Where the date appears

- The **Active run** card in [Home](HOME.md) shows the same one-line summary: date, holiday, season, moons, and weather.
- The [assistant](ASSISTANT.md) receives it with the **Today** toggle.
- **New session** copies the current `world_date` into the new session note.
- The [Timeline](TABLE-TOOLS.md#timeline) sorts events and sessions by their `world_date`, and **New event** fills it from `World Day.md`.

## At the end of a session

Advance the date with the block buttons before closing the session note. The next **New session** then starts on the right day.

!!! tip "No calendar yet?"
    Write the date as a line of text in the body of `World Day.md`, such as `Third night of the siege`. Without a calendar, Home shows the first text line of that note instead of the summary. The date block and the buttons need a calendar.
