# Home

Home is your starting screen: it shows the game you are playing now and lets you create worlds, campaigns, characters, parties, runs, and sessions. The screen is the same in the side panel and in the root `Home.md` note.

Open it with the house ribbon icon or the **Open Home** command, or open `Home.md` as a note. The panel opens by default after Obsidian restores the layout; turn that off with **Open Home on startup** in [Table Tools settings](SETTINGS.md).

## Active run card

When `Active.md` points to a complete run, the **Active run** card shows:

- the run folder name and its role, **Game master** or **Player**
- the campaign, its system, and the party
- the first non-heading line of the run's world-day note

| Button | Opens |
| --- | --- |
| **Open run** | The run note |
| **Open campaign** | The campaign note |
| **Open party** | The party note |
| **Open assistant** | The assistant view |
| **Open combat tracker** | The combat tracker |
| **Look up** | Search game notes and open a card |
| **Quick NPC** | Create an NPC in the world or campaign |

## Lists

**Worlds** lists notes with `type: world`, a campaign count, and **Open world**.

**Campaigns** lists every note with `type: campaign`, its system, and **Runs: <count>**. Each card has **Open campaign**.

Runs appear under their campaign. Runs whose campaign link does not resolve appear under **Runs without a campaign**. Each run card shows its folder name, role, and party, plus two buttons:

- **Make active** rewrites the root active-run pointer and refreshes home, assistant, and combat.
- **New session** creates and opens a dated session note; see [Sessions and runs](RUNS.md).

**Parties** lists every note with `type: party` and **Members: <count>**, counting linked `pc` notes (including legacy `npc` with `subtype: pc`). If none link to the party, Home counts list items under `## Members`. Each card has **Open party** and **New character**.

!!! info "Empty or unreadable vault"
    An empty vault shows **No campaigns, runs, or parties yet.** If a note cannot be read while the lists load, Home keeps its title and create buttons and shows **Home data could not be read.**; the original error goes to the developer console.

## Create buttons

The top of the view has **New world**, **New campaign**, **New party**, and **New run**. Every form ends with **Create** and checks **Name** before writing anything.

??? warning "Name rules and errors"
    A name cannot be blank or contain `\\`, `/`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, `#`, `^`, `[` or `]`.

    - Invalid input reports **Enter a valid name.**
    - An existing destination reports **That folder already contains a note.**

### New world

Asks for **Name**. It creates `Worlds/<name>/World.md` and `NPCs/`, `Locations/`, `Factions/`, `Lore/`, and `Events/`.

### New campaign

Asks for **Name**, **System**, and **World**. Choose a world note or **No world**. The System dropdown lists installed system packages and starts with `generic` when available.

It creates:

```text
Campaigns/<name>/
├── Campaign.md     type: campaign, with the chosen system and world link
├── Quests/
├── Encounters/
└── Handouts/
```

With **No world**, Home also creates `NPCs/`, `Locations/`, and `Factions/`. New notes in these folders get their template automatically; see [Where things go](WHERE-THINGS-GO.md). The created note opens and the Home screen refreshes.

### New party

Asks only for **Name**. It creates `Parties/<name>/Party.md` with `type: party`, opens it, and refreshes the Home screen.

### New character

On a party card, choose **New character** and enter **Name**. Home creates `Parties/<party>/<name>.md` from `pc.md` with a link to the party.

### New run

Asks for **Name**, **Role**, **Campaign**, **Party**, and **Make active after creating**.

- **Role** offers **Game master** and **Player**.
- **Campaign** and **Party** list notes by their `type` frontmatter. Both are required, otherwise the form reports **Choose both a campaign and a party for the run.**
- **Make active after creating** starts on, so the new run also updates `Active.md`. Turn it off for preparation material that should not become the current run.

It creates `Runs/<name>/Run.md` with role, campaign, and party links, plus `State.md` and `World Day.md`.

## Update banner

When a recorded update is newer than the installed GMVault, the top of the view shows its version and the command to run.

1. On desktop Obsidian, choose **Install update**. A report headed **Installing GMVault update** streams the CLI output.
2. Success ends with **Update complete. Reload Obsidian to use the new version.**
3. Failure shows **GMVault update failed.** and stays open so you can copy the output.

On a phone the banner names the command, but there is no install button.

## Templates used by the forms

The forms and **New session** read the matching `_local/templates/<kind>.md` first, and fall back to the matching file in `_system/templates/`.

They replace the title and folder Templater values, remove other Templater commands, keep non-form frontmatter, and write a complete note. Put vault-specific changes in `_local/templates/`; updates replace `_system` but leave `_local` alone.

## Next

- [Your first campaign](FIRST-CAMPAIGN.md): the whole first-hour sequence
- [Combat tracker and dice](TABLE-TOOLS.md): add campaign and party records to combat
- [Assistant](ASSISTANT.md): GM and player scopes after making a run active
- [Install](GETTING-STARTED.md): if the vault is not set up yet
