# Where things go

Use this map when deciding where to create a note. Names in angle brackets stand for your own names.

```text
GMVault/
|-- Active.md
|-- Home.md
|-- Library/
|   |-- <system>/
|   |   |-- Mechanics/<folders from the system package>/
|   |   |-- Worlds/<world>/
|   |   |   |-- World.md
|   |   |   |-- Locations/, NPCs/, Factions/, Events/
|   |   |   |-- Lore/<category>/
|   |   |   `-- Mechanics/
|   |   `-- Campaigns/<campaign>/
|   |       |-- Campaign.md
|   |       |-- Quests/, Encounters/, Handouts/
|   |       |-- NPCs/, Locations/, Factions/ (when no world)
|   |       `-- Lore/, Mechanics/
|   `-- Assets/
|-- Parties/<party>/Party.md, <character>.md
|-- Runs/<run>/Run.md, State.md, World Day.md, Sessions/
|-- Calendar/
|-- Archive/
|-- _local/
|-- _system/
|-- .obsidian/
`-- .gmvault/
```

| I want to add... | Put it in... | Template it gets |
| --- | --- | --- |
| World | `Library/<system>/Worlds/<world>/World.md` | `world.md` |
| World person, place, faction, event | The matching folder under the world | Matching template |
| Creature | The world's `Lore/Creatures/`, or a campaign's when there is no world | `creature.md` |
| Other lore | `Lore/<category>/` under a world or campaign | `lore.md` |
| Campaign | `Library/<system>/Campaigns/<campaign>/Campaign.md` | `campaign.md` |
| Quest, encounter, handout | The matching folder under the campaign | Matching template |
| Party, character | `Parties/<party>/` | `party.md`, `pc.md` |
| Run, session | `Runs/<run>/` | `run.md`, `session.md` |
| System mechanics | `Library/<system>/Mechanics/<folder>/` | Package layout chooses template |
| Assets | `Library/Assets/` | None |

The system package declares mechanics folders and suggests lore categories. **New world** creates only its top-level folders. **New campaign** creates the main campaign folders; it also creates NPC, location, and faction folders when no world is linked. Create lore categories as you need them. The One Ring 2e package uses `Callings/`, `Cultures/`, `Virtues/`, and `Rewards/` instead of D&D folder names.

Templater reads the merged system package and applies the matching template. `_local/templates/<kind>.md` takes precedence. Home creation also uses local templates. See [Game systems](AUTHORING-SYSTEMS.md) for layout overrides.

## Existing vaults

The earlier `Campaigns/<campaign>/`, `Worlds/<world>/`, and `Library/Mechanics/<system>/` paths remain readable. To move them with backups and rewritten links, run `node _system/bin/gmvault.mjs migrate system-library --dry-run`, then run it without `--dry-run`. Use `--system <id>` when a legacy world or campaign has no system field or linked world that identifies one. Migration refuses target collisions.

A place with sub-places can use `Locations/<place>/<place>.md` and child places in the same folder. Put map images in `Library/Assets/` (or anywhere in the vault) and link them from world and location notes using [Maps](MAPS.md).
