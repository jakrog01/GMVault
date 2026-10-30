---
type: quest
status: active
campaign: "<%* { if (tp.file.folder(true).split("/")[0] === "Campaigns" && tp.file.folder(true).split("/").length > 2) tR += "[[Campaigns/" + tp.file.folder(true).split("/")[1] + "/Campaign]]"; else { const filesCampaign = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "campaign").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedCampaign = await tp.system.suggester(["None", ...filesCampaign.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesCampaign], false, "Choose campaign"); tR += pickedCampaign ? "[[" + pickedCampaign.path.slice(0, -3) + "]]" : ""; } } %>"
---

# <% tp.file.title %>

## Goal

## Leads

## Outcome
