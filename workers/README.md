# mhr-deck-sync (Cloudflare Workers + D1)

Backend for optional Google login sync on the Marvel Hero Rush Deck Builder.

Frontend talks to this Worker with a Google **id_token** (GIS credential). User rows in D1 are keyed by Google JWT `sub`.

## Prerequisites

- Cloudflare account
- `wrangler` CLI (`npm i` in this folder, or global)
- Google OAuth **Web** Client ID already set in `../js/google-config.js` and mirrored in `wrangler.toml` `[vars]`

**Do not** run `wrangler login` from a shared group-chat agent session. Log in from your own machine / 1:1 chat with FRIDAY.

## One-time setup

```bash
cd workers
npm install
wrangler login          # your machine / 1:1 only
wrangler d1 create mhr-deck-sync
# paste the returned database_id into wrangler.toml → database_id

wrangler secret put SESSION_SECRET   # long random string
# optional override (else uses [vars].GOOGLE_CLIENT_ID):
# wrangler secret put GOOGLE_CLIENT_ID

npm run d1:migrate:remote
npm run deploy
```

Copy the printed `*.workers.dev` URL (or your custom domain).

## Point the static site at the Worker

In `js/google-config.js`:

```js
window.MHR_GOOGLE_CONFIG = {
  GOOGLE_CLIENT_ID: "….apps.googleusercontent.com",
  SYNC_API_BASE: "https://mhr-deck-sync.<your-subdomain>.workers.dev",
};
```

No trailing slash. Redeploy GitHub Pages (merge to `main`) after changing this.

## Local Worker

```bash
npm run d1:migrate:local
npm run dev
# then set SYNC_API_BASE to http://127.0.0.1:8787 for local Pages (`serve -l 5500`)
```

## API

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/api/health` | none | liveness |
| POST | `/api/auth` | body `{ id_token }` | verifies Google JWT `aud`, sets HttpOnly cookie + returns `session_token` |
| DELETE | `/api/auth` | cookie optional | clears cookie |
| GET | `/api/sync` | Bearer session / id_token or cookie | returns `{ empty, payload }` |
| PUT | `/api/sync` | same | body `{ payload }` — decks / favs / lang / updatedAt |

CORS allows `https://mhrdeckbuild.duckdns.org` and localhost:5500 (see `ALLOWED_ORIGINS`).

## What we do **not** store

No Google refresh tokens, no Client Secret on the Worker for this flow, no Drive files. Only the deck-builder JSON you PUT.
