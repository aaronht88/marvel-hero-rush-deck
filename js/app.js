// =============================================================
// Marvel Hero Rush TCG — Deck Builder (scaffold logic)
// =============================================================
// Depends on: cards.js (window.MHR_DATA), rules.js (window.MHR_RULES)

(function () {
  const { CARDS, RARITIES, CARD_SETS, EFFECT_TYPES } = window.MHR_DATA;
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
  const filterType = $("#filter-type");
  const filterRarity = $("#filter-rarity");
  const filterLevel = $("#filter-level");
  const shareText = $("#share-text");
  const toastEl = $("#toast");

  // ---------- init filters ----------
  RARITIES.forEach((r) => {
    const o = document.createElement("option");
    o.value = r; o.textContent = r; filterRarity.appendChild(o);
  });
  for (let lv = 1; lv <= RULES.characterLevels; lv++) {
    const o = document.createElement("option");
    o.value = String(lv); o.textContent = "Lv " + lv; filterLevel.appendChild(o);
  }

  // ---------- helpers ----------
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toastEl.hidden = true), 1800);
  }

  function getCard(id) { return CARDS.find((c) => c.id === id); }

  function cardMatches(card) {
    const q = searchEl.value.trim().toLowerCase();
    const type = filterType.value;
    const rar = filterRarity.value;
    const lv = filterLevel.value;
    if (type && card.type !== type) return false;
    if (rar && card.rarity !== rar) return false;
    if (lv && String(card.level) !== lv) return false;
    if (q) {
      const hay = (card.name + " " + (card.text || "") + " " + (card.faction || "")).toLowerCase();
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
      const cls = card.type === "Rush Point" ? "RushPoint" : "Character";
      const el = document.createElement("div");
      el.className = "card " + cls;
      el.innerHTML = `
        <div class="art">${card.name}</div>
        <div class="meta">
          <div class="cname">${card.name}</div>
          <div class="ctags">${card.type === "Character" ? "Lv " + card.level + " · " + card.effectType : "Rush Point"}</div>
          <span class="rar rar-${card.rarity.replace(/\s/g, "")}">${card.rarity}</span>
          ${inDeck ? `<span class="rar" style="background:#3a2;color:#fff">×${inDeck}</span>` : ""}
        </div>`;
      el.addEventListener("click", () => addCard(card.id));
      cardGrid.appendChild(el);
    });
  }

  // ---------- deck mutations ----------
  function addCard(id) {
    const card = getCard(id);
    const cur = deck.get(id) || 0;
    if (RULES.enforce && cur >= RULES.copyLimitPerCard) {
      toast(`每張卡最多 ${RULES.copyLimitPerCard} 張（${card.name}）`);
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
      return (cb.type === "Character") - (ca.type === "Character") || ca.name.localeCompare(cb.name);
    });
    entries.forEach(([id, qty]) => {
      const card = getCard(id);
      total += qty;
      const row = document.createElement("div");
      row.className = "deck-row";
      row.innerHTML = `
        <div class="dname">${card.name}<small>${card.type === "Character" ? "Lv " + card.level : "Rush Point"} · ${card.rarity}</small></div>
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
      validationEl.innerHTML = '<span class="warn">⚠ 規則驗證已關閉（placeholder）</span>';
      return;
    }
    const issues = [];
    const { min, max } = RULES.deckSize;
    if (total < min) issues.push(`牌組過少（最少 ${min}）`);
    if (total > max) issues.push(`牌組過多（最多 ${max}）`);
    // rush point ratio
    let rp = 0;
    deck.forEach((qty, id) => { if (getCard(id).type === "Rush Point") rp += qty; });
    if (total > 0) {
      const ratio = rp / total;
      const need = Math.round(total * RULES.rushPointRatio.min);
      if (rp < need) issues.push(`Rush Point 偏低（建議 ≥ ${need} 張）`);
    }
    // win condition reminder
    if (issues.length === 0) {
      validationEl.innerHTML = `<span class="ok">✓ 符合暫定規則 · 目標：填滿 ${RULES.winCondition.rushPointsToWin} Rush Points 取勝</span>`;
    } else {
      validationEl.innerHTML = '<span class="warn">⚠ ' + issues.join(" · ") + "</span>";
    }
  }

  // ---------- stats ----------
  function renderStats() {
    const chips = [];
    let chars = 0, rp = 0, cost = 0;
    const byRar = {};
    deck.forEach((qty, id) => {
      const c = getCard(id);
      if (c.type === "Character") chars += qty; else rp += qty;
      cost += (c.cost || 0) * qty;
      byRar[c.rarity] = (byRar[c.rarity] || 0) + qty;
    });
    chips.push(`<span class="stat-chip">角色 <b>${chars}</b></span>`);
    chips.push(`<span class="stat-chip">Rush Point <b>${rp}</b></span>`);
    chips.push(`<span class="stat-chip">總 cost <b>${cost}</b></span>`);
    Object.keys(byRar).forEach((r) => chips.push(`<span class="stat-chip">${r} <b>${byRar[r]}</b></span>`));
    statsEl.innerHTML = chips.join("");
  }

  // ---------- export / import / share ----------
  function deckToObj() {
    return {
      game: "Marvel Hero Rush TCG",
      version: "scaffold-0.1",
      rules: { deckSize: RULES.deckSize, copyLimit: RULES.copyLimitPerCard },
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
  filterType.addEventListener("change", renderCards);
  filterRarity.addEventListener("change", renderCards);
  filterLevel.addEventListener("change", renderCards);

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
