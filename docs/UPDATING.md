# Keeping a vault up to date

This page is the owner procedure for moving a vault to a released version. The command reference documents every flag; maintainers cutting releases should read [Maintaining releases](UPGRADING.md).

## Keep your vault in your own repository

Start with the [release zip](https://github.com/jakrog01/GMVault/releases/latest/download/GMVault.zip) and unzip it. In the vault folder, create your own repository and add its private remote:

```text
git init
git remote add origin <private-remote-url>
git add .
git commit -m "Start GMVault vault"
```

Commit your notes there as usual. Never merge the template repository into your vault. Take each release with **Install update** in Home or `node _system/bin/gmvault.mjs update --latest`, then commit the result.

## See whether a release exists

In Table Tools settings, choose **Check for updates** to ask the configured release host without downloading anything. If you prefer automatic checks, enable **Check once a day**; after Obsidian restores its layout, it checks at most once every 24 hours and stays quiet when there is no newer version or the host cannot be reached.

When a newer release has been recorded, Home shows a banner with the installed and available versions. From a terminal, run the explicit check at any time:

```text
node _system/bin/gmvault.mjs update --check
```

It reports either the available version and the install command or that the vault is current. It does not replace files.

## Install the release

On desktop Obsidian, choose **Install update** in Home's banner. The button runs the same latest-release command and keeps its report visible if it fails. After a successful report, choose whether to reload Obsidian. On phones, copy the displayed command and run it on a machine that can open the vault.

```text
node _system/bin/gmvault.mjs update --latest
```

For an offline or air-gapped vault, download `GMVault.zip` from the release page and install that archive instead:

```text
node _system/bin/gmvault.mjs update --from /path/to/GMVault.zip
```

Add `--dry-run` to either installation path to preview replacements and migrations without writing the vault.

## Know what changes

An update replaces `_system/` and the shipped `Home.md`. Managed Obsidian artifacts are reconciled, pending migrations run, the bundled plugin is refreshed, and the final check runs. The lean-vault migration moves old repository files into `.gmvault/backups/2026-10-20-lean-vault/`.

Your `_local` layer and content roots are never replaced. Local community plugins and their files stay local. Before a replacement or removal, the updater saves the affected shipped material under `.gmvault/backups/<timestamp>`.

## Read the report and recover when needed

The report labels each shipped entry as `replaced`, `unchanged`, or `kept`; previews say `would replace` or `would remove`. A successful update includes migration output and ends with the clean `doctor` result.

If finalisation fails, the shipped layer was already replaced and the report names its backup directory. Read the forwarded migration and doctor output, fix the reported problem, and run `node _system/bin/gmvault.mjs doctor`. Restoring the named backup is your decision because migrations may already have run.

## First update from 1.0.0

A vault still using the 1.0.0 CLI cannot use `update --check` or `update --latest`. Its one-off first hop is an offline `update --from` installation of a complete release. That old CLI discards the finalisation report, so run `doctor` afterwards. Once this refresh succeeds, later updates can use the settings check, banner, and latest-release command.
