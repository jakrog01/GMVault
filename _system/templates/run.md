---
type: run
role: gm
campaign: "<%* { const filesCampaign = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "campaign").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedCampaign = await tp.system.suggester(["None", ...filesCampaign.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesCampaign], false, "Choose campaign"); tR += pickedCampaign ? "[[" + pickedCampaign.path.slice(0, -3) + "]]" : ""; } %>"
party: "<%* { const filesParty = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "party").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedParty = await tp.system.suggester(["None", ...filesParty.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesParty], false, "Choose party"); tR += pickedParty ? "[[" + pickedParty.path.slice(0, -3) + "]]" : ""; } %>"
---

# <% tp.file.title %>

![[<% tp.file.folder(true) %>/World Day]]

## Session log
