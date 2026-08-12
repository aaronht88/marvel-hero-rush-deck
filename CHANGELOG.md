# Changelog

All notable changes to the Marvel Hero Rush Deck Builder.

## [1.3-beta] — 2026-08-11

### Added
- **Donation tab** (支持 / Support): new view tab with a "Buy me a coffee" button + PayMe QR code panel — fully voluntary, i18n for all 3 languages

## [1.2-beta] — 2026-08-11

### Added
- **UI motion polish** (craft pass on the whole interface):
  - Modals now animate in (scale 0.96 → 1 + fade, custom ease-out curve) and exit faster than they enter
  - Toasts slide up + fade instead of popping in/out; rapid actions retarget smoothly
  - Button press feedback: all buttons/tabs/qty controls scale down slightly on `:active`
  - Card tiles lift + glow on hover (now gated to mouse pointers only — no sticky hover on touch)
  - One-time fade-in of the card grid on first paint
- **Accessibility**: `prefers-reduced-motion` support — users with reduced-motion enabled get opacity/color-only transitions, no movement

### Changed
- All transitions now animate explicit properties only (no more `transition: all`-style shorthand) with custom cubic-bezier easing curves
- Easing/duration tuned to the theme's crisp tactical-HUD personality (everything stays sub-300ms)

## [1.1-beta] — 2026-08-11

### Added
- **Deck Simulator**: new 模擬器 button in the deck panel — opens an overlay with the whole deck grouped & sorted by Grade (Lv 1-6); each grade section shows its card count; clicking any card opens the full card detail modal
- **Series tag on every card tile**: new chip showing the source series (BP01 / SD01 / SD02 / SD03 / SD04), with the full series name on hover

### Fixed
- **Chinese attribute bug (official API data glitch)**: the official cardlist API returned Chinese color values (蓝/绿/黄) for 10 cards (BP01-061, BP01-035-V2, BP01-074-V2, BP01-075-V2, BP01-091/092/093, BP01-096-V2, BP01-097-V2, BP01-101-V2), causing missing color borders, broken color filters, and wrong deck color-count validation. All normalized to English; the data generator now maps 红→Red / 蓝→Blue / 黄→Yellow / 绿→Green so future scrapes stay clean

### Changed
- **Cache-busting**: all assets now load with `?v=` version query strings, so browsers never serve stale files after a release (visible fix for users who saw the pre-fix card data)

## [1.0-beta] — 2026-08-11

### Added
- Official MARVEL HERORUSH logo (topbar + welcome overlay)
- Visitor counter: topbar badge (👁 N) + cumulative visitor count in the welcome overlay (GoatCounter)
- Visitor counter labels follow the UI language (訪客 / 访客 / Visitors)
- Author credit (aaronht88) in the topbar and welcome overlay
- Custom domain: mhrdeckbuild.duckdns.org (via DuckDNS → GitHub Pages)
- Auto-detect browser language on first visit (saved choice still wins)
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
- Version bumped from 0.1.0-beta to 1.0-beta
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
