var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var ORIGINS = ["https://bhdefence.github.io", "http://127.0.0.1:8123", "http://localhost:8123", "http://localhost:8080", "http://127.0.0.1:8080"];
var ID_RE = /^[a-z][a-z0-9_]{3,15}$/;
var PW_RE = /^[\x21-\x7e]{8,64}$/;
var CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
var WEEK_RE = /^\d{4}-W\d{2}$/;
var DIFF_IDS = ["easy", "normal", "hard", "nm1", "nm2", "nm3"];
var NOTE_MAX = 500;
var ITER = 1e5;
var SESSION_DAYS = 180;
var RESET_TRIES = 5;
var LOCK_MS = 30 * 6e4;
var SAVE_MAX = 32 * 1024;
var enc = new TextEncoder();
var b64 = /* @__PURE__ */ __name((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), "b64");
var unb64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), "unb64");
var hex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "hex");
async function pbkdf2(secret, salt, iter = ITER) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
__name(pbkdf2, "pbkdf2");
async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await pbkdf2(secret, salt))}`;
}
__name(hashSecret, "hashSecret");
async function checkSecret(secret, stored) {
  const [kind, iter, salt, want] = String(stored).split("$");
  if (kind !== "pbkdf2") return false;
  const got = new Uint8Array(await pbkdf2(secret, unb64(salt), +iter)), exp = unb64(want);
  if (got.length !== exp.length) return false;
  let d = 0;
  for (let i = 0; i < got.length; i++) d |= got[i] ^ exp[i];
  return d === 0;
}
__name(checkSecret, "checkSecret");
var sha256 = /* @__PURE__ */ __name(async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s))), "sha256");
function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map((x) => A[x % A.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
__name(newCode, "newCode");
var dayKst = /* @__PURE__ */ __name((now = Date.now()) => new Date(now + 9 * 36e5).toISOString().slice(0, 10), "dayKst");
async function visitCounts(env, today) {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(n), 0) AS total, COALESCE(MAX(CASE WHEN day = ? THEN n END), 0) AS today FROM visits").bind(today).first();
  return { total: r ? r.total : 0, today: r ? r.today : 0 };
}
__name(visitCounts, "visitCounts");
function weekId(now = Date.now()) {
  const d = new Date(now + 9 * 36e5), day = (d.getUTCDay() + 6) % 7, th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const jan4 = new Date(Date.UTC(th.getUTCFullYear(), 0, 4)), wk = 1 + Math.round(((th - jan4) / 864e5 - 3 + (jan4.getUTCDay() + 6) % 7) / 7);
  return `${th.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
__name(weekId, "weekId");
function cors(req) {
  const o = req.headers.get("Origin");
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}
__name(cors, "cors");
var json = /* @__PURE__ */ __name((req, body2, status = 200) => new Response(JSON.stringify(body2), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req) } }), "json");
var fail = /* @__PURE__ */ __name((req, status, code, msg) => json(req, { error: code, message: msg }, status), "fail");
async function limited(env, key, max, windowMs) {
  const now = Date.now();
  if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM hits WHERE until < ?").bind(now).run();
  const row = await env.DB.prepare("SELECT n, until FROM hits WHERE k = ?").bind(key).first();
  if (!row || row.until < now) {
    await env.DB.prepare("INSERT OR REPLACE INTO hits (k, n, until) VALUES (?, 1, ?)").bind(key, now + windowMs).run();
    return false;
  }
  if (row.n >= max) return true;
  await env.DB.prepare("UPDATE hits SET n = n + 1 WHERE k = ?").bind(key).run();
  return false;
}
__name(limited, "limited");
async function newSession(env, id) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("INSERT INTO sessions (token, user_id, created) VALUES (?, ?, ?)").bind(await sha256(token), id, Date.now()).run();
  return token;
}
__name(newSession, "newSession");
async function auth(req, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("Authorization") || "");
  if (!m) return null;
  const row = await env.DB.prepare("SELECT user_id, created FROM sessions WHERE token = ?").bind(await sha256(m[1])).first();
  if (!row || Date.now() - row.created > SESSION_DAYS * 864e5) return null;
  return row.user_id;
}
__name(auth, "auth");
var ready = null;
var ensureTables = /* @__PURE__ */ __name((env) => ready ??= env.DB.batch([
  env.DB.prepare("CREATE TABLE IF NOT EXISTS firsts (diff TEXT PRIMARY KEY, user_id TEXT NOT NULL, at INTEGER NOT NULL)"),
  env.DB.prepare("CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, text TEXT NOT NULL, at INTEGER NOT NULL)")
]).catch((e) => {
  ready = null;
  throw e;
}), "ensureTables");
async function body(req) {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}
__name(body, "body");
var int = /* @__PURE__ */ __name((v, lo, hi) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.floor(+v))) : lo, "int");
var worker_default = {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
    const ip = (await sha256("bh:" + (req.headers.get("CF-Connecting-IP") || "x"))).slice(0, 20);
    try {
      await ensureTables(env);
      if (path === "/") return json(req, { ok: true, service: "bonghwa-api", week: weekId() });
      if (path === "/signup" && req.method === "POST") {
        if (await limited(env, `signup:${ip}`, 10, 36e5)) return fail(req, 429, "rate", "\uAC00\uC785 \uC2DC\uB3C4\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uD55C \uC2DC\uAC04 \uB4A4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.");
        const b = await body(req), id = String(b.id || "").toLowerCase(), pw = String(b.pw || "");
        if (!ID_RE.test(id)) return fail(req, 400, "id", "\uC544\uC774\uB514\uB294 \uC601\uBB38 \uC18C\uBB38\uC790\uB85C \uC2DC\uC791\uD558\uACE0 \uC601\uBB38 \uC18C\uBB38\uC790\xB7\uC22B\uC790\xB7_ \uB9CC 4~16\uC790\uB85C \uC801\uC5B4 \uC8FC\uC138\uC694.");
        if (!PW_RE.test(pw)) return fail(req, 400, "pw", "\uBE44\uBC00\uBC88\uD638\uB294 8~64\uC790\uC758 \uC601\uBB38\xB7\uC22B\uC790\xB7\uD2B9\uC218\uBB38\uC790\uB85C \uC801\uC5B4 \uC8FC\uC138\uC694.");
        if (await env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(id).first()) return fail(req, 409, "taken", "\uC774\uBBF8 \uC4F0\uACE0 \uC788\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4.");
        const code = newCode();
        await env.DB.prepare("INSERT INTO users (id, pw, rc, created) VALUES (?, ?, ?, ?)").bind(id, await hashSecret(pw), await hashSecret(code), Date.now()).run();
        return json(req, { id, token: await newSession(env, id), code });
      }
      if (path === "/login" && req.method === "POST") {
        if (await limited(env, `login:${ip}`, 30, 6e5)) return fail(req, 429, "rate", "\uB85C\uADF8\uC778 \uC2DC\uB3C4\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. 10\uBD84 \uB4A4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.");
        const b = await body(req), id = String(b.id || "").toLowerCase(), pw = String(b.pw || "");
        const u = ID_RE.test(id) ? await env.DB.prepare("SELECT id, pw FROM users WHERE id = ?").bind(id).first() : null;
        if (!u || !await checkSecret(pw, u.pw)) return fail(req, 401, "login", "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        return json(req, { id, token: await newSession(env, id) });
      }
      if (path === "/reset" && req.method === "POST") {
        if (await limited(env, `reset:${ip}`, 20, 36e5)) return fail(req, 429, "rate", "\uC2DC\uB3C4\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uD55C \uC2DC\uAC04 \uB4A4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.");
        const b = await body(req), id = String(b.id || "").toLowerCase(), code = String(b.code || "").toUpperCase().trim(), pw = String(b.pw || "");
        if (!PW_RE.test(pw)) return fail(req, 400, "pw", "\uC0C8 \uBE44\uBC00\uBC88\uD638\uB294 8~64\uC790\uC758 \uC601\uBB38\xB7\uC22B\uC790\xB7\uD2B9\uC218\uBB38\uC790\uB85C \uC801\uC5B4 \uC8FC\uC138\uC694.");
        const u = ID_RE.test(id) ? await env.DB.prepare("SELECT id, rc, fails, locked_until FROM users WHERE id = ?").bind(id).first() : null;
        if (!u) return fail(req, 401, "code", "\uC544\uC774\uB514 \uB610\uB294 \uBCF5\uAD6C\uCF54\uB4DC\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        if (u.locked_until > Date.now()) return fail(req, 423, "locked", `\uBCF5\uAD6C\uCF54\uB4DC\uB97C \uC5EC\uB7EC \uBC88 \uD2C0\uB824 \uC7A0\uACBC\uC2B5\uB2C8\uB2E4. ${Math.ceil((u.locked_until - Date.now()) / 6e4)}\uBD84 \uB4A4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.`);
        if (!CODE_RE.test(code) || !await checkSecret(code, u.rc)) {
          const fails = u.fails + 1, lock = fails >= RESET_TRIES;
          await env.DB.prepare("UPDATE users SET fails = ?, locked_until = ? WHERE id = ?").bind(lock ? 0 : fails, lock ? Date.now() + LOCK_MS : 0, id).run();
          return fail(req, 401, "code", lock ? "\uBCF5\uAD6C\uCF54\uB4DC\uB97C 5\uBC88 \uD2C0\uB824 30\uBD84 \uB3D9\uC548 \uC7A0\uACBC\uC2B5\uB2C8\uB2E4." : `\uC544\uC774\uB514 \uB610\uB294 \uBCF5\uAD6C\uCF54\uB4DC\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. (${RESET_TRIES - fails}\uBC88 \uB0A8\uC74C)`);
        }
        await env.DB.batch([
          env.DB.prepare("UPDATE users SET pw = ?, fails = 0, locked_until = 0 WHERE id = ?").bind(await hashSecret(pw), id),
          env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id)
        ]);
        return json(req, { id, token: await newSession(env, id) });
      }
      if (path === "/visit") {
        const today = dayKst();
        if (req.method === "POST" && !await limited(env, `visit:${ip}:${today}`, 5, 864e5)) {
          await env.DB.prepare("INSERT INTO visits (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1").bind(today).run();
        }
        return json(req, { day: today, ...await visitCounts(env, today) });
      }
      if (path === "/firsts" && req.method === "GET") {
        const rows = await env.DB.prepare("SELECT diff, user_id AS id, at FROM firsts").all();
        return json(req, { rows: rows.results });
      }
      if (path === "/feedback" && req.method === "POST") {
        if (await limited(env, `note:${ip}:${dayKst()}`, 5, 864e5)) return fail(req, 429, "rate", "\uC624\uB298\uC740 \uC758\uACAC\uC744 \uB354 \uBCF4\uB0BC \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB0B4\uC77C \uB2E4\uC2DC \uBCF4\uB0B4 \uC8FC\uC138\uC694.");
        const b = await body(req), text = String(b.text || "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
        if (text.length < 2) return fail(req, 400, "text", "\uB0B4\uC6A9\uC744 \uB450 \uAE00\uC790 \uC774\uC0C1 \uC801\uC5B4 \uC8FC\uC138\uC694.");
        if (text.length > NOTE_MAX) return fail(req, 400, "text", `\uB0B4\uC6A9\uC740 ${NOTE_MAX}\uC790\uAE4C\uC9C0 \uC801\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
        await env.DB.prepare("INSERT INTO feedback (user_id, text, at) VALUES (?, ?, ?)").bind(await auth(req, env), text, Date.now()).run();
        return json(req, { ok: true });
      }
      if (path === "/rank" && req.method === "GET") {
        const week = WEEK_RE.test(url.searchParams.get("week") || "") ? url.searchParams.get("week") : weekId();
        const rows = await env.DB.prepare("SELECT user_id AS id, score, round, win, kills, at FROM rank WHERE week = ? ORDER BY score DESC, at ASC LIMIT 50").bind(week).all();
        const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM rank WHERE week = ?").bind(week).first();
        return json(req, { week, count: cnt ? cnt.n : 0, rows: rows.results.map((r) => ({ ...r, win: !!r.win })) });
      }
      const uid = await auth(req, env);
      if (!uid) return fail(req, 401, "auth", "\uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.");
      if (path === "/me" && req.method === "GET") {
        const s = await env.DB.prepare("SELECT at FROM saves WHERE user_id = ?").bind(uid).first();
        return json(req, { id: uid, savedAt: s ? s.at : 0 });
      }
      if (path === "/delete" && req.method === "POST") {
        const b = await body(req), u = await env.DB.prepare("SELECT pw FROM users WHERE id = ?").bind(uid).first();
        if (!u || !await checkSecret(String(b.pw || ""), u.pw)) return fail(req, 401, "pw", "\uBE44\uBC00\uBC88\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        await env.DB.batch(["rank", "saves", "sessions", "firsts", "feedback"].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(uid)).concat(env.DB.prepare("DELETE FROM users WHERE id = ?").bind(uid)));
        return json(req, { ok: true });
      }
      if (path === "/logout" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256((req.headers.get("Authorization") || "").slice(7))).run();
        return json(req, { ok: true });
      }
      if (path === "/save" && req.method === "GET") {
        const s = await env.DB.prepare("SELECT data, at FROM saves WHERE user_id = ?").bind(uid).first();
        return json(req, s ? { data: JSON.parse(s.data), at: s.at } : { data: null, at: 0 });
      }
      if (path === "/save" && req.method === "PUT") {
        const text = await req.text();
        if (text.length > SAVE_MAX) return fail(req, 413, "size", "\uC800\uC7A5 \uC790\uB8CC\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
        let data;
        try {
          data = JSON.parse(text).data;
        } catch {
          return fail(req, 400, "json", "\uC800\uC7A5 \uC790\uB8CC\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        }
        if (!data || typeof data !== "object") return fail(req, 400, "json", "\uC800\uC7A5 \uC790\uB8CC\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        const at = Date.now();
        await env.DB.prepare("INSERT OR REPLACE INTO saves (user_id, data, at) VALUES (?, ?, ?)").bind(uid, JSON.stringify(data), at).run();
        return json(req, { ok: true, at });
      }
      if (path === "/rank" && req.method === "POST") {
        if (await limited(env, `rank:${uid}`, 12, 864e5)) return fail(req, 429, "rate", "\uC624\uB298\uC740 \uB7AD\uD0B9 \uAE30\uB85D\uC744 \uB354 \uC62C\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const b = await body(req), week = weekId();
        if (b.week !== week) return fail(req, 400, "week", "\uC774\uBC88 \uC8FC \uB7AD\uD0B9\uC804 \uAE30\uB85D\uB9CC \uC62C\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        const round = int(b.round, 0, 41), kills = int(b.kills, 0, 2e5), win = !!b.win;
        const score = int(b.score, 0, win ? 75999 : Math.min(40999, round * 1e3 + 999));
        const cur = await env.DB.prepare("SELECT score FROM rank WHERE user_id = ? AND week = ?").bind(uid, week).first();
        if (cur && cur.score >= score) return json(req, { ok: true, kept: true, prev: cur.score });
        await env.DB.prepare("INSERT OR REPLACE INTO rank (user_id, week, score, round, win, kills, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(uid, week, score, round, win ? 1 : 0, kills, Date.now()).run();
        return json(req, { ok: true, kept: false });
      }
      if (path === "/first" && req.method === "POST") {
        if (await limited(env, `first:${uid}`, 20, 864e5)) return fail(req, 429, "rate", "\uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.");
        const diff = String((await body(req)).diff || "");
        if (!DIFF_IDS.includes(diff)) return fail(req, 400, "diff", "\uC5C6\uB294 \uB09C\uC774\uB3C4\uC785\uB2C8\uB2E4.");
        const r = await env.DB.prepare("INSERT OR IGNORE INTO firsts (diff, user_id, at) VALUES (?, ?, ?)").bind(diff, uid, Date.now()).run();
        const row = await env.DB.prepare("SELECT user_id AS id, at FROM firsts WHERE diff = ?").bind(diff).first();
        return json(req, { ok: true, first: r.meta.changes > 0, holder: row });
      }
      return fail(req, 404, "path", "\uC5C6\uB294 \uC8FC\uC18C\uC785\uB2C8\uB2E4.");
    } catch (e) {
      return fail(req, 500, "server", "\uC11C\uBC84 \uC624\uB958\uAC00 \uB0AC\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.");
    }
  }
};

// ../../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-NBdTJu/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../tmp/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-NBdTJu/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
