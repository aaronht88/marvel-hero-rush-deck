// =============================================================
// Table-top battle counter.
// Counts Call 1/2/3 and 基地部署 for the player facing the phone.
// It does not enforce rules: every tap toggles, nothing is blocked.
// 結束回合 resets those marks, rotates the board, and swaps colors.
// 直向／橫向 only changes which way the board faces. It does not reset counts.
//
// Each player has one accumulated clock. Nothing runs on page load.
// The facing player's clock starts on the first Call or 基地部署.
// If 結束回合 is the first action, the incoming player's clock starts
// and the passing player stays at 0. Later 結束回合 presses bank the
// active clock and start the other. Totals are not reset by 結束回合
// or by 直向／橫向. The same tab session keeps them across reload.
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
  const clocksEl = document.getElementById("table-clocks");
  let endLock = false;
  let tickTimer = 0;

  function freshClock() {
    return { ms: { a: 0, b: 0 }, ticking: false, since: 0 };
  }

  function fresh() {
    return { side: "a", calls: [false, false, false], base: false, orient: null, clock: freshClock() };
  }

  function clockFrom(raw) {
    const clock = freshClock();
    if (!raw || typeof raw !== "object") return clock;
    const ms = raw.ms && typeof raw.ms === "object" ? raw.ms : {};
    ["a", "b"].forEach(function (side) {
      const n = Number(ms[side]);
      if (Number.isFinite(n) && n >= 0) clock.ms[side] = n;
    });
    const since = Number(raw.since);
    if (raw.ticking && Number.isFinite(since) && since > 0) {
      clock.ticking = true;
      clock.since = since > Date.now() ? Date.now() : since;
    }
    return clock;
  }

  function load() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (!raw || (raw.side !== "a" && raw.side !== "b") || !Array.isArray(raw.calls) || raw.calls.length !== 3) {
        return fresh();
      }
      const orientMode = raw.orient === "portrait" || raw.orient === "landscape" ? raw.orient : null;
      return {
        side: raw.side,
        calls: raw.calls.map(Boolean),
        base: !!raw.base,
        orient: orientMode,
        clock: clockFrom(raw.clock)
      };
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

  function formatClock(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = (m < 10 ? "0" : "") + m;
    const ss = (s < 10 ? "0" : "") + s;
    if (h > 0) return h + ":" + mm + ":" + ss;
    return mm + ":" + ss;
  }

  function shownMs(side) {
    let ms = state.clock.ms[side] || 0;
    if (state.clock.ticking && state.side === side) {
      ms += Math.max(0, Date.now() - state.clock.since);
    }
    return ms;
  }

  function beginActive() {
    state.clock.ticking = true;
    state.clock.since = Date.now();
  }

  function startIfIdle() {
    if (state.clock.ticking) return;
    beginActive();
  }

  function bankActive() {
    if (!state.clock.ticking) return;
    state.clock.ms[state.side] += Math.max(0, Date.now() - state.clock.since);
    state.clock.ticking = false;
    state.clock.since = 0;
  }

  function paintClocks() {
    ["a", "b"].forEach(function (side) {
      const el = clocksEl ? clocksEl.querySelector('.clock[data-clock="' + side + '"]') : null;
      if (!el) return;
      const running = !!(state.clock.ticking && state.side === side);
      const ms = shownMs(side);
      const text = formatClock(ms);
      const name = side === "b" ? label("tableSideB") : label("tableSideA");
      el.classList.toggle("is-running", running);
      const nameEl = el.querySelector(".clock-name");
      const statusEl = el.querySelector(".clock-status");
      const timeEl = el.querySelector(".clock-time");
      if (nameEl) nameEl.textContent = name;
      if (statusEl) statusEl.textContent = running ? label("tableClockRunning") : "";
      if (timeEl) {
        if (timeEl.textContent !== text) timeEl.textContent = text;
        timeEl.classList.toggle("is-long", ms >= 3600000);
      }
      let aria = name + " " + label("tableClockGroup") + " " + text;
      if (running) {
        const zh = (document.documentElement.lang || "").indexOf("zh") === 0;
        aria += (zh ? "，" : ", ") + label("tableClockRunning");
      }
      if (el.getAttribute("aria-label") !== aria) el.setAttribute("aria-label", aria);
    });
  }

  function syncTicker() {
    if (state.clock.ticking) {
      if (!tickTimer) tickTimer = window.setInterval(paintClocks, 250);
    } else if (tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = 0;
    }
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
    paintClocks();
    syncTicker();

    if (announce && live) {
      live.textContent = label("tableLiveEnd").replace("{side}", sideEl.textContent);
    }
  }

  document.getElementById("table-calls").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-call]");
    if (!btn) return;
    const i = Number(btn.dataset.call);
    startIfIdle();
    state.calls[i] = !state.calls[i];
    save();
    render(false);
  });

  document.getElementById("btn-base").addEventListener("click", () => {
    startIfIdle();
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
    bankActive();
    state.calls = [false, false, false];
    state.base = false;
    state.side = state.side === "a" ? "b" : "a";
    beginActive();
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
