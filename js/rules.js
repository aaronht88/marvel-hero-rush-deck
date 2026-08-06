// =============================================================
// Marvel Hero Rush TCG — Deck Construction Rules
// =============================================================
// !! PLACEHOLDER GUESS based on the official Learn-to-Play
// summary (game not yet released as of 2026-08-06).
// Real rules arrive 2026-08-15. EDIT THIS FILE when confirmed.
//
// Known-confirmed facts (from official LP video):
//   - Card types: Character Card, Rush Point
//   - Character cards: 6 levels
//   - Win condition: first to fill timeline with 9 Rush Points
//
// GUESSED (mark TODO until verified):
//   - deck size, per-card copy limit, type ratio, etc.
// =============================================================

const RULES = {
  gameName: "Marvel Hero Rush TCG",

  // ---- confirmed ----
  winCondition: { rushPointsToWin: 9 },
  characterLevels: 6,

  // ---- GUESSED — verify after release ----
  deckSize: { min: 40, max: 60, _todo: "VERIFY: real deck size limit" },
  copyLimitPerCard: 4, // typical TCG default; VERIFY
  rushPointRatio: { min: 0.25, _todo: "VERIFY: required Rush Point % of deck" },

  // validation toggle: when false, deck is built freely (no hard errors)
  enforce: true,

  // ---- helpers ----
  isCharacter(card) { return card.type === "Character"; },
  isRushPoint(card) { return card.type === "Rush Point"; },
};

window.MHR_RULES = RULES;
