---
type: rules
system: "<%* tR += (parts => parts[0] === "Library" && parts[1] === "Mechanics" ? parts[2] : parts[0] === "Library" && parts[2] === "Mechanics" ? parts[1] : "")(tp.file.folder(true).split("/")) %>"
world: "<%* tR += (parts => parts[0] === "Worlds" && parts.length > 2 ? "[[Worlds/" + parts[1] + "/World]]" : parts[0] === "Library" && parts[2] === "Worlds" && parts.length > 4 ? "[[Library/" + parts[1] + "/Worlds/" + parts[3] + "/World]]" : "")(tp.file.folder(true).split("/")) %>"
subtype: "<%* tR += (parts => { let i = parts.indexOf("Mechanics"); let section = i >= 0 ? parts[i + 1] : ""; return parts[0] !== "Library" ? "house-rule" : section === "Classes" ? (parts.at(-1) !== tp.file.title ? "subclass" : "class") : section === "Races" ? (parts.at(-1) !== tp.file.title ? "subrace" : "race") : section === "Backgrounds" ? "background" : section === "Feats" ? "feat" : "" })(tp.file.folder(true).split("/")) %>"
class: "<%* tR += (parts => parts.includes("Classes") && parts.at(-1) !== tp.file.title ? "[[" + parts.join("/") + "/" + parts.at(-1) + "]]" : "")(tp.file.folder(true).split("/")) %>"
race: "<%* tR += (parts => parts.includes("Races") && parts.at(-1) !== tp.file.title ? "[[" + parts.join("/") + "/" + parts.at(-1) + "]]" : "")(tp.file.folder(true).split("/")) %>"
---

# <% tp.file.title %>

## Rule
