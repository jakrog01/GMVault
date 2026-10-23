# Changelog

## Unreleased

## 2.4.1

- GMVault Home now shows the same screen in the side panel and in `Home.md`.
- The ribbon icon, the command, the panel title and the startup setting all say Home instead of Table home or Table Tools: Home.
- Corrected the embedding model and combat row button labels in the documentation.

## 2.4.0

- GMVault notes now use `type` and links for assistant scope, party counts, and combat players, while old campaign folders and party lists continue to work.
- Added worlds, player characters, lore, events, encounters, and handouts with templates, Home creation controls, and a shared-world demo.
- Updating an existing vault creates the new `Worlds/` folder through a migration; no existing note is moved or rewritten.
- ADR 0004 records the note contract: identity by `type`, fixed relation fields, and additive-only changes.

## 2.3.0

- GMVault semantic search can run locally inside Obsidian with a multilingual model (`Xenova/multilingual-e5-small`); choose **Local (on this device)** as the embedding provider. Nothing downloads until you confirm; the model (about 130 MB) is stored once in `.gmvault/cache/models/`, shows its download progress, leaves memory after five idle minutes, and can be deleted from the settings.
- Test copies of the repository skip `node_modules`.
- A test comparing large files no longer exhausts memory when they differ.

## 2.2.0

- GMVault now gives new notes inside runs a session template.
- Home creates dated session notes from shipped or local templates.
- Added quest, NPC, location, and claim templates with a run folder guide.
- Cleaned up GMVault tests, generated artifacts, and obsolete upgrade code.
- Gemini embeddings now show API errors and offer a fetched embedding model picker.
- New campaign creates `NPCs/`, `Locations/`, `Quests/` and `Factions/`; notes created there get their template and campaign link automatically.
- The manual is reorganised into sections, with a first-campaign walkthrough and a map of where things go.

## 2.1.1

- Home opens with its title, create buttons and lists again. Its note-opening helper was named `open`, which replaced the `open` method Obsidian uses to show a view, so the view stayed blank and the console reported `e.startsWith is not a function`.
- Home and the new-run form list only your game notes; the shipped templates and demo notes in `_system/` and your templates in `_local/` no longer appear as campaigns, parties or runs.
- The GMVault test harness opens views through `View.open` as Obsidian does, so a view method that shadows an Obsidian one now fails the test suite.

## 2.1.0

- GMVault releases now contain only the files needed to open and run a vault; the package list lives in the manifest.
- Updates no longer ship the repository manual, changelog, tests, workflows, or package metadata into a vault.
- A migration moves those files from existing vaults into a named backup while preserving install identity.
- Setup instructions now begin with the release download instead of a repository clone.

## 2.0.1

- The shipped documentation and release workflows run only in a GitHub repository marked as a template, so a vault kept in its own repository no longer builds the GMVault manual or tries to publish GMVault releases.
- **Use this template** is the supported way to start a vault repository, including a private one; the README and the updating guide explain how to keep it current.
- The updating guide has a new section on keeping a vault in your own repository: commit your notes there, take releases with **Install update** or `update --latest`, and never merge the template repository into the vault.

## 2.0.0

- RPGVault is now GMVault, with releases at `jakrog01/GMVault` and the `GMVault.zip` asset.
- The CLI is `_system/bin/gmvault.mjs`; `_system/bin/rpgvault.mjs` remains a legacy alias so an RPGVault 1.2.0 update can finish.
- Local state moves from `.rpgvault/` to `.gmvault/` on the first new CLI command, preserving install identity, backups, and cache.
- The first migration renames `.rpgvault-keep` placeholders and enabled snippet names, while keeping user-edited old snippet files.
- To upgrade an RPGVault 1.2.0 vault, set `_local/release.json` to `{"repo":"jakrog01/GMVault","asset":"GMVault.zip"}` and run `node _system/bin/rpgvault.mjs update --latest` once.

## 1.2.0

- Fancy-a-Story is the default theme for new and updated vaults. The CLI installs it when the vault has none and selects it only when no theme was chosen; your own theme choice is never changed, and an installed Fancy-a-Story is never overwritten, so Obsidian's theme updates keep working.
- The bundled Style Settings plugin is enabled with the other template plugins, so the theme's textures, colours, and options can be adjusted from Settings without installing anything.
- The `rpgvault-fantasy` snippet gives notes 5e sourcebook headings: accent-coloured small capitals for H1 to H3 and a gold rule under each H3. Add `cssclasses: [chapter]` to a note for a chapter opener with an ornament and a drop cap, and use a `[!statblock]` callout for a monster-block card.
- Cinzel and EB Garamond ship inside the `rpgvault-fonts` snippet, including Polish and other Latin Extended letters, so every vault gets the headings and body font with nothing to install. They are enabled together with the fantasy snippet, and switching the fantasy snippet off stays off through updates.
- Home keeps its title and create buttons while it loads, after a demo removal, and when a note cannot be read; a read failure shows **Home data could not be read.** and logs the original error.
- An empty `run`, `campaign`, or `party` link no longer resolves to the note that contains it, so an unset `Active.md` pointer shows no active run.
- Home, combat, and assistant views restored by Obsidian as deferred tabs are loaded when opened, and a Home tab left open from the last session renders at startup.

## 1.1.0

- `rpgvault update --check` asks the release host named in `_system/manifest.json` whether a newer release exists and records the answer in `.rpgvault/state.json`; `_local/release.json` points a fork somewhere else.
- `rpgvault update --latest` downloads that release, validates the archive before touching anything, and installs it through the same path as `update --from`. Both requests have deadlines, and every refusal names its cause instead of leaking a file or network error.
- An update now installs the whole shipped layer the release provides, not only `_system`: `docs/`, `Home.md`, `README.md`, `CHANGELOG.md` and `.github/`. Shipped folders are mirrored, so a file the release does not have is removed. Everything overwritten or removed goes to `.rpgvault/backups/<timestamp>/` first, and the report names each file and the backup. Put your own notes in the content roots or `_local/`, never in `docs/`.
- `doctor` requires every path declared in `ownedGlobs` to have exactly one update handler, so the manifest cannot drift from what the updater does.
- An update whose finalisation fails now forwards the migration and doctor output, says that `_system` was already replaced, and names the backup, instead of reporting a raw child-process failure.
- Table Tools settings gained an Updates section: a **Check for updates** button and an optional daily check at startup. Both work on mobile and download nothing.
- Home shows a banner when a newer release has been found, and on the desktop an **Install update** button runs `update --latest` in a modal that streams the CLI's own report; reload Obsidian when it finishes.
- Added scoped assistant retrieval, read-only vault tools, and loadable skills.

### Upgrading from 1.0.0

Your installed 1.0.0 CLI performs this upgrade itself, so take the first hop offline:

```text
node _system/bin/rpgvault.mjs update --from /path/to/RPGVault.zip
```

That CLI discards everything finalisation prints, so the upgrade says nothing at all, whether it worked or not. Run `node _system/bin/rpgvault.mjs doctor` afterwards to see where you stand. `update --check`, `update --latest` and the wider shipped layer take effect from the next update, which 1.1.0 performs itself.

## 1.0.0

First release of the upgradeable tabletop RPG vault template.

- Shipped system in `_system/`, replaced wholesale on update; your overrides in `_local/`; your game material in `Campaigns/`, `Parties/`, `Runs/`, `Library/`, `Calendar/`, and `Archive/`.
- `rpgvault` CLI: `init`, `doctor`, `update --from` with a hand-off to the newly installed CLI and backups, installable and removable demo, and mapping-driven `adopt` for existing vaults.
- System packages for generic play, D&D 5e, and Call of Cthulhu 7e, with radar checks for missing fields, dormant quests, duplicates, and unresolved links.
- Bundled Templater and Calendarium configuration.
- Table Tools plugin: combat tracker with initiative groups, encounter difficulty, row input for damage, healing, and temporary hit points, conditions, statblock cards with clickable dice, encounter sets, and Markdown export; a Gemini assistant with run context, quick prompts, attachments, and conversation history. Every interface string can be overridden in `_local/plugins/table-tools/strings.json`.
