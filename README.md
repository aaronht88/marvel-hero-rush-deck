# Marvel Hero Rush Deck Builder

A lightweight deck-building web app for the **Marvel Hero Rush TCG** (Card Fun / 杰森动漫).

> ✅ **Real card data.** 2026-08-10 — cardlist published on the official site; this repo now contains all **233 card entries** (192 unique card numbers, including alternate-art / rarity prints) scraped from the official API, with local card art thumbnails.

## Features
- Card browser with search (name / number / trait / effect text) + filters (series / rarity / level / attack range / color)
- Click-to-add deck building with per-card copy limits (**counted per card number**, so alternate-art prints of the same card share the 4-copy limit)
- Live deck validation (deck size, win-condition reminder)
- Deck statistics (level curve, color breakdown, rarity breakdown, average Power)
- Export / import deck as JSON, and a copy-paste share code

## Data
- Source: official Marvel Hero Rush cardlist API (`server.marvelherorush.com/marvel/card/list`)
- Sets: **BP01 The Avengers** (booster, 153 entries) · **SD01 REALITY** · **SD02 MIND** · **SD03 SPACE** · **SD04 TIME** (starter decks, 20 each)
- Rarities: R · SR · GR · MR · UR · SEC
- Card colors: Red · Yellow · Blue · Green
- Card art: downloaded from the official CDN and converted to local 480px WebP thumbnails (`img/cards/`) — official image URLs carry 24-hour expiry tokens, so local copies are required for a static site
- Note: the official cardlist contains **character cards only**; Rush Points are game tokens, not cards
- Deck rules (confirmed from the official rulebook PDF): **exactly 50 cards**, **max 2 colors**, **max 3 same-name copies**; separate 9-card Rush deck

## Tech
Zero-dependency static web app — plain HTML + CSS + vanilla JS. No build step.

## Run locally
```bash
# option 1: any static server
python3 -m http.server 8765
# then open http://localhost:8765

# option 2: just double-click index.html (data is embedded, works on file://)
```

## Files
| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `css/styles.css` | UI styling (dark theme) |
| `js/cards.js` | Card database (233 real entries) |
| `js/rules.js` | Deck-building rules (win condition + levels confirmed; deck size / copy limit flagged `_todo` until the official rulebook drops) |
| `js/app.js` | App logic: browse, build, validate, share |
| `img/cards/` | Local card art thumbnails (WebP) |

## Roadmap
- [x] Verify deck size + copy-limit rules against the official rulebook PDF (confirmed: 50 cards / 2 colors / 3 same-name)
- [ ] Traditional-Chinese card text (official API currently serves EN/ID only)
- [ ] Multiple saved decks, card detail popup, public sharing backend

## Deployment
Live site: https://aaronht88.github.io/marvel-hero-rush-deck/ (GitHub Actions → Pages)
