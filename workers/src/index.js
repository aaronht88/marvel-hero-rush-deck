/**
 * MHR Deck Builder — Cloudflare Worker sync + community decks API
 * GIS id_token → session; D1 payload keyed by Google `sub`.
 * Community: submit → pending → admin pass/reject/revise → published (+ votes).
 */

const COOKIE_NAME = "mhr_session";
const SESSION_TTL_SEC = 60 * 60 * 24; // 24h
const NOTE_MIN_LEN = 40;
const CHECKLIST_CODES = [
  "card_count_50",
  "unique_name_leq_3",
  "colors_ok",
  "no_rush_points",
  "code_importable",
  "note_engine",
  "submitter_name",
  "deck_name",
];

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
  const raw = env.ALLOWED_ORIGINS || "https://mhrdeckbuild.duckdns.org,http://localhost:5500,http://127.0.0.1:5500";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = parseAllowedOrigins(env);
  const headers = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
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

function adminEmails(env) {
  return String(env.ADMIN_EMAILS || "aaronht88@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(env, user) {
  if (!user || !user.email) return false;
  return adminEmails(env).includes(String(user.email).toLowerCase());
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
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
  if (!(await hmacVerify(secret, body, sig))) return null;
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
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sessionCookieHeader(token, maxAge) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

async function verifyGoogleIdToken(env, idToken) {
  const clientId = getClientId(env);
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured");
  if (!idToken) throw new Error("missing id_token");
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
  if (auth.toLowerCase().startsWith("bearer ")) bearer = auth.slice(7).trim();
  const cookies = parseCookies(request);
  const cookieTok = cookies[COOKIE_NAME] || "";
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
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookieHeader("", 0) });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
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
        is_admin: adminEmails(env).includes(String(g.email || "").toLowerCase()),
      },
      200,
      { "Set-Cookie": sessionCookieHeader(token, SESSION_TTL_SEC) }
    );
  } catch (e) {
    return json({ error: "auth_failed", message: String(e.message || e) }, 401);
  }
}

async function handleMe(request, env, user) {
  return json({
    sub: user.sub,
    email: user.email || "",
    is_admin: isAdmin(env, user),
  });
}

async function handleSyncGet(request, env, user) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  const row = await env.DB.prepare(
    "SELECT payload, updated_at, email FROM user_sync WHERE google_sub = ?"
  )
    .bind(user.sub)
    .first();
  if (!row) return json({ empty: true, payload: null });
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
  if (!payload || typeof payload !== "object") return json({ error: "missing_payload" }, 400);
  const raw = JSON.stringify(payload);
  if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413);
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

/** Server-side share-code parse (compact + legacy). No card DB — ids + qty only. */
const LETTER_SERIES = {
  A: "BP01", B: "SD01", C: "SD02", D: "SD03", E: "SD04",
  F: "EB01", G: "PB01", H: "TB01", I: "SP01",
};

function parseShareCode(code) {
  try {
    const s = String(code || "").trim();
    if (!s) return null;
    let cardsPart = s;
    let deckName = null;
    if (s.startsWith("1|")) {
      const idx = s.indexOf("|", 2);
      if (idx === -1) return null;
      deckName = s.slice(2, idx);
      try {
        deckName = decodeURIComponent(deckName);
      } catch (e) {}
      cardsPart = s.slice(idx + 1);
    }
    const entries = [];
    if (/^[A-I]/.test(cardsPart)) {
      let i = 0;
      while (i < cardsPart.length) {
        const letter = cardsPart[i++];
        const num = cardsPart.substr(i, 3);
        i += 3;
        if (!LETTER_SERIES[letter] || !/^\d{3}$/.test(num)) return null;
        let id = LETTER_SERIES[letter] + "-" + num;
        if (cardsPart[i] === "v") {
          i++;
          let v = "";
          while (i < cardsPart.length && /\d/.test(cardsPart[i])) v += cardsPart[i++];
          if (!v) return null;
          id += "-V" + v;
        }
        if (i >= cardsPart.length) return null;
        const qty = parseInt(cardsPart[i++], 36);
        if (!qty || qty < 1) return null;
        entries.push({ id, qty });
      }
    } else {
      const arr = JSON.parse(decodeURIComponent(escape(atob(cardsPart))));
      if (!Array.isArray(arr)) return null;
      for (const row of arr) {
        const id = row[0];
        const qty = row[1] | 0;
        if (!id || qty < 1) return null;
        entries.push({ id, qty });
      }
    }
    if (!entries.length) return null;
    return { entries, name: deckName };
  } catch (e) {
    return null;
  }
}

function isRushPointId(id) {
  // Rush Points: BP01-121~150, SP01-081~100, starter/EB rush prints — heuristic by known ranges
  const m = String(id).match(/^(BP01|SP01|EB01|SD0[1-4]|PB01|TB01)-(\d{3})/);
  if (!m) return false;
  const set = m[1];
  const n = parseInt(m[2], 10);
  if (set === "BP01" && n >= 121 && n <= 150) return true;
  if (set === "SP01" && n >= 81 && n <= 100) return true;
  // Starter / EB01 often use -121 style single rush; treat high numbers cautiously
  if (/^SD0[1-4]$/.test(set) && n >= 121) return true;
  if (set === "EB01" && n >= 121) return true;
  if (set === "PB01" && n >= 121) return true;
  if (set === "TB01" && n >= 121) return true;
  return false;
}

/**
 * Hard validation A+B (server). Client adds name-level unique + colors from cards.js.
 * checklist: { code: true|false|"unknown", ... }
 */
function buildServerChecklist({ name, submitter_name, note, code, clientChecklist }) {
  const checklist = {};
  CHECKLIST_CODES.forEach((c) => {
    checklist[c] = false;
  });

  checklist.deck_name = !!(name && String(name).trim());
  checklist.submitter_name = !!(submitter_name && String(submitter_name).trim());
  const noteStr = String(note || "").trim();
  checklist.note_engine = noteStr.length >= NOTE_MIN_LEN;

  const parsed = parseShareCode(code);
  checklist.code_importable = !!parsed;

  let total = 0;
  let rush = false;
  let qtyOk = true;
  if (parsed) {
    for (const e of parsed.entries) {
      total += e.qty;
      if (e.qty > 3) qtyOk = false;
      if (isRushPointId(e.id)) rush = true;
    }
  }
  checklist.card_count_50 = total === 50;
  checklist.no_rush_points = parsed ? !rush : false;
  // Server cannot resolve alt-art names; accept client flag or mark unknown when qty per id ≤3
  if (clientChecklist && typeof clientChecklist.unique_name_leq_3 === "boolean") {
    checklist.unique_name_leq_3 = clientChecklist.unique_name_leq_3;
  } else {
    checklist.unique_name_leq_3 = parsed ? qtyOk : false;
  }
  if (clientChecklist && typeof clientChecklist.colors_ok === "boolean") {
    checklist.colors_ok = clientChecklist.colors_ok;
  } else {
    checklist.colors_ok = "unknown";
  }

  const hardFail =
    !checklist.deck_name ||
    !checklist.submitter_name ||
    !checklist.note_engine ||
    !checklist.code_importable ||
    !checklist.card_count_50 ||
    !checklist.no_rush_points ||
    checklist.unique_name_leq_3 === false;

  return { checklist, hardFail, parsed, total };
}

function rowToDeck(row, { includePrivate } = {}) {
  if (!row) return null;
  let colors = [];
  let checklist = null;
  try {
    colors = row.colors ? JSON.parse(row.colors) : [];
  } catch (e) {
    colors = [];
  }
  try {
    checklist = row.checklist ? JSON.parse(row.checklist) : null;
  } catch (e) {
    checklist = null;
  }
  const out = {
    id: row.id,
    name: row.name,
    note: row.note,
    code: row.code,
    colors,
    submitter_name: row.submitter_name,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at || null,
    published_at: row.published_at || null,
    votes_up: row.votes_up | 0,
    votes_down: row.votes_down | 0,
    source: "community",
  };
  if (includePrivate) {
    out.checklist = checklist;
    out.reject_reason = row.reject_reason || null;
    out.google_sub = row.google_sub;
  } else if (row.status === "rejected" || row.status === "revise") {
    out.reject_reason = row.reject_reason || null;
  }
  return out;
}

async function handleDecksList(request, env, user) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  const url = new URL(request.url);
  let status = (url.searchParams.get("status") || "published").toLowerCase();
  const mine = url.searchParams.get("mine") === "1";

  if (mine) {
    if (!user) return json({ error: "unauthorized" }, 401);
    const { results } = await env.DB.prepare(
      `SELECT * FROM community_decks WHERE google_sub = ? ORDER BY created_at DESC LIMIT 100`
    )
      .bind(user.sub)
      .all();
    return json({
      decks: (results || []).map((r) => rowToDeck(r, { includePrivate: true })),
    });
  }

  if (status === "pending" || status === "revise" || status === "rejected") {
    if (!user || !isAdmin(env, user)) return json({ error: "forbidden" }, 403);
    const { results } = await env.DB.prepare(
      `SELECT * FROM community_decks WHERE status = ? ORDER BY created_at ASC LIMIT 200`
    )
      .bind(status)
      .all();
    return json({
      decks: (results || []).map((r) => rowToDeck(r, { includePrivate: true })),
    });
  }

  // published (public)
  const { results } = await env.DB.prepare(
    `SELECT * FROM community_decks WHERE status = 'published' ORDER BY (votes_up - votes_down) DESC, published_at DESC LIMIT 200`
  ).all();

  let myVotes = {};
  if (user) {
    const ids = (results || []).map((r) => r.id);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const voteRows = await env.DB.prepare(
        `SELECT deck_id, value FROM community_votes WHERE google_sub = ? AND deck_id IN (${placeholders})`
      )
        .bind(user.sub, ...ids)
        .all();
      (voteRows.results || []).forEach((v) => {
        myVotes[v.deck_id] = v.value;
      });
    }
  }

  return json({
    decks: (results || []).map((r) => {
      const d = rowToDeck(r, { includePrivate: false });
      if (user) d.my_vote = myVotes[r.id] || 0;
      return d;
    }),
  });
}

async function handleDecksCreate(request, env, user) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }
  const name = String(body.name || "").trim().slice(0, 80);
  const submitter_name = String(body.submitter_name || body.author || "").trim().slice(0, 40);
  const note = String(body.note || "").trim().slice(0, 2000);
  const code = String(body.code || "").trim().slice(0, 4000);
  const colors = Array.isArray(body.colors) ? body.colors.slice(0, 4) : [];
  const clientChecklist = body.checklist && typeof body.checklist === "object" ? body.checklist : null;

  const { checklist, hardFail } = buildServerChecklist({
    name,
    submitter_name,
    note,
    code,
    clientChecklist,
  });

  if (hardFail) {
    return json(
      {
        error: "validation_failed",
        message: "A/B hard checks failed",
        checklist,
      },
      400
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO community_decks
      (id, google_sub, submitter_name, name, note, code, colors, status, checklist, reject_reason, created_at, updated_at, published_at, votes_up, votes_down)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, NULL, 0, 0)`
  )
    .bind(
      id,
      user.sub,
      submitter_name,
      name,
      note,
      code,
      JSON.stringify(colors),
      JSON.stringify(checklist),
      now,
      now
    )
    .run();

  const row = await env.DB.prepare("SELECT * FROM community_decks WHERE id = ?").bind(id).first();
  return json({ ok: true, deck: rowToDeck(row, { includePrivate: true }) }, 201);
}

async function handleDeckPatch(request, env, user, deckId) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  const row = await env.DB.prepare("SELECT * FROM community_decks WHERE id = ?").bind(deckId).first();
  if (!row) return json({ error: "not_found" }, 404);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }

  const admin = isAdmin(env, user);
  const owner = row.google_sub === user.sub;
  const action = String(body.action || body.status || "").toLowerCase();

  // Owner resubmit after revise
  if (owner && !admin && row.status === "revise" && (action === "resubmit" || action === "pending")) {
    const name = String(body.name != null ? body.name : row.name).trim().slice(0, 80);
    const submitter_name = String(
      body.submitter_name != null ? body.submitter_name : row.submitter_name
    )
      .trim()
      .slice(0, 40);
    const note = String(body.note != null ? body.note : row.note).trim().slice(0, 2000);
    const code = String(body.code != null ? body.code : row.code).trim().slice(0, 4000);
    let colors = [];
    try {
      colors = Array.isArray(body.colors) ? body.colors : JSON.parse(row.colors || "[]");
    } catch (e) {
      colors = [];
    }
    const clientChecklist = body.checklist && typeof body.checklist === "object" ? body.checklist : null;
    const { checklist, hardFail } = buildServerChecklist({
      name,
      submitter_name,
      note,
      code,
      clientChecklist,
    });
    if (hardFail) {
      return json({ error: "validation_failed", checklist }, 400);
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE community_decks SET
        name = ?, submitter_name = ?, note = ?, code = ?, colors = ?,
        status = 'pending', checklist = ?, reject_reason = NULL, updated_at = ?
       WHERE id = ?`
    )
      .bind(name, submitter_name, note, code, JSON.stringify(colors), JSON.stringify(checklist), now, deckId)
      .run();
    const updated = await env.DB.prepare("SELECT * FROM community_decks WHERE id = ?").bind(deckId).first();
    return json({ ok: true, deck: rowToDeck(updated, { includePrivate: true }) });
  }

  if (!admin) return json({ error: "forbidden" }, 403);

  // Admin review: pass | reject | revise
  const decision = action === "published" ? "pass" : action;
  if (!["pass", "reject", "revise"].includes(decision)) {
    return json({ error: "invalid_action", message: "use pass|reject|revise" }, 400);
  }

  let checklist = null;
  if (body.checklist && typeof body.checklist === "object") {
    checklist = body.checklist;
  } else {
    try {
      checklist = row.checklist ? JSON.parse(row.checklist) : {};
    } catch (e) {
      checklist = {};
    }
  }

  const reason = String(body.reject_reason || body.reason || "").trim().slice(0, 500);
  if ((decision === "reject" || decision === "revise") && !reason) {
    return json({ error: "reason_required", message: "reject/revise need one-line reason (A/C)" }, 400);
  }

  const now = new Date().toISOString();
  let newStatus = "pending";
  let publishedAt = row.published_at;
  if (decision === "pass") {
    newStatus = "published";
    publishedAt = now;
  } else if (decision === "reject") {
    newStatus = "rejected";
  } else {
    newStatus = "revise";
  }

  await env.DB.prepare(
    `UPDATE community_decks SET
      status = ?, checklist = ?, reject_reason = ?, updated_at = ?, published_at = ?
     WHERE id = ?`
  )
    .bind(
      newStatus,
      JSON.stringify(checklist),
      decision === "pass" ? null : reason,
      now,
      publishedAt,
      deckId
    )
    .run();

  const updated = await env.DB.prepare("SELECT * FROM community_decks WHERE id = ?").bind(deckId).first();
  return json({ ok: true, deck: rowToDeck(updated, { includePrivate: true }) });
}

async function handleDeckVote(request, env, user, deckId) {
  if (!env.DB) return json({ error: "db_not_bound" }, 500);
  const row = await env.DB.prepare("SELECT * FROM community_decks WHERE id = ?").bind(deckId).first();
  if (!row) return json({ error: "not_found" }, 404);
  if (row.status !== "published") {
    return json({ error: "vote_only_published" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }
  let value = Number(body.value);
  if (value !== 1 && value !== -1) {
    return json({ error: "invalid_value", message: "value must be +1 or -1" }, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT value FROM community_votes WHERE deck_id = ? AND google_sub = ?"
  )
    .bind(deckId, user.sub)
    .first();

  const now = new Date().toISOString();
  let up = row.votes_up | 0;
  let down = row.votes_down | 0;

  if (existing) {
    if (existing.value === value) {
      // toggle off
      await env.DB.prepare(
        "DELETE FROM community_votes WHERE deck_id = ? AND google_sub = ?"
      )
        .bind(deckId, user.sub)
        .run();
      if (value === 1) up = Math.max(0, up - 1);
      else down = Math.max(0, down - 1);
      value = 0;
    } else {
      await env.DB.prepare(
        "UPDATE community_votes SET value = ?, updated_at = ? WHERE deck_id = ? AND google_sub = ?"
      )
        .bind(value, now, deckId, user.sub)
        .run();
      if (existing.value === 1) up = Math.max(0, up - 1);
      if (existing.value === -1) down = Math.max(0, down - 1);
      if (value === 1) up += 1;
      else down += 1;
    }
  } else {
    await env.DB.prepare(
      "INSERT INTO community_votes (deck_id, google_sub, value, updated_at) VALUES (?, ?, ?, ?)"
    )
      .bind(deckId, user.sub, value, now)
      .run();
    if (value === 1) up += 1;
    else down += 1;
  }

  await env.DB.prepare(
    "UPDATE community_decks SET votes_up = ?, votes_down = ? WHERE id = ?"
  )
    .bind(up, down, deckId)
    .run();

  return json({ ok: true, votes_up: up, votes_down: down, my_vote: value });
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
            community: true,
          }),
          request,
          env
        );
      }

      if (url.pathname === "/api/auth") {
        return withCors(await handleAuth(request, env), request, env);
      }

      if (url.pathname === "/api/me") {
        const user = await resolveUser(request, env);
        if (!user) return withCors(json({ error: "unauthorized" }, 401), request, env);
        return withCors(await handleMe(request, env, user), request, env);
      }

      if (url.pathname === "/api/sync") {
        const user = await resolveUser(request, env);
        if (!user) return withCors(json({ error: "unauthorized" }, 401), request, env);
        let res;
        if (request.method === "GET") res = await handleSyncGet(request, env, user);
        else if (request.method === "PUT") res = await handleSyncPut(request, env, user);
        else res = json({ error: "method_not_allowed" }, 405);
        return withCors(res, request, env);
      }

      // Community decks collection
      if (url.pathname === "/api/decks") {
        if (request.method === "GET") {
          const user = await resolveUser(request, env);
          return withCors(await handleDecksList(request, env, user), request, env);
        }
        if (request.method === "POST") {
          const user = await resolveUser(request, env);
          if (!user) return withCors(json({ error: "unauthorized" }, 401), request, env);
          return withCors(await handleDecksCreate(request, env, user), request, env);
        }
        return withCors(json({ error: "method_not_allowed" }, 405), request, env);
      }

      // /api/decks/:id and /api/decks/:id/vote
      const deckMatch = url.pathname.match(/^\/api\/decks\/([^/]+)(\/vote)?$/);
      if (deckMatch) {
        const deckId = decodeURIComponent(deckMatch[1]);
        const isVote = !!deckMatch[2];
        const user = await resolveUser(request, env);
        if (!user) return withCors(json({ error: "unauthorized" }, 401), request, env);

        if (isVote) {
          if (request.method !== "POST") {
            return withCors(json({ error: "method_not_allowed" }, 405), request, env);
          }
          return withCors(await handleDeckVote(request, env, user, deckId), request, env);
        }

        if (request.method === "PATCH") {
          return withCors(await handleDeckPatch(request, env, user, deckId), request, env);
        }
        return withCors(json({ error: "method_not_allowed" }, 405), request, env);
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
