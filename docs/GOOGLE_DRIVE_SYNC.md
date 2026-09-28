# Google Drive sync (experimental)

Branch for Google login + per-user deck settings stored in the user's own Google Drive.

Production GitHub Pages continues to deploy from `main` only. Merge here only when the flow is stable.

## Planned approach

- OAuth via Google Identity Services (PKCE), static site on GitHub Pages
- Drive scope: `drive.file` (preferred) or `appDataFolder`
- Keep `localStorage` as offline cache; sync JSON deck/fav state after sign-in
- Share codes remain for no-account transfer

## Status

- Branch created; implementation not started yet.
