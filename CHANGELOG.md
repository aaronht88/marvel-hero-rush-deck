# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

## [Unreleased]

### Changed
- Top tab label is now **Vault** only (was 卡庫（Vault）).


### Changed
- **卡庫（Vault）升為頂層主分頁**：與 Deck Builder／News／Deck 參考同級（`#vault`）；Builder 內「全部／最愛／Rush Point」不再含 Vault 子 tab
  - 獨立全寬圖鑑頁（`#page-vault`／`#vault-grid`）：進度、顯示模式／卡面大小、搜尋與篩選、卡面 ＋／− `xN`
  - 資料模型不變：`mhr_vault_v1`／`mhr_vault_ui_v1`、詳情頁已擁有數量、Google 同步

 — 1.5.3-beta (draft)

### Fixed
- Display mode / card size controls now apply on all browser tabs (not only Vault); fixed toolbar `hidden` overridden by CSS `display:flex`.

### Added
- **卡庫（Vault）圖鑑**：未擁有卡牌灰階、已擁有全彩並顯示數量；卡牌詳情可設定「已擁有數量」（按卡 id／印刷分別計算，收藏數量不設 3 張上限）
  - 本機：`localStorage` `mhr_vault_v1`；Google 登入後與 decks／favs／lang 一併雲端同步
  - 保留系列／顏色等篩選；進度「已收集 {owned}／{total}」
  - 文案：`docs/vault-i18n.zh-HK.snippet.js`（PR #9）
  - **未做（之後）**：Deck Builder「本副需要 N／卡庫有 M」對照提示
- **Vault 卡面快速加減／顯示模式／大小**：圖鑑卡面直接顯示 `xN` 並可按 ＋／−（不開啟詳情；收藏不設上限）；可切換「標準／最簡卡面」與卡面大小（小／中／大）；偏好存 `localStorage` `mhr_vault_ui_v1`
- **社區牌組投稿／審核／投票**：Deck 參考分「MHR 編輯群」精選與社區投稿；登入後投稿 → `pending` → 管理員 checklist 通過後公開；公開後可「認同／不認同」（每用戶每牌組一票）
  - Worker：`/api/decks`、`/api/decks/:id`、`/api/decks/:id/vote`、`/api/me`；D1 `0002_community_decks.sql`
  - 硬性檢查（A）：50 張、同名 ≤3、≤2 色、分享碼可匯入、不含 Rush Point；必填（B）名稱／上載者／玩法描述／分享碼；玩法描述（C）須寫觸發→回報
  - 審核結果（D）：通過／拒稿／須修改；拒稿與須修改須註明 A／C 條款
  - 指引：`docs/community-submit-guide.zh-HK.md`

### Changed
- 靜態 `data/decks.json` 仍為精選來源（不強制改寫作者）；新 AI／編輯構築署名「MHR 編輯群」

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
