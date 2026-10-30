---
type: session
run: "<%* { if (app.vault.getAbstractFileByPath(tp.file.folder(true) + "/Run.md")) tR += "[[" + tp.file.folder(true) + "/Run]]"; else { const filesRun = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "run").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedRun = await tp.system.suggester(["None", ...filesRun.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesRun], false, "Choose run"); tR += pickedRun ? "[[" + pickedRun.path.slice(0, -3) + "]]" : ""; } } %>"
date: <% tp.date.now("YYYY-MM-DD") %>
world_date: ""
---

# <% tp.file.title %>

![[<% tp.file.folder(true) %>/World Day]]

## Plan

## What happened

## Loot

## Threads
