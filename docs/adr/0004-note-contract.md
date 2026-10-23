# ADR 0004: note contract

Status: proposed for 2.4.0.

## Context

Notes are the user's data and must outlive every release. Until 2.3.0 several rules lived in places that make later changes expensive:

- The assistant classifies notes by path (`Campaigns/`, `Library/Mechanics/`, `/Mechanics/`), so moving a note changes its meaning.
- A player character is `type: npc` with `subtype: pc`, or any file in a party folder, and the party size is parsed from a `## Members` list in the note body.
- A campaign doubles as its world, so several campaigns in one setting would need notes moved later.
- Saved encounters live in the plugin's `data.json`, outside the vault's notes.
- There are no agreed fields for relations such as an NPC's faction or a location's region.

GMVault is a game master's vault. Players do not read it, so the contract has no visibility field.

## Decision

### Identity is `type`, not the folder

Every GMVault note is identified by its `type` frontmatter. Folders are a recommended layout that the create buttons and Templater rules follow, never a rule the code depends on. Code reads `type` and link fields first. A path is only a fallback for notes without a `type`.

### Note types in contract v1

| `type` | Purpose | Relation fields |
| --- | --- | --- |
| `world` | A setting shared by campaigns | `calendar` |
| `campaign` | A story told in a world | `world`, `system`, `calendar` |
| `party` | A group of player characters | `campaign` |
| `pc` | A player character | `party`, `player`, `class`, `level`, `ac`, `hp`, `init_mod` |
| `run` | One table playing a campaign with a party | `campaign`, `party`, `role` |
| `session` | One play session | `run`, `date`, `world_date` |
| `state` | Lasting facts and resources of a run | `run` |
| `world-day` | The current in-world date of a run | `run` |
| `npc` | A non-player character | `world` or `campaign`, `faction`, `location`, `status` |
| `location` | A place | `world` or `campaign`, `location` (parent place), `status` |
| `faction` | A group or organisation | `world` or `campaign`, `status` |
| `lore` | History, religion, deity, culture, language and similar | `world` or `campaign`, `subtype` |
| `event` | Something that happened at an in-world date | `world` or `campaign`, `world_date`, `location` |
| `quest` | A goal the party may pursue | `campaign`, `status`, `location` |
| `encounter` | A prepared fight or scene | `campaign`, `location`, `creatures` |
| `handout` | Something shown to players | `campaign`, `file` |
| `item` | An object | `system`, or `world`/`campaign` for homebrew, `owner` |
| `creature` | A statblock | `system`, or `world`/`campaign` for homebrew |
| `spell` | A spell | `system`, or `world`/`campaign` for homebrew |
| `rules` | Rules text | `system` or `campaign`, `subtype` (`house-rule`) |
| `claim` | Uncertain information heard in play | `about`, `what`, `from`, `session`, `status` |

Relation fields hold wikilinks. `status` is free text with suggested values: `alive`, `dead`, `missing` for people; `active`, `done`, `failed` for quests. `aliases` and `tags` keep their Obsidian meaning on every type. `creatures` on an encounter is a list of `{ creature: "[[Link]]", count: n }`.

### Recommended layout

```text
Worlds/<world>/World.md, NPCs/, Locations/, Factions/, Lore/, Events/, Mechanics/
Campaigns/<campaign>/Campaign.md, Quests/, Encounters/, Handouts/, Mechanics/
Parties/<party>/Party.md, <character>.md
Runs/<run>/Run.md, State.md, World Day.md, Session YYYY-MM-DD.md
Library/Mechanics/<system>/Bestiary/, Spells/, Items/, Rules/
Library/Assets/, Calendar/, Archive/
```

A note in another folder with a correct `type` and links is equally valid. An `npc` in `Campaigns/<campaign>/NPCs/` belongs to that campaign's world through the campaign's `world` link.

### Evolution rules

1. Types and fields are only added, never renamed or given a new meaning.
2. Readers tolerate missing fields and unknown types.
3. The code never parses the note body for data. Headings in templates are prompts for the writer, not structure.
4. Earlier forms are read forever: `npc` with `subtype: pc` is a player character, `## Members` counts members when a party has no `pc` notes, and a campaign without `world` is its own world.
5. A change that would need existing notes rewritten is a new ADR and a migration, never a silent reinterpretation.

## Consequences

Existing notes keep working without a migration. Assistant scope, party members, and combat players move from path and body rules to `type` and links, with the old rules kept as fallbacks. New types arrive as templates and create buttons; features that use them, such as timelines or encounter notes in the combat tracker, can follow in later releases without changing notes. An acceptance test pins the contract: every shipped template has a known `type`, and every relation field it writes is listed here.
