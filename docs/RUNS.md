# Sessions and runs

Each `Runs/<run>/` folder keeps the run record, current state, world day, and session notes together. [Table home](HOME.md) can create a dated session with **New session**. Creating any other Markdown note in the run folder also starts with the session template when Templater is enabled.

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

`State.md` holds facts and resources that persist between sessions.

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
---
```

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
