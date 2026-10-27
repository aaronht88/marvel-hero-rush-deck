// =============================================================
// Marvel Hero Rush Deck Builder — top-level pages
// Deck Builder / News (HK + intl) / Deck reference (+ community)
// =============================================================
(function () {
  const { t, getLang } = window.MHR_I18N;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAGES = ["builder", "vault", "news", "decks"];
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
  let newsView = "calendar"; // calendar | list — Hong Kong 卡賽 only
  let showPastEvents = false;
  let calCursor = null; // { y, m } month on screen, m = 1–12
  let calSelected = null; // YYYY-MM-DD
  let refDecks = null, decksFailed = false;
  let communityDecks = [];
  let communityFailed = false;
  let pendingDecks = [];
  let myDecks = [];
  let isAdmin = false;
  let decksTab = "editorial"; // editorial | community | submit | admin | mine
  let editorialVotes = {}; // deck_id -> { votes_up, votes_down, my_vote }
  let newsArticleId = null; // when set, show in-site article panel

  let newsPromise = null;
  function ensureNews() {
    if (news || newsFailed) return Promise.resolve();
    if (!newsPromise) {
      newsPromise = loadJSON("data/news.json").then((d) => { news = d; }).catch(() => { newsFailed = true; });
    }
    return newsPromise;
  }

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
  function parseHash() {
    const h = (location.hash || "").slice(1);
    if (h.startsWith("news/")) {
      return { page: "news", newsId: decodeURIComponent(h.slice(5)) || null };
    }
    if (PAGES.includes(h)) return { page: h, newsId: null };
    return { page: "builder", newsId: null };
  }

  function showPage(p, push, opts) {
    opts = opts || {};
    if (!PAGES.includes(p)) p = "builder";
    if (opts.newsId !== undefined) newsArticleId = opts.newsId;
    else if (p !== "news") newsArticleId = null;

    document.querySelectorAll(".page-tab").forEach((b) => {
      const on = b.dataset.page === p;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    PAGES.forEach((id) => { const el = $("#page-" + id); if (el) el.hidden = id !== p; });

    if (push) {
      let hash = "";
      if (p === "news" && newsArticleId) hash = "#news/" + encodeURIComponent(newsArticleId);
      else if (p !== "builder") hash = "#" + p;
      history.replaceState(null, "", location.pathname + location.search + hash);
    }

    if (p === "news") ensureNews().then(() => renderNews());
    if (p === "decks") {
      if (!refDecks && !decksFailed) {
        loadJSON("data/decks.json").then((d) => {
          refDecks = d.decks || [];
          refreshEditorialVotes().then(() => renderDecks());
        }).catch(() => { decksFailed = true; renderDecks(); });
      } else if (refDecks) {
        refreshEditorialVotes().then(() => renderDecks());
      }
      refreshCommunity();
    }
    try {
      if (window.MHR_APP && typeof window.MHR_APP.onPageShow === "function") {
        window.MHR_APP.onPageShow(p);
      }
    } catch (e) {}
    render();
  }
  document.querySelectorAll(".page-tab").forEach((b) => b.addEventListener("click", () => {
    showPage(b.dataset.page, true, { newsId: null });
  }));
  window.addEventListener("hashchange", () => {
    const { page, newsId } = parseHash();
    showPage(page, false, { newsId });
  });

  // ---------- news (list + in-site rewritten articles) ----------
  function catLabel(c) {
    return { event: t("catEvent"), product: t("catProduct"), notice: t("catNotice") }[c] || c || "";
  }

  /** Pick localized string from nested i18n map or flat legacy fields. */
  function pickI18n(it, field) {
    const lang = (getLang && getLang()) || "zh-HK";
    const map = it[field + "_i18n"] || it[field];
    if (map && typeof map === "object" && !Array.isArray(map)) {
      return map[lang] || map["zh-HK"] || map["zh-CN"] || map.en || "";
    }
    if (field === "title") {
      if (lang === "zh-HK") return it.title_zh || it.title || "";
      if (lang === "zh-CN") return (it.title_i18n && it.title_i18n["zh-CN"]) || it.title || "";
      return (it.title_i18n && it.title_i18n.en) || it.title || "";
    }
    if (field === "summary") {
      if (lang === "zh-HK") return it.summary_zh || "";
      return (it.summary_i18n && (it.summary_i18n[lang] || it.summary_i18n["zh-HK"])) || it.summary_zh || "";
    }
    if (field === "body") {
      // flat fallbacks: body_zh_hk / body_zh_cn / body_en
      const flat = { "zh-HK": it.body_zh_hk, "zh-CN": it.body_zh_cn, en: it.body_en };
      return flat[lang] || it.body_zh || it.body || "";
    }
    return "";
  }

  function hasOnSiteBody(it) {
    if (!it) return false;
    const map = it.body_i18n;
    if (map && typeof map === "object") {
      return !!(map["zh-HK"] || map["zh-CN"] || map.en);
    }
    return !!(it.body_zh_hk || it.body_zh_cn || it.body_en || it.body_zh || it.body);
  }

  function findNewsItem(id) {
    if (!news || !id) return null;
    for (const key of ["hk", "intl"]) {
      const hit = (news[key] || []).find((x) => x.id === id);
      if (hit) return hit;
    }
    return null;
  }

  /** Plain-text / light markdown → safe HTML paragraphs. */
  function formatArticleBody(raw) {
    const src = String(raw || "").trim();
    if (!src) return '<p class="empty">' + esc(t("newsArticlePending")) + "</p>";
    return src.split(/\n\s*\n/).map((block) => {
      const line = esc(block.trim()).replace(/\n/g, "<br>");
      return line ? "<p>" + line + "</p>" : "";
    }).join("");
  }

  /** Inline Deck Ref embed for body placeholder {{deck:DECK_ID}}. */
  function renderInlineDeckEmbed(deckId) {
    const d = (refDecks || []).find((x) => x.id === deckId);
    if (!d) {
      return '<aside class="news-deck-embed news-deck-embed-missing" data-deck-id="' + esc(deckId) + '">' +
        '<p class="page-note">' + esc(deckId) + "</p></aside>";
    }
    const actions = [];
    if (d.code) {
      actions.push('<button type="button" class="btn btn-sm" data-news-copy-id="' + esc(d.id) + '">' + esc(t("newsCopyShareCode")) + "</button>");
      actions.push('<button type="button" class="btn btn-sm btn-primary" data-news-import-id="' + esc(d.id) + '">' + esc(t("newsImportToBuilder")) + "</button>");
    }
    return '<aside class="news-deck-embed" data-deck-id="' + esc(d.id) + '">' +
      '<div class="news-deck-embed-head"><strong>' + esc(d.name) + "</strong></div>" +
      renderKeycards(d.keycards) +
      (d.code
        ? '<div class="news-share-block"><span class="news-share-label">' + esc(t("newsShareCode")) +
          '</span><code class="mono-code news-share-code">' + esc(d.code) + "</code></div>"
        : "") +
      (actions.length ? '<div class="news-related-actions">' + actions.join("") + "</div>" : "") +
      "</aside>";
  }

  /**
   * Split article body on {{deck:id}} placeholders.
   * Text segments → formatArticleBody; matches → inline deck embeds.
   */
  function renderArticleBodyWithEmbeds(raw) {
    const src = String(raw || "").trim();
    if (!src) {
      return { html: '<p class="empty">' + esc(t("newsArticlePending")) + "</p>", embeddedIds: [] };
    }
    const embeddedIds = [];
    const parts = src.split(/\{\{deck:([a-zA-Z0-9_-]+)\}\}/);
    let html = "";
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        const chunk = parts[i].trim();
        if (chunk) html += formatArticleBody(chunk);
      } else {
        embeddedIds.push(parts[i]);
        html += renderInlineDeckEmbed(parts[i]);
      }
    }
    return { html: html || '<p class="empty">' + esc(t("newsArticlePending")) + "</p>", embeddedIds };
  }

  function articleShareUrl(articleId) {
    const prod = "https://mhrdeckbuild.duckdns.org";
    const origin = (typeof location !== "undefined" && /mhrdeckbuild\.duckdns\.org$/i.test(location.hostname || ""))
      ? location.origin
      : prod;
    return origin.replace(/\/$/, "") + "/#news/" + articleId;
  }

  /** Localized card name for article mockups (mirrors app.js cnCard for zh-CN). */
  function newsCardName(card) {
    if (!card) return "";
    try {
      if (window.MHR_I18N && window.MHR_I18N.getLang() === "zh-CN" && window.MHR_CARD_CN && window.MHR_CARD_CN[card.card_no]) {
        const v = window.MHR_CARD_CN[card.card_no].name;
        if (v) return String(v).replace(/\n/g, "").trim();
      }
    } catch (e) {}
    return card.name || card.card_no || card.id || "";
  }

  function lookupCard(id) {
    if (!id || typeof CARDS === "undefined") return null;
    return CARDS.find((c) => c.id === id || c.card_no === id) || null;
  }


  function renderKeycards(ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return "";
    const cells = list.slice(0, 3).map((id) => {
      const card = lookupCard(id);
      if (!card || !card.art) {
        return '<div class="ref-keycard ref-keycard-empty" title="' + esc(id) + '"></div>';
      }
      const name = newsCardName(card);
      return '<div class="ref-keycard" title="' + esc(name) + '">' +
        '<img loading="lazy" src="' + esc(card.art) + '" alt="' + esc(name) + '" onerror="this.parentElement.classList.add(\'ref-keycard-empty\');this.remove()">' +
        "</div>";
    }).join("");
    return '<div class="ref-keycards" aria-hidden="true">' + cells + "</div>";
  }

  function renderFeaturedCards(ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return "";
    const faces = list.map((id) => {
      const card = lookupCard(id);
      if (!card) {
        return '<div class="news-feat-missing sim-card"><div class="sim-art"></div>' +
          '<div class="sim-name">' + esc(id) + "</div>" +
          '<div class="sim-chips"><span class="sim-chip sim-chip-no">' + esc(id) + "</span></div></div>";
      }
      const name = newsCardName(card);
      const attr = card.attribute || "";
      return '<div class="sim-card news-feat-card attr-' + esc(attr) + '" data-news-card="' + esc(card.id) + '" role="button" tabindex="0" title="' + esc(name) + '">' +
        '<div class="sim-art"><img loading="lazy" src="' + esc(card.art) + '" alt="' + esc(name) + '" onerror="this.style.display=\'none\'"></div>' +
        '<div class="sim-name">' + esc(name) + "</div>" +
        '<div class="sim-chips"><span class="sim-chip sim-chip-no">' + esc(card.card_no || card.id) + "</span></div>" +
        "</div>";
    }).join("");
    return '<section class="news-featured"><h3>' + esc(t("newsFeaturedCards")) + "</h3>" +
      '<div class="news-feat-row sim-row">' + faces + "</div></section>";
  }

  function renderRelatedDeckBlock(opts) {
    const name = opts.name || t("newsRelatedDecks");
    const note = opts.note || "";
    const code = opts.code || "";
    const importAttr = opts.importAttr || "";
    const copyAttr = opts.copyAttr || "";
    const actions = [];
    if (code) {
      actions.push('<button type="button" class="btn btn-sm" ' + copyAttr + ">" + esc(t("newsCopyShareCode")) + "</button>");
      actions.push('<button type="button" class="btn btn-sm btn-primary" ' + importAttr + ">" + esc(t("newsImportToBuilder")) + "</button>");
    } else if (importAttr) {
      actions.push('<button type="button" class="btn btn-sm btn-primary" ' + importAttr + ">" + esc(t("newsImportToBuilder")) + "</button>");
    }
    return '<li class="news-related-item">' +
      '<div class="news-related-head"><strong>' + esc(name) + "</strong></div>" +
      (note ? '<span class="news-related-note">' + esc(note) + "</span>" : "") +
      (code
        ? '<div class="news-share-block"><span class="news-share-label">' + esc(t("newsShareCode")) +
          '</span><code class="mono-code news-share-code">' + esc(code) + "</code></div>"
        : "") +
      (actions.length ? '<div class="news-related-actions">' + actions.join("") + "</div>" : "") +
      "</li>";
  }

  function renderNewsArticle(it) {
    const title = pickI18n(it, "title") || it.title_zh || it.title;
    const body = pickI18n(it, "body");
    const sourceName = it.source_name || it.source || "";
    const sourceUrl = it.source_url || it.url || "";
    const meta = [it.date + (it.time ? " " + it.time : ""), it.venue].filter(Boolean).map(esc).join(" · ");

    const bodyParts = renderArticleBodyWithEmbeds(body);
    const embeddedSet = new Set(bodyParts.embeddedIds);
    const hasInlineDecks = embeddedSet.size > 0;

    // Skip the big featured dump when body already interleaves deck keycards.
    const featuredHtml = hasInlineDecks ? "" : renderFeaturedCards(it.featured_cards);

    let relatedHtml = "";
    const relatedIds = it.related_deck_ids || [];
    const relatedDecks = it.related_decks || [];
    const leftoverIds = relatedIds.filter((rid) => !embeddedSet.has(rid));
    // Hide related section when every related_deck_id was inlined and no related_decks embeds.
    const showRelated = leftoverIds.length > 0 || relatedDecks.length > 0;
    if (showRelated) {
      const fromIds = leftoverIds.map((rid) => {
        const d = (refDecks || []).find((x) => x.id === rid);
        if (!d) return '<li class="news-related-missing">' + esc(rid) + "</li>";
        return renderRelatedDeckBlock({
          name: d.name,
          note: "",
          code: d.code || "",
          importAttr: 'data-news-import-id="' + esc(d.id) + '"',
          copyAttr: 'data-news-copy-id="' + esc(d.id) + '"',
        });
      }).join("");
      const fromEmbed = relatedDecks.map((rd, i) =>
        renderRelatedDeckBlock({
          name: rd.name || t("newsRelatedDecks"),
          note: rd.note || "",
          code: rd.code || "",
          importAttr: 'data-news-import-code="' + i + '"',
          copyAttr: 'data-news-copy-code="' + i + '"',
        })
      ).join("");
      relatedHtml = '<section class="news-related"><h3>' + esc(t("newsRelatedDecks")) + "</h3><ul>" +
        fromIds + fromEmbed + "</ul>" +
        '<p class="page-note">' + esc(t("newsRelatedDeckHint")) + "</p></section>";
    }

    const credit = sourceUrl
      ? '<footer class="news-credit">' + esc(t("newsSourceCredit", { name: sourceName || sourceUrl })) +
        ' · <a href="' + esc(sourceUrl) + '" target="_blank" rel="noopener">' + esc(t("newsSourceLink")) + "</a></footer>"
      : (sourceName ? '<footer class="news-credit">' + esc(t("newsSourceCredit", { name: sourceName })) + "</footer>" : "");

    const shareBtn = '<button type="button" class="btn btn-sm news-copy-article" data-news-copy-article="' +
      esc(it.id) + '">' + esc(t("newsCopyArticleLink")) + "</button>";

    return '<article class="news-article" data-news-article="' + esc(it.id) + '">' +
      '<button type="button" class="btn btn-sm news-back" data-news-back>' + esc(t("newsArticleBack")) + "</button>" +
      (it.category ? '<span class="news-cat cat-' + esc(it.category) + '">' + esc(catLabel(it.category)) + "</span>" : "") +
      '<h2 class="news-article-title">' + esc(title) + "</h2>" +
      (meta ? '<div class="news-meta">' + meta + "</div>" : "") +
      '<div class="news-article-actions">' + shareBtn + "</div>" +
      '<div class="news-article-body">' + bodyParts.html + "</div>" +
      featuredHtml + relatedHtml + credit +
      "</article>";
  }

  // Hong Kong locality names that open a Mato street address. Longest first.
  const HK_AREAS = [
    "尖沙咀", "荔枝角", "銅鑼灣", "長沙灣", "將軍澳", "九龍灣", "牛頭角", "黃大仙", "新蒲崗",
    "鑽石山", "九龍塘", "何文田", "土瓜灣", "堅尼地城", "大角咀", "石硤尾", "慈雲山",
    "天水圍", "馬鞍山", "觀塘", "油麻地", "深水埗", "葵涌", "葵芳", "青衣", "荃灣",
    "屯門", "元朗", "上水", "粉嶺", "大埔", "沙田", "火炭", "大圍", "藍田", "油塘",
    "彩虹", "紅磡", "佐敦", "太子", "中環", "金鐘", "上環", "西環", "灣仔", "天后",
    "炮台山", "北角", "鰂魚涌", "太古", "西灣河", "筲箕灣", "柴灣", "香港仔", "樂富",
    "東涌", "美孚", "旺角",
  ].sort((a, b) => b.length - a.length);

  const DISTRICT_EN = {
    "觀塘": "Kwun Tong", "尖沙咀": "Tsim Sha Tsui", "荔枝角": "Lai Chi Kok",
    "旺角": "Mong Kok", "銅鑼灣": "Causeway Bay", "中環": "Central",
    "荃灣": "Tsuen Wan", "沙田": "Sha Tin", "將軍澳": "Tseung Kwan O",
    "九龍灣": "Kowloon Bay", "紅磡": "Hung Hom", "佐敦": "Jordan",
    "太子": "Prince Edward", "深水埗": "Sham Shui Po", "長沙灣": "Cheung Sha Wan",
    "葵涌": "Kwai Chung", "屯門": "Tuen Mun", "元朗": "Yuen Long",
    "大埔": "Tai Po", "上水": "Sheung Shui", "黃大仙": "Wong Tai Sin",
    "油麻地": "Yau Ma Tei", "灣仔": "Wan Chai", "北角": "North Point",
    "柴灣": "Chai Wan", "太古": "Taikoo", "金鐘": "Admiralty",
    "上環": "Sheung Wan", "何文田": "Ho Man Tin", "土瓜灣": "To Kwa Wan",
    "大角咀": "Tai Kok Tsui", "美孚": "Mei Foo", "青衣": "Tsing Yi",
    "火炭": "Fo Tan", "馬鞍山": "Ma On Shan", "東涌": "Tung Chung",
    "新蒲崗": "San Po Kong", "藍田": "Lam Tin", "油塘": "Yau Tong",
    "牛頭角": "Ngau Tau Kok",
  };
  const DISTRICT_CN = {
    "觀塘": "观塘", "灣仔": "湾仔", "銅鑼灣": "铜锣湾", "黃大仙": "黄大仙",
    "紅磡": "红磡", "長沙灣": "长沙湾", "馬鞍山": "马鞍山", "東涌": "东涌",
    "藍田": "蓝田", "油塘": "油塘", "將軍澳": "将军澳", "新蒲崗": "新蒲岗",
    "淺水灣": "浅水湾",
  };

  function pad2(n) { return String(n).padStart(2, "0"); }

  function hktNowParts(date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date || new Date());
    const g = (type) => {
      const p = parts.find((x) => x.type === type);
      return p ? p.value : "";
    };
    let hour = g("hour");
    if (hour === "24") hour = "00";
    return {
      y: +g("year"), m: +g("month"), d: +g("day"),
      date: g("year") + "-" + g("month") + "-" + g("day"),
      time: hour + ":" + g("minute"),
    };
  }

  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); }

  /** Past once the Hong Kong calendar day has ended, or end_time has passed today. */
  function isPastEvent(it, now) {
    if (!it || !isIsoDate(it.date)) return false;
    now = now || hktNowParts();
    if (it.date < now.date) return true;
    if (it.date > now.date) return false;
    if (it.end_time && /^\d{2}:\d{2}$/.test(it.end_time) && it.end_time < now.time) return true;
    return false;
  }

  function hkDistrictFromAddress(addr) {
    const s = String(addr || "").replace(/\s+/g, "");
    for (let i = 0; i < HK_AREAS.length; i++) {
      if (s.startsWith(HK_AREAS[i])) return HK_AREAS[i];
    }
    return "";
  }

  function eventDistrict(it) {
    return (it && (it.district || hkDistrictFromAddress(it.address))) || "";
  }

  function districtLabel(code) {
    if (!code) return "";
    const lang = (getLang && getLang()) || "zh-HK";
    if (lang === "en") return DISTRICT_EN[code] || code;
    if (lang === "zh-CN") return DISTRICT_CN[code] || code;
    return code;
  }

  function inferFormatCode(it) {
    const blob = [
      it.title, it.title_zh, it.description,
      pickI18n(it, "title"), pickI18n(it, "summary"), pickI18n(it, "body"),
    ].join("\n");
    const low = blob.toLowerCase();
    const sealed = blob.indexOf("即開") >= 0 || blob.indexOf("開包") >= 0 || low.indexOf("sealed") >= 0
      || low.indexOf("purchased on-site") >= 0 || low.indexOf("purchased on site") >= 0;
    const constructed = blob.indexOf("構築") >= 0 || low.indexOf("constructed") >= 0;
    if (sealed && !(constructed && low.indexOf("constructed deck") >= 0
      && low.indexOf("purchased on-site") < 0 && low.indexOf("purchased on site") < 0
      && blob.indexOf("即開") < 0 && blob.indexOf("開包") < 0 && low.indexOf("sealed") < 0)) {
      return "sealed";
    }
    if (constructed) return "constructed";
    return "";
  }

  function formatPresentation(it) {
    const lang = (getLang && getLang()) || "zh-HK";
    const map = it.format_i18n;
    if (map && typeof map === "object") {
      const v = map[lang] || map["zh-HK"] || map.en;
      if (v) return { code: "custom", label: String(v) };
    }
    const raw = typeof it.format === "string" ? it.format.trim() : "";
    if (raw === "constructed" || raw === "sealed") {
      return { code: raw, label: t(raw === "constructed" ? "calFormatConstructed" : "calFormatSealed") };
    }
    if (raw) return { code: "custom", label: raw };
    const inferred = inferFormatCode(it);
    if (inferred) return { code: inferred, label: t(inferred === "constructed" ? "calFormatConstructed" : "calFormatSealed") };
    return { code: "", label: t("calFormatUnknown") };
  }

  function shopLine(it) {
    const shop = (it && it.venue) || "";
    const dist = districtLabel(eventDistrict(it));
    if (shop && dist) return shop + " · " + dist;
    return shop || dist || "";
  }

  function mondayIndex(iso) {
    const parts = iso.split("-").map(Number);
    const dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
    return (dow + 6) % 7;
  }

  function longDate(iso) {
    if (!isIsoDate(iso)) return iso || "";
    const parts = iso.split("-").map(Number);
    const lang = (getLang && getLang()) || "zh-HK";
    const names = t("calDowLong").split(",");
    const w = names[mondayIndex(iso)] || "";
    if (lang === "en") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return w + ", " + parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
    }
    return parts[0] + "年" + parts[1] + "月" + parts[2] + "日（" + w + "）";
  }

  function monthTitle(y, m) {
    const lang = (getLang && getLang()) || "zh-HK";
    if (lang === "en") {
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return months[m - 1] + " " + y;
    }
    return t("calMonth", { y: y, m: m });
  }

  function whenLine(it) {
    const date = longDate(it.date);
    let time = "";
    if (it.time && it.end_time) time = it.time + "–" + it.end_time;
    else if (it.time) time = it.time;
    return time ? date + " · " + time : date;
  }

  function hkEvents() {
    return ((news && news.hk) || []).filter((it) => isIsoDate(it.date));
  }

  function visibleHkEvents() {
    const all = hkEvents();
    if (showPastEvents) return all;
    const now = hktNowParts();
    return all.filter((it) => !isPastEvent(it, now));
  }

  function ensureCalCursor() {
    if (calCursor && calSelected) return;
    const now = hktNowParts();
    const upcoming = visibleHkEvents().map((it) => it.date).filter((d) => d >= now.date).sort();
    const pick = upcoming[0] || now.date;
    if (!calCursor) calCursor = { y: +pick.slice(0, 4), m: +pick.slice(5, 7) };
    if (!calSelected) calSelected = pick;
  }

  function shiftMonth(delta) {
    ensureCalCursor();
    let y = calCursor.y;
    let m = calCursor.m + delta;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    calCursor = { y: y, m: m };
    const prefix = y + "-" + pad2(m);
    if (!calSelected || calSelected.slice(0, 7) !== prefix) {
      const hit = visibleHkEvents().map((it) => it.date).filter((d) => d.slice(0, 7) === prefix).sort()[0];
      calSelected = hit || (prefix + "-01");
    }
  }

  function renderCalEvent(it, now) {
    const past = isPastEvent(it, now);
    const fmt = formatPresentation(it);
    const shop = shopLine(it);
    const addr = it.address || "";
    const title = pickI18n(it, "title") || it.title_zh || it.title || "";
    const href = it.url || it.source_url || "";
    const fmtClass = fmt.code === "constructed" ? "is-constructed"
      : fmt.code === "sealed" ? "is-sealed"
      : fmt.code === "custom" ? "is-custom" : "is-unknown";
    const actions = [];
    if (href) {
      actions.push('<a class="btn btn-sm btn-primary" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(t("calRegister")) + "</a>");
    }
    if (hasOnSiteBody(it)) {
      actions.push('<button type="button" class="btn btn-sm" data-news-open="' + esc(it.id) + '">' + esc(t("newsReadOnSite")) + "</button>");
    }
    return '<article class="cal-event' + (past ? " is-past" : "") + '">' +
      (past ? '<span class="cal-past-tag">' + esc(t("calPastTag")) + "</span>" : "") +
      '<h4 class="cal-event-title">' + esc(title) + "</h4>" +
      '<dl class="cal-facts">' +
        '<div><dt>' + esc(t("calWhenLabel")) + "</dt><dd>" + esc(whenLine(it)) + "</dd></div>" +
        '<div><dt>' + esc(t("calShopLabel")) + "</dt><dd>" +
          (shop ? '<span class="cal-shop">' + esc(shop) + "</span>" : "") +
          (addr ? '<span class="cal-address">' + esc(addr) + "</span>" : "") +
          (!shop && !addr ? "—" : "") +
        "</dd></div>" +
        '<div><dt>' + esc(t("calFormatLabel")) + '</dt><dd><span class="cal-format ' + fmtClass + '">' + esc(fmt.label) + "</span></dd></div>" +
      "</dl>" +
      (actions.length ? '<div class="cal-event-actions">' + actions.join("") + "</div>" : "") +
      "</article>";
  }

  function renderCalendar(root) {
    ensureCalCursor();
    const now = hktNowParts();
    const y = calCursor.y;
    const m = calCursor.m;
    const prefix = y + "-" + pad2(m);
    const byDay = {};
    visibleHkEvents().forEach((it) => {
      if (!byDay[it.date]) byDay[it.date] = [];
      byDay[it.date].push(it);
    });
    Object.keys(byDay).forEach((d) => {
      byDay[d].sort((a, b) => (a.time || "").localeCompare(b.time || "") || (a.venue || "").localeCompare(b.venue || ""));
    });
    if (!calSelected || calSelected.slice(0, 7) !== prefix) {
      const inMonth = Object.keys(byDay).filter((d) => d.slice(0, 7) === prefix).sort();
      calSelected = inMonth[0] || (prefix + "-01");
    }
    const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const lead = (firstDow + 6) % 7;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dows = t("calDowShort").split(",");
    let cells = "";
    for (let i = 0; i < lead; i++) cells += '<span class="cal-pad"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = prefix + "-" + pad2(d);
      const list = byDay[iso] || [];
      const n = list.length;
      const cls = ["cal-day"];
      if (iso === now.date) cls.push("is-today");
      if (iso === calSelected) cls.push("is-selected");
      if (n) cls.push("has-events");
      else cls.push("is-empty-day");
      if (iso < now.date) cls.push("is-before");
      if (n && list.every((it) => isPastEvent(it, now))) cls.push("is-past-mark");
      const label = n
        ? t("calDayEvents", { date: longDate(iso), n: n })
        : t("calDayNone", { date: longDate(iso) });
      const dots = '<span class="cal-dots" aria-hidden="true">' +
        (n ? new Array(Math.min(n, 3)).fill("<i></i>").join("") : "") + "</span>";
      const count = n > 1 ? '<span class="cal-count">' + n + "</span>" : "";
      cells += '<button type="button" class="' + cls.join(" ") + '" data-cal-day="' + iso + '" aria-pressed="' +
        (iso === calSelected ? "true" : "false") + '" aria-label="' + esc(label) + '">' +
        '<span class="cal-num">' + d + "</span>" + dots + count + "</button>";
    }
    const selectedEvents = byDay[calSelected] || [];
    const detail = selectedEvents.length
      ? selectedEvents.map((it) => renderCalEvent(it, now)).join("")
      : '<p class="empty cal-empty">' + esc(t("calEmptyDay")) + "</p>";
    root.innerHTML =
      '<div class="cal-toolbar">' +
        '<div class="cal-nav-group">' +
          '<button type="button" class="btn btn-sm cal-nav" data-cal="prev" aria-label="' + esc(t("calPrev")) + '">‹</button>' +
          '<h2 class="cal-title">' + esc(monthTitle(y, m)) + "</h2>" +
          '<button type="button" class="btn btn-sm cal-nav" data-cal="next" aria-label="' + esc(t("calNext")) + '">›</button>' +
        "</div>" +
        '<button type="button" class="btn btn-sm" data-cal="today">' + esc(t("calToday")) + "</button>" +
      "</div>" +
      '<div class="cal-layout">' +
        '<div class="cal-grid" role="grid" aria-label="' + esc(monthTitle(y, m)) + '">' +
          dows.map((name) => '<div class="cal-dow" role="columnheader">' + esc(name) + "</div>").join("") +
          cells +
        "</div>" +
        '<div class="cal-detail" id="news-cal-detail" aria-live="polite">' +
          '<h3 class="cal-detail-title">' + esc(longDate(calSelected)) + "</h3>" +
          detail +
        "</div>" +
      "</div>";
  }

  function renderTicker() {
    const track = $("#race-ticker");
    if (!track) return;
    if (!news) { track.innerHTML = ""; return; }
    const now = hktNowParts();
    let items = (news.hk || []).filter((it) => it && it.date && !isPastEvent(it, now));
    items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || "").localeCompare(String(b.time || "")));
    if (!items.length) items = (news.intl || []).filter((it) => it && (it.title || it.title_zh)).slice(0, 6);
    items = items.slice(0, 10);
    if (!items.length) { track.innerHTML = ""; return; }
    const bits = items.map((it) => {
      const title = pickI18n(it, "title") || it.title_zh || it.title || "";
      const when = String(it.date || "").slice(5);
      const place = it.venue || "";
      return "<span><b>" + esc(when) + "</b>" + esc(title) + (place ? " · " + esc(place) : "") + "</span>";
    }).join("");
    track.innerHTML = bits + bits;
  }

  function renderNews() {
    renderTicker();
    const list = $("#news-list");
    if (!list) return;
    const calEl = $("#news-calendar");
    const viewToggle = $("#news-view-toggle");
    const pastToggle = $("#news-past-toggle");
    const pastInput = $("#news-show-past");
    document.querySelectorAll("[data-news]").forEach((b) => b.classList.toggle("active", b.dataset.news === newsRegion));
    document.querySelectorAll("[data-news-view]").forEach((b) => b.classList.toggle("active", b.dataset.newsView === newsView));
    if (pastInput) pastInput.checked = showPastEvents;
    const noteEl = $("#news-note");
    if (noteEl) noteEl.textContent = t(newsRegion === "hk" ? "newsNoteHK" : "newsNoteIntl");
    const showTools = newsRegion === "hk" && !newsArticleId;
    if (viewToggle) viewToggle.hidden = !showTools;
    if (pastToggle) pastToggle.hidden = !showTools;

    if (newsFailed) {
      if (calEl) { calEl.hidden = true; calEl.innerHTML = ""; }
      list.hidden = false;
      list.innerHTML = '<p class="empty">' + esc(t("newsLoadFail")) + "</p>";
      return;
    }
    if (!news) {
      if (calEl) calEl.hidden = true;
      list.innerHTML = "";
      return;
    }
    const upd = $("#news-updated");
    if (upd) upd.textContent = news.updated ? t("newsUpdated", { t: news.updated }) : "";

    if (newsArticleId) {
      const it = findNewsItem(newsArticleId);
      if (it && hasOnSiteBody(it)) {
        if (!refDecks && !decksFailed) {
          loadJSON("data/decks.json").then((d) => { refDecks = d.decks || []; renderNews(); }).catch(() => { decksFailed = true; });
        }
        if (calEl) { calEl.hidden = true; calEl.innerHTML = ""; }
        list.hidden = false;
        list.innerHTML = renderNewsArticle(it);
        if (noteEl) noteEl.textContent = "";
        return;
      }
      newsArticleId = null;
      if (viewToggle) viewToggle.hidden = newsRegion !== "hk";
      if (pastToggle) pastToggle.hidden = newsRegion !== "hk";
    }

    const useCal = newsRegion === "hk" && newsView === "calendar";
    if (useCal && calEl) {
      list.hidden = true;
      list.innerHTML = "";
      calEl.hidden = false;
      renderCalendar(calEl);
      return;
    }
    if (calEl) { calEl.hidden = true; calEl.innerHTML = ""; }
    list.hidden = false;

    let items = (news[newsRegion] || []).slice();
    const now = hktNowParts();
    if (newsRegion === "hk" && !showPastEvents) items = items.filter((it) => !isPastEvent(it, now));
    if (!items.length) {
      list.innerHTML = '<p class="empty">' + esc(newsRegion === "hk" ? t("calNoUpcoming") : t("newsEmpty")) + "</p>";
      return;
    }
    list.innerHTML = items.map((it) => {
      const title = pickI18n(it, "title") || it.title_zh || it.title;
      const summary = pickI18n(it, "summary") || it.summary_zh || "";
      const fmt = newsRegion === "hk" ? formatPresentation(it) : null;
      const when = it.date + (it.time ? " " + it.time + (it.end_time ? "–" + it.end_time : "") : "");
      const metaParts = newsRegion === "hk"
        ? [when, shopLine(it) || it.venue, fmt && fmt.code ? fmt.label : "", it.source_name || it.source]
        : [it.date + (it.time ? " " + it.time : ""), it.venue, it.source_name || it.source];
      const meta = metaParts.filter(Boolean).map(esc).join(" · ");
      const onSite = hasOnSiteBody(it);
      const tag = onSite ? "button" : "a";
      const openAttr = onSite
        ? ' type="button" data-news-open="' + esc(it.id) + '"'
        : ' href="' + esc(it.url) + '" target="_blank" rel="noopener"';
      const badge = onSite ? '<span class="news-onsite">' + esc(t("newsReadOnSite")) + "</span>" : "";
      const pastCls = newsRegion === "hk" && isPastEvent(it, now) ? " is-past" : "";
      return '<' + tag + ' class="news-item' + pastCls + '"' + openAttr + '>' +
        (it.category ? '<span class="news-cat cat-' + esc(it.category) + '">' + esc(catLabel(it.category)) + "</span>" : "") +
        '<span class="news-body"><span class="news-title">' + esc(title) + badge + "</span>" +
        (summary ? '<span class="news-summary">' + esc(summary) + "</span>" : "") +
        '<span class="news-meta">' + meta + "</span></span></" + tag + ">";
    }).join("");
  }
  document.querySelectorAll("[data-news]").forEach((b) => b.addEventListener("click", () => {
    newsRegion = b.dataset.news;
    newsArticleId = null;
    history.replaceState(null, "", location.pathname + location.search + "#news");
    renderNews();
  }));
  document.addEventListener("change", (e) => {
    if (!e.target || e.target.id !== "news-show-past") return;
    showPastEvents = !!e.target.checked;
    renderNews();
  });

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


  async function refreshEditorialVotes() {
    editorialVotes = {};
    if (!refDecks || !refDecks.length) return;
    const g = gs();
    if (!g || !g.hasSyncApi || !g.hasSyncApi()) return;
    const ids = refDecks.map((d) => d.id).filter(Boolean);
    if (!ids.length) return;
    try {
      const res = await api("/api/editorial/votes?ids=" + encodeURIComponent(ids.join(",")));
      if (!res.ok) return;
      const data = await res.json();
      editorialVotes = data.votes || {};
    } catch (e) {
      /* keep empty tallies */
    }
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
    const v = editorialVotes[d.id] || { votes_up: 0, votes_down: 0, my_vote: 0 };
    const score = (v.votes_up | 0) - (v.votes_down | 0);
    const my = v.my_vote || 0;
    return '<article class="ref-deck" data-eid="' + esc(d.id) + '">' +
      '<div class="ref-deck-head">' + dots + "<h3>" + esc(d.name) + "</h3>" +
      '<span class="deck-badge">' + esc(t("pageDecksEditorial")) + "</span></div>" +
      '<div class="ref-deck-meta">' + [esc(d.set), src, esc(t("deckBy", { a: author, d: d.date || "" }))].filter(Boolean).join(" · ") + "</div>" +
      (d.note ? '<p class="ref-deck-note">' + esc(d.note) + "</p>" : "") +
      renderKeycards(d.keycards) +
      '<div class="ref-deck-actions">' +
      '<button class="btn btn-primary btn-sm" data-ref-import="' + i + '">' + esc(t("deckImport")) + "</button>" +
      '<button class="btn btn-sm" data-ref-copy="' + i + '">' + esc(t("deckCopy")) + "</button>" +
      '<button class="btn btn-sm vote-btn' + (my === 1 ? " active" : "") + '" data-e-vote="' + esc(d.id) + '" data-v="1" aria-label="' + esc(t("voteUp")) + '" title="' + esc(t("voteUp")) + '">' +
      "👍 " + (v.votes_up | 0) + "</button>" +
      '<button class="btn btn-sm vote-btn' + (my === -1 ? " active" : "") + '" data-e-vote="' + esc(d.id) + '" data-v="-1" aria-label="' + esc(t("voteDown")) + '" title="' + esc(t("voteDown")) + '">' +
      "👎 " + (v.votes_down | 0) + "</button>" +
      '<span class="vote-score" title="score">' + (score > 0 ? "+" : "") + score + "</span>" +
      "</div>" +
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
      '<button class="btn btn-sm vote-btn' + (my === 1 ? " active" : "") + '" data-c-vote="' + esc(d.id) + '" data-v="1" aria-label="' + esc(t("voteUp")) + '" title="' + esc(t("voteUp")) + '">' +
      "👍 " + (d.votes_up | 0) + "</button>" +
      '<button class="btn btn-sm vote-btn' + (my === -1 ? " active" : "") + '" data-c-vote="' + esc(d.id) + '" data-v="-1" aria-label="' + esc(t("voteDown")) + '" title="' + esc(t("voteDown")) + '">' +
      "👎 " + (d.votes_down | 0) + "</button>" +
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
    if (e.target.closest("#race-ticker-jump")) {
      showPage("news", true);
      return;
    }
    const viewBtn = e.target.closest("[data-news-view]");
    if (viewBtn) {
      newsView = viewBtn.dataset.newsView === "list" ? "list" : "calendar";
      newsArticleId = null;
      if ((location.hash || "").indexOf("#news/") === 0) {
        history.replaceState(null, "", location.pathname + location.search + "#news");
      }
      renderNews();
      return;
    }
    const calAct = e.target.closest("[data-cal]");
    if (calAct) {
      const act = calAct.dataset.cal;
      if (act === "prev") shiftMonth(-1);
      else if (act === "next") shiftMonth(1);
      else if (act === "today") {
        const now = hktNowParts();
        calCursor = { y: now.y, m: now.m };
        calSelected = now.date;
      }
      renderNews();
      return;
    }
    const dayBtn = e.target.closest("[data-cal-day]");
    if (dayBtn && dayBtn.dataset.calDay) {
      calSelected = dayBtn.dataset.calDay;
      renderNews();
      if (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) {
        const det = document.getElementById("news-cal-detail");
        if (det && det.scrollIntoView) det.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }

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

    const newsOpen = e.target.closest("[data-news-open]");
    if (newsOpen) {
      newsArticleId = newsOpen.dataset.newsOpen;
      history.replaceState(null, "", location.pathname + location.search + "#news/" + encodeURIComponent(newsArticleId));
      renderNews();
      return;
    }

    const newsBack = e.target.closest("[data-news-back]");
    if (newsBack) {
      newsArticleId = null;
      history.replaceState(null, "", location.pathname + location.search + "#news");
      renderNews();
      return;
    }

    const newsCopyArticle = e.target.closest("[data-news-copy-article]");
    if (newsCopyArticle) {
      const id = newsCopyArticle.dataset.newsCopyArticle;
      if (id) {
        const url = articleShareUrl(id);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            window.MHR_APP.toast(t("newsArticleLinkCopied"));
          }).catch(() => {
            window.MHR_APP.toast(url);
          });
        } else {
          window.MHR_APP.toast(url);
        }
      }
      return;
    }

    const newsImpId = e.target.closest("[data-news-import-id]");
    if (newsImpId) {
      const d = (refDecks || []).find((x) => x.id === newsImpId.dataset.newsImportId);
      if (d && d.code && window.MHR_APP.importCode(d.code)) {
        showPage("builder", true, { newsId: null });
        window.MHR_APP.toast(t("toastRefImported", { n: d.name }));
      }
      return;
    }

    const newsImpCode = e.target.closest("[data-news-import-code]");
    if (newsImpCode) {
      const it = findNewsItem(newsArticleId);
      const rd = it && it.related_decks && it.related_decks[+newsImpCode.dataset.newsImportCode];
      if (rd && rd.code && window.MHR_APP.importCode(rd.code)) {
        showPage("builder", true, { newsId: null });
        window.MHR_APP.toast(t("toastRefImported", { n: rd.name || "" }));
      } else if (rd && !rd.code) {
        window.MHR_APP.toast(t("newsRelatedDeckHint"));
      }
      return;
    }

    const newsCopyId = e.target.closest("[data-news-copy-id]");
    if (newsCopyId) {
      const d = (refDecks || []).find((x) => x.id === newsCopyId.dataset.newsCopyId);
      if (d && d.code) {
        navigator.clipboard?.writeText(d.code);
        window.MHR_APP.toast(t("toastDeckCopied") + "：" + d.name);
      }
      return;
    }

    const newsCopyCode = e.target.closest("[data-news-copy-code]");
    if (newsCopyCode) {
      const it = findNewsItem(newsArticleId);
      const rd = it && it.related_decks && it.related_decks[+newsCopyCode.dataset.newsCopyCode];
      if (rd && rd.code) {
        navigator.clipboard?.writeText(rd.code);
        window.MHR_APP.toast(t("toastDeckCopied") + (rd.name ? "：" + rd.name : ""));
      }
      return;
    }

    const newsCard = e.target.closest("[data-news-card]");
    if (newsCard) {
      const id = newsCard.dataset.newsCard;
      if (id && window.MHR_APP && typeof window.MHR_APP.openCard === "function") {
        const it = findNewsItem(newsArticleId);
        const feat = (it && it.featured_cards) ? it.featured_cards.filter(Boolean) : null;
        const navIds = feat && feat.length
          ? feat.map((fid) => {
              const c = lookupCard(fid);
              return c ? c.id : fid;
            })
          : null;
        window.MHR_APP.openCard(id, navIds, "modalNavInList");
      }
      return;
    }

    const eVoteBtn = e.target.closest("[data-e-vote]");
    if (eVoteBtn) {
      const g = gs();
      if (!g || !g.isSignedIn || !g.isSignedIn()) {
        window.MHR_APP.toast(t("voteNeedLogin"));
        return;
      }
      const id = eVoteBtn.dataset.eVote;
      const value = Number(eVoteBtn.dataset.v);
      try {
        const res = await api("/api/editorial/votes/" + encodeURIComponent(id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.MHR_APP.toast(t("googleSyncError"));
          return;
        }
        editorialVotes[id] = {
          votes_up: data.votes_up | 0,
          votes_down: data.votes_down | 0,
          my_vote: data.my_vote | 0,
        };
        renderDecks();
      } catch (err) {
        window.MHR_APP.toast(t("googleSyncError"));
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
      refreshEditorialVotes().then(() => refreshCommunity());
    });
  }

  {
    const boot = parseHash();
    showPage(boot.page, false, { newsId: boot.newsId });
    ensureNews().then(() => renderTicker());
  }
})();
