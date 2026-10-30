# GMVault concepts

Four ideas explain how GMVault is organised: layers, content roots, worlds and runs, and the active run.

## Layers: what updates touch

GMVault separates files it ships from files you own, so updates never overwrite your game.

| Layer | Who owns it | Replaced on update? |
| --- | --- | --- |
| `_system/` | GMVault: templates, plugin source, scripts, bases, systems, hidden `.demo/` source | Yes, after a backup |
| `_local/` | You: template overrides, scripts, assistant policy | No |
| Content roots | You: all game notes | No |
| `.obsidian/` | Obsidian settings and plugins | Managed entries only |

!!! warning
    Never put private notes or edits in `_system/`. An update backs it up and replaces it.

**The resolver.** Table Tools looks for `_local/<path>` before `_system/<path>`. A local template with the same name wins over the shipped one. See [Templates and overrides](CUSTOMISING.md).

## Content roots

The manifest declares seven content roots. Your notes live here; updates never replace them.

| Folder | Holds |
| --- | --- |
| `Worlds/` | Legacy settings shared by campaigns; still supported |
| `Campaigns/` | Campaign stories: quests, encounters, handouts, and campaign specific notes |
| `Parties/` | Party records and rosters |
| `Runs/` | Table-specific records: sessions, state, world day |
| `Library/` | System mechanics, worlds, and shared assets |
| `Calendar/` | Calendar content for the table |
| `Archive/` | Retired material, ignored by automation and assistant indexing |

The manifest also creates `_local/templates/` and `_local/scripts/`; those are not content roots. [Where things go](WHERE-THINGS-GO.md) shows the full map.

## Worlds, campaigns, parties, and runs

- A **world** is a setting that several campaigns can share. New worlds live under `Library/<system>/Worlds/`; earlier `Worlds/` notes remain valid.
- A **campaign** is one story in a world. A campaign without a world link acts as its own world.
- A **party** is the group of characters playing it.
- A **run** is one table's game: it connects a campaign, a party, and a role (game master or player).

A note's `type` frontmatter defines its identity. The folders are a suggested layout; links such as `world`, `campaign`, and `party` connect notes wherever they live.

One campaign can have many runs, for example two groups playing the same world. World and campaign notes describe the world before play; each run's `State.md` records what that table changed. See [Two tables in one world](RUNS.md#two-tables-in-one-world).

## The active run

Make a run active when it is the game you are playing now. The active run decides which campaign, party, and state the assistant and combat tracker use.

`Active.md` at the vault root points to it. It is your state, not shipped state, so it survives updates.

## Contractual names

These note names may repeat across folders because their paths tell them apart: `Active.md`, `World.md`, `Campaign.md`, `Party.md`, `Run.md`, `State.md`, `Dashboard.md`, `Radar.md`, `World Day.md`. Generated links to them are path-qualified.

## Systems

Mechanics live under `Library/<system>/Mechanics/`; the earlier `Library/Mechanics/<system>/` layout remains valid. System packages in `_system/systems/` describe note shapes and radar requirements for a game system. They contain no published rules text or statblocks. Experiment with a local package first; see [Game systems](AUTHORING-SYSTEMS.md).

## Vault state

??? info "What lives in `.gmvault/`"
    - `.gmvault/state.json` records install identity, installed version, applied migrations, and adoption state after the first state write. A fresh release vault has no state file.
    - `.gmvault/cache/` holds local derived caches, including assistant indexing data.
    - `.gmvault/backups/` receives a timestamped copy of `_system/` before an update replaces it, and a named backup of repository files moved by the lean-vault migration.

An update may replace `_system/`, reconcile manifest-managed Obsidian artifacts, refresh the bundled plugin, and write state. It does not replace `_local/`, the seven content roots, or the root active pointer.

## Next

- [Your first campaign](FIRST-CAMPAIGN.md): create a campaign, party, and run
- [Home](HOME.md): the creation controls
- [Troubleshooting](TROUBLESHOOTING.md): when `doctor` reports a violation
