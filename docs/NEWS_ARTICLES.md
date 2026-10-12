# News 站內全文（多語）流程

目標：API 撈到消息後，由編輯重寫站內版本，讀者唔使跳去微信／外部頁；頁底保留原文來源 credit。有牌表則可入 Deck 參考。

## 資料欄位

寫入 `data/news_overrides.json`（按消息 `id`），`scripts/fetch_news.py` 每次抓取都會 merge 入 `data/news.json`。

```json
{
  "<news-id>": {
    "title_zh": "（舊欄：等同 zh-HK 標題；可繼續用）",
    "summary_zh": "（舊欄：列表摘要 zh-HK）",
    "title_i18n": {
      "zh-HK": "繁中書面語標題",
      "zh-CN": "简体标题",
      "en": "English title"
    },
    "summary_i18n": {
      "zh-HK": "列表摘要",
      "zh-CN": "列表摘要",
      "en": "List summary"
    },
    "body_i18n": {
      "zh-HK": "站內正文（書面語）。段落之間空一行。\n\n第二段……",
      "zh-CN": "站内正文。",
      "en": "On-site article body."
    },
    "source_name": "官方微信",
    "source_url": "https://mp.weixin.qq.com/s/…",
    "related_deck_ids": ["sp01-01"],
    "related_decks": [
      {
        "name": "賽事 Top8 範例構築",
        "code": "1|…",
        "note": "來源：該篇新聞牌表（經 TCG 核對）"
      }
    ]
  }
}
```

亦支援扁平寫法：`body_zh_hk` / `body_zh_cn` / `body_en`（無 `body_i18n` 時）。

**前端行為**

- 若該則有任一語系 `body_*` → 列表顯示「站內閱讀」，點開 `#news/<id>` 文章頁（跟隨右上角語言切換顯示對應正文／標題）。
- 若無正文 → 維持開外部 `url`。
- 頁底：`來源：{source_name}` +「原文連結」→ `source_url`（缺省則用原 `url`）。
- UI 文案 key：`newsReadOnSite`、`newsArticleBack`、`newsSourceCredit`、`newsSourceLink`、`newsRelatedDecks`、`newsImportRelatedDeck`、`newsRelatedDeckHint`、`newsArticlePending`（`js/i18n.js`；內容創作可改書面語）。

## 分工 pipeline

1. **抓料** — `python3 scripts/fetch_news.py`（或日後啟用 `docs/news-workflow.yml` → `.github/workflows/`）。
2. **TCG 卡牌專家** — 核對賽事結果、牌表、卡效；確認可公開改寫嘅要點。
3. **內容創作助手** — 用書面語（zh-HK）＋簡中＋英文寫 `title_i18n` / `summary_i18n` / `body_i18n`；填 `source_name`／`source_url`。
4. **Commit** — 更新 `news_overrides.json`（必要时 re-run fetch 合併）；前端 cache-bust 若只改 data，通常唔使。

## 牌表 → Deck 參考

兩條路徑（至少用一條）：

### A. 站內按鈕（即時）

文章裡 `related_decks[].code` 或 `related_deck_ids`（對應已有 `data/decks.json`）會顯示「匯入此構築」，一鍵入 Builder。

### B. 寫入靜態編輯群（持久）

將核對後嘅構築加進 `data/decks.json`：

- `author`: `"MHR 編輯群"`
- `source`: 新聞標題或「新聞・<date>」
- `source_url`: 指向站內 `#news/<id>` 或原文
- `id`: 新 slug（例如 `news-guangzhou-top-01`）

可選小幫手（本機）：

```bash
# 見 scripts/seed_news_deck_note.md — 或手動加 decks.json 一筆
```

編輯群牌組喺 Deck 參考可投「認同／不認同」（Worker `editorial_votes`，與社區票分開）。

## 注意

- 正文只放可公開改寫／摘要內容；唔好整篇未經授權 verbatim 轉載受版權保護原文。
- 三語盡量齊；缺某一語時 UI 會 fallback：`當前語` → `zh-HK` → `zh-CN` → `en`。
