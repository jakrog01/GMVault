# GMVault

Download [`GMVault.zip` from the latest release](https://github.com/jakrog01/GMVault/releases/latest/download/GMVault.zip), unzip it, and open the folder as a vault in Obsidian. Enable community plugins when Obsidian asks. You can also browse [all releases](https://github.com/jakrog01/GMVault/releases).

GMVault is an Obsidian vault for running tabletop RPG campaigns. It gives you one Home screen for your worlds, campaigns, parties, and tables, plus a combat tracker with dice, quick look-up cards, a random NPC generator, interactive maps, a world calendar, and an optional AI assistant that reads your notes.

## Quick start

1. Download and unzip the release, then open the folder in Obsidian with **Open folder as vault**.
2. Turn on community plugins in **Settings → Community plugins**.
3. Open **Home** (house icon in the ribbon) and create a **New world**, a **New campaign**, a **New party**, and a **New run**.
4. On the active run card choose **New session**, and play.

The [Your first campaign](docs/FIRST-CAMPAIGN.md) guide walks through every step.

## Where your notes live

| Folder | Holds | Updated by GMVault? |
| --- | --- | --- |
| `Library/<system>/` | Mechanics, worlds, and campaigns for each game system | Never |
| `Parties/`, `Runs/`, `Calendar/`, `Archive/` | Your parties, tables and sessions, calendar notes, retired material | Never |
| `_local/` | Your template, string, and system overrides | Never |
| `_system/` | GMVault itself | Replaced on update, after a backup |

## Updating

Choose **Install update** in Home when it shows a newer version, or run `node _system/bin/gmvault.mjs update --latest` from the vault folder. The updater backs up affected files in `.gmvault/backups/` and never touches your notes. See [Keeping a vault up to date](docs/UPDATING.md).

## Documentation

Read the [GMVault manual](https://jakrog01.github.io/GMVault/) or its [source index](docs/README.md) for setup, play, customisation, and updates.

Cloning or using this repository as a template is for contributing to GMVault itself, not for running a game. Contributors should start with [Architecture](docs/ARCHITECTURE.md) and [Maintaining releases](docs/UPGRADING.md).
