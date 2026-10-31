export const NOTE_TYPES = [
  "world", "campaign", "party", "pc", "run", "session", "state", "world-day", "npc", "location", "faction", "lore", "event", "quest", "encounter", "handout", "item", "creature", "spell", "class", "subclass", "race", "background", "feat", "rules", "claim",
] as const;
export const RULE_TYPES: readonly string[] = ["creature", "item", "spell", "rules", "class", "subclass", "race", "background", "feat"];
export const WORLD_TYPES: readonly string[] = ["world", "campaign", "npc", "location", "faction", "lore", "event", "quest", "encounter", "handout"];
export const HOME_TYPES: readonly string[] = ["world", "campaign", "run", "party", "pc", "world-day", "state", "session", "quest", "claim"];
export const PARTY_TYPES: readonly string[] = ["pc", "party"];
export const RUN_TYPES: readonly string[] = ["run", "session", "world-day"];
export const SCOPED_RULE_TYPES: readonly string[] = ["rules", "class", "subclass", "race", "background", "feat"];
export const MAP_TYPES: readonly string[] = ["world", "location"];
export const HOME_RECENT_TYPES: readonly string[] = ["npc", "location", "faction"];
