# Templates and overrides

Keep personal changes in `_local` or the content roots. The local layer mirrors shipped paths and wins during resolution, so it is the durable place for overrides that should survive updates. `Home.md` is shipped and replaced after a backup. The lean-vault migration moves old repository documentation and metadata into a named backup.

## Labels and templates

To override selected Table Tools labels, create `_local/plugins/table-tools/strings.json`. The plugin reads it at load time. Unknown keys are ignored; malformed JSON leaves the English strings active and shows a notice.

```json
{
  "combat": "Encounter",
  "openCombat": "Open encounter tracker",
  "assistant": "Game assistant"
}
```

Use `_local/templates` for local versions of templates and `_local/scripts` for private scripts. Table home reads a local template before the shipped one when creating a campaign, party, run, or session. See [Sessions and runs](RUNS.md) for the session template and the templates inserted through Templater. The rest of the `_local` mirror can hold another shipped-path override when the resolver supports it. Keep normal table notes in the declared content roots rather than in any infrastructure layer.

## Obsidian additions

Your own community plugins, themes, snippets, and their settings remain in the vault through updates. Updates reconcile only the Obsidian artifacts the manifest manages; they do not remove local plugin ids or user appearance files.

Template community plugins are an exception: the shipped template requires them to stay enabled. `doctor` checks that `community-plugins.json` is a list of strings and reports missing required template plugins. It also checks declared roots, shipped ownership, templates, bases, and the freshness of the bundled plugin, so run it after a structural customisation.

### Fantasy look

Fancy-a-Story 2.7.4 by ElsaTam (github.com/ElsaTam/obsidian-fancy-a-story) is the default theme. It is licensed under GPL-3.0; its license ships in `_system/obsidian/themes/Fancy-a-Story/LICENSE`. You can choose another theme in Settings > Appearance. GMVault keeps your theme choice and never replaces an installed Fancy-a-Story theme. The bundled Style Settings plugin is enabled by default; use it in Settings > Style Settings to adjust Fancy-a-Story's textures, colours, and other options. It is licensed under GPL-3.0; its license ships in `_system/obsidian/plugins/obsidian-style-settings/LICENSE.md`.

The `gmvault-fonts` CSS snippet bundles Cinzel and EB Garamond, including Latin and Latin Extended characters, under the OFL-1.1 license. There is nothing to install. The `gmvault-fantasy` snippet uses those fonts for sourcebook-style headings and reading text while keeping the theme's palette and textures. H1 to H3 use small capitals and a warm heading colour, with a gold rule under H3. It also styles callouts, tables, and Table Tools cards. Both snippets are enabled by default. Switch the fantasy look off in Settings > Appearance > CSS snippets; GMVault keeps that choice. Updates refresh the shipped snippet files. Put personal tweaks in your own snippet, such as `.obsidian/snippets/my-table.css`, instead of editing a shipped file; `doctor` flags changes to shipped snippets.

Add the `chapter` CSS class to a note's frontmatter to turn its first-level heading into a chapter opener: a centered title, an ornamental rule, and a drop cap on the first paragraph.

```markdown
---
cssclasses: [chapter]
---
```

Use a `[!statblock]` callout for a parchment card with red top and bottom bars:

```markdown
> [!statblock] Goblin
> Small humanoid, neutral evil
```
