# Game systems

A package lives at `_system/systems/<id>/package.json`. It names the system, declares `noteTypes` and `requiredFrontmatter`, and describes folders in `layout`. The package contains structure, not published rules text or statblocks. Keep actual notes in `Library/<system>/`.

## Layout

`layout.mechanics`, `layout.world`, and `layout.campaign` are lists of `{ "folder": "...", "type": "..." }` entries. A folder may contain `/`. The longest matching folder wins. Each type must be in `noteTypes`. An optional `nested` type applies to child notes under a named parent folder; the folder's own note keeps the main type. For example, `Classes/Wizard/Wizard.md` is a class and `Classes/Wizard/Evoker.md` is a subclass.

`create` is optional. New world and New campaign create top-level listed folders by default and skip entries with `/`. Set `create` explicitly to change that. `layout.lore` lists suggested categories; Home does not create them. The generic package supplies any omitted layout lists.

The D&D 5e package uses Classes, Races, Backgrounds, Feats, Spells, Items, and Rules. The One Ring 2e package uses Callings, Cultures, Virtues, Rewards, Items, and Rules. Creatures belong in a world or campaign's `Lore/Creatures/`. Legacy Bestiary folders remain readable.

## Local overrides

`_local/systems/<id>/package.json` merges with the shipped package. A local file can contain only a layout section. Each present layout key replaces the shipped list wholesale. For example, to rename The One Ring folders, put this in `_local/systems/tor2e/package.json`:

```json
{
  "layout": {
    "mechanics": [
      {"folder":"Rules","type":"rules"},
      {"folder":"Callings","type":"class"},
      {"folder":"Cultures","type":"race"},
      {"folder":"Virtues","type":"feat"},
      {"folder":"Treasures","type":"item"}
    ]
  }
}
```

Here `Treasures` replaces `Rewards` and `Items`; include every mechanics folder you still want. A local id with no shipped package needs a full package.

## Templates, radar, and checks

Templater dispatches from the merged layout and includes `_local/templates/<kind>.md` before the shipped template. Use path-qualified links for `World.md` and `Campaign.md`. Radar checks use `requiredFrontmatter` from the merged package. Run `node _system/bin/gmvault.mjs doctor` to check layout types and vault contracts.
