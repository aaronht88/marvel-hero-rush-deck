// =============================================================
// Marvel Hero Rush — Google login + Workers/D1 sync
// =============================================================
// GIS credential (id_token) + optional SYNC_API_BASE Worker.
// Exposes window.MHRGoogleSync. Degrades when Client ID / API empty.

(function () {
  const LS_META = "mhr_sync_meta_v1";
  const SS_SESSION = "mhr_google_session_v1";
  const DEBOUNCE_MS = 1500;
  const SCHEMA = 1;

  let cfg = () => (window.MHR_GOOGLE_CONFIG || {});
  let hooks = { getState: null, applyState: null, toast: null, t: (k) => k };
  let gisLoaded = false;
  let gisLoading = null;
  let idInitialized = false;
  let session = null; // { idToken, sessionToken, email, sub, exp }
  let syncing = false;
  let debounceTimer = null;
  let conflictResolvedThisSession = false;
  let ui = {};
  let lastStatus = "idle";
  let lastStatusDetail = "";
  let lastSyncedAt = null;
  let authListeners = [];

  function t(key, vars) {
    try { return hooks.t ? hooks.t(key, vars) : key; } catch (e) { return key; }
  }
  function toast(msg) {
    if (hooks.toast) hooks.toast(msg);
  }
  function clientId() {
    return String((cfg().GOOGLE_CLIENT_ID || "").trim());
  }
  function syncApiBase() {
    return String((cfg().SYNC_API_BASE || "").trim()).replace(/\/$/, "");
  }
  function isConfigured() {
    return !!clientId();
  }
  function hasSyncApi() {
    return !!syncApiBase();
  }
  function isSignedIn() {
    return !!(session && session.exp > Date.now() + 5000 && (session.idToken || session.sessionToken));
  }

  // ---------- meta / local updatedAt ----------
  function readMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(LS_META) || "null");
      if (m && typeof m.updatedAt === "string") return m;
    } catch (e) {}
    return { updatedAt: null };
  }
  function bumpMeta(iso) {
    const updatedAt = iso || new Date().toISOString();
    try { localStorage.setItem(LS_META, JSON.stringify({ updatedAt })); } catch (e) {}
    return updatedAt;
  }
  function ensureLocalUpdatedAt() {
    const m = readMeta();
    if (m.updatedAt) return m.updatedAt;
    return bumpMeta();
  }

  // ---------- session persistence ----------
  function saveSession( partial ) {
    session = Object.assign({}, session || {}, partial || {});
    try {
      sessionStorage.setItem(SS_SESSION, JSON.stringify({
        idToken: session.idToken || "",
        sessionToken: session.sessionToken || "",
        email: session.email || "",
        sub: session.sub || "",
        exp: session.exp || 0,
      }));
    } catch (e) {}
  }
  function clearSession() {
    session = null;
    try { sessionStorage.removeItem(SS_SESSION); } catch (e) {}
    notifyAuth();
  }
  function restoreSession() {
    try {
      const raw = sessionStorage.getItem(SS_SESSION);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || !o.exp || o.exp <= Date.now() + 5000) {
        clearSession();
        return false;
      }
      if (!o.idToken && !o.sessionToken) {
        clearSession();
        return false;
      }
      session = o;
      return true;
    } catch (e) {
      return false;
    }
  }

  function decodeJwtPayload(jwt) {
    try {
      const part = String(jwt || "").split(".")[1];
      if (!part) return null;
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(b64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  // ---------- GIS script ----------
  function loadGis() {
    if (gisLoaded && window.google && google.accounts && google.accounts.id) {
      return Promise.resolve();
    }
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => {
        gisLoaded = true;
        resolve();
      };
      s.onerror = () => {
        gisLoading = null;
        reject(new Error("GIS load failed"));
      };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  function ensureIdClient() {
    if (idInitialized) return;
    if (!window.google || !google.accounts || !google.accounts.id) {
      throw new Error("GIS not ready");
    }
    google.accounts.id.initialize({
      client_id: clientId(),
      callback: (resp) => {
        // used when One Tap / button fires; also wired via Promise below
        if (window.__mhrGisCredentialResolve) {
          window.__mhrGisCredentialResolve(resp);
          window.__mhrGisCredentialResolve = null;
          window.__mhrGisCredentialReject = null;
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });
    idInitialized = true;
  }

  function requestCredential() {
    return new Promise(async (resolve, reject) => {
      try {
        await loadGis();
        ensureIdClient();
        window.__mhrGisCredentialResolve = resolve;
        window.__mhrGisCredentialReject = reject;
        // Prefer a temporary GIS button click (popup) over One Tap alone —
        // render into a hidden host and programmatically click.
        let host = document.getElementById("mhr-gis-btn-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "mhr-gis-btn-host";
          host.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
          document.body.appendChild(host);
        }
        host.innerHTML = "";
        google.accounts.id.renderButton(host, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
        });
        // Also try One Tap; either path delivers credential to initialize callback
        try { google.accounts.id.prompt(); } catch (e) {}
        // Click the rendered button so user gets the account chooser
        const btn = host.querySelector("div[role=button], button, iframe");
        // GIS often injects an iframe; we cannot click cross-origin iframe.
        // Fall back: show prompt and also make the real chip open a visible button overlay.
        const visible = document.getElementById("mhr-gis-visible");
        if (visible) {
          visible.hidden = false;
          visible.innerHTML = "";
          google.accounts.id.renderButton(visible, {
            type: "standard",
            theme: "filled_black",
            size: "medium",
            text: "signin_with",
            shape: "pill",
            width: 220,
          });
        }
        // Timeout if user abandons
        setTimeout(() => {
          if (window.__mhrGisCredentialReject === reject) {
            window.__mhrGisCredentialResolve = null;
            window.__mhrGisCredentialReject = null;
            reject(new Error("Sign-in cancelled or timed out"));
          }
        }, 120000);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function applyCredential(credentialJwt) {
    const payload = decodeJwtPayload(credentialJwt);
    if (!payload || !payload.sub) throw new Error("Invalid id_token");
    const expMs = (Number(payload.exp) || 0) * 1000;
    saveSession({
      idToken: credentialJwt,
      email: payload.email || "",
      sub: payload.sub,
      exp: expMs || (Date.now() + 3600 * 1000),
      sessionToken: (session && session.sessionToken) || "",
    });

    if (hasSyncApi()) {
      try {
        const res = await apiFetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: credentialJwt }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.session_token) {
            saveSession({
              sessionToken: data.session_token,
              email: data.email || session.email,
              sub: data.sub || session.sub,
              exp: data.exp ? Number(data.exp) * 1000 : session.exp,
            });
          }
        } else {
          console.warn("[MHRGoogleSync] /api/auth", res.status);
        }
      } catch (e) {
        console.warn("[MHRGoogleSync] /api/auth failed", e);
        toast(t("googleSyncApiMissing"));
      }
    }
    notifyAuth();
  }

  // ---------- Worker API ----------
  async function apiFetch(path, options) {
    const base = syncApiBase();
    if (!base) throw new Error("SYNC_API_BASE empty");
    const opts = Object.assign({ credentials: "include" }, options || {});
    opts.headers = Object.assign({}, opts.headers || {});
    const token = (session && (session.sessionToken || session.idToken)) || "";
    if (token && !opts.headers.Authorization) {
      opts.headers.Authorization = "Bearer " + token;
    }
    return fetch(base + path, opts);
  }

  function buildPayloadFromState(state) {
    const updatedAt = (state && state.updatedAt) || ensureLocalUpdatedAt();
    return {
      schema: SCHEMA,
      updatedAt,
      decks: state.decks,
      favs: state.favs,
      lang: state.lang,
    };
  }

  async function downloadSyncJson() {
    const res = await apiFetch("/api/sync", { method: "GET" });
    if (res.status === 404) return null;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error("GET /api/sync " + res.status + " " + txt.slice(0, 120));
    }
    const data = await res.json();
    if (!data || data.empty) return null;
    return data.payload || data;
  }

  async function uploadSyncJson(payload) {
    const res = await apiFetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error("PUT /api/sync " + res.status + " " + txt.slice(0, 120));
    }
    return res.json().catch(() => ({}));
  }

  function snapshotEqual(a, b) {
    try {
      return JSON.stringify(normalizeSnap(a)) === JSON.stringify(normalizeSnap(b));
    } catch (e) {
      return false;
    }
  }
  function normalizeSnap(s) {
    if (!s) return null;
    return {
      decks: s.decks || null,
      favs: Array.isArray(s.favs) ? s.favs.slice().sort() : [],
      lang: s.lang || null,
    };
  }
  function parseTime(iso) {
    const t = Date.parse(iso || "");
    return Number.isFinite(t) ? t : 0;
  }
  function formatTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString();
    } catch (e) {
      return String(iso);
    }
  }

  function showConflictModal(cloudAt, localAt) {
    return new Promise((resolve) => {
      const modal = document.getElementById("google-conflict-modal");
      if (!modal) {
        resolve(parseTime(cloudAt) > parseTime(localAt) ? "cloud" : "local");
        return;
      }
      const msg = document.getElementById("google-conflict-msg");
      if (msg) {
        msg.textContent = t("googleConflictMsg", {
          cloud: formatTime(cloudAt),
          local: formatTime(localAt),
        });
      }
      const bLocal = document.getElementById("google-conflict-local");
      const bCloud = document.getElementById("google-conflict-cloud");
      const bCancel = document.getElementById("google-conflict-cancel");
      if (bLocal) bLocal.textContent = t("googleConflictKeepLocal");
      if (bCloud) bCloud.textContent = t("googleConflictUseCloud");
      if (bCancel) bCancel.textContent = t("googleConflictCancel");

      function cleanup(choice) {
        modal.hidden = true;
        modal.classList.remove("show");
        if (bLocal) bLocal.onclick = null;
        if (bCloud) bCloud.onclick = null;
        if (bCancel) bCancel.onclick = null;
        modal.onclick = null;
        resolve(choice);
      }
      if (bLocal) bLocal.onclick = () => cleanup("local");
      if (bCloud) bCloud.onclick = () => cleanup("cloud");
      if (bCancel) bCancel.onclick = () => cleanup("cancel");
      modal.onclick = (e) => { if (e.target === modal) cleanup("cancel"); };
      modal.hidden = false;
      void modal.offsetWidth;
      modal.classList.add("show");
    });
  }

  async function pullAndMerge() {
    if (!hooks.getState || !hooks.applyState) return;
    if (!hasSyncApi()) {
      setStatus("idle");
      toast(t("googleSyncApiMissing"));
      return;
    }
    if (syncing) return;
    syncing = true;
    clearTimeout(debounceTimer);
    setStatus("syncing");
    try {
      const cloud = await downloadSyncJson();
      const localState = hooks.getState();
      const localAt = localState.updatedAt || ensureLocalUpdatedAt();
      const localSnap = {
        decks: localState.decks,
        favs: localState.favs,
        lang: localState.lang,
        updatedAt: localAt,
      };

      if (!cloud) {
        const payload = buildPayloadFromState(localSnap);
        await uploadSyncJson(payload);
        setStatus("synced");
        toast(t("googleSynced"));
        return;
      }

      const cloudSnap = {
        decks: cloud.decks,
        favs: cloud.favs || [],
        lang: cloud.lang,
        updatedAt: cloud.updatedAt,
      };

      if (snapshotEqual(localSnap, cloudSnap)) {
        if (!readMeta().updatedAt && cloud.updatedAt) bumpMeta(cloud.updatedAt);
        setStatus("synced");
        return;
      }

      let choice;
      if (!conflictResolvedThisSession) {
        conflictResolvedThisSession = true;
        choice = await showConflictModal(cloud.updatedAt, localAt);
        if (choice === "cancel") {
          setStatus("idle");
          return;
        }
      } else {
        choice = parseTime(cloud.updatedAt) > parseTime(localAt) ? "cloud" : "local";
      }

      if (choice === "cloud") {
        hooks.applyState({
          decks: cloud.decks,
          favs: cloud.favs || [],
          lang: cloud.lang,
          updatedAt: cloud.updatedAt || new Date().toISOString(),
        });
        bumpMeta(cloud.updatedAt || new Date().toISOString());
        setStatus("synced");
        toast(t("googleSyncedFromCloud"));
      } else {
        const payload = buildPayloadFromState(localSnap);
        await uploadSyncJson(payload);
        setStatus("synced");
        toast(t("googleSynced"));
      }
    } catch (e) {
      console.warn("[MHRGoogleSync] pullAndMerge", e);
      setStatus("error", e.message || String(e));
      toast(t("googleSyncError"));
    } finally {
      syncing = false;
    }
  }

  async function pushNow() {
    if (!hooks.getState) return;
    if (!hasSyncApi() || !isSignedIn()) return;
    if (syncing) return;
    syncing = true;
    setStatus("syncing");
    try {
      const state = hooks.getState();
      if (!state.updatedAt) state.updatedAt = ensureLocalUpdatedAt();
      const payload = buildPayloadFromState(state);
      await uploadSyncJson(payload);
      setStatus("synced");
    } catch (e) {
      console.warn("[MHRGoogleSync] pushNow", e);
      setStatus("error", e.message || String(e));
      toast(t("googleSyncError"));
    } finally {
      syncing = false;
    }
  }

  function onLocalChange() {
    if (syncing) return;
    bumpMeta();
    if (!isSignedIn() || !hasSyncApi()) {
      updateUI();
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pushNow();
    }, DEBOUNCE_MS);
    updateUI();
  }

  // ---------- UI ----------
  function cacheUI() {
    ui.chip = document.getElementById("google-sync-chip");
    ui.btnSignIn = document.getElementById("btn-google-signin");
    ui.userWrap = document.getElementById("google-sync-user");
    ui.email = document.getElementById("google-sync-email");
    ui.btnSync = document.getElementById("btn-google-sync");
    ui.btnSignOut = document.getElementById("btn-google-signout");
    ui.status = document.getElementById("google-sync-status");
    ui.gisVisible = document.getElementById("mhr-gis-visible");
  }

  function setStatus(kind, detail) {
    lastStatus = kind;
    lastStatusDetail = detail || "";
    if (kind === "synced") lastSyncedAt = new Date();
    updateUI();
  }

  function truncateEmail(email) {
    if (!email) return "";
    if (email.length <= 22) return email;
    const at = email.indexOf("@");
    if (at > 0) {
      const local = email.slice(0, at);
      const domain = email.slice(at);
      const short = local.length > 8 ? local.slice(0, 6) + "…" : local;
      return short + domain;
    }
    return email.slice(0, 18) + "…";
  }

  function hideGisButton() {
    const visible = document.getElementById("mhr-gis-visible");
    if (visible) {
      visible.hidden = true;
      visible.innerHTML = "";
    }
  }

  function updateUI() {
    if (!ui.btnSignIn) cacheUI();
    if (!ui.chip) return;

    const configured = isConfigured();
    const signed = isSignedIn();

    if (!configured) {
      if (ui.btnSignIn) {
        ui.btnSignIn.hidden = false;
        ui.btnSignIn.textContent = t("googleSyncBtn");
        ui.btnSignIn.title = t("googleNotConfigured");
      }
      if (ui.userWrap) ui.userWrap.hidden = true;
      if (ui.status) {
        ui.status.textContent = "";
        ui.status.title = t("googleNotConfigured");
      }
      hideGisButton();
      return;
    }

    if (!signed) {
      if (ui.btnSignIn) {
        ui.btnSignIn.hidden = false;
        ui.btnSignIn.textContent = t("googleSignIn");
        ui.btnSignIn.title = "";
      }
      if (ui.userWrap) ui.userWrap.hidden = true;
    } else {
      if (ui.btnSignIn) ui.btnSignIn.hidden = true;
      if (ui.userWrap) ui.userWrap.hidden = false;
      hideGisButton();
      if (ui.email) {
        ui.email.textContent = truncateEmail((session && session.email) || "Google");
        ui.email.title = (session && session.email) || "";
      }
      if (ui.btnSync) ui.btnSync.textContent = t("googleSyncNow");
      if (ui.btnSignOut) ui.btnSignOut.textContent = t("googleSignOut");
    }

    if (ui.status) {
      let text = "";
      if (lastStatus === "syncing") text = t("googleSyncing");
      else if (lastStatus === "synced") {
        text = t("googleSynced");
        if (lastSyncedAt) {
          try { text += " · " + lastSyncedAt.toLocaleTimeString(); } catch (e) {}
        }
      } else if (lastStatus === "error") text = t("googleSyncError");
      else if (signed && !hasSyncApi()) text = t("googleSyncApiMissingShort");
      ui.status.textContent = text;
      ui.status.title = lastStatusDetail || text;
      ui.status.dataset.status = lastStatus;
    }
  }

  async function handleCredentialResponse(resp) {
    if (!resp || !resp.credential) throw new Error("No credential");
    await applyCredential(resp.credential);
    hideGisButton();
    updateUI();
    if (hasSyncApi()) {
      await pullAndMerge();
    } else {
      setStatus("idle");
      toast(t("googleSignedInNoSync"));
    }
  }

  async function signIn() {
    if (!isConfigured()) {
      toast(t("googleNotConfigured"));
      return;
    }
    setStatus("syncing");
    try {
      await loadGis();
      ensureIdClient();
      // Re-bind callback to our promise-free path for this click
      const prevResolve = window.__mhrGisCredentialResolve;
      const credPromise = new Promise((resolve, reject) => {
        window.__mhrGisCredentialResolve = (resp) => {
          window.__mhrGisCredentialResolve = prevResolve || null;
          resolve(resp);
        };
        window.__mhrGisCredentialReject = reject;
      });
      const visible = document.getElementById("mhr-gis-visible");
      if (visible) {
        visible.hidden = false;
        visible.innerHTML = "";
        google.accounts.id.renderButton(visible, {
          type: "standard",
          theme: "filled_black",
          size: "medium",
          text: "signin_with",
          shape: "pill",
          width: 220,
        });
      }
      try { google.accounts.id.prompt(); } catch (e) {}
      toast(t("googleSignInHint"));
      const resp = await Promise.race([
        credPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error("Sign-in timed out")), 120000)),
      ]);
      await handleCredentialResponse(resp);
    } catch (e) {
      console.warn("[MHRGoogleSync] signIn", e);
      setStatus("error", e.message || String(e));
      if (String(e.message || "").indexOf("timed out") === -1 && String(e.message || "").indexOf("cancelled") === -1) {
        toast(t("googleSyncError"));
      }
      hideGisButton();
      updateUI();
    }
  }

  function signOut() {
    try {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}
    if (hasSyncApi() && session) {
      apiFetch("/api/auth", { method: "DELETE" }).catch(() => {});
    }
    clearSession();
    conflictResolvedThisSession = false;
    hideGisButton();
    setStatus("idle");
    toast(t("googleSignedOut"));
    updateUI();
  }

  async function syncNow() {
    if (!isConfigured()) {
      toast(t("googleNotConfigured"));
      return;
    }
    if (!hasSyncApi()) {
      toast(t("googleSyncApiMissing"));
      return;
    }
    if (!isSignedIn()) {
      await signIn();
      return;
    }
    try {
      await pullAndMerge();
    } catch (e) {
      console.warn("[MHRGoogleSync] syncNow", e);
      setStatus("error", e.message || String(e));
      toast(t("googleSyncError"));
    }
  }

  function bindUI() {
    cacheUI();
    if (ui.btnSignIn) {
      ui.btnSignIn.addEventListener("click", () => {
        if (!isConfigured()) {
          toast(t("googleNotConfigured"));
          return;
        }
        signIn();
      });
    }
    if (ui.btnSync) ui.btnSync.addEventListener("click", () => syncNow());
    if (ui.btnSignOut) ui.btnSignOut.addEventListener("click", () => signOut());
  }

  async function init(options) {
    hooks = Object.assign(hooks, options || {});
    bindUI();
    ensureLocalUpdatedAt();

    if (!isConfigured()) {
      updateUI();
      return;
    }

    if (restoreSession()) {
      updateUI();
      if (hasSyncApi()) {
        pullAndMerge().catch(() => {});
      }
    } else {
      updateUI();
      loadGis().catch(() => {});
    }
  }

  function refreshLabels() {
    updateUI();
  }

  function notifyAuth() {
    authListeners.forEach((fn) => {
      try { fn({ signedIn: isSignedIn(), email: (session && session.email) || "" }); } catch (e) {}
    });
  }
  function onAuthChange(fn) {
    if (typeof fn === "function") authListeners.push(fn);
  }

  window.MHRGoogleSync = {
    init,
    onLocalChange,
    isSignedIn,
    isConfigured,
    hasSyncApi,
    signIn,
    signOut,
    syncNow,
    refreshLabels,
    apiFetch,
    onAuthChange,
    getUserEmail: () => (session && session.email) || "",
    getSyncApiBase: () => syncApiBase(),
  };
})();
