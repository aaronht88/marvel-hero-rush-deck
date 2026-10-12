# Community decks (Workers + D1)

See also: [community-submit-guide.zh-HK.md](./community-submit-guide.zh-HK.md) (投稿／審核書面語).

## Flow

1. User signs in (Google GIS) → POST `/api/decks` → status `pending`
2. Admin (`ADMIN_EMAILS`) reviews checklist A/B/C → PATCH `pass` | `reject` | `revise`
3. Published decks appear under Deck 參考 → Community; votes (`認同` / `不認同`) only when `published`

## Curated vs community

| Source | Storage | Author |
|--------|---------|--------|
| Editorial / AI | `data/decks.json` (static) | Prefer **MHR 編輯群** for new AI decks; existing authors left as-is |
| Community | D1 `community_decks` | Submitter display name |
| Editorial votes | D1 `editorial_votes` (keyed by static `decks.json` id) | Same UI as community; not mixed with `community_votes` |

## Migrate + deploy

```bash
cd workers
eval "$(fnm env)" && fnm use 22
npx wrangler d1 execute mhr-deck-sync --remote --file=./migrations/0002_community_decks.sql
npx wrangler d1 execute mhr-deck-sync --remote --file=./migrations/0003_editorial_votes.sql
npx wrangler deploy
```
