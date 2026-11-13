# Adopting an existing vault

Run `node _system/bin/gmvault.mjs adopt /path/to/source --map mapping.json` from the target vault.

The map names each folder import, plugin-data import, and calendar-definition import. Folder patterns use `*` for one path segment. Plugin settings are copied only into the target plugin `data.json`; the report lists setting names and never values.

```json
{
  "folders": [
    { "from": "Old Campaigns", "to": "Library/generic/Campaigns" },
    { "from": "Rules/*/Spells", "to": "Library/*/Mechanics/Spells", "optional": true }
  ],
  "pluginData": [
    {
      "from": ".obsidian/plugins/old-table/data.json",
      "to": "table-tools",
      "keys": { "token": "apiKey", "activeFile": "activePointerPath" },
      "rewrites": { "activePointerPath": { "Old/Current.md": "Active.md" } }
    }
  ],
  "calendar": { "from": ".obsidian/plugins/calendarium/data.json", "to": ".obsidian/plugins/calendarium/data.json" }
}
```

Map worlds and campaigns straight into `Library/<system>/`. If you import the older `Worlds/` and `Campaigns/` layout, run `node _system/bin/gmvault.mjs migrate system-library --dry-run` afterwards and then without `--dry-run`.

Entries are required unless marked `"optional": true`; a missing required source fails before the target vault changes, while a missing optional source appears in the report's `skipped` array.
If every required folder is missing but one non-dot source folder would contain a match, the failure prints that inner folder's absolute path as a wrapped-source hint.
