---
type: background
system: "<%* tR += (parts => parts[0] === "Library" && parts[1] === "Mechanics" ? parts[2] : parts[0] === "Library" && parts[2] === "Mechanics" ? parts[1] : "")(tp.file.folder(true).split("/")) %>"
world: "<%* tR += (parts => parts[0] === "Worlds" && parts.length > 2 ? "[[Worlds/" + parts[1] + "/World]]" : parts[0] === "Library" && parts[2] === "Worlds" && parts.length > 4 ? "[[Library/" + parts[1] + "/Worlds/" + parts[3] + "/World]]" : "")(tp.file.folder(true).split("/")) %>"
---

# <% tp.file.title %>

## Description
