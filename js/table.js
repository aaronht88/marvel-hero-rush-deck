// =============================================================
// Table-top battle counter.
// Counts Call 1/2/3 and 基地部署 for the player facing the phone.
// It does not enforce rules: every tap toggles, nothing is blocked.
// 結束回合 resets those marks, rotates the board, and swaps colors.
// 直向／橫向 only changes which way the board faces. It does not reset
// counts, timers, or the first-player draw.
//
// A fresh page, or 清空, starts at 抽先後攻: a gold coin, front FIRST
// and back SECOND. One tap tosses it through space. Gravity, a random
// path, bounces, and spin on all three axes run on each frame. A fair
// coin-flip picked at the tap is the face the toss settles on, so the
// result is not a preset clip. After the coin lies still long enough
// to read, 先攻 leaves the screen where it is and shows 先攻. 後攻
// rotates the stage 180° and swaps color, so the opponent faces the
// screen and sees 先攻. The coin then stays away until the next 清空.
// Reduced motion skips the flight and still uses the same fair face.
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
  const coinScene = document.getElementById("coin-scene");
  const coinEl = document.getElementById("coin");
  const shadowEl = document.getElementById("coin-shadow");
  const drawBtn = document.getElementById("btn-draw");
  const drawName = drawBtn ? drawBtn.querySelector(".draw-name") : null;
  const drawSub = drawBtn ? drawBtn.querySelector(".draw-sub") : null;
  const STEP = 0.004;
  const HOLD_MS = 1300;
  const REDUCED_HOLD_MS = 900;
  // Rest and landing lean so the rim stays visible. The flip result
  // is still which face points up: front = REST_RX, back = π + REST_RX.
  const REST_RX = 0.30;
  const REST_RY = 0.48;
  let uiLock = false;
  let tickTimer = 0;
  let toss = null;
  let tossRaf = 0;
  let tossGen = 0;
  let tossAcc = 0;

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

  function fairBit() {
    try {
      if (window.crypto && crypto.getRandomValues) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return (buf[0] & 1) === 1;
      }
    } catch (e) {}
    return Math.random() < 0.5;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function buildCoin() {
    if (!coinEl || coinEl.dataset.built === "1") return;
    const slabs = 12;
    for (let i = 0; i < slabs; i++) {
      const slab = document.createElement("span");
      slab.className = "coin-slab";
      const zf = -0.46 + ((i + 0.5) / slabs) * 0.92;
      slab.style.setProperty("--zf", zf.toFixed(3));
      if (i === 0 || i === slabs - 1) slab.classList.add("is-bevel");
      else if (i === 5 || i === 6) slab.classList.add("is-groove");
      else if (i === 3 || i === 8) slab.classList.add("is-glint");
      coinEl.appendChild(slab);
    }
    const n = 72;
    const rim = document.createElement("div");
    rim.className = "coin-rim";
    coinEl.style.setProperty("--n", String(n));
    for (let i = 0; i < n; i++) {
      const seg = document.createElement("span");
      const deg = (i + 0.5) * (360 / n);
      const lit = Math.cos(deg * Math.PI / 180);
      seg.className = "coin-rim-seg";
      if (lit > 0.86) seg.classList.add("is-lit");
      else if (lit < -0.45) seg.classList.add("is-dark");
      else if (i % 2 === 0) seg.classList.add("is-reed");
      seg.style.setProperty("--a", deg.toFixed(2) + "deg");
      rim.appendChild(seg);
    }
    coinEl.appendChild(rim);
    coinEl.dataset.built = "1";
  }

  function paintCoin(s) {
    if (!coinEl) return;
    const rx = (s.rx || 0) * 180 / Math.PI;
    const ry = (s.ry || 0) * 180 / Math.PI;
    const rz = (s.rz || 0) * 180 / Math.PI;
    const z = s.z || 0;
    coinEl.style.transform = "translate3d(" + s.x.toFixed(2) + "px," + (-s.y).toFixed(2) + "px," + z.toFixed(2) + "px) rotateZ(" + rz.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) rotateX(" + rx.toFixed(2) + "deg)";
    const hx = 50 - Math.sin(s.ry || 0) * 32 + Math.sin((s.rx || 0) * 2) * 8 + Math.sin(s.rz || 0) * 12;
    const hy = 28 + Math.sin(s.rx || 0) * 24 + Math.cos(s.rz || 0) * 8;
    const clamp = function (v) { return Math.max(10, Math.min(90, v)); };
    coinEl.style.setProperty("--hx", clamp(hx).toFixed(1) + "%");
    coinEl.style.setProperty("--hy", clamp(hy).toFixed(1) + "%");
    if (!shadowEl) return;
    const ceiling = s.ceiling > 0 ? s.ceiling : 160;
    const t = Math.max(0, Math.min(1, s.y / ceiling));
    const scale = 1 - t * 0.42;
    shadowEl.style.transform = "translate3d(" + ((s.x + z * 0.35) * 0.62).toFixed(2) + "px,0,0) scale(" + scale.toFixed(3) + ")";
    shadowEl.style.opacity = String(Math.max(0.14, 0.55 - t * 0.38));
  }

  function paintDrawCopy(mode, first) {
    if (!drawName || !drawSub) return;
    if (mode === "fly") {
      drawName.textContent = label("tableTossing");
      drawSub.textContent = "";
      return;
    }
    if (mode === "hold") {
      drawName.textContent = first ? label("tableCoinFirst") : label("tableCoinSecond");
      drawSub.textContent = first ? label("tableCoinFront") : label("tableCoinBack");
      return;
    }
    drawName.textContent = label("tableDraw");
    drawSub.textContent = label("tableDrawSub");
  }

  function markToss(phase, face) {
    if (!drawPanel) return;
    drawPanel.dataset.toss = phase;
    if (face) drawPanel.dataset.face = face;
    else delete drawPanel.dataset.face;
  }

  function facePose(first) {
    return {
      x: 0,
      y: 0,
      z: 0,
      rx: first ? REST_RX : Math.PI + REST_RX,
      ry: REST_RY,
      rz: 0,
      ceiling: 160
    };
  }

  function idlePose() {
    return facePose(true);
  }

  function resetCoinPose() {
    paintCoin(idlePose());
    markToss("idle", "");
    paintDrawCopy("idle");
    if (drawBtn && !state.drawn) {
      drawBtn.disabled = false;
      drawBtn.removeAttribute("aria-busy");
      drawBtn.setAttribute("aria-label", label("tableCoinAria"));
    }
  }

  function cancelToss() {
    tossGen += 1;
    toss = null;
    tossAcc = 0;
    if (tossRaf) cancelAnimationFrame(tossRaf);
    tossRaf = 0;
  }

  // Flight is a small rigid body: travel across the table, height,
  // and spin on all three axes. The face is steered only while falling
  // after the first bounce, so the tumble itself stays free.
  function aheadAngle(angle, vel, target) {
    const period = Math.PI * 2;
    let nearest = target;
    let nearestAbs = Infinity;
    let k;
    for (k = -6; k <= 8; k++) {
      const cand = target + period * k;
      const ad = Math.abs(cand - angle);
      if (ad < nearestAbs) { nearestAbs = ad; nearest = cand; }
    }
    if (nearestAbs < 0.45 || Math.abs(vel) < 0.8) return nearest;
    const dir = vel < 0 ? -1 : 1;
    let best = nearest;
    let bestAbs = Infinity;
    for (k = -6; k <= 8; k++) {
      const cand = target + period * k;
      const d = cand - angle;
      if (dir > 0 && d < 0.05) continue;
      if (dir < 0 && d > -0.05) continue;
      const ad = Math.abs(d);
      if (ad < bestAbs && ad < period * 1.35) { bestAbs = ad; best = cand; }
    }
    return best;
  }

  function timeToGround(y, vy, g) {
    const A = 0.5 * g;
    const B = -vy;
    const C = -Math.max(0, y);
    const disc = B * B - 4 * A * C;
    if (!(A > 0) || disc < 0) return 0.16;
    const t = (-B + Math.sqrt(disc)) / (2 * A);
    return t > 0.02 ? t : 0.02;
  }

  function stepToss(s, dt) {
    let calm, destX, destY, destZ;
    if (s.phase === "fly") {
      s.vy -= s.g * dt;
      s.y += s.vy * dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.vx *= Math.exp(-0.32 * dt);
      s.vz *= Math.exp(-0.4 * dt);
      const maxX = s.maxX || 56;
      if (s.x > maxX) { s.x = maxX; s.vx = -Math.abs(s.vx) * 0.62; }
      if (s.x < -maxX) { s.x = -maxX; s.vx = Math.abs(s.vx) * 0.62; }
      if (s.z > 34) { s.z = 34; s.vz *= -0.45; }
      if (s.z < -26) { s.z = -26; s.vz *= -0.45; }
      s.vrx *= Math.exp(-s.drag * dt);
      s.vry *= Math.exp(-0.1 * dt);
      s.vrz *= Math.exp(-0.14 * dt);
      s.rx += s.vrx * dt;
      s.ry += s.vry * dt;
      s.rz += s.vrz * dt;
      if (s.bounces >= 1 && s.vy < 0 && s.y > 0 && s.y < s.ceiling * 0.72) {
        const tHit = Math.min(0.7, timeToGround(s.y, s.vy, s.g));
        const wantX = (aheadAngle(s.rx, s.vrx, s.target) - s.rx) / tHit;
        const wantY = (aheadAngle(s.ry, s.vry, REST_RY) - s.ry) / tHit;
        const gain = Math.min(1, dt * (0.7 + 2.2 / tHit));
        s.vrx += (Math.max(-46, Math.min(46, wantX)) - s.vrx) * gain;
        s.vry += (Math.max(-26, Math.min(26, wantY)) - s.vry) * gain * 0.85;
      }
      if (s.y <= 0 && s.vy < 0) {
        s.y = 0;
        s.bounces += 1;
        const impact = Math.abs(s.vy);
        const e = s.bounces === 1 ? s.rest1 : s.rest2;
        s.vx = s.vx * (0.42 + Math.random() * 0.28) + (Math.random() - 0.5) * 110;
        s.vz = s.vz * 0.35 + (Math.random() - 0.5) * 50;
        s.vrx *= s.spinKeep;
        s.vry = s.vry * s.spinKeep + (Math.random() - 0.5) * 4;
        s.vrz = s.vrz * s.spinKeep + (Math.random() - 0.5) * 3.2;
        if (impact < 150 || s.bounces >= 3) {
          s.vy = 0;
          s.phase = "settle";
          s.settleFor = 0;
          s.vrx = Math.max(-3.4, Math.min(3.4, s.vrx));
          s.vry = Math.max(-2.6, Math.min(2.6, s.vry));
          s.vrz = Math.max(-3.2, Math.min(3.2, s.vrz));
          return;
        }
        s.vy = impact * e;
      }
      return;
    }
    s.vy -= s.g * dt;
    s.y += s.vy * dt;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = s.vy < -34 ? -s.vy * 0.28 : 0;
      s.vx *= 0.84;
      s.vz *= 0.8;
    }
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.vx += (-s.x * 26 - s.vx * 6.5) * dt;
    s.vz += (-s.z * 28 - s.vz * 7) * dt;
    destX = aheadAngle(s.rx, s.vrx, s.target);
    destY = aheadAngle(s.ry, s.vry, REST_RY);
    destZ = aheadAngle(s.rz, s.vrz, 0);
    s.vrx += ((destX - s.rx) * 42 - s.vrx * 10) * dt;
    s.rx += s.vrx * dt;
    s.vry += ((destY - s.ry) * 38 - s.vry * 9) * dt;
    s.ry += s.vry * dt;
    s.vrz += ((destZ - s.rz) * 34 - s.vrz * 8) * dt;
    s.rz += s.vrz * dt;
    calm = Math.abs(destX - s.rx) < 0.06 && Math.abs(s.vrx) < 0.45
      && Math.abs(destY - s.ry) < 0.07 && Math.abs(s.vry) < 0.4
      && Math.abs(destZ - s.rz) < 0.09 && Math.abs(s.vrz) < 0.45
      && s.y < 1 && Math.abs(s.vy) < 2 && Math.abs(s.x) < 3 && Math.abs(s.z) < 3;
    s.settleFor = calm ? s.settleFor + dt : 0;
    if (s.settleFor >= 0.1) s.phase = "done";
  }

  function blankToss(proto) {
    return {
      y: 0,
      vy: proto.vy,
      g: proto.g,
      x: 0,
      vx: proto.vx || 0,
      z: 0,
      vz: proto.vz || 0,
      rx: 0,
      vrx: proto.vrx,
      ry: 0,
      vry: proto.vry || 0,
      rz: 0,
      vrz: proto.vrz || 0,
      rest1: proto.rest1,
      rest2: proto.rest2,
      spinKeep: proto.spinKeep,
      drag: proto.drag,
      bounces: 0,
      phase: "fly",
      target: proto.target,
      settleFor: 0,
      ceiling: proto.ceiling,
      maxX: proto.maxX || 56,
      first: proto.first,
      gen: proto.gen
    };
  }

  function measureCeiling() {
    if (!coinScene || !coinEl) return 140;
    const h = coinScene.clientHeight || 0;
    const d = coinEl.offsetWidth || 160;
    const head = h * 0.56 - d * 0.5 - 8;
    return Math.max(64, Math.min(head, 230));
  }

  function kickSettle(s) {
    const lean = Math.random() < 0.5 ? -1 : 1;
    s.ry = REST_RY + lean * (0.22 + Math.random() * 0.16);
    s.vry = -lean * (1.6 + Math.random() * 1.4);
    s.rz += (Math.random() - 0.5) * 0.45;
    s.vrz += (Math.random() - 0.5) * 2.8;
    s.vx += (Math.random() - 0.5) * 50;
    const hop = Math.min(26, Math.max(10, s.ceiling * 0.16));
    s.vy = Math.sqrt(2 * s.g * hop) * (0.82 + Math.random() * 0.28);
  }

  function finishToss(first) {
    toss = null;
    tossAcc = 0;
    if (tossRaf) cancelAnimationFrame(tossRaf);
    tossRaf = 0;
    state.drawn = true;
    state.opening = true;
    if (!first) state.side = state.side === "a" ? "b" : "a";
    save();
    render(false);
    if (live) live.textContent = first ? label("tableLiveDrawStay") : label("tableLiveDrawFlip");
    lockFor(first ? 280 : 520);
  }

  function beginHold(s) {
    const gen = s.gen;
    const first = s.first;
    const flat = facePose(first);
    flat.ceiling = s.ceiling;
    paintCoin(flat);
    paintDrawCopy("hold", first);
    markToss("hold", first ? "first" : "second");
    window.setTimeout(function () {
      if (gen !== tossGen) return;
      finishToss(first);
    }, HOLD_MS);
  }

  function frameToss(now) {
    const s = toss;
    if (!s || s.gen !== tossGen) return;
    if (!s.last) s.last = now;
    let dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    tossAcc += dt;
    let guard = 0;
    while (tossAcc >= STEP && s.phase !== "done" && guard < 40) {
      const before = s.phase;
      stepToss(s, STEP);
      if (before === "fly" && s.phase === "settle") {
        kickSettle(s);
        paintDrawCopy("hold", s.first);
        markToss("settle", s.first ? "first" : "second");
        if (live) live.textContent = s.first ? label("tableLiveCoinFirst") : label("tableLiveCoinSecond");
      }
      tossAcc -= STEP;
      guard += 1;
    }
    if (s.phase === "done") {
      s.rx = s.target;
      s.ry = REST_RY;
      s.rz = 0;
      s.x = 0;
      s.y = 0;
      s.z = 0;
      s.vy = 0;
      paintCoin(s);
      beginHold(s);
      return;
    }
    paintCoin(s);
    tossRaf = window.requestAnimationFrame(frameToss);
  }

  function startToss() {
    if (state.drawn || uiLock || toss) return;
    const first = fairBit();
    const gen = tossGen + 1;
    tossGen = gen;
    if (drawBtn) {
      drawBtn.disabled = true;
      drawBtn.setAttribute("aria-busy", "true");
      drawBtn.setAttribute("aria-label", label("tableTossing"));
    }
    if (live) live.textContent = label("tableLiveToss");
    markToss(prefersReducedMotion() ? "hold" : "fly", first ? "first" : "second");
    if (prefersReducedMotion()) {
      toss = { reduced: true, gen: gen, first: first };
      paintCoin(facePose(first));
      paintDrawCopy("hold", first);
      if (live) live.textContent = first ? label("tableLiveCoinFirst") : label("tableLiveCoinSecond");
      window.setTimeout(function () {
        if (gen !== tossGen) return;
        finishToss(first);
      }, REDUCED_HOLD_MS);
      return;
    }
    const ceiling = measureCeiling();
    const air = (ceiling < 110 ? 1.22 : 1.05) + Math.random() * 0.16;
    const h = ceiling * (0.9 + Math.random() * 0.1);
    const g = (8 * h) / (air * air);
    const maxX = (function () {
      const sw = coinScene ? coinScene.clientWidth : 360;
      const d = coinEl ? coinEl.offsetWidth : 160;
      return Math.max(32, Math.min(72, (sw - d) * 0.2));
    })();
    const spin = Math.random() < 0.5 ? -1 : 1;
    const proto = {
      vy: g * air / 2,
      g: g,
      rest1: 0.5 + Math.random() * 0.16,
      rest2: 0.36 + Math.random() * 0.12,
      spinKeep: 0.55 + Math.random() * 0.1,
      drag: 0.08 + Math.random() * 0.06,
      target: first ? REST_RX : Math.PI + REST_RX,
      ceiling: h,
      maxX: maxX,
      first: first,
      gen: gen,
      vx: (Math.random() - 0.5) * 180,
      vz: (Math.random() - 0.5) * 80,
      vrx: spin * (18 + Math.random() * 16),
      vry: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 12),
      vrz: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 12)
    };
    toss = blankToss(proto);
    toss.rx = REST_RX;
    toss.ry = REST_RY;
    toss.rz = (Math.random() - 0.5) * 0.6;
    toss.gen = gen;
    toss.first = first;
    toss.ceiling = h;
    toss.last = 0;
    tossAcc = 0;
    paintDrawCopy("fly");
    paintCoin(toss);
    tossRaf = window.requestAnimationFrame(frameToss);
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
    if (pre && !toss) resetCoinPose();
    else if (drawBtn && !pre) drawBtn.setAttribute("aria-label", label("tableCoinAria"));
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

  if (drawBtn) drawBtn.addEventListener("click", () => {
    startToss();
  });

  clearBtn.addEventListener("click", () => {
    if (uiLock) return;
    cancelToss();
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

  buildCoin();
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
