# Google login + Cloudflare Workers / D1 sync

Branch: `feat/google-auth-sync`

Optional **Sign in with Google** (GIS **id_token** / credential) plus per-user deck sync on **Cloudflare Workers + D1**. This replaces the experimental Drive-based approach on `feat/google-drive-sync` (do not merge that branch for production sync).

Production GitHub Pages continues to deploy from **`main` only**.

## What gets synced

| Key | Source | Notes |
|-----|--------|--------|
| decks | `localStorage` `mhr_decks_v3` | `{ current, decks: [{id,name,cards}] }` |
| favs | `localStorage` `mhr_favs_v2` | array of card ids |
| lang | `localStorage` `mhr_lang` | `zh-HK` / `zh-CN` / `en` |
| updatedAt | `localStorage` `mhr_sync_meta_v1` | ISO-8601; bumped on every local save |

Share codes still work without an account. Offline localStorage is never wiped on sync errors.

## Architecture

```
Browser (GitHub Pages)
  ├─ GIS → Google id_token (Client ID only; no Client Secret)
  ├─ localStorage cache (always)
  └─ fetch SYNC_API_BASE  ──►  Cloudflare Worker
                                 ├─ verify id_token (aud = Client ID)
                                 ├─ HttpOnly session cookie + signed session_token
                                 └─ D1 table user_sync (PK = google_sub)
```

Scripts: `js/google-config.js`, `js/google-auth.js`. Worker: `workers/`.

## Google Cloud Console (Client ID)

Aaron already created a Web Client ID and authorized JS origin for production.

Confirm **Authorized JavaScript origins**:

| Origin |
|--------|
| `https://mhrdeckbuild.duckdns.org` |
| `http://localhost:5500` |
| `http://127.0.0.1:5500` |

OAuth consent screen: add test users while the app is in Testing. This flow does **not** need Drive scopes.

Live Client ID lives in `js/google-config.js` (public SPA identifier — not a secret).

## Cloudflare Worker (required for sync)

1. In a **1:1** session / your own machine: `cd workers && npm i && wrangler login`
2. `wrangler d1 create mhr-deck-sync` → paste `database_id` into `workers/wrangler.toml`
3. `wrangler secret put SESSION_SECRET`
4. `npm run d1:migrate:remote && npm run deploy`
5. Set `SYNC_API_BASE` in `js/google-config.js` to the Worker URL (no trailing slash)
6. Merge / deploy Pages so the static site picks up the config

Until `SYNC_API_BASE` is set, Sign in still shows your email chip (identity only) and toasts that sync API is not configured.

See `workers/README.md` for API details.

## Local testing

```bash
# static site — origin must match an Authorized JS origin
npx --yes serve -l 5500
# Worker (optional)
cd workers && npm run d1:migrate:local && npm run dev
# then SYNC_API_BASE = "http://127.0.0.1:8787"
```

## UI

Top bar chip:

- Not signed in: **Google 登入** / Sign in
- Signed in: truncated email · **立即同步** · **登出**
- Status: syncing / synced (+ time) / error / sync API not set

First differing cloud vs local: conflict modal (keep local / use cloud / cancel). Later: last-write-wins by `updatedAt`.

## Privacy

See [`privacy.html`](../privacy.html).

## Limitations

- id_token lifetime is short (~1h); user may need to sign in again after expiry
- Cross-origin cookies need `SameSite=None; Secure` + CORS allowlist (Worker already set for duckdns + localhost)
- No realtime CRDT — debounce upload (~1.5s) only
- Popup / third-party cookie blockers can interfere with GIS
