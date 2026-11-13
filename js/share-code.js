// =============================================================
// Marvel Hero Rush TCG — compact share codes
// =============================================================
// Token: [A-I] + 3-digit number + optional variant + one base36 quantity.
//   series letters are uppercase (A = BP01 … I = SP01)
//   variant, when present, is lowercase "v" + the variant digits ("v2", "v10")
//   quantity is one base36 char: "1"-"9" (1-9) or "a"-"z" (10-35)
//
// Quantity 1-9 is a digit, so "v22" is variant 2 × qty 2, not variant 22.
// The quantity char is lowercase when it is a letter, which keeps it distinct
// from the next card's uppercase series letter. A bare "v" (not followed by a
// digit) is quantity 31 on a non-variant card, not a variant marker.
// Encoder output is unchanged so codes already shared in the wild still match.

(function (root) {
  const SERIES_LETTER = { SP01: "I", EB01: "F", PB01: "G", TB01: "H", BP01: "A", SD01: "B", SD02: "C", SD03: "D", SD04: "E" };
  const LETTER_SERIES = { A: "BP01", B: "SD01", C: "SD02", D: "SD03", E: "SD04", F: "EB01", G: "PB01", H: "TB01", I: "SP01" };

  function getCard(id) {
    const cards = root.MHR_DATA && root.MHR_DATA.CARDS;
    if (!cards) return undefined;
    return cards.find((c) => c.id === id);
  }

  function encodeShareFor(cardsArr, deckName) {
    let out = "";
    for (const [id, qty] of cardsArr) {
      const m = id.match(/^(SP01|EB01|PB01|TB01|BP01|SD0[1-4])-(\d{3})(-V(\d+))?$/);
      if (!m) return encodeShareForLegacy(cardsArr); // unknown id → fall back to legacy
      out += SERIES_LETTER[m[1]] + m[2] + (m[4] ? "v" + m[4] : "") + Math.min(qty | 0, 35).toString(36);
    }
    if (deckName && deckName.trim()) {
      const n = encodeURIComponent(deckName.trim().slice(0, 60));
      out = "1|" + n + "|" + out;
    }
    return out;
  }

  function encodeShareForLegacy(cardsArr) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(cardsArr.map(([id, qty]) => [id, qty])))));
  }

  // Split "v" + digits into the variant number and the one quantity char.
  // Returns { variant, qty } or null when the token is truncated.
  function readVariantAndQty(cardsPart, i) {
    const digitStart = i;
    while (i < cardsPart.length && /\d/.test(cardsPart.charAt(i))) i++;
    const digits = cardsPart.slice(digitStart, i);
    if (!digits) return null;
    const next = cardsPart.charAt(i);
    if (next && /[a-z]/.test(next)) {
      return { variant: digits, qty: parseInt(next, 36), nextIndex: i + 1 };
    }
    // Qty 1-9 is the final digit. Everything before it is the variant number,
    // including multi-digit variants such as V10 ("v102" → V10 × 2).
    if (digits.length < 2) return null;
    return {
      variant: digits.slice(0, -1),
      qty: parseInt(digits.charAt(digits.length - 1), 36),
      nextIndex: i,
    };
  }

  function decodeShare(code) {
    try {
      const s = (code || "").trim();
      let cardsPart = s;
      let deckName = null;
      if (s.startsWith("1|")) {
        const idx = s.indexOf("|", 2);
        if (idx === -1) return null;
        deckName = s.slice(2, idx);
        try { deckName = decodeURIComponent(deckName); } catch (e) {}
        cardsPart = s.slice(idx + 1);
      }
      let m;
      if (/^[A-I]/.test(cardsPart)) {
        m = new Map();
        let i = 0;
        while (i < cardsPart.length) {
          const letter = cardsPart.charAt(i++);
          const num = cardsPart.substr(i, 3); i += 3;
          if (!LETTER_SERIES[letter] || !/^\d{3}$/.test(num)) return null;
          let id = LETTER_SERIES[letter] + "-" + num;
          let qty;
          if (cardsPart.charAt(i) === "v" && /\d/.test(cardsPart.charAt(i + 1))) {
            const parsed = readVariantAndQty(cardsPart, i + 1);
            if (!parsed || !parsed.variant) return null;
            id += "-V" + parsed.variant;
            qty = parsed.qty;
            i = parsed.nextIndex;
          } else {
            if (i >= cardsPart.length) return null;
            qty = parseInt(cardsPart.charAt(i++), 36);
          }
          if (qty > 0 && getCard(id)) m.set(id, qty);
        }
      } else {
        // legacy base64 JSON
        const arr = JSON.parse(decodeURIComponent(escape(atob(cardsPart))));
        m = new Map();
        arr.forEach(([id, qty]) => { if (getCard(id)) m.set(id, qty | 0); });
      }
      return { deck: m, name: deckName };
    } catch (e) { return null; }
  }

  root.MHR_SHARE = { encodeShareFor, decodeShare };
})(typeof window !== "undefined" ? window : globalThis);
