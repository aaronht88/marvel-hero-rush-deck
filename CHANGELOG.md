# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

## [0.1.0-beta] — 2026-08-10

### Added
- Startup overlay: build version, changelog summary, disclaimer, official credits
- Version badge in the topbar (click to reopen the info overlay)
- Official deck rules validation: exactly 50 cards, max 2 colors, max 3 same-name copies
- Multi-deck storage with naming + Deck Manager (new / rename / delete / load)
- One-click copy of any deck's share code
- View tabs: All / Favorites / Owned collection
- Card detail overlay: enlarged art, full stats, effect text, in-deck counter,
  Add-to-Deck / Favorite / Owned (±) actions
- Drag & drop cards onto the deck panel
- Multi-language UI (繁體中文 / 简体中文 / English)
- Dark sci-fi HUD theme based on the official rulebook design language
- localStorage persistence: decks, favorites, owned counts, language

### Changed
- Clicking a card now opens the detail overlay instead of adding to deck directly
- Copy limit counted per card NAME (alternate-art prints share the limit)
- Deck size changed from guessed 40-60 to official exactly 50

### Fixed
- i18n gap on the modal Add-to-Deck button (now translated in all languages)

---

## Pre-version milestones (2026-08-10 / 2026-08-06)

### 2026-08-10 — Real card data
- 233 real card entries from the official cardlist API
  (BP01 The Avengers booster + SD01-04 REALITY/MIND/SPACE/TIME starters)
- Local 480px WebP card art thumbnails (official image URLs expire in 24h)
- Filters: series, rarity, level, attack range, attribute color

### 2026-08-06 — Initial scaffold
- Zero-dependency static web app (HTML + CSS + vanilla JS)
- Placeholder card data + guessed rules, GitHub Pages deployment
