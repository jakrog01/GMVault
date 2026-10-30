---
type: location
world: "<%* { if (tp.file.folder(true).split("/")[0] === "Worlds" && tp.file.folder(true).split("/").length > 2 || tp.file.folder(true).split("/")[0] === "Library" && tp.file.folder(true).split("/")[2] === "Worlds" && tp.file.folder(true).split("/").length > 4 || tp.file.folder(true).split("/")[0] === "Campaigns" && tp.file.folder(true).split("/").length > 2) tR += (parts => parts[0] === "Worlds" && parts.length > 2 ? "[[Worlds/" + parts[1] + "/World]]" : parts[0] === "Library" && parts[2] === "Worlds" && parts.length > 4 ? "[[Library/" + parts[1] + "/Worlds/" + parts[3] + "/World]]" : "")(tp.file.folder(true).split("/")); else { const filesWorld = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "world").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedWorld = await tp.system.suggester(["None", ...filesWorld.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesWorld], false, "Choose world"); tR += pickedWorld ? "[[" + pickedWorld.path.slice(0, -3) + "]]" : ""; } } %>"
campaign: "<%* tR += (parts => parts[0] === "Campaigns" && parts.length > 2 ? "[[Campaigns/" + parts[1] + "/Campaign]]" : "")(tp.file.folder(true).split("/")) %>"
location: "<%* tR += (parts => { let i = parts.indexOf("Locations"); let depth = parts.length - i - 1; let parent = i >= 0 && depth > 0 ? parts.at(parts.at(-1) === tp.file.title ? -2 : -1) : ""; if (depth === 1 && parts.at(-1) === tp.file.title) parent = ""; return parent ? "[[" + parent + "]]" : "" })(tp.file.folder(true).split("/")) %>"
---

# <% tp.file.title %>

## Description

## People

## Hooks
