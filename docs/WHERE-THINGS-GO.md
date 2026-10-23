# Where things go

Use this map when deciding where to create a note. Names in angle brackets stand for your own names.

```text
GMVault/
├── Active.md                    active run pointer
├── Home.md                      shipped home note
├── Campaigns/
│   └── <campaign>/
│       ├── Campaign.md          premise, factions, locations
│       ├── NPCs/                character notes
│       ├── Locations/           places
│       ├── Quests/              tasks and leads
│       ├── Factions/            groups and relations
│       └── Mechanics/           campaign homebrew rules and bestiary
├── Parties/
│   └── <party>/Party.md          roster and members
├── Runs/
│   └── <run>/
│       ├── Run.md               role, campaign, party
│       ├── State.md             lasting facts and resources
│       ├── World Day.md         current in-world date
│       ├── Session YYYY-MM-DD.md
│       └── <claim>.md           optional player claim
├── Library/
│   ├── Mechanics/<system>/Bestiary/
│   ├── Mechanics/<system>/Spells/
│   ├── Mechanics/<system>/Items/
│   └── Assets/
├── Calendar/                    calendar content
├── Archive/                     retired material
├── _local/
│   ├── templates/               your template overrides
│   ├── scripts/                 your scripts
│   └── assistant/               optional policy and skills
├── _system/                     shipped files
├── .obsidian/                   Obsidian settings and plugins
└── .gmvault/                    state, cache, backups
```

| I want to add... | Put it in... | Template it gets |
| --- | --- | --- |
| Campaign overview | `Campaigns/<campaign>/Campaign.md` | **New campaign** uses `campaign.md` |
| NPC | `Campaigns/<campaign>/NPCs/<name>.md` | Automatic `npc.md` |
| Location | `Campaigns/<campaign>/Locations/<name>.md` | Automatic `location.md` |
| Quest | `Campaigns/<campaign>/Quests/<name>.md` | Automatic `quest.md` |
| Faction | `Campaigns/<campaign>/Factions/<name>.md` | Automatic `faction.md` |
| Party and roster | `Parties/<party>/Party.md` | **New party** uses `party.md` |
| Run | `Runs/<run>/Run.md` | **New run** uses `run.md` |
| Session | `Runs/<run>/Session YYYY-MM-DD.md` | **New session** or automatic `session.md` |
| Persistent state | `Runs/<run>/State.md` | Created by **New run** |
| In-world date | `Runs/<run>/World Day.md` | Created by **New run** |
| Player claim | `Runs/<run>/<claim>.md` | Insert `claim.md` with **Templater: Insert template** |
| Creature, spell, item | `Library/Mechanics/<system>/Bestiary/`, `Spells/`, or `Items/` | Automatic `creature.md`, `spell.md`, or `item.md` |
| Rules or house rules | `Library/Mechanics/<system>/` or the campaign's `Mechanics/` folder | Choose a rules note or `rules.md` manually |
| Calendar content | `Calendar/` | No automatic template |
| Retired note | `Archive/` | No automatic template |
| Template override | `_local/templates/<kind>.md` | Your local version takes precedence for Table Tools creation |

!!! note "Automatic templates"
    Templater applies folder rules when enabled and when you create a new Markdown file in Obsidian. The four campaign templates set `campaign: "[[Campaigns/<campaign>/Campaign]]"` from the folder. Outside a campaign subfolder, that field is empty.

!!! warning "Updates replace shipped files"
    `_system/` is replaced on update. Keep your notes in the content roots and your overrides in `_local/`. [Templates and overrides](CUSTOMISING.md) explains the local layer.

Read [Your first campaign](FIRST-CAMPAIGN.md) for the creation sequence and [Sessions and runs](RUNS.md) for the run files.
