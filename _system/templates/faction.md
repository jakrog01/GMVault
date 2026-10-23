---
type: faction
world: "<%* tR += (parts => parts[0] === "Worlds" && parts.length > 2 ? "[[Worlds/" + parts[1] + "/World]]" : "")(tp.file.folder(true).split("/")) %>"
campaign: "<%* tR += (parts => parts[0] === "Campaigns" && parts.length > 2 ? "[[Campaigns/" + parts[1] + "/Campaign]]" : "")(tp.file.folder(true).split("/")) %>"
---

# <% tp.file.title %>

## Goals

## Members

## Relations
