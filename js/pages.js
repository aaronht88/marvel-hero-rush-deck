// =============================================================
// Marvel Hero Rush Deck Builder — top-level pages
// Deck Builder / News (HK + intl) / Deck reference
// =============================================================
(function () {
  const { t } = window.MHR_I18N;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAGES = ["builder", "news", "decks"];
  const COLOR_VAR = { Red: "var(--red)", Yellow: "var(--yellow)", Blue: "var(--blue)", Green: "var(--green)" };

  let news = null, newsFailed = false, newsRegion = "hk";
  let refDecks = null, decksFailed = false;

  function loadJSON(url) {
    return fetch(url + "?t=" + Date.now(), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // ---------- page switching (#news / #decks in the URL) ----------
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
    if (p === "decks" && !refDecks && !decksFailed) {
      loadJSON("data/decks.json").then((d) => { refDecks = d.decks || []; renderDecks(); }).catch(() => { decksFailed = true; renderDecks(); });
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

  // ---------- deck reference ----------
  function renderDecks() {
    const wrap = $("#ref-decks");
    if (!wrap) return;
    if (decksFailed) { wrap.innerHTML = '<p class="empty">' + esc(t("deckLoadFail")) + "</p>"; return; }
    if (!refDecks) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = refDecks.map((d, i) => {
      const dots = (d.colors || []).map((c) => '<span class="color-dot" style="background:' + (COLOR_VAR[c] || "var(--muted)") + '" title="' + esc(c) + '"></span>').join("");
      const cards = (d.cards || []).map((c) => "<li><span class=\"qty-x\">" + c.qty + "×</span> " + esc(c.name) + ' <span class="card-no">' + esc(c.no) + "</span></li>").join("");
      const src = d.source_url ? '<a href="' + esc(d.source_url) + '" target="_blank" rel="noopener">' + esc(d.source) + "</a>" : esc(d.source || "");
      return '<article class="ref-deck">' +
        '<div class="ref-deck-head">' + dots + '<h3>' + esc(d.name) + "</h3></div>" +
        '<div class="ref-deck-meta">' + [esc(d.set), src, esc(t("deckBy", { a: d.author || "", d: d.date || "" }))].filter(Boolean).join(" · ") + "</div>" +
        '<div class="ref-deck-actions">' +
        '<button class="btn btn-primary btn-sm" data-ref-import="' + i + '">' + esc(t("deckImport")) + "</button>" +
        '<button class="btn btn-sm" data-ref-copy="' + i + '">' + esc(t("deckCopy")) + "</button></div>" +
        "<details><summary>" + esc(t("deckCardsList")) + " (" + (d.total || "") + ")</summary><ul class=\"ref-card-list\">" + cards + "</ul></details>" +
        "</article>";
    }).join("");
  }
  document.addEventListener("click", (e) => {
    const imp = e.target.closest("[data-ref-import]");
    const cp = e.target.closest("[data-ref-copy]");
    if (!imp && !cp) return;
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
  });

  function render() { renderNews(); renderDecks(); }
  window.MHR_PAGES = { render, showPage };
  showPage(location.hash.slice(1));
})();
