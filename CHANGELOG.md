# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

> 版本編號格式：X.Y.Z-beta。此檔案只記錄最新版本改動；完整歷史見 Git commit log。

## [1.3.1-beta] — 2026-08-12

### Added
- **Welcome overlay 用法簡介**：新增「用法簡介」section（搜尋篩選 / 砌牌組 / 分享碼 / 模擬器 / 語言切換），三語（繁中 / 简中 / EN）
- 聯絡 email（dose-tragedy-goes@duck.com）於作者 Credit + 捐款自介（三語）
- 牌組模擬器卡面顯示卡號 / 稀有度 / 系列 chips
- Deck 條件以 checkbox（☑/☐）顯示：50 張牌組 · 最多 2 色 · 同名最多 3 張（新增同名即時驗證）
- 每張卡顯示所屬系列（BP01 / SD01-04）

### Changed
- 繁中介面全部文案改為書面語（去除廣東話口語）
- 版本編號格式改為 X.Y.Z-beta（三個小數點位）
- 「匯入 Deck」改為彈窗輸入分享碼；分享碼為唯一牌組傳輸方式（JSON 匯出/匯入移除）
- 捐款：☕ 支持我 改為彈出 overlay（含自介 + BMC + PayMe + QR）
- 支持入口移至頂欄（counter chip 右邊金色「☕ 支持我」）

### Fixed
- 手機版 deck panel 不可見：body 鎖死 100vh 導致單欄時 deck 被推出視口 — 改為自然流動 + deck panel 底部 sticky bar
- 卡面擁有標記遮住 Lv — 已移除（擁有機制一併移除）
- SEC 卡 chips 迫行 — 縮細 chip 尺寸
- 多處 cache-busting 失效（同版本號重複 deploy）— 每次 deploy 必 bump 版本

### Removed
- 「擁有」(owned) 機制：擁有 tab、卡面數量顯示、批量按鈕、modal 控制
- 常駐分享碼輸入框、JSON 匯出/匯入
- 捐款 tab 的多餘勝利條件字條

---

*過往版本（v0.1.0 → v1.2.20）記錄已移至 Git commit log。*
