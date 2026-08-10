// =============================================================
// Marvel Hero Rush TCG — Deck Builder (real card data)
// =============================================================
// Depends on: cards.js (window.MHR_DATA), rules.js (window.MHR_RULES)

(function () {
  const { CARDS, RARITIES, CARD_SETS, ATTRIBUTES } = window.MHR_DATA;
  const RULES = window.MHR_RULES;

  // deck state: Map<cardId, count>
  let deck = new Map();

  // ---------- DOM refs ----------
  const $ = (sel) => document.querySelector(sel);
  const cardGrid = $("#card-grid");
  const deckListEl = $("#deck-list");
  const deckCountEl = $("#deck-count");
  const validationEl = $("#deck-validation");
  const statsEl = $("#deck-stats");
  const searchEl = $("#search");
  const filterSet = $("#filter-set");
  const filterRarity = $("#filter-rarity");
  const filterLevel = $("#filter-level");
  const filterRange = $("#filter-range");
  const filterAttr = $("#filter-attr");
  const shareText = $("#share-text");
  const toastEl = $("#toast");

  // ---------- init filters ----------
  Object.keys(CARD_SETS).forEach((s) => {
    const o = document.createElement("option");
    o.value = s; o.textContent = CARD_SETS[s]; filterSet.appendChild(o);
  });
  RARITIES.forEach((r) => {
    const o = document.createElement("option");
    o.value = r; o.textContent = r; filterRarity.appendChild(o);
  });
  for (let lv = 1; lv <= RULES.characterLevels; lv++) {
    const o = document.createElement("option");
    o.value = String(lv); o.textContent = "Lv " + lv; filterLevel.appendChild(o);
  }
  for (let rng = 0; rng <= 5; rng++) {
    const o = document.createElement("option");
    o.value = String(rng); o.textContent = "範圍 " + rng; filterRange.appendChild(o);
  }
  ATTRIBUTES.forEach((a) => {
    const o = document.createElement("option");
    o.value = a; o.textContent = a; filterAttr.appendChild(o);
  });

  // ---------- helpers ----------
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toastEl.hidden = true), 1800);
  }

  function getCard(id) { return CARDS.find((c) => c.id === id); }

  const ATTR_LABEL = { Red: "紅", Yellow: "黃", Blue: "藍", Green: "綠" };

  function cardMatches(card) {
    const q = searchEl.value.trim().toLowerCase();
    const set = filterSet.value;
    const rar = filterRarity.value;
    const lv = filterLevel.value;
    const rng = filterRange.value;
    const attr = filterAttr.value;
    if (set && card.set !== set) return false;
    if (rar && card.rarity !== rar) return false;
    if (lv && String(card.level) !== lv) return false;
    if (rng && String(card.attackRange) !== rng) return false;
    if (attr && card.attribute !== attr) return false;
    if (q) {
      const hay = (card.name + " " + card.card_no + " " + (card.feature || "") + " " + (card.effect || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  // ---------- render card browser ----------
  function renderCards() {
    cardGrid.innerHTML = "";
    const list = CARDS.filter(cardMatches);
    if (!list.length) {
      cardGrid.innerHTML = '<p style="color:var(--muted)">無吻合卡片。</p>';
      return;
    }
    list.forEach((card) => {
      const inDeck = deck.get(card.id) || 0;
      const el = document.createElement("div");
      el.className = "card attr-" + card.attribute;
      el.innerHTML = `
        <div class="art"><img loading="lazy" src="${card.art}" alt="${card.name}" onerror="this.style.display='none'"></div>
        <div class="meta">
          <div class="cname" title="${card.name}">${card.name}</div>
          <div class="ctags">${card.id} · Lv ${card.level} · PWR ${card.power} · 範圍 ${card.attackRange}</div>
          <div class="cmeta">
            <span class="chip chip-attr chip-${card.attribute}">${ATTR_LABEL[card.attribute] || card.attribute}</span>
            <span class="rar rar-${card.rarity}">${card.rarity}</span>
            ${inDeck ? `<span class="rar" style="background:#3a2;color:#fff">×${inDeck}</span>` : ""}
          </div>
        </div>`;
      el.addEventListener("click", () => addCard(card.id));
      cardGrid.appendChild(el);
    });
  }

  // ---------- deck mutations ----------
  // copy limit is counted per card NAME (「subtitle」included, so
  // alternate-art prints of the same card share the limit)
  function countByName(name) {
    let n = 0;
    deck.forEach((qty, id) => { if (getCard(id).name === name) n += qty; });
    return n;
  }
  function addCard(id) {
    const card = getCard(id);
    const cur = deck.get(id) || 0;
    if (RULES.enforce && countByName(card.name) >= RULES.copyLimitPerName) {
      toast(`同名卡最多 ${RULES.copyLimitPerName} 張（${card.name}）`);
      return;
    }
    deck.set(id, cur + 1);
    renderCards(); renderDeck();
  }
  function removeCard(id) {
    const cur = deck.get(id) || 0;
    if (cur <= 1) deck.delete(id);
    else deck.set(id, cur - 1);
    renderCards(); renderDeck();
  }

  // ---------- render deck ----------
  function renderDeck() {
    deckListEl.innerHTML = "";
    let total = 0;
    const entries = [...deck.entries()].sort((a, b) => {
      const ca = getCard(a[0]), cb = getCard(b[0]);
      return ca.card_no.localeCompare(cb.card_no);
    });
    entries.forEach(([id, qty]) => {
      const card = getCard(id);
      total += qty;
      const row = document.createElement("div");
      row.className = "deck-row";
      row.innerHTML = `
        <img class="dthumb" src="${card.art}" alt="">
        <div class="dname">${card.name}<small>${card.id} · Lv ${card.level} · ${card.rarity} · ${ATTR_LABEL[card.attribute] || card.attribute}</small></div>
        <div class="qty">
          <button data-act="dec" data-id="${id}">−</button>
          <span>${qty}</span>
          <button data-act="inc" data-id="${id}">+</button>
        </div>`;
      deckListEl.appendChild(row);
    });
    deckCountEl.textContent = total + " 張";
    validateDeck(total);
    renderStats();
  }

  // ---------- deck validation ----------
  function validateDeck(total) {
    if (!RULES.enforce) {
      validationEl.innerHTML = '<span class="warn">⚠ 規則驗證已關閉</span>';
      return;
    }
    const issues = [];
    const exact = RULES.deckSize.exact;
    if (total < exact) issues.push(`牌組過少（要 ${exact} 張）`);
    if (total > exact) issues.push(`牌組過多（要 ${exact} 張）`);
    // color rule: at most 2 colors
    const colors = new Set();
    deck.forEach((qty, id) => colors.add(getCard(id).attribute));
    if (colors.size > RULES.maxColors) {
      issues.push(`顏色過多（最多 ${RULES.maxColors} 色，現有 ${colors.size} 色）`);
    }
    if (issues.length === 0) {
      validationEl.innerHTML = `<span class="ok">✓ ${exact} 張 · ${RULES.maxColors} 色以內 · 另備 ${RULES.rushDeckSize} 張衝擊卡組 · 目標：${RULES.winCondition.rushPointsToWin} 張衝擊卡或對手卡組歸零取勝</span>`;
    } else {
      validationEl.innerHTML = '<span class="warn">⚠ ' + issues.join(" · ") + "</span>";
    }
  }

  // ---------- stats ----------
  function renderStats() {
    const chips = [];
    const byLv = {}, byAttr = {}, byRar = {};
    let total = 0, powerSum = 0, powerN = 0;
    deck.forEach((qty, id) => {
      const c = getCard(id);
      total += qty;
      byLv["Lv" + c.level] = (byLv["Lv" + c.level] || 0) + qty;
      byAttr[ATTR_LABEL[c.attribute] || c.attribute] = (byAttr[ATTR_LABEL[c.attribute] || c.attribute] || 0) + qty;
      byRar[c.rarity] = (byRar[c.rarity] || 0) + qty;
      const p = parseInt(c.power, 10);
      if (!isNaN(p)) { powerSum += p * qty; powerN += qty; }
    });
    chips.push(`<span class="stat-chip">合計 <b>${total}</b></span>`);
    Object.keys(byLv).sort().forEach((k) => chips.push(`<span class="stat-chip">${k} <b>${byLv[k]}</b></span>`));
    Object.keys(byAttr).forEach((k) => chips.push(`<span class="stat-chip">${k} <b>${byAttr[k]}</b></span>`));
    Object.keys(byRar).forEach((k) => chips.push(`<span class="stat-chip">${k} <b>${byRar[k]}</b></span>`));
    if (powerN > 0) chips.push(`<span class="stat-chip">平均PWR <b>${Math.round(powerSum / powerN)}</b></span>`);
    statsEl.innerHTML = chips.join("");
  }

  // ---------- export / import / share ----------
  function deckToObj() {
    return {
      game: "Marvel Hero Rush TCG",
      version: "v2-real-cards",
      rules: { deckSize: RULES.deckSize, copyLimitPerName: RULES.copyLimitPerName, maxColors: RULES.maxColors },
      cards: [...deck.entries()].map(([id, qty]) => ({ id, qty })),
    };
  }
  function download(obj, name) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
  function loadDeckObj(obj) {
    deck = new Map();
    (obj.cards || []).forEach(({ id, qty }) => {
      if (getCard(id)) deck.set(id, Math.max(1, qty | 0));
    });
    renderCards(); renderDeck();
  }
  // share code = base64 of compact JSON
  function encodeShare() {
    const compact = [...deck.entries()].map(([id, qty]) => [id, qty]);
    return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
  }
  function decodeShare(code) {
    try {
      const arr = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      const m = new Map();
      arr.forEach(([id, qty]) => { if (getCard(id)) m.set(id, qty | 0); });
      return m;
    } catch (e) { return null; }
  }

  // ---------- events ----------
  searchEl.addEventListener("input", renderCards);
  filterSet.addEventListener("change", renderCards);
  filterRarity.addEventListener("change", renderCards);
  filterLevel.addEventListener("change", renderCards);
  filterRange.addEventListener("change", renderCards);
  filterAttr.addEventListener("change", renderCards);

  deckListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === "inc") addCard(id);
    else removeCard(id);
  });

  $("#btn-export").addEventListener("click", () => {
    download(deckToObj(), "hero-rush-deck.json");
    toast("已匯出 deck JSON");
  });
  $("#btn-share").addEventListener("click", () => {
    const code = encodeShare();
    shareText.value = code;
    navigator.clipboard?.writeText(code);
    toast("分享碼已複製");
  });
  $("#btn-import").addEventListener("click", () => {
    const code = shareText.value.trim();
    if (!code) { $("#file-import").click(); return; }
    const m = decodeShare(code);
    if (m) { deck = m; renderCards(); renderDeck(); toast("已匯入分享碼"); }
    else toast("分享碼無效");
  });
  $("#file-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { loadDeckObj(JSON.parse(reader.result)); toast("已匯入 JSON"); }
      catch (err) { toast("JSON 解析失敗"); }
    };
    reader.readAsText(file);
  });
  $("#btn-clear").addEventListener("click", () => {
    deck = new Map(); renderCards(); renderDeck(); toast("已清空 deck");
  });

  // ---------- boot ----------
  renderCards();
  renderDeck();
})();
