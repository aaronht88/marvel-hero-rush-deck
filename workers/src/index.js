/**
 * MHR Deck Builder — Cloudflare Worker sync API
 * GIS id_token → session; D1 payload keyed by Google `sub`.
 */

const COOKIE_NAME = "mhr_session";
const SESSION_TTL_SEC = 60 * 60 * 24; // 24h

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function parseAllowedOrigins(env) {
  const raw = (env.ALLOWED_ORIGINS || "https://mhrdeckbuild.duckdns.org,http://localhost:5500,http://127.0.0.1:5500");
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = parseAllowedOrigins(env);
  const headers = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

function withCors(response, request, env) {
  const h = corsHeaders(request, env);
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
  return out;
}

function getClientId(env) {
  return String(env.GOOGLE_CLIENT_ID || "").trim();
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacVerify(secret, message, signature) {
  const expected = await hmacSign(secret, message);
  return expected === signature;
}

function b64urlJson(obj) {
  const s = btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return s;
}

function b64urlParse(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

async function mintSession(env, { sub, email }) {
  const secret = env.SESSION_SECRET || (await sha256Hex("dev-" + getClientId(env)));
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const body = b64urlJson({ sub, email: email || "", exp });
  const sig = await hmacSign(secret, body);
  return { token: body + "." + sig, exp };
}

async function verifySessionToken(env, token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const secret = env.SESSION_SECRET || (await sha256Hex("dev-" + getClientId(env)));
  const ok = await hmacVerify(secret, body, sig);
  if (!ok) return null;
  let payload;
  try {
    payload = b64urlParse(body);
  } catch (e) {
    return null;
  }
  if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function sessionCookieHeader(token, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${maxAge}`,
  ];
  return parts.join("; ");
}

async function verifyGoogleIdToken(env, idToken) {
  const clientId = getClientId(env);
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured");
  if (!idToken) throw new Error("missing id_token");

  // Google tokeninfo (scaffold). For high traffic, switch to JWKS verification.
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("tokeninfo " + res.status + " " + txt.slice(0, 80));
  }
  const data = await res.json();
  if (data.aud !== clientId) throw new Error("aud mismatch");
  const iss = data.iss || "";
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("iss mismatch");
  }
  const exp = Number(data.exp) || 0;
  if (exp < Math.floor(Date.now() / 1000)) throw new Error("id_token expired");
  return {
    sub: data.sub,
    email: data.email || "",
    email_verified: data.email_verified === "true" || data.email_verified === true,
    exp,
  };
}

async function resolveUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  let bearer = "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    bearer = auth.slice(7).trim();
  }
  const cookies = parseCookies(request);
  const cookieTok = cookies[COOKIE_NAME] || "";

  // Prefer session token (HMAC); fall back to raw Google id_token
  for (const tok of [bearer, cookieTok]) {
    if (!tok) continue;
    const session = await verifySessionToken(env, tok);
    if (session) return session;
  }
  for (const tok of [bearer, cookieTok]) {
    if (!tok || tok.split(".").length !== 3) continue;
    try {
      const g = await verifyGoogleIdToken(env, tok);
      return { sub: g.sub, email: g.email, exp: g.exp };
    } catch (e) {
      /* try next */
    }
  }
  return null;
}

async function handleAuth(request, env) {
  if (request.method === "DELETE") {
    return json(
      { ok: true },
      200,
      { "Set-Cookie": sessionCookieHeader("", 0) }
    );
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }
  try {
    const g = await verifyGoogleIdToken(env, body.id_token);
    const { token, exp } = await mintSession(env, { sub: g.sub, email: g.email });
    return json(
      {
        ok: true,
        sub: g.sub,
        email: g.email,
        session_token: token,
        exp,
      },
      200,
      { "Set-Cookie": sessionCookieHeader(token, SESSION_TTL_SEC) }
    );
  } catch (e) {
    return json({ error: "auth_failed", message: String(e.message || e) }, 401);
  }
}

async function handleSyncGet(request, env, user) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  const row = await env.DB.prepare(
    "SELECT payload, updated_at, email FROM user_sync WHERE google_sub = ?"
  )
    .bind(user.sub)
    .first();
  if (!row) {
    return json({ empty: true, payload: null });
  }
  let payload;
  try {
    payload = JSON.parse(row.payload);
  } catch (e) {
    return json({ error: "corrupt_payload" }, 500);
  }
  return json({ empty: false, payload, updated_at: row.updated_at });
}

async function handleSyncPut(request, env, user) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }
  const payload = body.payload || body;
  if (!payload || typeof payload !== "object") {
    return json({ error: "missing_payload" }, 400);
  }
  // Soft size guard (~512 KB)
  const raw = JSON.stringify(payload);
  if (raw.length > 512 * 1024) {
    return json({ error: "payload_too_large" }, 413);
  }
  const updatedAt = payload.updatedAt || new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_sync (google_sub, email, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email,
       payload = excluded.payload,
       updated_at = excluded.updated_at`
  )
    .bind(user.sub, user.email || null, raw, updatedAt)
    .run();
  return json({ ok: true, updated_at: updatedAt });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return withCors(
          json({
            ok: true,
            service: "mhr-deck-sync",
            hasDb: !!env.DB,
            clientIdSet: !!getClientId(env),
          }),
          request,
          env
        );
      }

      if (url.pathname === "/api/auth") {
        const res = await handleAuth(request, env);
        return withCors(res, request, env);
      }

      if (url.pathname === "/api/sync") {
        const user = await resolveUser(request, env);
        if (!user) {
          return withCors(json({ error: "unauthorized" }, 401), request, env);
        }
        let res;
        if (request.method === "GET") res = await handleSyncGet(request, env, user);
        else if (request.method === "PUT") res = await handleSyncPut(request, env, user);
        else res = json({ error: "method_not_allowed" }, 405);
        return withCors(res, request, env);
      }

      return withCors(json({ error: "not_found" }, 404), request, env);
    } catch (e) {
      return withCors(
        json({ error: "internal", message: String(e.message || e) }, 500),
        request,
        env
      );
    }
  },
};
