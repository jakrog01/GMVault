# ADR 0005: system library layout

Status: proposed for 2.5.0.

## Context

ADR 0004 recommends `Worlds/<world>/` for setting material and `Library/Mechanics/<system>/` for rules, spells, creatures and items. Importing real books showed three problems:

- Worlds are in practice tied to a system. Forgotten Realms material written for D&D 5e uses 5e mechanics, and a group that also plays another system keeps its own copy.
- Everything of one kind lands in one flat folder. A city district such as "Dzielnica Morska" means nothing without its city, and religion, currency and history all end up in `Lore/`.
- Character options (classes, subclasses, races, backgrounds, feats) have no place of their own, so they are mixed with general rules.

## Decision

### Recommended layout

```text
Library/<system>/
├── Mechanics/
│   ├── Classes/<class>/<class>.md      subclasses next to it: Classes/<class>/<subclass>.md
│   ├── Races/<race>/<race>.md          subraces next to it
│   ├── Backgrounds/, Feats/
│   ├── Spells/, Bestiary/, Items/
│   └── Rules/<chapter>/
└── Worlds/<world>/
    ├── World.md
    ├── Locations/<place>/<place>.md    sub-places inside the parent's folder, recursively
    ├── Lore/<category>/                Religion, History, Culture, Peoples, Languages, Magic, Cosmology, Economy, Creatures, Other
    ├── Factions/, NPCs/, Events/
    └── Mechanics/                      world homebrew
Library/Assets/
```

A place with sub-places is a folder holding a note with the folder's name (folder note) and the sub-places. A place without sub-places may be a plain note in its parent's folder.

### Contract additions (additive, ADR 0004 evolution rule 1)

| `type` | New fields or values |
| --- | --- |
| `world` | `system` (package id) |
| `rules` | `subtype` values `class`, `subclass`, `race`, `subrace`, `background`, `feat`, `condition`; `class` (subclass to class link), `race` (subrace to race link) |
| `lore` | suggested `subtype` values `religion`, `deity`, `history`, `culture`, `language`, `magic`, `economy` |
| any | `source` (free text, the book a note came from) |

`location` on a `location` remains the parent place link. Identity stays `type` plus links; folders remain a recommendation.

### Old layout

`Worlds/<world>/` and `Library/Mechanics/<system>/` stay valid forever (ADR 0004 rule 4). Code that falls back to paths recognises both layouts. `gmvault migrate system-library` moves an existing vault to the new layout on request, with a backup and link rewriting; nothing moves without it.

## Consequences

New worlds are created under a system. A campaign keeps linking its world with `world`, now usually `[[Library/<system>/Worlds/<world>/World]]`. Templater rules, Home creation, assistant scope fallbacks, the demo and the docs follow the new layout; the old paths keep working for existing vaults.
