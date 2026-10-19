# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

## [1.6.6-beta] — 2026-10-19

### Fixed
- **Vault / News / Deck 參考分頁切唔走 Builder**：`css/styles.css` 殘低嘅 `<<<<<<< HEAD` 令 `.page[hidden] { display: none !important; }` 被瀏覽器丟棄，`.layout { display: grid }` 蓋過 `[hidden]`，Builder 一直留喺畫面
- 版本／cache-bust **1.6.6-beta**

## [1.6.5-beta] — 2026-10-19

### Removed
- **「包含 deck 名」剔選掣拆走**（Aaron：太重複）：分享碼一律帶 deck 名；既然撞名已經會自動變 `Name（1）`，cards-only 模式只係多餘 UI。舊 cards-only 分享碼仍然解碼得（向後兼容）
- 版本／cache-bust **1.6.5-beta**

## [1.6.4-beta] — 2026-10-19

### Added
- **匯入可以揀「新增一副」／「合併入現有」**：匯入視窗兩個掣，合併會將卡直接加落目前牌組（跟同名 3 張上限，超出會略過並提示合併了幾多張）
- **Deck Manager 每副加「⧉ 複製」**：一按即複製整副（卡 table 一樣），名自動變 `X（1）`，即刻切換去新副改
- 版本／cache-bust **1.6.4-beta**

### Changed
- 匯入命名簡化成純 Windows 式 `Name（1）`／`Name（2）`（唔再加 `（imported）`，同名先加號）

## [1.6.3-beta] — 2026-10-19

### Fixed
- **匯入分享碼唔會再靜靜雞「合併」**：以前如果匯入嘅卡同現有 deck 一模一樣，app 會直接跳去嗰副 deck、唔新增任何嘢，用戶就會以為「分享碼無效」。現在每次匯入都一定新增一副新 deck
- 匯入撞名自動加後綴（Windows 式）：`Deck A` → `Deck A 2（imported）` → `Deck A 3（imported）`，唔會再覆蓋或靜默跳 deck

### Added
- **「包含 deck 名」checkbox**（喺「複製分享碼」旁）：剔住（預設）= 分享碼含 deck 名；取消剔選 = 分享碼只含卡 data，照樣匯入得
- 版本／cache-bust **1.6.3-beta**

## [1.6.2-beta] — 2026-10-12

### Changed
- **唔再顯示官方卡組碼**：News 文內牌組區塊同 Deck 參考 meta 只保留本站分享碼／複製／匯入（官方碼需微信，唔對訪客顯示）；`data/decks.json` 仍可保留 `official_code` 作內部資料
- ASCC 四強站內文三語正文移除文末「官方卡組碼／官方卡组码／Official deck code」句子
- 版本／cache-bust **1.6.2-beta**

## [1.6.1-beta] — 2026-10-12

### Added
- **News 文內牌組區塊**：正文支援 `{{deck:DECK_ID}}` placeholder，渲染後插入 Deck Ref 名稱、3 keycards、本站分享碼與「複製／匯入」按鈕（重用既有 `data-news-copy-id` / `data-news-import-id`；唔顯示官方微信卡組碼）
- **複製文章連結**：文章標題下「複製文章連結」按鈕，複製 `https://mhrdeckbuild.duckdns.org/#news/<id>`（同 host 則用 `location.origin`）
- ASCC 四強站內文（三語）每副評論後插入對應 `{{deck:ascc-*}}`；有 inline embed 時略過底部大批 featured 卡牆，並隱藏已全部內嵌的 related 區塊

### Changed
- 版本／cache-bust **1.6.1-beta**

## [1.6.0-beta] — 2026-10-12

### Added
- **ASCC 亞洲巔峰邀請賽四強** 編輯群 Deck 參考：冠軍 剩饭君（YG Web Spider）、亞軍 YOGIE（GR Attach Tempo）、四強 RADIAN（RB Symbiote Knull）、四強 落雨啦（BG Cap/Chaos Story）；含完整卡表、3 keycards、官方卡組碼 `official_code` 與本站 share `code`
- **News 站內全文**：`editorial-ascc-asia-peak-top4-2026-10-12` 三語（zh-HK／zh-CN／en）四強卡組一覽；每副附引擎／勝勢／注意（構築評論＋玩法講解）；`featured_cards` 11 張；`related_deck_ids` 對應四副 ASCC Deck Ref；`fetch_news.py` 會保留／注入 `editorial-*` stub
- Deck 參考資料可存 `official_code`（內部用；UI 唔再顯示，因官方碼需微信）
- 冠軍鷹眼 SD04-002 數量推斷註記（截圖角標被遮）

### Changed
- 版本／cache-bust **1.6.0-beta**

## [Unreleased]

## [1.5.9-beta] — 2026-10-12

### Added
- **卡詳情左右切換**：`#card-modal` 兩側圓形箭嘴（‹ ›）＋底部位置指示（如 `12 / 248 · 篩選結果內`）；跟住目前篩選／圖鑑／Vault／模擬器／News featured 列表順序；鍵盤 ← → 支援（input／textarea 唔偷鍵）；兩端 disable、唔 wrap

### Changed
- 版本／cache-bust **1.5.9-beta**

## [1.5.8-beta] — 2026-10-12

### Added
- **Deck 參考 keycard 預覽**：每副編輯群牌組顯示 3 張關鍵卡小圖（三欄並排）；資料來源 `data/decks.json` 的 `keycards`，卡面沿用 `img/cards/<id>.webp`（與 Vault／News featured 相同解析）

### Changed
- 版本／cache-bust **1.5.8-beta**

## [1.5.7-beta] — 2026-10-12

### Fixed
- **Deck 參考桌面版 layout**：`#ref-decks.ref-decks` 改為 flex column，唔再當 card grid；只有 `.ref-decks-grid` 排牌組卡；subtabs／intro 全寬

### Changed
- 認同／不認同掣改為 **👍／👎** ＋數字（`aria-label`／`title` 仍用 i18n 文案）
- 版本／cache-bust **1.5.7-beta**

## [1.5.6-beta] — 2026-10-12

### Added
- **編輯群牌組投票**：Deck 參考「MHR 編輯群」靜態牌組顯示認同／不認同（須 Google 登入；每用戶每牌組一票、再按可取消）。Worker 表 `editorial_votes` 與社區票分開；`GET /api/editorial/votes?ids=`、`POST /api/editorial/votes/:deckId`
- **News 站內全文（多語 scaffold）**：`title_i18n`／`summary_i18n`／`body_i18n`（zh-HK／zh-CN／en）；有正文則 `#news/<id>` 站內閱讀並隨語言切換；頁底「來源／原文連結」；`related_deck_ids`／`related_decks` 可匯入構築。流程：`docs/NEWS_ARTICLES.md`
- **News 提及卡牌＋分享碼**：`featured_cards` 以模擬器風格顯示本地卡面；`related_decks[].code` 顯示分享碼＋複製／匯入至構築
- 範例：SP01 六張卡牌調整公告三語正文＋`featured_cards`（含蜘蛛俠候選卡號）

### Changed
- 版本／cache-bust **1.5.6-beta**

## [1.5.4-beta] — 2026-10-12

### Fixed
- Bump cache-bust so Vault tab label updates.

### Changed
- Top tab label **Vault** only; Vault promoted to main tab（詳見 commit log）.

## [1.5.1-beta] — 2026-10-11 (Google auth)

### Added
- **Google 登入 + 雲端同步（骨架）**：GIS `id_token` 登入；可選 Cloudflare Workers + D1 按 Google `sub` 儲存牌組／最愛／語言（`feat/google-auth-sync`）
  - 前端：`js/google-config.js`、`js/google-auth.js`；`SYNC_API_BASE` 未設定時仍可登入顯示身分，不同步
  - 後端骨架：`workers/`（須自行 `wrangler` 建立 D1 並部署）
  - 說明：`docs/GOOGLE_AUTH_SYNC.md`；私隱政策：`privacy.html`
- 本機與雲端資料衝突時可選擇保留本機／使用雲端

> 注意：此功能須部署 Worker 並填入 `SYNC_API_BASE` 後才會真正跨裝置同步；與舊實驗分支 `feat/google-drive-sync`（Drive API）無關。

## [1.5.0-beta] — 2026-10-08

### Added
- **頂部分頁**：Deck Builder／News／Deck 參考，可用 `#news`、`#decks` 直接開
- **News Tab**：香港（代理 Saka Saka 喺 Mato 嘅賽事活動）＋國際（官方網站新聞 API，簡中）
  - `scripts/fetch_news.py` 抓取並寫入 `data/news.json`；每日自動更新嘅 workflow 暫放 `docs/news-workflow.yml`，搬去 `.github/workflows/news.yml` 先會啟用
  - `data/news_overrides.json` 可按 id 加廣東話標題（`title_zh`）同摘要（`summary_zh`），每次抓取都會保留
- **Deck 參考 Tab**：讀 `data/decks.json`，一鍵匯入做新 Deck（唔覆蓋現有牌組）或複製分享碼；第一批為 4 副 SP01 構築

### Changed
- 篩選由常駐 chips 改為**下拉選單**：㩒開先多項剔選，按鈕顯示已揀項目（多過 2 項顯示「已揀 N 項」）；㩒外面或 Esc 收起；手機版面板全寬
- 篩選邏輯不變（同類 OR、跨類 AND）

## [1.4.6-beta] — 2026-09-28

### Changed
- **篩選改為 Checkbox 多選**：系列／稀有度／等級／攻擊範圍／顏色由單一 `<select>` 改為勾選 chips
  - 同類別內：**OR**（例如勾 Red + Blue → 紅或藍）
  - 跨類別：**AND**（例如再勾 SR → 只顯示紅 SR 與藍 SR）
  - 某類別零勾選＝不限（等同舊「全部」）
  - 搜尋文字與最愛視圖仍與篩選 AND；Rush Point 圖鑑 tab 不變
- 新增「清除篩選」按鈕；語言切換時同步更新等級／範圍／顏色標籤

## [1.4.5-beta] — 2026-08-18

### Added
- **簡中介面顯示官方簡中卡名 / 特徵 / 效果**（js/cards_cn.js，官方 API zh-CN 448 條）：切換去簡中就自動用中文卡文字（如「毒液」「蜘蛛侠」）；搜尋同時支援中英文；繁中/英文維持英文卡資料

## [1.4.4-beta] — 2026-08-18

### Added
- **SP01「Era of Spiders」蜘蛛紀元全卡表**（官方 API 首發，297 → **449 張**）
  - SP01-001~080：80 個角色 — Spider-Man 宇宙全陣容（Venom 與共生體群 / Spider-Gwen / Ghost-Spider / Spider-Ham / Spider-Man 2099 / Superior Spider-Man / Doc Ock / Green Goblin / Kingpin / Knull / Black Cat / Silk 等）
  - SP01-081~100：20 張 Rush Point（含 MR / SEC 稀有度 print）
  - **HR** 新稀有度（chip 顏色 + filter + 分享碼 I=SP01 支援）
  - 152 張卡圖全部本地 WebP，0 缺圖

### Changed
- 卡庫 **297 → 449**（377 角色 + 72 Rush Point）；Rush Point 圖鑑由 39 → 72 張
- subtitle / 捐款自介 / welcome overlay 卡數字眼三語同步

### Removed
- 卡牌詳情 3D + Holo 效果 prototype（效果一般，roll back）
- 「⚔️ 試玩對戰」按鈕（battle sim 尚未適合公開）

---

*上一版：v1.3.11-beta（EB01 / PB01 / TB01 新系列）。完整歷史見 Git commit log。*
