// =============================================================
// Marvel Hero Rush TCG — Deck Construction Rules (v2, real data)
// =============================================================
// Confirmed from official cardlist + product info (2026-08-10):
//   - All cards in the official cardlist are CHARACTER cards
//     (Rush Points are game tokens, not cards → no type ratio rule)
//   - Character cards: 6 levels (Lv1-6), Power, Attack Range 0-5
//   - Card colors (attribute): Red / Yellow / Blue / Green
//   - Sets: BP01 The Avengers (booster), SD01 REALITY / SD02 MIND /
//     SD03 SPACE / SD04 TIME (starter decks)
//   - Win condition: fill your timeline with 9 Rush Points
//
// STILL GUESSED (official rulebook not public — mark TODO):
//   - deck size (default 40-60 like most TCGs)
//   - per-card copy limit (default 4; counted per card NUMBER,
//     so alternate-art prints of the same card share the limit)
// =============================================================

const RULES = {
  gameName: "Marvel Hero Rush TCG",

  // ---- confirmed ----
  winCondition: { rushPointsToWin: 9 },
  characterLevels: 6,
  attributes: ["Red", "Yellow", "Blue", "Green"],

  // ---- GUESSED — verify when official rulebook releases ----
  deckSize: { min: 40, max: 60, _todo: "VERIFY: real deck size limit" },
  copyLimitPerCard: 4, // counted per card_no (variants share the limit); VERIFY
  // NOTE: no Rush Point ratio rule — the cardlist contains characters only.

  // validation toggle: when false, deck is built freely (no hard errors)
  enforce: true,

  // ---- helpers ----
  isCharacter(card) { return card.type === "Character"; },
};

window.MHR_RULES = RULES;
