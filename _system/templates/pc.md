---
type: pc
party: "<%* { if (tp.file.folder(true).split("/")[0] === "Parties" && tp.file.folder(true).split("/").length > 1) tR += "[[Parties/" + tp.file.folder(true).split("/")[1] + "/Party]]"; else { const filesParty = app.vault.getMarkdownFiles().filter(file => file.path.split("/").every(part => !part.startsWith(".") && part !== "_system" && part !== "_local") && app.metadataCache.getFileCache(file)?.frontmatter?.type === "party").sort((a, b) => (a.parent?.path ?? "").localeCompare(b.parent?.path ?? "") || a.path.localeCompare(b.path)); const pickedParty = await tp.system.suggester(["None", ...filesParty.map(file => (file.parent?.path ?? "Vault") + " / " + file.basename)], [null, ...filesParty], false, "Choose party"); tR += pickedParty ? "[[" + pickedParty.path.slice(0, -3) + "]]" : ""; } } %>"
player: ""
species: ""
class: ""
subclass: ""
background: ""
alignment: ""
level: 1
ac: 10
hp: 10
hp_max: 10
speed: 9
init_mod: 0
prof_bonus: 2
passive_perception: 10
spell_dc: ""
str: 10
dex: 10
con: 10
int: 10
wis: 10
cha: 10
---

# <% tp.file.title %>

> [!statblock] <% tp.file.title %>
> *Species, Class (Subclass), level 1, Background*
>
> | AC | HP | Speed | Init | Prof | Passive Perception |
> |:-:|:-:|:-:|:-:|:-:|:-:|
> | 10 | 10 / 10 | 9 m | +0 | +2 | 10 |
>
> | STR | DEX | CON | INT | WIS | CHA |
> |:-:|:-:|:-:|:-:|:-:|:-:|
> | 10 (+0) | 10 (+0) | 10 (+0) | 10 (+0) | 10 (+0) | 10 (+0) |
>
> **Saving Throws** 
>
> **Skills** 
>
> **Senses** 
>
> **Languages** 

## Features and Traits

## Attacks and Spells

## Equipment

## Appearance

## Background

## Goals

## GM Notes
