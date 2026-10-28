// =============================================================
// Marvel Hero Rush — Battle Sim
// Same-page match using the vendored mhr-rules-engine build
// pinned to github:aaronht88/mhr-rules-engine#eaf08e0
// (DSL v1.1, place_from_retreat, BP01-037 in the catalog).
// Both sides call chooseAction. No local policy and no Worker.
// GameState ids are P1 (我方) and P2 (對手).
// =============================================================
(function () {
  const { t, getLang } = window.MHR_I18N || {};
  const page = document.getElementById("page-battle-sim");
  if (!page || !t) return;

  const COLOR_ORDER = ["Red", "Yellow", "Blue", "Green"];
  const COLOR_VAR = { Red: "var(--red)", Yellow: "var(--yellow)", Blue: "var(--blue)", Green: "var(--green)" };
  const COLOR_ZH_HK = { Red: "紅", Yellow: "黃", Blue: "藍", Green: "綠" };
  const COLOR_ZH_CN = { Red: "红", Yellow: "黄", Blue: "蓝", Green: "绿" };
  const MAX_STEPS = 800;
  const CHUNK = 40;
  const KEY_ACTIONS = {
    ADJUST_STARTING_HAND: "bsimActAdjust",
    BASE_DEPLOYMENT: "bsimActBase",
    ACTION_CALL: "bsimActCall",
    END_ACTION_PHASE: "bsimActEndAction",
    DECLARE_ATTACK: "bsimActAttack",
    BATTLE_BASE_MOVE: "bsimActMove",
    COUNTER_CALL: "bsimActCounter",
    ACTIVATE_EFFECT: "bsimActEffect",
    ACTIVATE_COUNTER_EFFECT: "bsimActCounterEffect",
  };

  const state = {
    self: { mode: "saved", deckId: "", code: "" },
    opp: { mode: "saved", deckId: "", code: "" },
    difficulty: "normal",
    notice: null,
    result: null,
    runId: 0,
  };

  function engine() {
    return window.MHR_RULES_ENGINE || null;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function colorName(attr) {
    const lang = (getLang && getLang()) || "zh-HK";
    if (lang === "en") return attr;
    if (lang === "zh-CN") return COLOR_ZH_CN[attr] || attr;
    return COLOR_ZH_HK[attr] || attr;
  }

  function sideRoot(side) {
    return page.querySelector('[data-bsim-side="' + side + '"]');
  }

  function savedDecks() {
    const api = window.MHR_APP;
    if (!api || typeof api.getSavedDecks !== "function") return [];
    try { return api.getSavedDecks() || []; } catch (e) { return []; }
    }

  function resolveSide(side) {
    const s = state[side];
    const api = window.MHR_APP;
    if (!api) return null;
    if (s.mode === "code") {
      const code = String(s.code || "").trim();
      if (!code) return null;
      let analysis = null;
      try { analysis = api.analyzeShareCode(code); } catch (e) { analysis = null; }
      if (!analysis || !analysis.checklist || !analysis.checklist.code_importable) {
        return { invalid: true, analysis: analysis };
      }
      return {
        invalid: false,
        source: "code",
        label: analysis.name || t("bsimImported"),
        analysis: analysis,
      };
    }
    if (!s.deckId) return null;
    const deck = savedDecks().find((d) => d.id === s.deckId);
    if (!deck) return null;
    let analysis = null;
    try { analysis = api.summarizeCards(deck.cards); } catch (e) { analysis = null; }
    if (!analysis) return null;
    return {
      invalid: false,
      source: "saved",
      label: deck.name || t("bsimImported"),
      analysis: analysis,
    };
  }

  function cardIdList(resolved) {
    const entries = (resolved && resolved.analysis && resolved.analysis.entries) || [];
    const ids = [];
    entries.forEach((entry) => {
      const qty = entry.qty | 0;
      for (let i = 0; i < qty; i++) ids.push(String(entry.id));
    });
    return ids;
  }

  function builderDef(id) {
    if (typeof CARDS === "undefined" || !CARDS) return null;
    const c = CARDS.find((x) => x.id === id) || CARDS.find((x) => x.card_no === id);
    if (!c) return null;
    const rush = /impact|rush/i.test(c.type || "");
    return {
      id: c.id,
      cardNo: c.card_no || c.id,
      name: c.name,
      cardType: rush ? "impact" : "character",
      attribute: String(c.attribute || "").trim(),
      level: Number(c.level) || 0,
      power: Number(String(c.power || "").replace(/,/g, "")) || 0,
      attackRange: Number(c.attackRange) || 0,
      effect: c.effect || "",
      abilities: [],
    };
  }

  function catalogFor(ids, eng) {
    const catalog = {};
    const unique = [];
    ids.concat(["BP01-121"]).forEach((id) => {
      if (unique.indexOf(id) === -1) unique.push(id);
    });
    let unregistered = 0;
    unique.forEach((id) => {
      const def = (eng.cardDef && eng.cardDef(id)) || builderDef(id);
      if (def) catalog[id] = def;
      if (id !== "BP01-121" && eng.effectRegistered && !eng.effectRegistered(id)) unregistered += 1;
    });
    return { catalog: catalog, unregistered: unregistered };
  }

  function syncChrome(side) {
    const root = sideRoot(side);
    if (!root) return;
    const mode = state[side].mode === "code" ? "code" : "saved";
    state[side].mode = mode;
    root.querySelectorAll("[data-bsim-mode]").forEach((btn) => {
      const on = btn.dataset.bsimMode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    root.querySelectorAll("[data-bsim-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.bsimPanel !== mode;
    });
  }

  function renderPreview(side) {
    const root = sideRoot(side);
    const el = root && root.querySelector("[data-bsim-preview]");
    if (!el) return;
    const resolved = resolveSide(side);
    if (!resolved) {
      el.innerHTML = '<p class="bsim-empty">' + esc(t("bsimEmpty")) + "</p>";
      return;
    }
    if (resolved.invalid) {
      el.innerHTML = '<p class="bsim-bad">' + esc(t("bsimBadCode")) + "</p>";
      return;
    }
    const a = resolved.analysis;
    const counts = a.colorCounts || {};
    const countCls = a.checklist && a.checklist.card_count_50 ? "is-ok" : "is-bad";
    const colors = COLOR_ORDER.filter((c) => counts[c]).map((c) =>
      '<span class="bsim-color"><span class="color-dot" style="background:' + COLOR_VAR[c] + '"></span>' +
      esc(colorName(c)) + " ×" + counts[c] + "</span>"
    ).join("");
    const checks = [
      ["card_count_50", "vSize"],
      ["colors_ok", "vColors"],
      ["unique_name_leq_3", "vCopies"],
    ].map(([key, labelKey]) => {
      const ok = a.checklist && a.checklist[key] === true;
      return '<span class="v-item ' + (ok ? "ok" : "bad") + '"><span class="v-box">' +
        (ok ? "☑" : "☐") + "</span>" + esc(t(labelKey)) + "</span>";
    }).join("");
    el.innerHTML =
      '<div class="bsim-name">' + esc(resolved.label) + "</div>" +
      '<div class="bsim-count ' + countCls + '">' + esc(t("bsimCount", { n: a.total || 0 })) + "</div>" +
      '<div class="bsim-colors"><span class="bsim-colors-label">' + esc(t("bsimColorsLabel")) + "</span>" +
      (colors || '<span class="bsim-muted">' + esc(t("bsimNoColor")) + "</span>") +
      "</div>" +
      '<div class="bsim-checks">' + checks + "</div>";
  }

  function refreshDecks() {
    const decks = savedDecks();
    ["self", "opp"].forEach((side) => {
      const root = sideRoot(side);
      const sel = root && root.querySelector("[data-bsim-deck]");
      if (!sel) return;
      const prev = state[side].deckId;
      const opts = ['<option value="">' + esc(t("bsimPickDeck")) + "</option>"];
      decks.forEach((d) => {
        let n = 0;
        try {
          const sum = window.MHR_APP.summarizeCards(d.cards);
          n = sum && sum.total ? sum.total : 0;
        } catch (e) { n = 0; }
        opts.push('<option value="' + esc(d.id) + '">' + esc(t("bsimDeckOption", { name: d.name || "", n: n })) + "</option>");
      });
      sel.innerHTML = opts.join("");
      if (prev && decks.some((d) => d.id === prev)) {
        sel.value = prev;
      } else {
        state[side].deckId = "";
        sel.value = "";
      }
      renderPreview(side);
    });
  }

  function actorOf(game, eng, catalog) {
    if (!game || game.status.kind === "ended" || game.status.kind === "draw") return null;
    if (game.status.kind === "setup") return game.setup && game.setup.awaitingHandAdjust;
    if (game.pendingTriggers && game.pendingTriggers.length) {
      const who = ["P1", "P2"].find((p) => eng.listLegalActions(game, p, catalog).length);
      return who || game.pendingTriggers[0].controllerId;
    }
    if (game.phase === "counter" || game.step === "counterStep") return game.priority;
    return game.activePlayerId;
  }

  function sideLabel(id) {
    return id === "P2" ? t("bsimSideP2") : t("bsimSideP1");
  }

  function actionLabel(type) {
    const key = KEY_ACTIONS[type];
    return key ? t(key) : type;
  }

  function renderNotice() {
    const el = document.getElementById("bsim-notice");
    if (!el) return;
    if (!state.notice) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = "<p>" + esc(state.notice) + "</p>";
  }

  function renderResult() {
    const el = document.getElementById("bsim-result");
    if (!el) return;
    const r = state.result;
    if (!r) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    const eng = engine();
    const max = (eng && eng.TIMELINE_WIN_COUNT) || 9;
    let headline;
    if (r.running) {
      headline = t("bsimRunning");
    } else if (r.statusKind === "ended") {
      const who = r.winnerId === "P2" ? t("bsimWinnerP2") : t("bsimWinnerP1");
      headline = t("bsimWinner", { who: who });
    } else if (r.statusKind === "draw") {
      headline = t("bsimWinner", { who: t("bsimDraw") });
    } else {
      headline = t("bsimIncomplete", { n: r.steps });
    }
    const lines = (r.log || []).map((line) => "<li>" + esc(line) + "</li>").join("");
    el.hidden = false;
    el.innerHTML =
      '<p class="bsim-disclaimer">' + esc(t("bsimDisclaimer")) + "</p>" +
      "<p>" + esc(headline) + (r.reason ? " · " + esc(r.reason) : "") + "</p>" +
      '<div class="bsim-score"><span>' + esc(t("bsimRpLabel")) + "</span><span>" +
      esc(t("bsimSideP1")) + " <strong>" + esc(r.rp1) + "</strong> / " + esc(max) +
      "</span><span>" + esc(t("bsimSideP2")) + " <strong>" + esc(r.rp2) + "</strong> / " + esc(max) +
      "</span><span>" + esc(t("bsimSteps", { n: r.steps })) + "</span></div>" +
      "<p class=\"bsim-muted\">" + esc(t("bsimBothAi")) + " " + esc(t("bsimUnregistered", { n: r.unregistered })) +
      " · " + esc(r.seed) + "</p>" +
      "<p>" + esc(t("bsimLogTitle")) + "</p>" +
      '<ol class="bsim-log">' + lines + "</ol>";
  }

  function snapshot(game, steps, log, meta, running) {
    return {
      statusKind: game.status.kind,
      winnerId: game.status.winnerId || "",
      reason: game.status.reason || "",
      rp1: game.players.P1.zones.timeline.length,
      rp2: game.players.P2.zones.timeline.length,
      steps: steps,
      log: log.slice(-60),
      unregistered: meta.unregistered,
      seed: meta.seed,
      running: !!running,
    };
  }

  function stepOnce(game, eng, catalog, difficulty, log) {
    const actor = actorOf(game, eng, catalog);
    if (!actor) return { game: game, done: true };
    const pick = eng.chooseAction(game, actor, catalog, difficulty);
    if (!pick || !pick.action) return { game: game, done: true, stuck: true };
    const before = game.eventSeq;
    const applied = eng.apply(game, pick.action, actor, catalog);
    const next = applied.state;
    if (next.eventSeq === before) return { game: next, done: true, stuck: true };
    const type = pick.action.type;
    if (KEY_ACTIONS[type]) {
      const reason = pick.reason_zh ? " — " + pick.reason_zh : "";
      log.push(sideLabel(actor) + " · " + actionLabel(type) + reason);
    }
    const ended = next.status.kind === "ended" || next.status.kind === "draw";
    return { game: next, done: ended };
  }

  function finishRun(runId, game, steps, log, meta, notice) {
    if (runId !== state.runId) return;
    state.result = snapshot(game, steps, log, meta);
    state.notice = notice || null;
    const btn = document.getElementById("bsim-start");
    if (btn) btn.disabled = false;
    renderNotice();
    renderResult();
  }

  function pump(runId, game, eng, catalog, difficulty, steps, log, meta) {
    if (runId !== state.runId) return;
    try {
      let current = game;
      let n = steps;
      let stopped = false;
      for (let i = 0; i < CHUNK; i++) {
        if (n >= MAX_STEPS) { stopped = true; break; }
        const step = stepOnce(current, eng, catalog, difficulty, log);
        current = step.game;
        n += 1;
        if (step.done) { stopped = true; break; }
      }
      state.result = snapshot(current, n, log, meta, true);
      renderResult();
      if (stopped || n >= MAX_STEPS) {
        finishRun(runId, current, n, log, meta, null);
        return;
      }
      setTimeout(function () {
        pump(runId, current, eng, catalog, difficulty, n, log, meta);
      }, 0);
    } catch (err) {
      finishRun(runId, game, steps, log, meta, t("bsimSimError", { msg: err && err.message ? err.message : String(err) }));
    }
  }

  function onStart() {
    const self = resolveSide("self");
    const opp = resolveSide("opp");
    const selfOk = self && !self.invalid && self.analysis && self.analysis.total > 0;
    const oppOk = opp && !opp.invalid && opp.analysis && opp.analysis.total > 0;
    if (!selfOk || !oppOk) {
      state.notice = t("bsimNeedSides");
      renderNotice();
      return;
    }
    const eng = engine();
    if (!eng || typeof eng.createMatchGameState !== "function" || typeof eng.chooseAction !== "function" || typeof eng.apply !== "function") {
      state.notice = t("bsimEngineNotice");
      state.result = null;
      renderNotice();
      renderResult();
      return;
    }
    const diffSel = document.getElementById("bsim-difficulty");
    const difficulty = diffSel && /^(weak|normal|strong)$/.test(diffSel.value) ? diffSel.value : "normal";
    state.difficulty = difficulty;
    const selfIds = cardIdList(self);
    const oppIds = cardIdList(opp);
    const built = catalogFor(selfIds.concat(oppIds), eng);
    const seed = "bsim-" + Date.now().toString(36);
    let game;
    try {
      game = eng.createMatchGameState({
        p1CardIds: selfIds,
        p2CardIds: oppIds,
        rngSeed: seed,
        firstPlayerId: "P1",
      });
    } catch (err) {
      state.notice = t("bsimSimError", { msg: err && err.message ? err.message : String(err) });
      renderNotice();
      return;
    }
    const meta = { unregistered: built.unregistered, seed: seed };
    const log = [];
    state.notice = t("bsimRunning");
    state.result = snapshot(game, 0, log, meta, true);
    const btn = document.getElementById("bsim-start");
    if (btn) btn.disabled = true;
    renderNotice();
    renderResult();
    const runId = ++state.runId;
    setTimeout(function () {
      try {
        pump(runId, game, eng, built.catalog, difficulty, 0, log, meta);
      } catch (err) {
        finishRun(runId, game, 0, log, meta, t("bsimSimError", { msg: err && err.message ? err.message : String(err) }));
      }
    }, 0);
  }

  page.addEventListener("click", (e) => {
    const modeBtn = e.target.closest("[data-bsim-mode]");
    if (modeBtn && page.contains(modeBtn)) {
      const root = modeBtn.closest("[data-bsim-side]");
      const side = root && root.dataset.bsimSide;
      if (!state[side]) return;
      state[side].mode = modeBtn.dataset.bsimMode === "code" ? "code" : "saved";
      state.notice = null;
      syncChrome(side);
      renderPreview(side);
      renderNotice();
      return;
    }
    if (e.target.closest("#bsim-start")) onStart();
  });

  page.addEventListener("change", (e) => {
    const diff = e.target.closest("#bsim-difficulty");
    if (diff) {
      state.difficulty = /^(weak|normal|strong)$/.test(diff.value) ? diff.value : "normal";
      return;
    }
    const sel = e.target.closest("[data-bsim-deck]");
    if (!sel || !page.contains(sel)) return;
    const side = sel.closest("[data-bsim-side]").dataset.bsimSide;
    if (!state[side]) return;
    state[side].deckId = sel.value;
    state.notice = null;
    renderPreview(side);
    renderNotice();
  });

  page.addEventListener("input", (e) => {
    const ta = e.target.closest("[data-bsim-code]");
    if (!ta || !page.contains(ta)) return;
    const side = ta.closest("[data-bsim-side]").dataset.bsimSide;
    if (!state[side]) return;
    state[side].code = ta.value;
    state.notice = null;
    renderPreview(side);
    renderNotice();
  });

  const pin = document.getElementById("bsim-engine");
  const eng = engine();
  if (pin && eng && eng.ENGINE_COMMIT) {
    pin.textContent = "mhr-rules-engine " + eng.ENGINE_COMMIT + " · " + (eng.ENGINE_FEATURES || "");
  }

  ["self", "opp"].forEach(syncChrome);
  refreshDecks();
  renderNotice();
  renderResult();

  window.MHR_BATTLE = {
    onShow(p) {
      if (p === "battle-sim") refreshDecks();
    },
    onLang() {
      refreshDecks();
      renderNotice();
      renderResult();
      const node = document.getElementById("bsim-engine");
      const live = engine();
      if (node && live && live.ENGINE_COMMIT) {
        node.textContent = "mhr-rules-engine " + live.ENGINE_COMMIT + " · " + (live.ENGINE_FEATURES || "");
      }
    },
    onDecksChanged() {
      refreshDecks();
    },
  };
})();
