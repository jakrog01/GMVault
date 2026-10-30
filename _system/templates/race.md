---
type: race
system: "<%* tR += (parts => parts[0] === "Library" && parts[1] === "Mechanics" ? parts[2] : parts[0] === "Library" && parts[2] === "Mechanics" ? parts[1] : "")(tp.file.folder(true).split("/")) %>"
world: "<%* tR += (parts => parts[0] === "Worlds" && parts.length > 2 ? "[[Worlds/" + parts[1] + "/World]]" : parts[0] === "Library" && parts[2] === "Worlds" && parts.length > 4 ? "[[Library/" + parts[1] + "/Worlds/" + parts[3] + "/World]]" : "")(tp.file.folder(true).split("/")) %>"
subtype: "<%* tR += (parts => { let i = parts.indexOf("Races"); return i >= 0 && parts.length > i + 1 && parts[i + 1] !== tp.file.title ? "subrace" : "" })(tp.file.folder(true).split("/")) %>"
race: "<%* tR += (parts => { let j = parts.indexOf("Races"); return j >= 0 && parts.length > j + 1 && parts[j + 1] !== tp.file.title ? "[[" + parts.join("/") + "/" + parts[j + 1] + "]]" : "" })(tp.file.folder(true).split("/")) %>"
---

# <% tp.file.title %>

## Features
