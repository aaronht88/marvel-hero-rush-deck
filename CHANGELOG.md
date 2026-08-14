# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

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
