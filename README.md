# Marvel Hero Rush Deck Builder

A lightweight deck-building web app for the **Marvel Hero Rush TCG** (Card Fun, launching 2026-08-15).

> ⚠️ **Scaffold / placeholder status.** This is an early scaffold built before the game's card data was published. All card data is PLACEHOLDER and the deck-construction rules are GUESSED. Replace `js/cards.js` and `js/rules.js` with real data after release.

## Features
- Card browser with search + filters (type / rarity / level)
- Click-to-add deck building with per-card copy limits
- Live deck validation against placeholder rules
- Deck statistics (character / Rush Point counts, total cost, rarity breakdown)
- Export / import deck as JSON, and a copy-paste share code

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
| `js/cards.js` | Card database + schema (EDIT THIS with real cards) |
| `js/rules.js` | Deck-building rules (EDIT THIS with real rules) |
| `js/app.js` | App logic: browse, build, validate, share |

## Roadmap
- [ ] Replace placeholder cards with real card data (post 2026-08-15)
- [ ] Verify & finalize deck rules
- [ ] Optional: card images, multiple saved decks, public sharing backend
