# Sessions and runs

Each `Runs/<run>/` folder keeps the run record, current state, world day, and session notes together. [Home](HOME.md) can create a dated session with **New session**. Creating any other Markdown note in the run folder also starts with the session template when Templater is enabled.

## Run record

`Run.md` links the campaign and party and records the role.

```yaml
---
type: run
role: gm
campaign: "[[Campaigns/Glass/Campaign]]"
party: "[[Parties/Watch/Party]]"
---
```

## State

`State.md` holds facts and resources that persist between sessions. Its **World changes** section records what this table changed in the world.

### Two tables in one world

World and campaign notes describe the world before play. Never edit them because of what players did. Write the outcome in the run's `State.md` instead. The demo shows two tables of the Glassgate campaign:

| Note | Says |
| --- | --- |
| `Library/generic/Worlds/Glass Coast/NPCs/Ilyra.md` | Ilyra watches the Storm Gate after sunset. |
| `Runs/Glassgate-Harbor-S01/State.md` | Ilyra drowned when the Storm Gate opened at dawn. |
| `Runs/Glassgate-Clock-S02/State.md` | Ilyra joined the Clockmakers and now keeps the Storm Gate's logs. |

The assistant reads the active run's `State.md` and treats it as true where it differs from world and campaign notes. Notes of other runs stay out of its scope, so each table keeps its own story. A larger outcome can get its own note in the run folder.

```yaml
---
type: state
---
```

## World day

`World Day.md` records the current in-world date. Run and session notes embed it.

```yaml
---
type: world-day
---
```

## Session notes

**New session** creates `Session YYYY-MM-DD.md` in the run folder using the local date. Another session on the same day gets a numeric suffix. The note opens after creation. A note created directly in that folder receives the session template through Templater, except `Run.md`.

```yaml
---
type: session
run: "[[Runs/Harbor/Run]]"
date: 2026-10-21
world_date: ""
---
```

## Wrap up a session

Choose **Wrap up session** while a session note is active, or use **Wrap up** on its Look up card or a Home run card. Without an active session note, the command uses the newest session in the active run. A Google AI key must be set in Table Tools settings.

The configured Gemini chat model reads the session, `Run.md`, `State.md`, and the names, types, and statuses of notes linked from the session. Review its proposals under **World changes**, **What players know**, and **Rumours**. Every proposal starts checked and its text is editable. **Cancel** writes nothing. **Apply** appends selected facts beneath the matching headings in `State.md`, skips identical lines already there, and creates a `claim` note for each selected rumour. Each fact cites the session. Claims link back to the session and start with `status: current`.

Review proposals before applying them. The world and campaign notes are never changed by this action.

## Claims and other working notes

Player runs can keep claims about uncertain information. Insert the `claim` template with **Templater: Insert template**.

```yaml
---
type: claim
about: "[[People/Guide]]"
what: "The bridge is safe"
from: "[[People/Scout]]"
session: "[[Runs/Harbor/Session 2026-10-21]]"
status: current
---
```

Use **Templater: Insert template** for `quest`, `npc`, and `location` notes wherever they belong. The automatic run-folder rule uses the session template for new Markdown notes there. Table Tools checks `_local/templates/<kind>.md` before `_system/templates/<kind>.md` when it creates notes, so a local `session.md` can change **New session** output.
