# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

## [1.5.0-beta] — 2026-10-08

### Added
- **頂部分頁**：Deck Builder／News／Deck 參考，可用 `#news`、`#decks` 直接開
- **News Tab**：香港（代理 Saka Saka 喺 Mato 嘅賽事活動）＋國際（官方網站新聞 API，簡中）
  - `scripts/fetch_news.py` 抓取並寫入 `data/news.json`；GitHub Actions `news.yml` 每日 09:17 HKT 自動更新並重新部署
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
