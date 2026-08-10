// =============================================================
// Marvel Hero Rush TCG — Deck Builder (v4: i18n + card overlay +
// favorites / owned + drag & drop)
// =============================================================
// Depends on: i18n.js, cards.js (window.MHR_DATA), rules.js (window.MHR_RULES)

(function () {
  const { CARDS, RARITIES, CARD_SETS, ATTRIBUTES } = window.MHR_DATA;
  const RULES = window.MHR_RULES;
  const { t, setLang, getLang } = window.MHR_I18N;

  // ---------- state ----------
  let deck = new Map();           // id -> qty
  let favs = new Set();           // card ids
  let owned = {};                 // id -> count
  let modalCardId = null;

  // ---------- persistence ----------
  const LS_DECK = "mhr_deck_v2", LS_FAVS = "mhr_favs_v2", LS_OWNED = "mhr_owned_v2";
  function saveDeck() { try { localStorage.setItem(LS_DECK, JSON.stringify([...deck.entries()])); } catch (e) {} }
  function saveFavs() { try { localStorage.setItem(LS_FAVS, JSON.stringify([...favs])); } catch (e) {} }
  function saveOwned() { try { localStorage.setItem(LS_OWNED, JSON.stringify(owned)); } catch (e) {} }
  function loadPersist() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_DECK) || "[]");
      deck = new Map(d.filter(([id]) => getCard(id)));
    } catch (e) { deck = new Map(); }
    try { favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]").filter((id) => getCard(id))); } catch (e) { favs = new Set(); }
    try { owned = JSON.parse(localStorage.getItem(LS_OWNED) || "{}"); } catch (e) { owned = {}; }
  }

  // ---------- DOM refs ----------
  const $ = (sel) => document.querySelector(sel);
  const cardGrid = $("#card-grid");
  const deckListEl = $("#deck-list");
  const deckPanel = $("#deck-panel");
  const deckCountEl = $("#deck-count");
  const validationEl = $("#deck-validation");
  const statsEl = $("#deck-stats");
  const searchEl = $("#search");
  const filterSet = $("#filter-set");
  const filterRarity = $("#filter-rarity");
  const filterLevel = $("#filter-level");
  const filterRange = $("#filter-range");
  const filterAttr = $("#filter-attr");
  const filterFav = $("#filter-fav");
  const shareText = $("#share-text");
  const toastEl = $("#toast");
  const modal = $("#card-modal");

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
    o.value = String(lv); o.textContent = t("lvPrefix") + " " + lv; filterLevel.appendChild(o);
  }
  for (let rng = 0; rng <= 5; rng++) {
    const o = document.createElement("option");
    o.value = String(rng); o.textContent = t("rangePrefix") + " " + rng; filterRange.appendChild(o);
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
  const ATTR_COLOR_ZHCN = { Red: "红", Yellow: "黄", Blue: "蓝", Green: "绿" };
  const ATTR_COLOR_EN = { Red: "Red", Yellow: "Yellow", Blue: "Blue", Green: "Green" };
  function attrLabel(a) {
    const l = getLang();
    if (l === "en") return ATTR_COLOR_EN[a] || a;
    if (l === "zh-CN") return ATTR_COLOR_ZHCN[a] || a;
    return ATTR_LABEL[a] || a;
  }

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
    if (filterFav.checked && !favs.has(card.id)) return false;
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
      cardGrid.innerHTML = '<p style="color:var(--muted)">' + t("noMatch") + "</p>";
      return;
    }
    list.forEach((card) => {
      const inDeck = deck.get(card.id) || 0;
      const inFav = favs.has(card.id);
      const ownedN = owned[card.id] || 0;
      const el = document.createElement("div");
      el.className = "card attr-" + card.attribute + (inFav ? " is-fav" : "");
      el.draggable = true;
      el.innerHTML = `
        <div class="art"><img loading="lazy" src="${card.art}" alt="${card.name}" onerror="this.style.display='none'"></div>
        <div class="badges">
          ${inFav ? '<span class="badge badge-fav">★</span>' : ""}
          ${ownedN ? `<span class="badge badge-owned">${ownedN}</span>` : ""}
          ${inDeck ? `<span class="badge badge-deck">×${inDeck}</span>` : ""}
        </div>
        <div class="meta">
          <div class="cname" title="${card.name}">${card.name}</div>
          <div class="ctags">${card.id} · ${t("lvPrefix")} ${card.level} · PWR ${card.power} · ${t("rangePrefix")} ${card.attackRange}</div>
          <div class="cmeta">
            <span class="chip chip-attr chip-${card.attribute}">${attrLabel(card.attribute)}</span>
            <span class="rar rar-${card.rarity}">${card.rarity}</span>
          </div>
        </div>`;
      el.addEventListener("click", () => openModal(card.id));
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "copy";
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
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
  function addCard(id, silent) {
    const card = getCard(id);
    const cur = deck.get(id) || 0;
    if (RULES.enforce && countByName(card.name) >= RULES.copyLimitPerName) {
      toast(t("toastCopyLimit", { name: card.name }));
      return false;
    }
    deck.set(id, cur + 1);
    saveDeck();
    renderCards(); renderDeck(); updateModalActions();
    if (!silent) toast(t("toastAdded"));
    return true;
  }
  function removeCard(id) {
    const cur = deck.get(id) || 0;
    if (cur <= 1) deck.delete(id);
    else deck.set(id, cur - 1);
    saveDeck();
    renderCards(); renderDeck(); updateModalActions();
  }

  // ---------- favorites / owned ----------
  function toggleFav(id) {
    if (favs.has(id)) { favs.delete(id); toast(t("toastFavOff")); }
    else { favs.add(id); toast(t("toastFavOn")); }
    saveFavs();
    renderCards(); updateModalActions();
  }
  function incOwned(id) { owned[id] = (owned[id] || 0) + 1; saveOwned(); renderCards(); updateModalActions(); toast(t("toastOwnedInc")); }
  function decOwned(id) {
    owned[id] = Math.max(0, (owned[id] || 0) - 1);
    if (!owned[id]) delete owned[id];
    saveOwned(); renderCards(); updateModalActions(); toast(t("toastOwnedDec"));
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
        <div class="dname">${card.name}<small>${card.id} · ${t("lvPrefix")} ${card.level} · ${card.rarity} · ${attrLabel(card.attribute)}</small></div>
        <div class="qty">
          <button data-act="dec" data-id="${id}">−</button>
          <span>${qty}</span>
          <button data-act="inc" data-id="${id}">+</button>
        </div>`;
      deckListEl.appendChild(row);
    });
    deckCountEl.textContent = total + " " + t("deckCountSuffix");
    validateDeck(total);
    renderStats();
  }

  // ---------- deck validation ----------
  function validateDeck(total) {
    if (!RULES.enforce) {
      validationEl.innerHTML = '<span class="warn">⚠</span>';
      return;
    }
    const issues = [];
    const exact = RULES.deckSize.exact;
    if (total < exact) issues.push(t("vTooFew"));
    if (total > exact) issues.push(t("vTooMany"));
    const colors = new Set();
    deck.forEach((qty, id) => colors.add(getCard(id).attribute));
    if (colors.size > RULES.maxColors) {
      issues.push(t("vTooManyColors", { n: colors.size }));
    }
    if (issues.length === 0) {
      validationEl.innerHTML = '<span class="ok">' + t("vOk") + "</span>";
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
      byLv[t("lvPrefix") + c.level] = (byLv[t("lvPrefix") + c.level] || 0) + qty;
      byAttr[attrLabel(c.attribute)] = (byAttr[attrLabel(c.attribute)] || 0) + qty;
      byRar[c.rarity] = (byRar[c.rarity] || 0) + qty;
      const p = parseInt(c.power, 10);
      if (!isNaN(p)) { powerSum += p * qty; powerN += qty; }
    });
    chips.push(`<span class="stat-chip">${t("statTotal")} <b>${total}</b></span>`);
    Object.keys(byLv).sort().forEach((k) => chips.push(`<span class="stat-chip">${k} <b>${byLv[k]}</b></span>`));
    Object.keys(byAttr).forEach((k) => chips.push(`<span class="stat-chip">${k} <b>${byAttr[k]}</b></span>`));
    Object.keys(byRar).forEach((k) => chips.push(`<span class="stat-chip">${k} <b>${byRar[k]}</b></span>`));
    if (powerN > 0) chips.push(`<span class="stat-chip">${t("statAvgPwr")} <b>${Math.round(powerSum / powerN)}</b></span>`);
    statsEl.innerHTML = chips.join("");
  }

  // ---------- card detail modal ----------
  function fillModalDetails(c) {
    $("#modal-no").textContent = c.card_no + (c.id !== c.card_no ? " · " + c.id : "");
    $("#modal-level").textContent = c.level;
    $("#modal-power").textContent = c.power;
    $("#modal-range").textContent = c.attackRange;
    $("#modal-attr").textContent = c.attribute + " (" + attrLabel(c.attribute) + ")";
    $("#modal-feature").textContent = c.feature || "—";
    $("#modal-rarity").textContent = c.rarity;
    $("#modal-set").textContent = CARD_SETS[c.set] || c.set;
    $("#modal-effect-text").textContent = c.effect || "—";
  }
  function openModal(id) {
    const c = getCard(id);
    if (!c) return;
    modalCardId = id;
    $("#modal-art").src = c.art;
    $("#modal-name").textContent = c.name;
    fillModalDetails(c);
    updateModalActions();
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }
  function closeModal() {
    modal.hidden = true;
    modalCardId = null;
    document.body.classList.remove("modal-open");
  }
  function updateModalActions() {
    if (!modalCardId) return;
    const c = getCard(modalCardId);
    const favBtn = $("#modal-fav");
    favBtn.textContent = favs.has(modalCardId) ? t("unfavBtn") : t("favBtn");
    $("#owned-count").textContent = owned[modalCardId] || 0;
    $("#modal-add-deck").disabled = RULES.enforce && countByName(c.name) >= RULES.copyLimitPerName;
  }

  // ---------- drag & drop ----------
  deckPanel.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    deckPanel.classList.add("drag-over");
  });
  deckPanel.addEventListener("dragleave", () => deckPanel.classList.remove("drag-over"));
  deckPanel.addEventListener("drop", (e) => {
    e.preventDefault();
    deckPanel.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/plain");
    if (id && getCard(id)) {
      if (addCard(id, true)) toast(t("toastDragAdd"));
    }
  });

  // ---------- export / import / share ----------
  function deckToObj() {
    return {
      game: "Marvel Hero Rush TCG",
      version: "v4",
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
    saveDeck();
    renderCards(); renderDeck();
  }
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
  filterFav.addEventListener("change", renderCards);

  $("#lang-select").addEventListener("change", (e) => {
    setLang(e.target.value);
    localStorage.setItem("mhr_lang", e.target.value);
  });

  deckListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === "inc") addCard(id);
    else removeCard(id);
  });

  // modal events
  $("#modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  $("#modal-add-deck").addEventListener("click", () => { if (modalCardId) addCard(modalCardId); });
  $("#modal-fav").addEventListener("click", () => { if (modalCardId) toggleFav(modalCardId); });
  $("#owned-inc").addEventListener("click", () => { if (modalCardId) incOwned(modalCardId); });
  $("#owned-dec").addEventListener("click", () => { if (modalCardId) decOwned(modalCardId); });

  $("#btn-export").addEventListener("click", () => {
    download(deckToObj(), "hero-rush-deck.json");
    toast(t("toastExport"));
  });
  $("#btn-share").addEventListener("click", () => {
    const code = encodeShare();
    shareText.value = code;
    navigator.clipboard?.writeText(code);
    toast(t("toastShare"));
  });
  $("#btn-import").addEventListener("click", () => {
    const code = shareText.value.trim();
    if (!code) { $("#file-import").click(); return; }
    const m = decodeShare(code);
    if (m) { deck = m; saveDeck(); renderCards(); renderDeck(); toast(t("toastImportCode")); }
    else toast(t("toastBadCode"));
  });
  $("#file-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { loadDeckObj(JSON.parse(reader.result)); toast(t("toastImportJson")); }
      catch (err) { toast(t("toastBadJson")); }
    };
    reader.readAsText(file);
  });
  $("#btn-clear").addEventListener("click", () => {
    deck = new Map(); saveDeck(); renderCards(); renderDeck(); toast(t("toastCleared"));
  });

  // language change re-render hook (called by i18n.js setLang)
  window.MHR_APP = {
    onLangChange() {
      // rebuild dynamic option labels
      for (let lv = 1; lv <= RULES.characterLevels; lv++) {
        const opt = filterLevel.querySelector(`option[value="${lv}"]`);
        if (opt) opt.textContent = t("lvPrefix") + " " + lv;
      }
      for (let rng = 0; rng <= 5; rng++) {
        const opt = filterRange.querySelector(`option[value="${rng}"]`);
        if (opt) opt.textContent = t("rangePrefix") + " " + rng;
      }
      if (modalCardId) fillModalDetails(getCard(modalCardId));
      renderCards(); renderDeck(); updateModalActions();
    },
  };

  // ---------- boot ----------
  loadPersist();
  const savedLang = localStorage.getItem("mhr_lang");
  if (savedLang && window.MHR_I18N.I18N[savedLang]) {
    $("#lang-select").value = savedLang;
    setLang(savedLang);
  } else {
    setLang("zh-HK");
  }
  renderCards();
  renderDeck();
})();
