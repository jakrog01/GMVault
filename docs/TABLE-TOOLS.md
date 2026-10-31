# Combat tracker and dice

Table Tools adds the Home, Combat, and Assistant views to Obsidian.
The active run selected in [Home](HOME.md) supplies campaign, party, and system context to the other views.
Use the three ribbon icons or the command palette to open the views.

## Ribbons and commands

The house ribbon icon is labelled **Open Home** and opens Home.
The combat ribbon is **Table Tools: Combat** and opens the combat tracker.
The assistant ribbon is **Table Tools: Assistant** and opens the assistant.

| Command id | English command label | What it does |
| --- | --- | --- |
| `open-combat` | **Open combat** | Opens the combat view. |
| `open-assistant` | **Open assistant** | Opens the assistant view. |
| `open-home` | **Open Home** | Opens the home view. |
| `open-timeline` | **Open timeline** | Opens the active run's Timeline. |
| `open-map` | **Open map** | Opens the active campaign world's map, or the active world or location note's map. See [Maps](MAPS.md). |
| `look-up` | **Look up** | Finds a game note and opens its card. |
| `quick-npc` | **Quick NPC** | Creates an NPC in the active campaign or world. |
| `new-session` | **New session** | Creates and opens a dated session note for the active run, like Home's **New session**. |
| `note-actions` | **Note actions** | Lists the actions for the open game note: **Add to combat**, **Start encounter**, **Wrap up**, **Open map**, **Show on map**. Shown only when the open note has one. |
| `wrap-up-session` | **Wrap up session** | Proposes run state changes and rumours from a session note. |
| `assistant-rebuild-index` | **Assistant: rebuild index** | Rebuilds the assistant index. |
| `combat-next-turn` | **Combat: next turn** | Advances the active combat turn. |
| `combat-previous-turn` | **Combat: previous turn** | Moves the active combat turn back. |
| `combat-roll-initiative` | **Combat: roll initiative** | Rolls initiative for combat participants. |
| `combat-add-players` | **Combat: add players** | Opens the **Players** picker. |
| `combat-add-creature` | **Combat: add enemy** | Opens the **Enemy** picker. |
| `combat-start-encounter` | **Combat: start encounter** | Picks an encounter note and loads it. |
| `combat-save-encounter` | **Combat: save as encounter note** | Saves the current non-player participants as an encounter note. |
| `combat-clear` | **Combat: clear** | Clears the current combat. |
| `assistant-ask-selection` | **Assistant: ask about the selected text** | Opens the assistant and sends the editor selection; without a selection it says **Select some text first.** |

Right-click a game note in the file explorer, its tab, or the editor to get the same note actions, plus **Look up** to open its card. Other files get nothing extra.

## Combat tracker

## Look up and Quick NPC

Use **Look up** from the ribbon, command palette, or the active run card in Home. Type a name, alias, or folder name. Results from the active run, campaign, party, world, and system appear first. Enter opens a compact card with a note preview and **At this table** references from the run state and recent sessions. **Open** opens the note, **Open to the side** uses another pane, **Insert link** writes a wikilink into the editor you were using, and **Add to combat** adds an NPC or creature. Press Mod+Enter on a result to open its note directly. The card preview uses the first 60 body lines; **More** opens the full note.

Use **Quick NPC** from the command palette or Home's active run card. It starts with a random **Name** and **Trait**; use the dice buttons to reroll. **Where** chooses the linked world's `NPCs/` folder by default, or the campaign's `NPCs/` folder. Press Enter or **Create**. The NPC is created from `_local/templates/npc.md` when present, otherwise `_system/templates/npc.md`. A link is inserted at the previous editor cursor and the current note stays open. Duplicate names get a number suffix.

The shipped name and trait lists are `_system/tables/names.txt` and `_system/tables/traits.txt`. Put one entry per line in `_local/tables/names.txt` or `_local/tables/traits.txt` to replace either list. Non-empty local lists take priority; this is also where to put Polish names. The commands have no default hotkeys. To bind one, open Obsidian Settings, Hotkeys, search for **Look up** or **Quick NPC**, and assign a shortcut.

Open **Combat** from the ribbon, command palette, home card, or the **Open combat** command.
The toolbar has **Players**, **Enemy**, and **Initiative** for adding party members, adding a bestiary creature, and rolling initiative.
Before combat starts, **Start** begins round 1 and rolls initiative for participants without one.
Once active, **Previous** and **Next** move the turn; the tracker skips defeated non-player participants.
The **Round** display shows the current round or an em dash before start.
The right-side buttons are **Start encounter**, **Save as encounter note** (enabled once there is a non-player participant), **Encounter sets**, **Save to the active note**, and **New combat (clear)**.
Clearing an occupied combat asks **Clear the combat?** and requires **Clear**; an empty combat clears immediately.

### Difficulty and participant table

When there is at least one player and one enemy, the difficulty bar shows raw XP, adjusted XP, player count, and thresholds.
Its possible level names are **trivial**, **easy**, **medium**, **hard**, and **deadly**.
The participant table columns are **Init**, **Name**, **AC**, **HP**, **Damage / +heal**, and **Conditions**.
Initiative is editable in its number field; the row name also shows CR, level, and any GM note.
HP shows current and maximum values, a health bar, and temporary HP when present.
In **Damage / +heal**, enter a plain number such as `12` to deal damage, `+5` to heal, or `t 5` to set temporary hit points.
Press Enter to apply the entry; Shift+Enter makes a plain number heal instead of damage.
An invalid value shows **Enter a damage amount, +N to heal, or tN for temporary hit points.**

Condition chips display the participant's conditions and can be clicked to remove them.
Use the plus button labelled **Add condition** to choose more conditions.
Each row also has **Note, name, AC** (opens the **Edit** modal), a visibility toggle labelled **Hidden from the players** or **Visible to the players**, and **Remove**.
Click a row outside an input or button to select it for the card below.

### Cards, log, sets, and export

The selected participant's statblock card shows its note link, AC, HP, speed, abilities, saves, skills, defences, senses, languages, challenge, and available traits or actions.
Clickable ability modifiers and recognised attack bonuses roll dice and add the result to the combat log.
A selected source note without a statblock says **This note has no statblock.**; a manual participant says **Entered manually, without a statblock.**
The **Log** panel shows the most recent combat events, including additions, initiative, rounds, damage, healing, temporary HP, removals, and rolls.

An encounter set is a saved list of source-backed enemies prepared before a session.
Open **Encounter sets** to load a set, delete one, or **Save the current enemies as a set** with a name and description.
Loading adds the set's enemies to the current combat; saving stores encounter sets in Table Tools plugin data.
**Start encounter** on the toolbar (also in **Encounter sets**) loads a `type: encounter` note; **Save as encounter note** saves the current non-player participants. Starting a note loads its `creatures` entries and adds missing party players once. Missing creature links are reported together while valid creatures still load. The note writer creates `Campaigns/<campaign>/Encounters/<name>.md`, adds a number to a duplicate name, groups source-backed creatures as `creature` and `count` entries, and lists manual participants below the title. Each legacy set also has **Save as note** to copy it into a note while keeping the set. An encounter note's **Look up** card has **Start encounter**.
**Save to the active note** appends a combat callout with the initiative table and recent log to the active Markdown note.
If no note is open, the same export is copied to the clipboard and reports **No open note; the combat was copied to the clipboard.**

## Where creatures and players come from

The **Enemy** picker reads creature notes with `type: creature` and notes inside configured bestiary folders.
Without an override, those folders are `Library/Mechanics/<system>/Bestiary` and the active campaign's `Mechanics/Bestiary`.
Creatures may use a fenced `statblock` YAML block or a `monster` frontmatter value; the note basename is used when a statblock has no name.
The **Players** picker reads `type: npc` with `subtype: pc`, plus notes in the active party folder except its folder note and `Party.md`.
Party frontmatter can provide HP, AC, `init_mod`, and level; missing values can be filled in from the add-players form.
The active run determines the campaign, party, and system used by those default folders.

## Everyday flow

Add players and enemies, review the difficulty bar, then press **Start** when initiative is ready.
Use the row inputs and condition chips during play, and use **Next** or the command palette at turn changes.
Save an encounter set when a group should recur later.
Export the combat to an open session note before clearing it.
The Settings reference documents bestiary, party, hit-point, group-initiative, and attack-roll controls.
See [Assistant](ASSISTANT.md) for how combat state can be attached to a request.

## Timeline

Use **Open timeline** or **Timeline** on the active run card. It shows dated events from the campaign and its world, plus sessions from the run. Each row shows the world date, note name, type, and the real session date when present. Numeric world dates such as `-200`, `1492`, `1492-03`, and `1492-03-14 DR` sort by year, month, and day. Free-text or empty dates appear under **Undated**. Click a note name to open it. **New event** creates an event note in the world's `Events/` folder, or the campaign's when no world is linked, and fills `world_date` from `World Day.md` when available.

## GMVault updates

When Home has a recorded release newer than this vault, it shows an update banner with both versions and the CLI command. On desktop Obsidian, **Install update** runs the update through the shipped CLI; phones show the banner and command but cannot install it from Table Tools.

Follow [Keeping a vault up to date](UPDATING.md) for the full procedure, report, backup, recovery, and offline options.
