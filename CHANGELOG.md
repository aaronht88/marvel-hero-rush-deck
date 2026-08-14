# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

## [1.3.4-beta] — 2026-08-14

### Added
- **Deck 一覽圖輸出（「匯出 Deck 圖」）**：模擬器一鍵輸出整副 deck 嘅 PNG — Deck 名 + 稀有度構成 + 全部卡圖（×N badge）
- **Logo + Footer + QR Code 只出現喺輸出 PNG**：左上角官方 logo、footer（網址/作者/版本）、右下角 QR（一掃即經 ?deck= 匯入牌組）；modal 預覽保持乾淨版
- **URL deck 匯入**：?deck=<share code> 自動載入牌組（QR scan 落點）
- 本地 qrcode-generator library（零依賴）

## [1.3.4-beta] — 2026-08-13

### Added
- **Deck 一覽圖輸出（prototype）**：模擬器新增「匯出 Deck 圖」— canvas 生成含 Deck 名 + 稀有度構成 + 全部卡圖 + QR code（一掃即匯入）嘅 PNG，附即時預覽

## [1.3.3-beta] — 2026-08-13

### Changed
- 卡數字眼更新：233 → 268（subtitle + 捐款自介，三語）

## [1.3.2-beta] — 2026-08-13

### Added
- **Rush Point 圖鑑**：官方 API 新出 34 張 RUSH POINT 卡（card_type=impact，BP01-121~150 + SD01-04 各 019），新增「Rush Point」view tab 顯示全部真卡圖（本地 WebP）
- 新角色卡 BP01-062-V4（「Freedom Will」Captain America SEC）
- 卡庫更新至 268 張（234 角色 + 34 Rush Point）

## [1.3.1-beta] — 2026-08-12

### Fixed
- **EN deck card count hidden by long buttons**: deck header now wraps + the deck-select shrinks (ellipsis) so the count is always visible — verified no overlap at 380px panel

---

*上一版：v1.3.0-beta（Welcome 用法簡介 + Changelog 精簡 + 版本格式統一）。完整歷史見 Git commit log。*
