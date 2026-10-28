// =============================================================
// Marvel Hero Rush — Battle Sim tab (v1 shell)
// Pick two decks (saved or share code), preview construction, then run.
// No combat engine in this build: the start button explains that and
// can open the public demo in a new tab. It does not embed that demo.
// =============================================================
(function () {
  const { t, getLang } = window.MHR_I18N || {};
  const page = document.getElementById("page-battle-sim");
  if (!page || !t) return;

  const DEMO_URL = "https://zmart-event-mvp-herorush.web.app/";
  const COLOR_ORDER = ["Red", "Yellow", "Blue", "Green"];
  const COLOR_VAR = { Red: "var(--red)", Yellow: "var(--yellow)", Blue: "var(--blue)", Green: "var(--green)" };
  const COLOR_ZH_HK = { Red: "紅", Yellow: "黃", Blue: "藍", Green: "綠" };
  const COLOR_ZH_CN = { Red: "红", Yellow: "黄", Blue: "蓝", Green: "绿" };

  const state = {
    self: { mode: "saved", deckId: "", code: "" },
    opp: { mode: "saved", deckId: "", code: "" },
    notice: null,
  };

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

  function renderNotice(opts) {
    opts = opts || {};
    const el = document.getElementById("bsim-notice");
    if (!el) return;
    if (!state.notice) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    if (state.notice === "need") {
      el.innerHTML = "<p>" + esc(t("bsimNeedSides")) + "</p>";
    } else {
      el.innerHTML =
        "<p>" + esc(t("bsimEngineNotice")) + "</p>" +
        '<p class="bsim-demo-row"><a class="btn btn-sm" href="' + esc(DEMO_URL) +
        '" target="_blank" rel="noopener noreferrer">' + esc(t("bsimDemoLink")) + "</a></p>";
    }
    if (opts.scroll && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function sidePayload(resolved) {
    const a = resolved.analysis || {};
    return {
      name: resolved.label,
      source: resolved.source,
      total: a.total || 0,
      colors: a.colors || [],
      colorCounts: a.colorCounts || {},
      checklist: a.checklist || {},
      entries: a.entries || [],
    };
  }

  function onStart() {
    const self = resolveSide("self");
    const opp = resolveSide("opp");
    const selfOk = self && !self.invalid && self.analysis && self.analysis.total > 0;
    const oppOk = opp && !opp.invalid && opp.analysis && opp.analysis.total > 0;
    if (!selfOk || !oppOk) {
      state.notice = "need";
      renderNotice({ scroll: true });
      return;
    }
    const engine = window.MHR_BATTLE_ENGINE;
    if (engine && typeof engine.start === "function") {
      state.notice = null;
      renderNotice();
      engine.start({ self: sidePayload(self), opp: sidePayload(opp) });
      return;
    }
    state.notice = "engine";
    renderNotice({ scroll: true });
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

  ["self", "opp"].forEach(syncChrome);
  refreshDecks();
  renderNotice();

  window.MHR_BATTLE = {
    onShow(p) {
      if (p === "battle-sim") refreshDecks();
    },
    onLang() {
      refreshDecks();
      renderNotice();
    },
    onDecksChanged() {
      refreshDecks();
    },
  };
})();
