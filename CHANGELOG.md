# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

## [1.4.0-beta] — 2026-08-27

### Added
- **⚔️ 試玩對戰（Battle Test）**：一鍵將當前 deck 帶入 Battle Sim（aaronht88.github.io/marvel-hero-rush-sim/?deck=<share code>）——share code v2 格式直通 sim，sim 端自動載入 deck 並開始對戰（唔使手動貼 code）

## [1.4.1-beta] — 2026-08-18

### Removed
- **「⚔️ 試玩對戰」按鈕**：battle sim 尚未適合公開，暫時下架（deck header + 相關 code/i18n 移除）

## [1.3.11-beta] — 2026-08-18

### Added
- **官方卡表更新 268 → 297 張**：
  - **EB01 EVENT PACK** 擴充至 15 張（EB01-001~005 Rush Point + 角色卡，包括「Echo of Fate」Spider-Man 雙版本）
  - **PB01 Promotion Pack A/B**（11 張 PR 稀有度）：A = 銀河守護隊（Drax/Rocket/Star-Lord/Nebula/Gamora/Groot），B = Iron Man/Thor/Hulk/Captain America/Doctor Strange
  - **TB01 Treasure Booster**（3 張 TR 稀有度）：「Lord of Battleworld」Doctor Doom ×3
- 新稀有度 ER/PR/TR、分享碼格式支援（F=EB01, G=PB01, H=TB01）

## [1.3.10-beta] — 2026-08-18

### Added
- **EB01 EVENT PACK 系列 + 新稀有度 ER**：EB01-006「Super Strike」Hulk（Lv6 / 6000 / Red）
- 卡庫 268 → 269（share code 支援 EB01 = F 字母）

## [1.3.9-beta] — 2026-08-18

### Changed
- **分享碼帶埋 deck 名**：匯入時自動保留原名並加上（imported），不再叫「匯入牌組」

## [1.3.8-beta] — 2026-08-18

### Fixed
- **QR / 連結匯入牌組 bug**：之前匯入會直接覆寫用戶現有 deck（通常係「預設牌組」）；而家匯入會開新 deck（「匯入牌組」/「匯入牌組 2」…），原有牌組不會被覆寫；重複匯入同一副 deck 會自動去重
- 匯入成功會顯示提示

## [1.3.7-beta] — 2026-08-14

### Changed
- Welcome overlay「本版更新」精簡至最新功能（3 項），移除舊版本累積項目

## [1.3.6-beta] — 2026-08-14

### Added
- **Deck 一覽圖輸出（「匯出 Deck 圖」）**：模擬器一鍵輸出整副牌組 PNG — Deck 名 + 稀有度構成 + 全部卡圖（×N badge）+ 左上角官方 Logo + Footer
- **QR Code 匯入**：輸出圖右上角 QR（300px / 49×49 modules，手機可掃），一掃即開 `?deck=` 自動匯入牌組；modal 預覽為乾淨版（不包含 Logo/Footer/QR）
- **URL deck 匯入**：`?deck=<share code>` 自動載入牌組

### Changed
- **分享碼壓縮（compact 格式）**：BP01→A、SD01-04→B-E + 卡號 + 數量，50 卡碼 310 chars → 85 chars（-73%）；舊 base64 碼照常可匯入（向後兼容）
- 輸出 PNG 解像度 1200 → 1600px

### Fixed
- 輸出圖 QR 曾被畫布邊緣斬半 → 移至右上角完整顯示
- EN 版 deck 卡數曾被長按鈕遮擋 → header 可換行 + 牌組選單可收縮

### Removed
- 卡面「擁有」標記機制（避免混淆）—— 保留 全部/最愛 兩個 view tab

---

*上一版：v1.3.5-beta（QR 位置修正）。完整歷史見 Git commit log。*
