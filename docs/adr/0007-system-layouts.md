# ADR 0007: system-driven layouts

Status: accepted for 2.8.0. Supersedes the folder recommendations in ADR 0005.

## Context

Imported books use different names for mechanics. Worlds and campaigns both belong to a game system. Empty fixed lore categories and a separate bestiary do not fit those books.

## Decision

A system package declares `layout.mechanics`, `layout.world`, `layout.campaign`, and suggested `layout.lore` categories. Folder entries map a path to a contract `type`; `nested` selects a child type and `create` controls Home scaffolding. The longest matching folder wins. Omitted lists inherit the generic package. A local package replaces individual layout lists while inheriting all other shipped fields.

New campaigns live in `Library/<system>/Campaigns/`. Creatures live in world or campaign `Lore/Creatures/`. New worlds create only top-level folders. A shared resolver supplies the plugin, CLI, and Templater. Legacy `Campaigns/`, `Worlds/`, and `Library/Mechanics/` paths remain readable under ADR 0004 rule 4. Migration is opt-in, backed up, and rewrites explicit links.

## Contract additions

Package `layout` is additive to the note contract. Note identity remains `type` and links. A package's folder names are recommendations and template routing, not the identity of existing notes.
