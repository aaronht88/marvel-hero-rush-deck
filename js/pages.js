// =============================================================
// Marvel Hero Rush Deck Builder — top-level pages
// Deck Builder / News (HK + intl) / Deck reference (+ community)
// =============================================================
(function () {
  const { t } = window.MHR_I18N;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAGES = ["builder", "news", "decks"];
  const COLOR_VAR = { Red: "var(--red)", Yellow: "var(--yellow)", Blue: "var(--blue)", Green: "var(--green)" };
  const CHECK_LABELS = {
    card_count_50: "A1 · 剛好 50 張角色卡",
    unique_name_leq_3: "A2 · 同名最多 3 張",
    colors_ok: "A3 · 顏色最多 2 種",
    code_importable: "A4 · 分享碼可匯入",
    no_rush_points: "A5 · 不含 Rush Point",
    note_engine: "C · 玩法描述（觸發→回報）",
    submitter_name: "B · 上載者顯示名稱",
    deck_name: "B · 牌組名稱",
  };

  let news = null, newsFailed = false, newsRegion = "hk";
  let refDecks = null, decksFailed = false;
  let communityDecks = [];
  let communityFailed = false;
  let pendingDecks = [];
  let myDecks = [];
  let isAdmin = false;
  let decksTab = "editorial"; // editorial | community | submit | admin | mine

  function loadJSON(url) {
    return fetch(url + "?t=" + Date.now(), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function gs() {
    return window.MHRGoogleSync || null;
  }

  async function api(path, options) {
    const g = gs();
    if (!g || !g.hasSyncApi || !g.hasSyncApi()) throw new Error("no_api");
    return g.apiFetch(path, options);
  }

  // ---------- page switching ----------
  function showPage(p, push) {
    if (!PAGES.includes(p)) p = "builder";
    document.querySelectorAll(".page-tab").forEach((b) => {
      const on = b.dataset.page === p;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    PAGES.forEach((id) => { const el = $("#page-" + id); if (el) el.hidden = id !== p; });
    if (push) history.replaceState(null, "", p === "builder" ? location.pathname + location.search : "#" + p);
    if (p === "news" && !news && !newsFailed) {
      loadJSON("data/news.json").then((d) => { news = d; renderNews(); }).catch(() => { newsFailed = true; renderNews(); });
    }
    if (p === "decks") {
      if (!refDecks && !decksFailed) {
        loadJSON("data/decks.json").then((d) => { refDecks = d.decks || []; renderDecks(); }).catch(() => { decksFailed = true; renderDecks(); });
      }
      refreshCommunity();
    }
    render();
  }
  document.querySelectorAll(".page-tab").forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page, true)));
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1)));

  // ---------- news ----------
  function catLabel(c) {
    return { event: t("catEvent"), product: t("catProduct"), notice: t("catNotice") }[c] || c || "";
  }
  function renderNews() {
    const list = $("#news-list");
    if (!list) return;
    document.querySelectorAll("[data-news]").forEach((b) => b.classList.toggle("active", b.dataset.news === newsRegion));
    $("#news-note").textContent = t(newsRegion === "hk" ? "newsNoteHK" : "newsNoteIntl");
    if (newsFailed) { list.innerHTML = '<p class="empty">' + esc(t("newsLoadFail")) + "</p>"; return; }
    if (!news) { list.innerHTML = ""; return; }
    $("#news-updated").textContent = news.updated ? t("newsUpdated", { t: news.updated }) : "";
    const items = news[newsRegion] || [];
    if (!items.length) { list.innerHTML = '<p class="empty">' + esc(t("newsEmpty")) + "</p>"; return; }
    list.innerHTML = items.map((it) => {
      const title = it.title_zh || it.title;
      const meta = [it.date + (it.time ? " " + it.time : ""), it.venue, it.source].filter(Boolean).map(esc).join(" · ");
      return '<a class="news-item" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        (it.category ? '<span class="news-cat cat-' + esc(it.category) + '">' + esc(catLabel(it.category)) + "</span>" : "") +
        '<span class="news-body"><span class="news-title">' + esc(title) + "</span>" +
        (it.summary_zh ? '<span class="news-summary">' + esc(it.summary_zh) + "</span>" : "") +
        '<span class="news-meta">' + meta + "</span></span></a>";
    }).join("");
  }
  document.querySelectorAll("[data-news]").forEach((b) => b.addEventListener("click", () => { newsRegion = b.dataset.news; renderNews(); }));

  // ---------- community data ----------
  async function refreshCommunity() {
    const g = gs();
    if (!g || !g.hasSyncApi || !g.hasSyncApi()) {
      communityFailed = false;
      communityDecks = [];
      renderDecks();
      return;
    }
    try {
      const pub = await api("/api/decks?status=published");
      if (pub.ok) {
        const data = await pub.json();
        communityDecks = data.decks || [];
        communityFailed = false;
      } else {
        communityFailed = true;
      }
    } catch (e) {
      communityFailed = true;
    }

    if (g.isSignedIn && g.isSignedIn()) {
      try {
        const me = await api("/api/me");
        if (me.ok) {
          const m = await me.json();
          isAdmin = !!m.is_admin;
        }
      } catch (e) { isAdmin = false; }
      try {
        const mine = await api("/api/decks?mine=1");
        if (mine.ok) {
          const d = await mine.json();
          myDecks = d.decks || [];
        }
      } catch (e) { myDecks = []; }
      if (isAdmin) {
        try {
          const pend = await api("/api/decks?status=pending");
          if (pend.ok) {
            const d = await pend.json();
            pendingDecks = d.decks || [];
          }
        } catch (e) { pendingDecks = []; }
      } else {
        pendingDecks = [];
      }
    } else {
      isAdmin = false;
      myDecks = [];
      pendingDecks = [];
    }
    renderDecks();
  }

  function colorDots(colors) {
    return (colors || []).map((c) =>
      '<span class="color-dot" style="background:' + (COLOR_VAR[c] || "var(--muted)") + '" title="' + esc(c) + '"></span>'
    ).join("");
  }

  function statusBadge(status) {
    const map = {
      pending: t("statusPending"),
      published: t("statusPublished"),
      rejected: t("statusRejected"),
      revise: t("statusRevise"),
    };
    return '<span class="deck-status status-' + esc(status || "") + '">' + esc(map[status] || status || "") + "</span>";
  }

  function renderCuratedCard(d, i) {
    const dots = colorDots(d.colors);
    const cards = (d.cards || []).map((c) =>
      "<li><span class=\"qty-x\">" + c.qty + "×</span> " + esc(c.name) + ' <span class="card-no">' + esc(c.no) + "</span></li>"
    ).join("");
    const src = d.source_url
      ? '<a href="' + esc(d.source_url) + '" target="_blank" rel="noopener">' + esc(d.source) + "</a>"
      : esc(d.source || "");
    const author = d.author || t("authorEditorial");
    return '<article class="ref-deck">' +
      '<div class="ref-deck-head">' + dots + "<h3>" + esc(d.name) + "</h3>" +
      '<span class="deck-badge">' + esc(t("pageDecksEditorial")) + "</span></div>" +
      '<div class="ref-deck-meta">' + [esc(d.set), src, esc(t("deckBy", { a: author, d: d.date || "" }))].filter(Boolean).join(" · ") + "</div>" +
      (d.note ? '<p class="ref-deck-note">' + esc(d.note) + "</p>" : "") +
      '<div class="ref-deck-actions">' +
      '<button class="btn btn-primary btn-sm" data-ref-import="' + i + '">' + esc(t("deckImport")) + "</button>" +
      '<button class="btn btn-sm" data-ref-copy="' + i + '">' + esc(t("deckCopy")) + "</button></div>" +
      "<details><summary>" + esc(t("deckCardsList")) + " (" + (d.total || "") + ")</summary><ul class=\"ref-card-list\">" + cards + "</ul></details>" +
      "</article>";
  }

  function renderCommunityCard(d) {
    const dots = colorDots(d.colors);
    const score = (d.votes_up | 0) - (d.votes_down | 0);
    const my = d.my_vote || 0;
    return '<article class="ref-deck community-deck" data-cid="' + esc(d.id) + '">' +
      '<div class="ref-deck-head">' + dots + "<h3>" + esc(d.name) + "</h3></div>" +
      '<div class="ref-deck-meta">' + esc(t("deckBy", { a: d.submitter_name || "", d: (d.published_at || d.created_at || "").slice(0, 10) })) + "</div>" +
      (d.note ? '<p class="ref-deck-note">' + esc(d.note) + "</p>" : "") +
      '<div class="ref-deck-actions">' +
      '<button class="btn btn-primary btn-sm" data-c-import="' + esc(d.id) + '">' + esc(t("deckImport")) + "</button>" +
      '<button class="btn btn-sm" data-c-copy="' + esc(d.id) + '">' + esc(t("deckCopy")) + "</button>" +
      '<button class="btn btn-sm vote-btn' + (my === 1 ? " active" : "") + '" data-c-vote="' + esc(d.id) + '" data-v="1">' +
      esc(t("voteUp")) + " · " + (d.votes_up | 0) + "</button>" +
      '<button class="btn btn-sm vote-btn' + (my === -1 ? " active" : "") + '" data-c-vote="' + esc(d.id) + '" data-v="-1">' +
      esc(t("voteDown")) + " · " + (d.votes_down | 0) + "</button>" +
      '<span class="vote-score" title="score">' + (score > 0 ? "+" : "") + score + "</span>" +
      "</div></article>";
  }

  function renderPendingCard(d) {
    const checks = Object.keys(CHECK_LABELS).map((code) => {
      const val = d.checklist && d.checklist[code];
      const checked = val === true ? "checked" : "";
      return '<label class="chk-row"><input type="checkbox" data-chk="' + esc(code) + '" ' + checked + "> " +
        esc(CHECK_LABELS[code]) + "</label>";
    }).join("");
    return '<article class="ref-deck admin-deck" data-aid="' + esc(d.id) + '">' +
      '<div class="ref-deck-head"><h3>' + esc(d.name) + "</h3>" + statusBadge(d.status) + "</div>" +
      '<div class="ref-deck-meta">' + esc(d.submitter_name) + " · " + esc((d.created_at || "").slice(0, 19)) + "</div>" +
      '<p class="ref-deck-note">' + esc(d.note) + "</p>" +
      '<p class="mono-code">' + esc(d.code) + "</p>" +
      '<div class="checklist">' + checks + "</div>" +
      '<label class="field-label">' + esc(t("reviewReason")) +
      ' <input type="text" class="admin-reason" placeholder="A1 / C1 …" maxlength="500"></label>' +
      '<div class="ref-deck-actions">' +
      '<button class="btn btn-primary btn-sm" data-admin-act="pass">' + esc(t("reviewPass")) + "</button>" +
      '<button class="btn btn-sm" data-admin-act="revise">' + esc(t("reviewRevise")) + "</button>" +
      '<button class="btn btn-sm btn-danger" data-admin-act="reject">' + esc(t("reviewReject")) + "</button>" +
      '<button class="btn btn-sm" data-c-import="' + esc(d.id) + '">' + esc(t("deckImport")) + "</button>" +
      "</div></article>";
  }

  function renderMineCard(d) {
    return '<article class="ref-deck">' +
      '<div class="ref-deck-head"><h3>' + esc(d.name) + "</h3>" + statusBadge(d.status) + "</div>" +
      (d.reject_reason ? '<p class="ref-deck-note warn">' + esc(d.reject_reason) + "</p>" : "") +
      (d.note ? '<p class="ref-deck-note">' + esc(d.note) + "</p>" : "") +
      '<div class="ref-deck-actions">' +
      '<button class="btn btn-sm" data-c-copy="' + esc(d.id) + '">' + esc(t("deckCopy")) + "</button>" +
      (d.status === "revise"
        ? '<button class="btn btn-primary btn-sm" data-resubmit="' + esc(d.id) + '">' + esc(t("submitSend")) + "</button>"
        : "") +
      "</div></article>";
  }

  function renderSubmitForm() {
    const g = gs();
    const signed = g && g.isSignedIn && g.isSignedIn();
    if (!signed) {
      return '<div class="submit-box"><p class="empty">' + esc(t("submitNeedLogin")) + "</p>" +
        '<button class="btn btn-primary" id="community-signin">' + esc(t("googleSignIn")) + "</button></div>";
    }
    const email = (g.getUserEmail && g.getUserEmail()) || "";
    return '<form class="submit-box" id="community-submit-form">' +
      '<p class="page-note"><a href="docs/community-submit-guide.zh-HK.md" target="_blank" rel="noopener">' +
      esc(t("submitGuideLink")) + "</a></p>" +
      '<label class="field-label">' + esc(t("fieldDeckName")) +
      '<input name="name" required maxlength="80" placeholder="…"></label>' +
      '<label class="field-label">' + esc(t("fieldAuthorDisplay")) +
      '<input name="submitter_name" required maxlength="40" value="' + esc(email.split("@")[0] || "") + '"></label>' +
      '<label class="field-label">' + esc(t("fieldPlaystyle")) +
      '<span class="field-hint">' + esc(t("fieldPlaystyleHint")) + "</span>" +
      '<textarea name="note" required minlength="40" rows="4" placeholder="觸發卡 → 回報卡…"></textarea></label>' +
      '<label class="field-label">' + esc(t("fieldShareCode")) +
      '<span class="field-hint">' + esc(t("fieldShareCodeHint")) + "</span>" +
      '<textarea name="code" required rows="3" class="mono-code" placeholder="1|…"></textarea></label>' +
      '<div class="ref-deck-actions">' +
      '<button type="button" class="btn btn-sm" id="use-current-code">' + esc(t("fieldUseCurrentDeck") || "使用目前牌組分享碼") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + esc(t("submitSend")) + "</button></div>" +
      '<div id="submit-checklist" class="checklist"></div>' +
      '<p id="submit-msg" class="page-note"></p></form>';
  }

  function renderDecks() {
    const wrap = $("#ref-decks");
    if (!wrap) return;

    const tabs = [
      ["editorial", t("pageDecksEditorial")],
      ["community", t("pageDecksCommunity")],
      ["submit", t("submitDeckBtn")],
      ["mine", t("pageDecksMine") || "我的投稿"],
    ];
    if (isAdmin) tabs.push(["admin", t("pageDecksAdmin") || "審核"]);

    const tabHtml = '<div class="deck-subtabs" role="tablist">' +
      tabs.map(([id, label]) =>
        '<button type="button" class="deck-subtab' + (decksTab === id ? " active" : "") +
        '" data-decks-tab="' + id + '">' + esc(label) +
        (id === "admin" && pendingDecks.length ? ' <span class="tab-count">' + pendingDecks.length + "</span>" : "") +
        "</button>"
      ).join("") + "</div>";

    let body = "";
    if (decksTab === "editorial") {
      if (decksFailed) body = '<p class="empty">' + esc(t("deckLoadFail")) + "</p>";
      else if (!refDecks) body = "";
      else if (!refDecks.length) body = '<p class="empty">' + esc(t("deckLoadFail")) + "</p>";
      else body = '<div class="ref-decks-grid">' + refDecks.map(renderCuratedCard).join("") + "</div>";
    } else if (decksTab === "community") {
      if (communityFailed) body = '<p class="empty">' + esc(t("deckLoadFail")) + "</p>";
      else if (!communityDecks.length) body = '<p class="empty">' + esc(t("communityEmpty") || "暫未有已公開社區牌組") + "</p>";
      else body = '<div class="ref-decks-grid">' + communityDecks.map(renderCommunityCard).join("") + "</div>";
    } else if (decksTab === "submit") {
      body = renderSubmitForm();
    } else if (decksTab === "mine") {
      if (!(gs() && gs().isSignedIn && gs().isSignedIn())) {
        body = '<p class="empty">' + esc(t("submitNeedLogin")) + "</p>";
      } else if (!myDecks.length) {
        body = '<p class="empty">' + esc(t("mineEmpty") || "尚未有投稿") + "</p>";
      } else {
        body = '<div class="ref-decks-grid">' + myDecks.map(renderMineCard).join("") + "</div>";
      }
    } else if (decksTab === "admin") {
      if (!isAdmin) body = '<p class="empty">Forbidden</p>';
      else if (!pendingDecks.length) body = '<p class="empty">' + esc(t("adminEmpty") || "沒有待審核牌組") + "</p>";
      else body = '<div class="ref-decks-grid">' + pendingDecks.map(renderPendingCard).join("") + "</div>";
    }

    wrap.innerHTML = tabHtml + '<p class="page-note decks-intro-line">' + esc(t("decksIntro")) + "</p>" + body;
  }

  function findCommunity(id) {
    return communityDecks.find((d) => d.id === id) ||
      pendingDecks.find((d) => d.id === id) ||
      myDecks.find((d) => d.id === id);
  }

  document.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-decks-tab]");
    if (tab) {
      decksTab = tab.dataset.decksTab;
      renderDecks();
      return;
    }

    const signin = e.target.closest("#community-signin");
    if (signin && gs() && gs().signIn) {
      await gs().signIn();
      refreshCommunity();
      return;
    }

    const useCur = e.target.closest("#use-current-code");
    if (useCur) {
      const code = window.MHR_APP && window.MHR_APP.getShareCode && window.MHR_APP.getShareCode();
      const ta = document.querySelector("#community-submit-form textarea[name=code]");
      if (ta && code) {
        ta.value = code;
        previewChecklist();
      }
      return;
    }

    const imp = e.target.closest("[data-ref-import]");
    const cp = e.target.closest("[data-ref-copy]");
    if (imp || cp) {
      const d = refDecks && refDecks[+(imp || cp).dataset[imp ? "refImport" : "refCopy"]];
      if (!d) return;
      if (cp) {
        navigator.clipboard?.writeText(d.code);
        window.MHR_APP.toast(t("toastDeckCopied") + "：" + d.name);
        return;
      }
      if (window.MHR_APP.importCode(d.code)) {
        showPage("builder", true);
        window.MHR_APP.toast(t("toastRefImported", { n: d.name }));
      }
      return;
    }

    const cImp = e.target.closest("[data-c-import]");
    const cCp = e.target.closest("[data-c-copy]");
    if (cImp || cCp) {
      const id = (cImp || cCp).dataset[cImp ? "cImport" : "cCopy"];
      const d = findCommunity(id);
      if (!d || !d.code) return;
      if (cCp) {
        navigator.clipboard?.writeText(d.code);
        window.MHR_APP.toast(t("toastDeckCopied") + "：" + d.name);
        return;
      }
      if (window.MHR_APP.importCode(d.code)) {
        showPage("builder", true);
        window.MHR_APP.toast(t("toastRefImported", { n: d.name }));
      }
      return;
    }

    const voteBtn = e.target.closest("[data-c-vote]");
    if (voteBtn) {
      const g = gs();
      if (!g || !g.isSignedIn || !g.isSignedIn()) {
        window.MHR_APP.toast(t("voteNeedLogin"));
        return;
      }
      const id = voteBtn.dataset.cVote;
      const value = Number(voteBtn.dataset.v);
      try {
        const res = await api("/api/decks/" + encodeURIComponent(id) + "/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.MHR_APP.toast(data.error === "vote_only_published" ? t("voteOnlyPublished") : t("googleSyncError"));
          return;
        }
        const d = communityDecks.find((x) => x.id === id);
        if (d) {
          d.votes_up = data.votes_up;
          d.votes_down = data.votes_down;
          d.my_vote = data.my_vote;
        }
        renderDecks();
      } catch (err) {
        window.MHR_APP.toast(t("googleSyncError"));
      }
      return;
    }

    const adminAct = e.target.closest("[data-admin-act]");
    if (adminAct) {
      const card = adminAct.closest("[data-aid]");
      if (!card) return;
      const id = card.dataset.aid;
      const action = adminAct.dataset.adminAct;
      const checklist = {};
      card.querySelectorAll("[data-chk]").forEach((inp) => {
        checklist[inp.dataset.chk] = !!inp.checked;
      });
      const reason = (card.querySelector(".admin-reason") || {}).value || "";
      if ((action === "reject" || action === "revise") && !String(reason).trim()) {
        window.MHR_APP.toast(t("reviewReason") + "（A / C）");
        return;
      }
      try {
        const res = await api("/api/decks/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, checklist, reject_reason: reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.MHR_APP.toast(data.message || data.error || t("googleSyncError"));
          return;
        }
        window.MHR_APP.toast(t("reviewPass") + " · " + action);
        await refreshCommunity();
      } catch (err) {
        window.MHR_APP.toast(t("googleSyncError"));
      }
      return;
    }

    const resub = e.target.closest("[data-resubmit]");
    if (resub) {
      decksTab = "submit";
      renderDecks();
      const d = myDecks.find((x) => x.id === resub.dataset.resubmit);
      if (d) {
        const form = $("#community-submit-form");
        if (form) {
          form.name.value = d.name || "";
          form.submitter_name.value = d.submitter_name || "";
          form.note.value = d.note || "";
          form.code.value = d.code || "";
          form.dataset.resubmitId = d.id;
          previewChecklist();
        }
      }
    }
  });

  function previewChecklist() {
    const form = $("#community-submit-form");
    const box = $("#submit-checklist");
    if (!form || !box) return;
    const code = form.code.value;
    const analysis = window.MHR_APP && window.MHR_APP.analyzeShareCode
      ? window.MHR_APP.analyzeShareCode(code)
      : null;
    const noteOk = String(form.note.value || "").trim().length >= 40;
    const nameOk = !!String(form.name.value || "").trim();
    const authorOk = !!String(form.submitter_name.value || "").trim();
    const cl = Object.assign({
      deck_name: nameOk,
      submitter_name: authorOk,
      note_engine: noteOk,
      code_importable: false,
      card_count_50: false,
      unique_name_leq_3: false,
      colors_ok: false,
      no_rush_points: false,
    }, analysis && analysis.checklist);
    box.innerHTML = Object.keys(CHECK_LABELS).map((codeKey) => {
      const ok = cl[codeKey] === true;
      return '<div class="chk-preview ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓" : "✗") + " " + esc(CHECK_LABELS[codeKey]) + "</div>";
    }).join("");
  }

  document.addEventListener("input", (e) => {
    if (e.target && e.target.closest && e.target.closest("#community-submit-form")) previewChecklist();
  });

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("#community-submit-form");
    if (!form) return;
    e.preventDefault();
    const msg = $("#submit-msg");
    const name = form.name.value.trim();
    const submitter_name = form.submitter_name.value.trim();
    const note = form.note.value.trim();
    const code = form.code.value.trim();
    const analysis = window.MHR_APP.analyzeShareCode(code);
    const checklist = Object.assign({
      deck_name: !!name,
      submitter_name: !!submitter_name,
      note_engine: note.length >= 40,
    }, analysis.checklist);

    if (!name || !submitter_name || note.length < 40 || !analysis.ok) {
      if (msg) msg.textContent = t("submitInvalid");
      previewChecklist();
      return;
    }

    const resubmitId = form.dataset.resubmitId || "";
    try {
      let res;
      const payload = {
        name,
        submitter_name,
        note,
        code,
        colors: analysis.colors || [],
        checklist,
      };
      if (resubmitId) {
        res = await api("/api/decks/" + encodeURIComponent(resubmitId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({ action: "resubmit" }, payload)),
        });
      } else {
        res = await api("/api/decks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (msg) msg.textContent = t("submitInvalid");
        if (data.checklist) {
          const box = $("#submit-checklist");
          if (box) {
            box.innerHTML = Object.keys(CHECK_LABELS).map((codeKey) => {
              const ok = data.checklist[codeKey] === true;
              return '<div class="chk-preview ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓" : "✗") + " " + esc(CHECK_LABELS[codeKey]) + "</div>";
            }).join("");
          }
        }
        return;
      }
      if (msg) msg.textContent = t("submitSuccess");
      form.reset();
      delete form.dataset.resubmitId;
      decksTab = "mine";
      await refreshCommunity();
    } catch (err) {
      if (msg) msg.textContent = t("googleSyncError");
    }
  });

  function render() { renderNews(); renderDecks(); }
  window.MHR_PAGES = { render, showPage, refreshCommunity };

  const g0 = gs();
  if (g0 && g0.onAuthChange) {
    g0.onAuthChange(() => {
      if (!$("#page-decks") || $("#page-decks").hidden) return;
      refreshCommunity();
    });
  }

  showPage(location.hash.slice(1));
})();
