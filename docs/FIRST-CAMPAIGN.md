# Your first campaign

Follow these steps from an empty GMVault to a first played session. [Install](GETTING-STARTED.md) the vault first.

!!! tip "See a filled example first"
    Run `node _system/bin/gmvault.mjs demo install` from the vault root. Explore `Campaigns/Glassgate/`, its party, and its runs. Run `node _system/bin/gmvault.mjs demo remove` when you are ready for your own game.

1. Open **Table Tools: Home** from the ribbon or command palette. Choose **New campaign**, enter a **Name**, select a **System**, then choose **Create**. Home opens `Campaigns/<name>/Campaign.md` and creates `NPCs/`, `Locations/`, `Quests/`, and `Factions/` beside it.

2. Fill in `Campaign.md`: write the **Premise**, list the main groups under **Factions**, and add a few places under **Locations**. You can link the faction and location notes you create next.

3. In the new `NPCs/` folder, create a Markdown note for one character. Do the same for a place in `Locations/` and a task in `Quests/`. Templater applies the matching NPC, location, and quest templates on file creation and fills their `campaign` link. Add a note in `Factions/` when a group needs its own goals, members, and relations.

4. Return to **Table Tools: Home** and choose **New party**. Enter a **Name** and choose **Create**. In `Parties/<name>/Party.md`, list each character as a bullet under `## Members`.

5. Choose **New run**. Select the **Campaign**, **Party**, and **Role**, give the run a **Name**, and leave **Make active after creating** on. Choose **Create**. The new `Runs/<name>/` folder contains `Run.md`, `State.md`, and `World Day.md`; `Active.md` points to this run.

    === "Game master"

        Select **Game master** for the table that prepares campaign facts, locations, and encounters.

    === "Player"

        Select **Player** for a player record. Its assistant scope excludes GM campaign and system material; use a `claim` note for uncertain information.

6. On the run card in **Table Tools: Home**, choose **New session**. It creates and opens a dated `Session YYYY-MM-DD.md` with a plan, events, loot, and threads. Add a few beats under **Plan** before play.

7. During play, open **Open combat tracker** to add **Players** and **Enemy**, roll **Initiative**, and use **Next** to advance turns. Click a roll in a statblock or use the assistant's `roll_dice` tool for dice. Open **Open assistant** to ask about the active run, search notes, or summarise a scene.

8. After play, update the run's `State.md` with lasting facts and resources, and `World Day.md` with the current in-world date. Finish the session note's **What happened**, **Loot**, and **Threads** sections so the next session starts with a clear record.

## What next

Use [Where things go](WHERE-THINGS-GO.md) for more note types, [Sessions and runs](RUNS.md) for the run files, and [Combat tracker and dice](TABLE-TOOLS.md) for play controls. [Assistant](ASSISTANT.md) explains setup and privacy choices.
