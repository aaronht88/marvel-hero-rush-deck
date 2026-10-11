// =============================================================
// Google OAuth / Workers sync — EXAMPLE config (copy → google-config.js)
// =============================================================
// 1. Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console
//    https://console.cloud.google.com/apis/credentials
// 2. Under Authorized JavaScript origins, add:
//      https://mhrdeckbuild.duckdns.org
//      http://localhost:5500
//      http://127.0.0.1:5500
//    (GIS credential / id_token flow usually does NOT need redirect URIs)
// 3. Paste the Client ID below. Do NOT put a Client Secret in the frontend.
// 4. After deploying workers/ (see docs/GOOGLE_AUTH_SYNC.md), set SYNC_API_BASE
//    to the Worker origin (no trailing slash), e.g.
//      "https://mhr-deck-sync.example.workers.dev"
// 5. Full walkthrough: docs/GOOGLE_AUTH_SYNC.md
//
// This file is documentation only. The live file is js/google-config.js.

window.MHR_GOOGLE_CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  SYNC_API_BASE: "", // Worker URL after wrangler deploy; empty = login UI only
};
