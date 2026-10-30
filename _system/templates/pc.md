---
type: pc
party: "<%* { if (tp.file.folder(true).split("/")[0] === "Parties" && tp.file.folder(true).split("/").length > 1) tR += "[[Parties/" + tp.file.folder(true).split("/")[1] + "/Party]]"; else { const filesParty = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "party").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedParty = await tp.system.suggester(["None", ...filesParty.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesParty], false, "Choose party"); tR += pickedParty ? "[[" + pickedParty.path.slice(0, -3) + "]]" : ""; } } %>"
player: ""
class: ""
level: ""
ac: ""
hp: ""
init_mod: ""
---

# <% tp.file.title %>

## Appearance

## Background

## Goals
