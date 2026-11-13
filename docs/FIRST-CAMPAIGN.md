# Your first campaign

This page walks you from an empty vault to the end of your first session. [Install](GETTING-STARTED.md) the vault first. Everything below happens inside Obsidian; you do not need the command line.

!!! tip "See a filled example first"
    Run `node _system/bin/gmvault.mjs demo install` from the vault root and explore `Library/generic/Campaigns/Glassgate/`, its parties, and its runs. Run `node _system/bin/gmvault.mjs demo remove` when you are ready for your own game.

## The four things you create

| You create | It is | Lives in |
| --- | --- | --- |
| **World** | The setting: places, people, factions, history. Several campaigns can share it. | `Library/<system>/Worlds/<world>/` |
| **Campaign** | One story in that world: quests, encounters, handouts. | `Library/<system>/Campaigns/<campaign>/` |
| **Party** | The player characters. | `Parties/<party>/` |
| **Run** | One table playing one campaign with one party. It holds sessions and what this table changed. | `Runs/<run>/` |

A world is optional: a campaign without one acts as its own world. Read [GMVault concepts](CONCEPTS.md) for the reasons behind this split.

All four are created from **Home**. Open it with the house icon in the left ribbon, or the **Open Home** command (Ctrl/Cmd+P).

## Part 1: prepare the game (once)

### 1. Create the world

In Home choose **New world**, enter a **Name**, pick a **System**, and choose **Create**. Home creates `World.md` and folders for `Locations/`, `NPCs/`, `Factions/`, `Events/`, `Lore/`, and `Mechanics/`.

Write the premise in `World.md`. Add places and people as notes in the matching folders: a new note in `NPCs/` gets the NPC template, a new note in `Locations/` the location template, and so on. See [Where things go](WHERE-THINGS-GO.md) for every folder.

!!! info "Pick the system carefully"
    The system decides the folder layout and templates. Use `generic` if your game has no package; `dnd5e`, `tor2e`, and `coc7e` are also shipped.

### 2. Create the campaign

Choose **New campaign**, enter a **Name**, pick the world in **World** (the system follows), and choose **Create**. You get `Campaign.md` plus `Quests/`, `Encounters/`, and `Handouts/`. With **No world**, Home also creates `NPCs/`, `Locations/`, and `Factions/` inside the campaign.

Add the first quest as a note in `Quests/`; its template links it to the campaign.

### 3. Create the party

Choose **New party** and enter a **Name**. On the new party card, choose **New character** once per player character. Fill in HP, AC, initiative modifier, and level: the combat tracker reads them.

### 4. Create the run and make it active

Choose **New run**, enter a **Name** (for example `Harbor-S01`), and pick the **Campaign**, **Party**, and **Role**. Leave **Make active after creating** on and choose **Create**.

=== "Game master"

    Pick **Game master** when you run the game. The assistant sees the campaign, world, party, and system material.

=== "Player"

    Pick **Player** when you keep notes as a player. The assistant does not see GM campaign or system material; write uncertain information as `claim` notes.

The top of Home now shows the **Active run** card. Everything else (combat, Look up, Quick NPC, assistant, timeline) works with this run. To switch games later, choose **Make active** on another run card.

### 5. Optional: connect a calendar

To track the in-world date with weekdays, moons, seasons, and weather, create a Calendarium calendar named `Calendar` once. Follow [World calendar](CALENDAR.md).

### 6. Optional: add a map

Put a map image anywhere in the vault (for example `Library/Assets/`), open `World.md`, run **Open map**, and choose **Choose map image**. Click the map to pin places. See [Maps](MAPS.md).

## Part 2: before each session

1. In Home, choose **New session** on the active run card. A dated note opens in `Runs/<run>/Sessions/`.
2. Read the **Next session** block on the run card: the last session, people and places from it, open quests, and rumours to resolve.
3. Write a few beats under **Plan** in the session note.
4. Optional: build a fight in advance. Open the combat tracker, add enemies with **Enemy**, then choose **Save as encounter note**.

## Part 3: during the session

| You want to... | Do this |
| --- | --- |
| Find an NPC, place, or rule | **Look up** on the run card, or the **Look up** command. Enter opens a card. |
| Invent a character on the spot | **Quick NPC**: a random name and trait, created in the world's `NPCs/` with one key press. |
| Run a fight | **Open combat tracker**: **Players**, **Enemy**, then **Start**. **Next** moves the turn; type `12` to deal damage or `+5` to heal. See [Combat tracker and dice](TABLE-TOOLS.md). |
| Roll dice | Click a modifier or attack bonus in a statblock card. |
| Ask for help | **Open assistant** (needs a Google AI key): describe a scene, improvise an NPC, check a rule. See [Assistant](ASSISTANT.md). |
| Act on the open note | Right-click it or use **Note actions**: add to combat, start an encounter, open its map. |

Write what happens in the session note as you go.

## Part 4: after the session

1. Finish the session note: **What happened**, **Loot**, and **Threads**.
2. Record lasting changes in the run's `State.md`, under **World changes**. Do not edit world or campaign notes because of what the players did: they describe the world before play, and another table may share them. See [Two tables in one world](RUNS.md#two-tables-in-one-world).
3. Optional: choose **Wrap up** on the run card. The assistant proposes world changes, what the players know, and rumours; tick what is right and choose **Apply**.
4. Move the in-world date with the buttons in `World Day.md`, or edit its text if you use no calendar.

The next **New session** starts from this record.

## What next

- [Where things go](WHERE-THINGS-GO.md): a folder for every kind of note
- [Sessions and runs](RUNS.md): run files, claims, and wrap-up in detail
- [Templates and overrides](CUSTOMISING.md): change templates without losing them on update
- [Keeping a vault up to date](UPDATING.md): install new GMVault releases
