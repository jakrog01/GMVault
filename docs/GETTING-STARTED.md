# Install

Get GMVault onto your computer and open it in Obsidian. This takes about five minutes.

!!! note "What you need"
    - [Obsidian](https://obsidian.md) on desktop
    - [Node.js](https://nodejs.org) 20 or newer, for the maintenance commands

## 1. Download and unzip

Download [GMVault.zip](https://github.com/jakrog01/GMVault/releases/latest/download/GMVault.zip) from the [latest release](https://github.com/jakrog01/GMVault/releases/latest) and unzip it.

```text
mkdir GMVault
unzip GMVault.zip -d GMVault
cd GMVault
```

The folder already holds `_system/`, `_local/`, the content folders, and the Obsidian configuration.

## 2. Open it in Obsidian

Choose **Open folder as vault** and select the `GMVault` folder. Nothing is generated; Obsidian just reads the files.

## 3. Enable the plugins

Open **Settings → Community plugins**, turn community plugins on, and enable:

| Plugin | What it does |
| --- | --- |
| `table-tools` | Home, combat tracker, dice, assistant |
| `templater-obsidian` | Fills new notes from templates |
| `calendarium` | In-world calendar |
| `obsidian-style-settings` | Appearance options |

The ids come from `.obsidian/community-plugins.json`.

## 4. Check the vault

```text
node _system/bin/gmvault.mjs doctor
```

You should see `GMVault doctor: clean (<version>)`. `doctor` only reads; it never creates content. If it reports a problem, see [Troubleshooting](TROUBLESHOOTING.md).

## 5. Optional: look at an example

```text
node _system/bin/gmvault.mjs demo install
```

This copies a small example campaign, parties, runs, library, and calendar into the vault and reports `demo installed`. Browse it, then clean up:

```text
node _system/bin/gmvault.mjs demo remove
```

`demo remove` deletes only notes with `origin: demo` in their frontmatter and the folders it emptied.

## Next

Campaigns, parties, and runs are created in Obsidian, not from the command line. Continue with [Your first campaign](FIRST-CAMPAIGN.md).

??? info "Where to read more"
    - [GMVault concepts](CONCEPTS.md): layers, content folders, and the active run
    - [Home](HOME.md): every creation form and button
    - [CLI reference](CLI.md): all maintenance commands
    - [Assistant](ASSISTANT.md): optional AI assistant setup
