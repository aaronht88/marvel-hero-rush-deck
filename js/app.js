// =============================================================
// Marvel Hero Rush TCG — Deck Builder (v5: multi-deck + views)
// =============================================================
// Depends on: i18n.js, cards.js (window.MHR_DATA), rules.js (window.MHR_RULES)

(function () {
  const APP_VERSION = "1.3-beta";
  const { CARDS, RARITIES, CARD_SETS, ATTRIBUTES } = window.MHR_DATA;
  const RULES = window.MHR_RULES;
  const { t, setLang, getLang } = window.MHR_I18N;

  // ---------- state ----------
  let decks = [];            // [{id, name, cards:[[id,qty],...]}]
  let currentDeckId = null;
  let deck = new Map();      // working deck (current)
  let favs = new Set();      // card ids
  let owned = {};            // id -> count
  let modalCardId = null;
  let view = "all";          // "all" | "fav" | "owned"

  // ---------- persistence ----------
  const LS_DECKS = "mhr_decks_v3", LS_FAVS = "mhr_favs_v2", LS_OWNED = "mhr_owned_v2", LS_LEGACY_DECK = "mhr_deck_v2";
  function genId() { return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function saveDecks() {
    try {
      const cur = decks.find((d) => d.id === currentDeckId);
      if (cur) cur.cards = [...deck.entries()];
      localStorage.setItem(LS_DECKS, JSON.stringify({ current: currentDeckId, decks: decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards })) }));
    } catch (e) {}
  }
  function saveFavs() { try { localStorage.setItem(LS_FAVS, JSON.stringify([...favs])); } catch (e) {} }
  function saveOwned() { try { localStorage.setItem(LS_OWNED, JSON.stringify(owned)); } catch (e) {} }
  function loadPersist() {
    try { favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]").filter((id) => getCard(id))); } catch (e) { favs = new Set(); }
    try { owned = JSON.parse(localStorage.getItem(LS_OWNED) || "{}"); } catch (e) { owned = {}; }
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(LS_DECKS) || "null"); } catch (e) { stored = null; }
    if (stored && Array.isArray(stored.decks) && stored.decks.length) {
      decks = stored.decks.map((d) => ({ id: d.id, name: d.name || t("defaultDeckName"), cards: Array.isArray(d.cards) ? d.cards.filter(([cid]) => getCard(cid)) : [] }));
      currentDeckId = stored.current && decks.find((d) => d.id === stored.current) ? stored.current : decks[0].id;
    } else {
      // migrate legacy single deck
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LS_LEGACY_DECK) || "null"); } catch (e) { legacy = null; }
      decks = [{ id: genId(), name: t("defaultDeckName"), cards: Array.isArray(legacy) ? legacy.filter(([cid]) => getCard(cid)) : [] }];
      currentDeckId = decks[0].id;
      try { localStorage.removeItem(LS_LEGACY_DECK); } catch (e) {}
    }
    deck = new Map(decks.find((d) => d.id === currentDeckId).cards);
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
  const deckSelect = $("#deck-select");
  const dmModal = $("#deck-manager");
  const dmList = $("#dm-list");
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
    clearTimeout(toast._t);
    clearTimeout(toast._showT);
    toastEl.hidden = false;
    void toastEl.offsetWidth; // reflow → CSS transition runs
    toastEl.classList.add("show");
    toast._t = setTimeout(() => {
      toastEl.classList.remove("show");
      toast._showT = setTimeout(() => { toastEl.hidden = true; }, 240);
    }, 1600);
  }
  // ---------- overlay show/hide with motion ----------
  function showOverlay(el) {
    clearTimeout(el._hideT);
    el.hidden = false;
    void el.offsetWidth;
    el.classList.remove("closing");
    el.classList.add("show");
  }
  function hideOverlay(el) {
    if (el.hidden) return;
    el.classList.remove("show");
    el.classList.add("closing");
    clearTimeout(el._hideT);
    el._hideT = setTimeout(() => { el.hidden = true; el.classList.remove("closing"); }, 200);
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
    if (view === "fav" && !favs.has(card.id)) return false;
    if (view === "owned" && !(owned[card.id] || 0)) return false;
    if (q) {
      const hay = (card.name + " " + card.card_no + " " + (card.feature || "") + " " + (card.effect || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  // ---------- render card browser ----------
  function applyViewLayout() {
    const don = view === "donation";
    $(".controls").hidden = don;
    $("#card-grid").hidden = don;
    $("#donation-panel").hidden = !don;
  }
  function renderCards() {
    applyViewLayout();
    if (view === "donation") return;
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
            <span class="chip chip-set" title="${CARD_SETS[card.set] || card.set}">${card.set}</span>
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
    saveDecks();
    renderCards(); renderDeck(); updateModalActions(); renderDeckSelect();
    if (!silent) toast(t("toastAdded"));
    return true;
  }
  function removeCard(id) {
    const cur = deck.get(id) || 0;
    if (cur <= 1) deck.delete(id);
    else deck.set(id, cur - 1);
    saveDecks();
    renderCards(); renderDeck(); updateModalActions(); renderDeckSelect();
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

  // ---------- multi-deck ----------
  function renderDeckSelect() {
    deckSelect.innerHTML = "";
    decks.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id; o.textContent = d.name; deckSelect.appendChild(o);
    });
    deckSelect.value = currentDeckId;
  }
  function selectDeck(id) {
    const d = decks.find((x) => x.id === id);
    if (!d) return;
    // save current
    const cur = decks.find((x) => x.id === currentDeckId);
    if (cur) cur.cards = [...deck.entries()];
    currentDeckId = id;
    deck = new Map(d.cards.filter(([cid]) => getCard(cid)));
    saveDecks();
    renderDeckSelect(); renderDeckManager(); renderCards(); renderDeck();
    toast(t("toastDeckLoaded"));
  }
  function newDeck(name) {
    const id = genId();
    decks.push({ id, name: (name && name.trim()) || t("defaultDeckName"), cards: [] });
    currentDeckId = id;
    deck = new Map();
    saveDecks();
    renderDeckSelect(); renderDeckManager(); renderCards(); renderDeck();
    toast(t("toastDeckCreated"));
  }
  function renameDeck(id, name) {
    const d = decks.find((x) => x.id === id);
    if (!d) return;
    d.name = (name && name.trim()) || d.name;
    saveDecks(); renderDeckSelect(); renderDeckManager();
    toast(t("toastDeckRenamed"));
  }
  function deleteDeck(id) {
    if (decks.length <= 1) { toast(t("toastCantDeleteLast")); return; }
    decks = decks.filter((d) => d.id !== id);
    if (currentDeckId === id) {
      currentDeckId = decks[0].id;
      deck = new Map(decks[0].cards.filter(([cid]) => getCard(cid)));
    }
    saveDecks();
    renderDeckSelect(); renderDeckManager(); renderCards(); renderDeck();
    toast(t("toastDeckDeleted"));
  }
  function deckCardCount(d) { return (d.cards || []).reduce((s, [, q]) => s + q, 0); }
  function renderDeckManager() {
    dmList.innerHTML = "";
    decks.forEach((d) => {
      const row = document.createElement("div");
      row.className = "dm-row" + (d.id === currentDeckId ? " dm-current" : "");
      row.innerHTML = `
        <div class="dm-info">
          <div class="dm-name">${d.name}${d.id === currentDeckId ? " ✓" : ""}</div>
          <div class="dm-count">${deckCardCount(d)} ${t("deckCountSuffix")}</div>
        </div>
        <div class="dm-actions">
          <button class="btn btn-sm" data-dm="copy" data-id="${d.id}">${t("dmCopy")}</button>
          <button class="btn btn-sm" data-dm="rename" data-id="${d.id}">✎</button>
          <button class="btn btn-sm" data-dm="load" data-id="${d.id}">${t("dmLoad")}</button>
          <button class="btn btn-sm btn-danger" data-dm="delete" data-id="${d.id}">${t("dmDelete")}</button>
        </div>`;
      dmList.appendChild(row);
    });
  }
  function openDeckManager() { renderDeckManager(); showOverlay(dmModal); }
  function closeDeckManager() { hideOverlay(dmModal); }
  function encodeShareFor(cardsArr) {
    const compact = cardsArr.map(([id, qty]) => [id, qty]);
    return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
  }

  // ---------- deck simulator ----------
  function renderSimulator() {
    const content = $("#sim-content");
    const sub = $("#sim-sub");
    content.innerHTML = "";
    const entries = [...deck.entries()].sort((a, b) => {
      const ca = getCard(a[0]), cb = getCard(b[0]);
      return ca.level - cb.level || ca.card_no.localeCompare(cb.card_no);
    });
    let total = 0;
    entries.forEach(([, qty]) => (total += qty));
    sub.textContent = (decks.find((d) => d.id === currentDeckId) || {}).name + " · " + total + " " + t("deckCountSuffix");
    if (!entries.length) {
      content.innerHTML = '<p style="color:var(--muted)">' + t("simEmpty") + "</p>";
      return;
    }
    const byLv = {};
    entries.forEach(([id, qty]) => {
      const c = getCard(id);
      (byLv[c.level] = byLv[c.level] || []).push({ card: c, qty });
    });
    Object.keys(byLv).map(Number).sort((a, b) => a - b).forEach((lv) => {
      const sec = document.createElement("div");
      sec.className = "sim-grade";
      const lvCount = byLv[lv].reduce((s, x) => s + x.qty, 0);
      sec.innerHTML = `<div class="sim-grade-head"><span class="sim-grade-lv">${t("lvPrefix")} ${lv}</span><span class="sim-grade-count">×${lvCount}</span></div>`;
      const row = document.createElement("div");
      row.className = "sim-row";
      byLv[lv].forEach(({ card, qty }) => {
        const t2 = document.createElement("div");
        t2.className = "sim-card attr-" + card.attribute;
        t2.innerHTML = `
          <div class="sim-art"><img loading="lazy" src="${card.art}" alt="${card.name}" onerror="this.style.display='none'"></div>
          <div class="sim-name" title="${card.name}">${card.name}</div>
          <div class="sim-qty">×${qty}</div>`;
        t2.addEventListener("click", () => openModal(card.id));
        row.appendChild(t2);
      });
      sec.appendChild(row);
      content.appendChild(sec);
    });
    const hint = document.createElement("p");
    hint.className = "sim-hint";
    hint.textContent = "👆 " + t("simClickHint");
    content.appendChild(hint);
  }
  function openSimulator() { renderSimulator(); showOverlay($("#sim-modal")); }
  function closeSimulator() { hideOverlay($("#sim-modal")); }

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
    showOverlay(modal);
    document.body.classList.add("modal-open");
  }
  function closeModal() {
    hideOverlay(modal);
    modalCardId = null;
    document.body.classList.remove("modal-open");
  }
  function updateModalActions() {
    if (!modalCardId) return;
    const c = getCard(modalCardId);
    const favBtn = $("#modal-fav");
    favBtn.textContent = favs.has(modalCardId) ? t("unfavBtn") : t("favBtn");
    $("#owned-count").textContent = owned[modalCardId] || 0;
    const inDeck = deck.get(modalCardId) || 0;
    $("#deck-count-modal").textContent = inDeck;
    const atLimit = RULES.enforce && countByName(c.name) >= RULES.copyLimitPerName;
    $("#modal-add-deck").disabled = atLimit;
    $("#deck-inc").disabled = atLimit;
    $("#deck-dec").disabled = inDeck === 0;
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

  // ---------- welcome / info overlay ----------
  const LS_SEEN_VERSION = "mhr_seen_version";
  function showWelcome() { $("#wl-version").textContent = "v" + APP_VERSION; showOverlay($("#welcome-modal")); }
  function hideWelcome() { hideOverlay($("#welcome-modal")); }
  function maybeShowWelcome() {
    try {
      if (localStorage.getItem(LS_SEEN_VERSION) === APP_VERSION) return;
    } catch (e) {}
    showWelcome();
  }
  $("#wl-start").addEventListener("click", () => {
    if ($("#wl-dontshow").checked) {
      try { localStorage.setItem(LS_SEEN_VERSION, APP_VERSION); } catch (e) {}
    }
    hideWelcome();
  });
  $("#version-badge").addEventListener("click", showWelcome);

  // ---------- visitor counter (GoatCounter public JSON) ----------
  function loadVisitorCount() {
    fetch("https://aaronht88.goatcounter.com/counter/TOTAL.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.count) {
          $("#visitor-count").textContent = d.count;
          $("#wl-visitor-count").textContent = d.count;
        }
      })
      .catch(() => {});
  }

  // ---------- export / import / share ----------
  function deckToObj() {
    return {
      game: "Marvel Hero Rush TCG",
      version: "v5",
      appVersion: APP_VERSION,
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
    saveDecks();
    renderCards(); renderDeck(); renderDeckSelect();
  }
  function encodeShare() {
    return encodeShareFor([...deck.entries()]);
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

  // view tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      view = tab.dataset.view;
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === tab));
      renderCards();
    });
  });

  // donation: wire BMC URL constant (real link swapped on release)
  const BMC_URL = "https://buymeacoffee.com/YOUR_BMC";

  // language
  $("#lang-select").addEventListener("change", (e) => {
    setLang(e.target.value);
    localStorage.setItem("mhr_lang", e.target.value);
  });

  // deck selector + manager
  deckSelect.addEventListener("change", (e) => { if (e.target.value) selectDeck(e.target.value); });
  $("#btn-deck-new").addEventListener("click", () => {
    const name = prompt(t("promptDeckName"), "");
    if (name !== null) newDeck(name);
  });
  $("#btn-deck-manage").addEventListener("click", openDeckManager);
  $("#btn-simulator").addEventListener("click", openSimulator);
  $("#sim-close").addEventListener("click", closeSimulator);
  $("#sim-modal").addEventListener("click", (e) => { if (e.target === $("#sim-modal")) closeSimulator(); });
  $("#dm-close").addEventListener("click", closeDeckManager);
  dmModal.addEventListener("click", (e) => { if (e.target === dmModal) closeDeckManager(); });
  $("#dm-new").addEventListener("click", () => {
    const name = prompt(t("promptDeckName"), "");
    if (name !== null) { newDeck(name); }
  });
  dmList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-dm]");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.dm;
    if (act === "copy") {
      const d = decks.find((x) => x.id === id);
      if (d) {
        const code = encodeShareFor(d.cards);
        navigator.clipboard?.writeText(code);
        shareText.value = code;
        toast(t("toastDeckCopied") + "：" + d.name);
      }
    } else if (act === "rename") {
      const d = decks.find((x) => x.id === id);
      if (d) {
        const name = prompt(t("promptDeckName"), d.name);
        if (name !== null) renameDeck(id, name);
      }
    } else if (act === "load") {
      selectDeck(id);
      closeDeckManager();
    } else if (act === "delete") {
      if (confirm(t("dmDelete") + "? " + decks.find((x) => x.id === id).name)) deleteDeck(id);
    }
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      else if (!$("#sim-modal").hidden) closeSimulator();
    }
  });
  $("#modal-add-deck").addEventListener("click", () => { if (modalCardId) addCard(modalCardId); });
  $("#deck-inc").addEventListener("click", () => { if (modalCardId) addCard(modalCardId); });
  $("#deck-dec").addEventListener("click", () => { if (modalCardId) removeCard(modalCardId); });
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
    if (m) { deck = m; saveDecks(); renderCards(); renderDeck(); renderDeckSelect(); toast(t("toastImportCode")); }
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
    deck = new Map(); saveDecks(); renderCards(); renderDeck(); renderDeckSelect(); toast(t("toastCleared"));
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
      renderDeckManager();
      renderCards(); renderDeck(); updateModalActions();
    },
  };

  // ---------- boot ----------
  loadPersist();
  renderDeckSelect();
  $("#version-badge").textContent = "v" + APP_VERSION;
  // language: saved choice wins; otherwise auto-detect from browser
  function detectLang() {
    const nav = (navigator.language || navigator.userLanguage || "zh-HK").toLowerCase();
    if (nav.startsWith("zh")) {
      if (nav.startsWith("zh-tw") || nav.startsWith("zh-hk") || nav.startsWith("zh-mo")) return "zh-HK";
      if (nav.startsWith("zh-cn") || nav.startsWith("zh-sg")) return "zh-CN";
      return "zh-HK"; // plain "zh" → project home market
    }
    return "en"; // en + everything else → English
  }
  const savedLang = localStorage.getItem("mhr_lang");
  const bootLang = (savedLang && window.MHR_I18N.I18N[savedLang]) ? savedLang : detectLang();
  $("#lang-select").value = bootLang;
  setLang(bootLang);
  try { localStorage.setItem("mhr_lang", bootLang); } catch (e) {}
  renderCards();
  renderDeck();
  loadVisitorCount();
  maybeShowWelcome();
})();
