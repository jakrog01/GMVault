# Your first campaign

Follow these steps from an empty GMVault to a first played session. [Install](GETTING-STARTED.md) the vault first.

!!! tip "See a filled example first"
    Run `node _system/bin/gmvault.mjs demo install` from the vault root. Explore `Campaigns/Glassgate/`, its party, and its runs. Run `node _system/bin/gmvault.mjs demo remove` when you are ready for your own game.

1. Open **Open Home**. Choose **New world**, enter a **Name**, then choose **Create**. Home creates `Worlds/<name>/World.md` and folders for NPCs, locations, factions, lore, and events. Describe the setting in the world note.

2. Choose **New campaign**, enter a **Name**, choose the world in **World**, select a **System**, then choose **Create**. Home links the campaign to the world and creates `Quests/`, `Encounters/`, and `Handouts/`. Choosing **No world** instead creates the familiar NPC, location, quest, and faction folders as well.

3. Add a character or place under the world's `NPCs/` or `Locations/` folder. Templater fills the `world` link. Add a quest under the campaign's `Quests/` folder; its template fills the `campaign` link.

4. Choose **New party** and enter a **Name**. On the party card, choose **New character** for each player character. Each character note links to the party and supplies combat fields. Older party notes with a `## Members` list still show a member count.

5. Choose **New run**. Select the **Campaign**, **Party**, and **Role**, give the run a **Name**, and leave **Make active after creating** on. Choose **Create**. The new `Runs/<name>/` folder contains `Run.md`, `State.md`, and `World Day.md`; `Active.md` points to this run.

    === "Game master"

        Select **Game master** for the table that prepares campaign facts, locations, and encounters.

    === "Player"

        Select **Player** for a player record. Its assistant scope excludes GM campaign and system material; use a `claim` note for uncertain information.

6. On the run card in **Open Home**, choose **New session**. It creates and opens a dated `Session YYYY-MM-DD.md` with a plan, events, loot, and threads. Add a few beats under **Plan** before play.

7. During play, open **Open combat tracker** to add **Players** and **Enemy**, roll **Initiative**, and use **Next** to advance turns. Click a roll in a statblock or use the assistant's `roll_dice` tool for dice. Open **Open assistant** to ask about the active run, search notes, or summarise a scene.

8. After play, update the run's `State.md` with lasting facts and resources, and `World Day.md` with the current in-world date. Finish the session note's **What happened**, **Loot**, and **Threads** sections so the next session starts with a clear record.

## What next

Use [Where things go](WHERE-THINGS-GO.md) for more note types, [Sessions and runs](RUNS.md) for the run files, and [Combat tracker and dice](TABLE-TOOLS.md) for play controls. [Assistant](ASSISTANT.md) explains setup and privacy choices.
