// =============================================================
// Marvel Hero Rush TCG — Card Database (PLACEHOLDER / SCAFFOLD)
// =============================================================
// !! WARNING: Card data below is PLACEHOLDER based on the
// official Learn-to-Play summary (Aug 2026). Real stats,
// art, and full card text are NOT yet published (game drops
// 2026-08-15). Replace `CARDS` with real data after release.
//
// SCHEMA (field meanings):
//   id         unique card id (e.g. "MHR-001")
//   name       card name
//   type       "Character" | "Rush Point"
//   level      only for Character: 1-6 (per official "6 levels")
//   effectType only for Character: one of 3 effect families
//              (placeholder labels: "Strike" / "Defend" / "Support")
//   rarity      "Common" | "Uncommon" | "Rare" | "Super Rare" | "Secret"
//   set        set code, e.g. "B1" (Base Set 1)
//   cost       placeholder "Rush Point cost" to play the card
//   text       card text (placeholder)
//   faction    (optional) hero team / affiliation placeholder
//   art        image URL — leave "" and the UI renders a colored
//              placeholder tile with the card name
// =============================================================

const CARD_SETS = {
  B1: "Base Set 1 (Booster, 2026-08-15)",
};

const RARITIES = ["Common", "Uncommon", "Rare", "Super Rare", "Secret"];

// effect type families for Character cards (3 families per official LP)
const EFFECT_TYPES = ["Strike", "Defend", "Support"];

const CARDS = [
  // -------- Character cards (level 1-6 placeholders) --------
  { id: "MHR-001", name: "Captain America", type: "Character", level: 3, effectType: "Defend", rarity: "Rare", set: "B1", cost: 3, faction: "Avengers", text: "Placeholder: Shield wall — reduce incoming Rush damage.", art: "" },
  { id: "MHR-002", name: "Iron Man", type: "Character", level: 4, effectType: "Strike", rarity: "Rare", set: "B1", cost: 4, faction: "Avengers", text: "Placeholder: Repulsor blast — deal Rush damage.", art: "" },
  { id: "MHR-003", name: "Spider-Man", type: "Character", level: 2, effectType: "Support", rarity: "Uncommon", set: "B1", cost: 2, faction: "Avengers", text: "Placeholder: Web pull — draw a card.", art: "" },
  { id: "MHR-004", name: "Thor", type: "Character", level: 5, effectType: "Strike", rarity: "Super Rare", set: "B1", cost: 5, faction: "Avengers", text: "Placeholder: Lightning — strong Rush damage.", art: "" },
  { id: "MHR-005", name: "Black Widow", type: "Character", level: 2, effectType: "Support", rarity: "Uncommon", set: "B1", cost: 2, faction: "Avengers", text: "Placeholder: Intel — peek opponent timeline.", art: "" },
  { id: "MHR-006", name: "Hulk", type: "Character", level: 6, effectType: "Strike", rarity: "Super Rare", set: "B1", cost: 6, faction: "Avengers", text: "Placeholder: Smash — massive Rush damage.", art: "" },
  { id: "MHR-007", name: "Doctor Strange", type: "Character", level: 4, effectType: "Support", rarity: "Rare", set: "B1", cost: 4, faction: "Mystic", text: "Placeholder: Portal — move Rush Points.", art: "" },
  { id: "MHR-008", name: "Black Panther", type: "Character", level: 3, effectType: "Defend", rarity: "Rare", set: "B1", cost: 3, faction: "Wakanda", text: "Placeholder: Vibranium — negate damage.", art: "" },
  { id: "MHR-009", name: "Scarlet Witch", type: "Character", level: 5, effectType: "Support", rarity: "Super Rare", set: "B1", cost: 5, faction: "Mystic", text: "Placeholder: Chaos magic — rewrite a Rush Point.", art: "" },
  { id: "MHR-010", name: "Captain Marvel", type: "Character", level: 4, effectType: "Strike", rarity: "Rare", set: "B1", cost: 4, faction: "Avengers", text: "Placeholder: Photon blast — Rush damage.", art: "" },
  { id: "MHR-011", name: "Thanos", type: "Character", level: 6, effectType: "Strike", rarity: "Secret", set: "B1", cost: 6, faction: "Villain", text: "Placeholder: Snap — remove Rush Points.", art: "" },
  { id: "MHR-012", name: "Loki", type: "Character", level: 3, effectType: "Support", rarity: "Uncommon", set: "B1", cost: 3, faction: "Villain", text: "Placeholder: Illusion — confuse opponent.", art: "" },
  { id: "MHR-013", name: "Ultron", type: "Character", level: 5, effectType: "Defend", rarity: "Super Rare", set: "B1", cost: 5, faction: "Villain", text: "Placeholder: Swarm — fortified defense.", art: "" },
  { id: "MHR-014", name: "Hawkeye", type: "Character", level: 1, effectType: "Strike", rarity: "Common", set: "B1", cost: 1, faction: "Avengers", text: "Placeholder: Arrow — small Rush damage.", art: "" },
  { id: "MHR-015", name: "Vision", type: "Character", level: 4, effectType: "Defend", rarity: "Rare", set: "B1", cost: 4, faction: "Avengers", text: "Placeholder: Phasing — avoid a hit.", art: "" },

  // -------- Rush Point cards (resource/point placeholders) --------
  { id: "MHR-RP01", name: "Rush Point — Momentum", type: "Rush Point", level: null, effectType: null, rarity: "Common", set: "B1", cost: 0, faction: null, text: "Placeholder: +1 Rush Point to your timeline.", art: "" },
  { id: "MHR-RP02", name: "Rush Point — Surge", type: "Rush Point", level: null, effectType: null, rarity: "Common", set: "B1", cost: 0, faction: null, text: "Placeholder: +1 Rush Point, draw 1.", art: "" },
  { id: "MHR-RP03", name: "Rush Point — Overflow", type: "Rush Point", level: null, effectType: null, rarity: "Uncommon", set: "B1", cost: 0, faction: null, text: "Placeholder: +2 Rush Points this turn.", art: "" },
  { id: "MHR-RP04", name: "Rush Point — Catalyst", type: "Rush Point", level: null, effectType: null, rarity: "Uncommon", set: "B1", cost: 0, faction: null, text: "Placeholder: Boost a Character effect.", art: "" },
  { id: "MHR-RP05", name: "Rush Point — Anchor", type: "Rush Point", level: null, effectType: null, rarity: "Rare", set: "B1", cost: 0, faction: null, text: "Placeholder: Lock a timeline slot.", art: "" },
];

// expose for app.js
window.MHR_DATA = { CARDS, CARD_SETS, RARITIES, EFFECT_TYPES };
