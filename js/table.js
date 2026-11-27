// =============================================================
// Table-top battle counter.
// Counts Call 1/2/3 and 基地部署 for the player facing the phone.
// It does not enforce rules: every tap toggles, nothing is blocked.
// 結束回合 resets those marks, rotates the board, and swaps colors.
// 直向／橫向 only changes which way the board faces. It does not reset
// counts, timers, or the first-player draw.
//
// A fresh page, or 清空, starts at 抽先後攻. One tap is a fair 50/50.
// 先攻 leaves the screen where it is and shows 先攻. 後攻 rotates the
// stage 180° and swaps color, so the opponent faces the screen and
// sees 先攻. The draw control then stays away until the next 清空.
//
// Each player has one accumulated clock. Nothing runs on page load
// or on the draw. The facing player's clock starts on the first Call
// or 基地部署. If 結束回合 is the first action, the incoming player's
// clock starts and the passing player stays at 0. Later 結束回合
// presses bank the active clock and start the other. Totals are not
// reset by 結束回合 or by 直向／橫向. 清空 zeros both clocks, stops
// the tick, resets action marks, and returns to the draw. It keeps
// the 直向／橫向 choice. The same tab session keeps an in-progress
// game, including that the draw already happened, across reload.
// 清空 writes that cleared state, so a reload does not restore it.
// Closing the tab clears the session.
// =============================================================
(function () {
  const i18n = window.MHR_I18N;
  const KEY = "mhr_table_v1";
  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  const orient = document.getElementById("orient");
  const live = document.getElementById("table-live");
  const sideEl = document.getElementById("table-side");
  const turnLabel = document.getElementById("table-turn-label");
  const hintEl = document.getElementById("table-hint");
  const drawPanel = document.getElementById("table-draw");
  const board = document.getElementById("table-board");
  const clearBtn = document.getElementById("btn-clear");
  const orientBtn = document.getElementById("btn-orient");
  const orientLabel = document.getElementById("orient-label");
  const clocksEl = document.getElementById("table-clocks");
  let uiLock = false;
  let tickTimer = 0;

  function freshClock() {
    return { ms: { a: 0, b: 0 }, ticking: false, since: 0 };
  }

  function fresh(orientMode) {
    return {
      side: "a",
      calls: [false, false, false],
      base: false,
      orient: orientMode === "portrait" || orientMode === "landscape" ? orientMode : null,
      clock: freshClock(),
      drawn: false,
      opening: false
    };
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
      // Sessions saved before the draw existed have no `drawn` flag.
      // Treat those as an in-progress game so a reload does not ask again.
      const legacy = raw.drawn !== true && raw.drawn !== false;
      const drawn = legacy ? true : raw.drawn === true;
      if (!drawn) return fresh(orientMode);
      return {
        side: raw.side,
        calls: raw.calls.map(Boolean),
        base: !!raw.base,
        orient: orientMode,
        clock: clockFrom(raw.clock),
        drawn: true,
        opening: raw.opening === true
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
    if (!state.drawn || state.clock.ticking) return;
    beginActive();
  }

  function bankActive() {
    if (!state.clock.ticking) return;
    state.clock.ms[state.side] += Math.max(0, Date.now() - state.clock.since);
    state.clock.ticking = false;
    state.clock.since = 0;
  }

  function stopTicker() {
    if (!tickTimer) return;
    window.clearInterval(tickTimer);
    tickTimer = 0;
  }

  function facingGoesFirst() {
    try {
      if (window.crypto && crypto.getRandomValues) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return (buf[0] & 1) === 1;
      }
    } catch (e) {}
    return Math.random() < 0.5;
  }

  function lockFor(ms) {
    uiLock = true;
    window.setTimeout(function () { uiLock = false; }, ms);
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
    } else {
      stopTicker();
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
    const pre = !state.drawn;
    document.body.dataset.side = state.side;
    document.body.dataset.phase = pre ? "draw" : (state.opening ? "opening" : "play");
    stage.dataset.side = state.side;
    stage.classList.toggle("is-flipped", state.side === "b");
    stage.classList.toggle("is-pregame", pre);
    stage.classList.toggle("is-opening", !pre && state.opening);
    if (drawPanel) drawPanel.hidden = !pre;
    if (board) board.hidden = pre;
    applyOrient();
    const land = effectiveOrient() === "landscape";
    orientLabel.textContent = land ? label("tableOrientLandscape") : label("tableOrientPortrait");
    orientBtn.setAttribute("aria-pressed", land ? "true" : "false");
    orientBtn.setAttribute("aria-label", land ? label("tableOrientToPort") : label("tableOrientToLand"));
    if (clearBtn) clearBtn.setAttribute("aria-label", label("tableClearAria"));
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
    if (turnLabel) {
      if (pre) turnLabel.textContent = label("tablePreGame");
      else if (state.opening) turnLabel.textContent = label("tableFirst");
      else turnLabel.textContent = label("tableYourTurn");
      turnLabel.classList.toggle("is-first", !pre && state.opening);
    }
    if (hintEl) hintEl.textContent = pre ? label("tableDrawHint") : label("tableHint");
    document.title = label("tableDocTitle");
    paintClocks();
    syncTicker();

    if (announce && live) {
      live.textContent = label("tableLiveEnd").replace("{side}", sideEl.textContent);
    }
  }

  document.getElementById("table-calls").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-call]");
    if (!btn || !state.drawn) return;
    const i = Number(btn.dataset.call);
    startIfIdle();
    state.calls[i] = !state.calls[i];
    save();
    render(false);
  });

  document.getElementById("btn-base").addEventListener("click", () => {
    if (!state.drawn) return;
    startIfIdle();
    state.base = !state.base;
    save();
    render(false);
  });

  document.getElementById("btn-draw").addEventListener("click", () => {
    if (state.drawn || uiLock) return;
    const first = facingGoesFirst();
    state.drawn = true;
    state.opening = true;
    if (!first) state.side = state.side === "a" ? "b" : "a";
    save();
    render(false);
    if (live) live.textContent = first ? label("tableLiveDrawStay") : label("tableLiveDrawFlip");
    lockFor(first ? 280 : 520);
  });

  clearBtn.addEventListener("click", () => {
    if (uiLock) return;
    stopTicker();
    state = fresh(state.orient);
    save();
    render(false);
    if (live) live.textContent = label("tableLiveClear");
    lockFor(520);
  });

  orientBtn.addEventListener("click", () => {
    state.orient = effectiveOrient() === "landscape" ? "portrait" : "landscape";
    save();
    render(false);
    if (live) live.textContent = state.orient === "landscape" ? label("tableOrientNowLand") : label("tableOrientNowPort");
  });

  document.getElementById("btn-end").addEventListener("click", () => {
    if (!state.drawn || uiLock) return;
    bankActive();
    state.calls = [false, false, false];
    state.base = false;
    state.opening = false;
    state.side = state.side === "a" ? "b" : "a";
    beginActive();
    save();
    render(true);
    lockFor(520);
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
