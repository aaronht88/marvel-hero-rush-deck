// =============================================================
// Table-top battle counter.
// Counts Call 1/2/3 and 基地部署 for the player facing the phone.
// It does not enforce rules: every tap toggles, nothing is blocked.
// 結束回合 resets those marks, rotates the board, and swaps colors.
// 直向／橫向 only changes which way the board faces. It does not reset counts.
// =============================================================
(function () {
  const i18n = window.MHR_I18N;
  const KEY = "mhr_table_v1";
  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  const orient = document.getElementById("orient");
  const live = document.getElementById("table-live");
  const sideEl = document.getElementById("table-side");
  const orientBtn = document.getElementById("btn-orient");
  const orientLabel = document.getElementById("orient-label");
  let endLock = false;

  function fresh() {
    return { side: "a", calls: [false, false, false], base: false, orient: null };
  }

  function load() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (!raw || (raw.side !== "a" && raw.side !== "b") || !Array.isArray(raw.calls) || raw.calls.length !== 3) {
        return fresh();
      }
      const orientMode = raw.orient === "portrait" || raw.orient === "landscape" ? raw.orient : null;
      return { side: raw.side, calls: raw.calls.map(Boolean), base: !!raw.base, orient: orientMode };
    } catch (e) {
      return fresh();
    }
  }

  let state = load();

  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function label(key) {
    return i18n.t(key);
  }

  function deviceIsLandscape() {
    return window.matchMedia("(orientation: landscape)").matches;
  }

  function effectiveOrient() {
    if (state.orient === "portrait" || state.orient === "landscape") return state.orient;
    return deviceIsLandscape() ? "landscape" : "portrait";
  }

  function applyOrient() {
    const wantLand = effectiveOrient() === "landscape";
    const turn = wantLand !== deviceIsLandscape();
    frame.classList.toggle("is-turned", turn);
    stage.classList.toggle("is-wide", wantLand);
    if (!turn) {
      orient.style.width = "";
      orient.style.height = "";
      orient.style.top = "";
      return;
    }
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    orient.style.width = h + "px";
    orient.style.height = w + "px";
    orient.style.top = (-w) + "px";
  }

  function render(announce) {
    document.body.dataset.side = state.side;
    stage.dataset.side = state.side;
    stage.classList.toggle("is-flipped", state.side === "b");
    applyOrient();
    const land = effectiveOrient() === "landscape";
    orientLabel.textContent = land ? label("tableOrientLandscape") : label("tableOrientPortrait");
    orientBtn.setAttribute("aria-pressed", land ? "true" : "false");
    orientBtn.setAttribute("aria-label", land ? label("tableOrientToPort") : label("tableOrientToLand"));
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute("content", state.side === "b" ? "#070b12" : "#09090b");

    stage.querySelectorAll("[data-call]").forEach((btn) => {
      const used = !!state.calls[Number(btn.dataset.call)];
      btn.setAttribute("aria-pressed", used ? "true" : "false");
      btn.classList.toggle("is-used", used);
      const st = btn.querySelector(".slot-state");
      if (st) st.textContent = used ? label("tableUsed") : label("tableUnused");
    });

    const base = document.getElementById("btn-base");
    base.setAttribute("aria-pressed", state.base ? "true" : "false");
    base.classList.toggle("is-used", state.base);
    const baseState = base.querySelector(".slot-state");
    if (baseState) baseState.textContent = state.base ? label("tableBaseUsed") : label("tableBaseUnused");

    sideEl.textContent = state.side === "b" ? label("tableSideB") : label("tableSideA");
    document.title = label("tableDocTitle");

    if (announce && live) {
      live.textContent = label("tableLiveEnd").replace("{side}", sideEl.textContent);
    }
  }

  document.getElementById("table-calls").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-call]");
    if (!btn) return;
    const i = Number(btn.dataset.call);
    state.calls[i] = !state.calls[i];
    save();
    render(false);
  });

  document.getElementById("btn-base").addEventListener("click", () => {
    state.base = !state.base;
    save();
    render(false);
  });

  orientBtn.addEventListener("click", () => {
    state.orient = effectiveOrient() === "landscape" ? "portrait" : "landscape";
    save();
    render(false);
    if (live) live.textContent = state.orient === "landscape" ? label("tableOrientNowLand") : label("tableOrientNowPort");
  });

  document.getElementById("btn-end").addEventListener("click", () => {
    if (endLock) return;
    endLock = true;
    state.calls = [false, false, false];
    state.base = false;
    state.side = state.side === "a" ? "b" : "a";
    save();
    render(true);
    window.setTimeout(() => { endLock = false; }, 520);
  });

  const savedLang = localStorage.getItem("mhr_lang");
  const lang = (savedLang && i18n.I18N[savedLang]) ? savedLang : "zh-HK";
  window.MHR_APP = { onLangChange: function () { render(false); } };
  stage.classList.add("no-anim");
  i18n.setLang(lang);
  window.addEventListener("resize", function () { applyOrient(); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { applyOrient(); });
  window.matchMedia("(orientation: landscape)").addEventListener("change", function () {
    if (state.orient !== "portrait" && state.orient !== "landscape") render(false);
    else applyOrient();
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { stage.classList.remove("no-anim"); });
  });
})();
