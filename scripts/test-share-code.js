// Share-code codec checks. Run from the repo root:
//   node scripts/test-share-code.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const window = {};
const context = vm.createContext({
  window,
  console,
  btoa: global.btoa,
  atob: global.atob,
  encodeURIComponent,
  decodeURIComponent,
  escape,
  unescape,
});
vm.runInContext(fs.readFileSync(path.join(root, "js/cards.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "js/share-code.js"), "utf8"), context);

const { encodeShareFor, decodeShare } = window.MHR_SHARE;
const CARDS = window.MHR_DATA.CARDS;

const REPRO =
  "1|%E9%A0%90%E8%A8%AD%E7%89%8C%E7%B5%84|I0041A0821A0861D001v22D0143D0102A0772I0422I0062I0501I0542I0521I0511I0531A002v23D0112A0711D0041A0673A0272D0022A0643I0471A0291A0081A0231A0663G0031I0011A018v21A0131";
const NO_VARIANT =
  "1|%E9%A0%90%E8%A8%AD%E7%89%8C%E7%B5%84|I0041A0821A0861D0012D0143D0102A0772I0422I0062I0501I0542I0521I0511I0531A0023D0112A0711D0041A0673A0272D0022A0643I0471A0291A0081A0231A0663G0031I0011A0181A0131";

let failed = 0;
function assert(cond, msg) {
  if (cond) return;
  failed++;
  console.error("FAIL: " + msg);
}
function total(deck) {
  let n = 0;
  deck.forEach((q) => { n += q; });
  return n;
}
function sameEntries(deck, cards) {
  const got = [...deck.entries()];
  if (got.length !== cards.length) return false;
  return cards.every(([id, qty], i) => got[i][0] === id && got[i][1] === qty);
}

const repro = decodeShare(REPRO);
assert(repro && repro.deck, "repro code should decode");
if (repro && repro.deck) {
  assert(repro.name === "預設牌組", "repro deck name, got " + repro.name);
  assert(total(repro.deck) === 50, "repro should be 50 cards, got " + total(repro.deck));
  assert(repro.deck.size === 31, "repro should be 31 types, got " + repro.deck.size);
  assert(repro.deck.get("SD03-001-V2") === 2, "SD03-001-V2 ×2, got " + repro.deck.get("SD03-001-V2"));
  assert(repro.deck.get("BP01-002-V2") === 3, "BP01-002-V2 ×3, got " + repro.deck.get("BP01-002-V2"));
  assert(repro.deck.get("BP01-018-V2") === 1, "BP01-018-V2 ×1, got " + repro.deck.get("BP01-018-V2"));
  assert(!repro.deck.has("SD03-001-V22"), "quantity digit must not become part of the variant");
  assert(encodeShareFor([...repro.deck.entries()], repro.name) === REPRO, "repro re-encodes to the same code");
}

const plain = decodeShare(NO_VARIANT);
assert(plain && plain.deck, "no-variant code should decode");
if (plain && plain.deck) {
  assert(plain.name === "預設牌組", "no-variant deck name");
  assert(total(plain.deck) === 50, "no-variant code should be 50 cards, got " + total(plain.deck));
  assert(plain.deck.size === 31, "no-variant code should be 31 types, got " + plain.deck.size);
  assert(plain.deck.get("SD03-001") === 2, "stripped code keeps base SD03-001 ×2");
  assert(plain.deck.get("BP01-002") === 3, "stripped code keeps base BP01-002 ×3");
  assert(plain.deck.get("BP01-018") === 1, "stripped code keeps base BP01-018 ×1");
  assert(![...plain.deck.keys()].some((id) => /-V\d+$/.test(id)), "no-variant code must not invent variants");
  assert(encodeShareFor([...plain.deck.entries()], plain.name) === NO_VARIANT, "no-variant code re-encodes unchanged");
}

function roundTrip(cards, name, label) {
  const code = encodeShareFor(cards, name);
  const decoded = decodeShare(code);
  assert(decoded && decoded.deck && sameEntries(decoded.deck, cards), label + " round-trip failed: " + code);
  if (name) assert(decoded && decoded.name === name, label + " name");
  else assert(decoded && decoded.name == null, label + " has no name");
  return code;
}

roundTrip([
  ["BP01-001-V2", 2],
  ["BP01-001-V3", 1],
  ["BP01-062-V4", 3],
  ["BP01-013", 1],
  ["SD03-001", 2],
], "variant mix", "variant deck");

roundTrip([
  ["SP01-004", 1],
  ["BP01-082", 3],
  ["PB01-003", 2],
  ["SD03-014", 1],
], "no variants", "non-variant deck");

// Quantity 1-9 must stay a quantity. Quantity 10-35 is a-z and must still work.
roundTrip([["BP01-001-V2", 1], ["BP01-013", 1]], "", "V2 ×1 before another card");
roundTrip([["BP01-001-V2", 9], ["SD03-001", 1]], "", "V2 ×9 is not swallowed");
roundTrip([["BP01-001-V3", 9], ["BP01-013", 1]], "", "V3 ×9");
roundTrip([["BP01-062-V4", 1]], "", "V4 ×1 at end of code");
roundTrip([["BP01-001-V2", 10], ["BP01-013", 1]], "", "V2 ×10 (a)");
roundTrip([["BP01-001-V2", 35], ["BP01-002", 1]], "", "V2 ×35 (z)");
roundTrip([["BP01-001", 10], ["BP01-013", 1]], "", "non-variant ×10");
roundTrip([["BP01-001", 31]], "", "non-variant ×31 is a bare v, not a variant marker");
roundTrip([["BP01-001-V2", 31], ["BP01-013", 1]], "", "V2 ×31 (qty char v) before another card");
roundTrip([["BP01-001", 35], ["SD01-001", 1]], "", "non-variant ×35");

// V10 is not in the card DB. The codec still has to round-trip it when the card exists.
const v10 = { id: "BP01-001-V10", card_no: "BP01-001", name: "synthetic", type: "Character" };
CARDS.push(v10);
try {
  const code9 = roundTrip([["BP01-001-V10", 9], ["BP01-013", 1]], "", "V10 ×9");
  assert(code9.indexOf("v109") !== -1, "V10 ×9 encodes as v109, got " + code9);
  const code10 = roundTrip([["BP01-001-V10", 10], ["BP01-013", 1]], "", "V10 ×10");
  assert(code10.indexOf("v10a") !== -1, "V10 ×10 encodes as v10a, got " + code10);
  const code1 = roundTrip([["BP01-001-V10", 1]], "", "V10 ×1");
  assert(code1 === "A001v101", "V10 ×1 encodes as A001v101, got " + code1);
} finally {
  CARDS.pop();
}

// Unknown ids still fall back to the legacy base64 payload (name is not wrapped
// on that path — same as the previous encoder). Known cards come back.
const legacy = encodeShareFor([["BP01-013", 2], ["NOT-A-CARD", 1]], "legacy");
assert(!legacy.startsWith("1|") && !/^[A-I]/.test(legacy), "unknown id uses legacy encoding, got " + legacy.slice(0, 24));
const legacyDecoded = decodeShare(legacy);
assert(legacyDecoded && legacyDecoded.deck.get("BP01-013") === 2, "legacy keeps known cards");
assert(legacyDecoded && !legacyDecoded.deck.has("NOT-A-CARD"), "legacy drops unknown cards");

// A truncated variant token is invalid rather than a shifted deck.
assert(decodeShare("A001v2") === null, "variant with no quantity char is invalid");

if (failed) {
  console.error(failed + " assertion(s) failed");
  process.exit(1);
}
console.log("share-code tests passed");
