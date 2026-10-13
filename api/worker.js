// 봉화대 사수 계정 서버: 아이디·비밀번호 가입과 로그인, 복구코드로 비밀번호 재설정, 계정별 진행 저장, 주간 랭킹.
// Cloudflare Worker + D1 (binding DB). Schema: schema.sql.

const ORIGINS = ['https://bhdefence.github.io', 'http://127.0.0.1:8123', 'http://localhost:8123', 'http://localhost:8080', 'http://127.0.0.1:8080'];
const ID_RE = /^[a-z][a-z0-9_]{3,15}$/;
const PW_RE = /^[\x21-\x7e]{8,64}$/;
const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;
const DIFF_IDS = ['easy', 'normal', 'hard', 'nm1', 'nm2', 'nm3', 'nether']; // same ids as DIFFS in data.js
const NOTE_MAX = 500;
const ITER = 100000, SESSION_DAYS = 180, RESET_TRIES = 5, LOCK_MS = 30 * 60e3, SAVE_MAX = 32 * 1024;

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function pbkdf2(secret, salt, iter = ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}
async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await pbkdf2(secret, salt))}`;
}
async function checkSecret(secret, stored) {
  const [kind, iter, salt, want] = String(stored).split('$'); if (kind !== 'pbkdf2') return false;
  const got = new Uint8Array(await pbkdf2(secret, unb64(salt), +iter)), exp = unb64(want);
  if (got.length !== exp.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got[i] ^ exp[i];
  return d === 0;
}
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map(x => A[x % A.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
const dayKst = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
async function visitCounts(env, today) {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS total, COALESCE(MAX(CASE WHEN day = ? THEN n END), 0) AS today FROM visits').bind(today).first();
  return { total: r ? r.total : 0, today: r ? r.today : 0 };
}
// Same week id as the game: ISO week in Korean time.
function weekId(now = Date.now()) {
  const d = new Date(now + 9 * 3600e3), day = (d.getUTCDay() + 6) % 7, th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const jan4 = new Date(Date.UTC(th.getUTCFullYear(), 0, 4)), wk = 1 + Math.round(((th - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${th.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function cors(req) {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
const fail = (req, status, code, msg) => json(req, { error: code, message: msg }, status);

// Simple fixed-window limiter per key, kept in D1.
async function limited(env, key, max, windowMs) {
  const now = Date.now();
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM hits WHERE until < ?').bind(now).run();
  const row = await env.DB.prepare('SELECT n, until FROM hits WHERE k = ?').bind(key).first();
  if (!row || row.until < now) { await env.DB.prepare('INSERT OR REPLACE INTO hits (k, n, until) VALUES (?, 1, ?)').bind(key, now + windowMs).run(); return false; }
  if (row.n >= max) return true;
  await env.DB.prepare('UPDATE hits SET n = n + 1 WHERE k = ?').bind(key).run();
  return false;
}
async function newSession(env, id) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created) VALUES (?, ?, ?)').bind(await sha256(token), id, Date.now()).run();
  return token;
}
async function auth(req, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('Authorization') || ''); if (!m) return null;
  const row = await env.DB.prepare('SELECT user_id, created FROM sessions WHERE token = ?').bind(await sha256(m[1])).first();
  if (!row || Date.now() - row.created > SESSION_DAYS * 864e5) return null;
  return row.user_id;
}
// Tables added after launch are created on first use, so a deploy never needs a manual schema step.
let ready = null;
const ensureTables = env => (ready ??= env.DB.batch([
  env.DB.prepare('CREATE TABLE IF NOT EXISTS firsts (diff TEXT PRIMARY KEY, user_id TEXT NOT NULL, at INTEGER NOT NULL)'),
  env.DB.prepare('CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, text TEXT NOT NULL, at INTEGER NOT NULL)'),
]).catch(e => { ready = null; throw e; }));
async function body(req) { try { const b = await req.json(); return b && typeof b === 'object' ? b : {}; } catch { return {}; } }
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.floor(+v))) : lo);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
    // IPs are only used, hashed, as keys for short-lived rate-limit counters.
    const ip = (await sha256('bh:' + (req.headers.get('CF-Connecting-IP') || 'x'))).slice(0, 20);
    try {
      await ensureTables(env);
      if (path === '/' ) return json(req, { ok: true, service: 'bonghwa-api', week: weekId() });

      if (path === '/signup' && req.method === 'POST') {
        if (await limited(env, `signup:${ip}`, 10, 3600e3)) return fail(req, 429, 'rate', '가입 시도가 너무 많습니다. 한 시간 뒤 다시 해 주세요.');
        const b = await body(req), id = String(b.id || '').toLowerCase(), pw = String(b.pw || '');
        if (!ID_RE.test(id)) return fail(req, 400, 'id', '아이디는 영문 소문자로 시작하고 영문 소문자·숫자·_ 만 4~16자로 적어 주세요.');
        if (!PW_RE.test(pw)) return fail(req, 400, 'pw', '비밀번호는 8~64자의 영문·숫자·특수문자로 적어 주세요.');
        if (await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first()) return fail(req, 409, 'taken', '이미 쓰고 있는 아이디입니다.');
        const code = newCode();
        await env.DB.prepare('INSERT INTO users (id, pw, rc, created) VALUES (?, ?, ?, ?)').bind(id, await hashSecret(pw), await hashSecret(code), Date.now()).run();
        return json(req, { id, token: await newSession(env, id), code });
      }

      if (path === '/login' && req.method === 'POST') {
        if (await limited(env, `login:${ip}`, 30, 600e3)) return fail(req, 429, 'rate', '로그인 시도가 너무 많습니다. 10분 뒤 다시 해 주세요.');
        const b = await body(req), id = String(b.id || '').toLowerCase(), pw = String(b.pw || '');
        const u = ID_RE.test(id) ? await env.DB.prepare('SELECT id, pw FROM users WHERE id = ?').bind(id).first() : null;
        if (!u || !(await checkSecret(pw, u.pw))) return fail(req, 401, 'login', '아이디 또는 비밀번호가 맞지 않습니다.');
        return json(req, { id, token: await newSession(env, id) });
      }

      if (path === '/reset' && req.method === 'POST') {
        if (await limited(env, `reset:${ip}`, 20, 3600e3)) return fail(req, 429, 'rate', '시도가 너무 많습니다. 한 시간 뒤 다시 해 주세요.');
        const b = await body(req), id = String(b.id || '').toLowerCase(), code = String(b.code || '').toUpperCase().trim(), pw = String(b.pw || '');
        if (!PW_RE.test(pw)) return fail(req, 400, 'pw', '새 비밀번호는 8~64자의 영문·숫자·특수문자로 적어 주세요.');
        const u = ID_RE.test(id) ? await env.DB.prepare('SELECT id, rc, fails, locked_until FROM users WHERE id = ?').bind(id).first() : null;
        if (!u) return fail(req, 401, 'code', '아이디 또는 복구코드가 맞지 않습니다.');
        if (u.locked_until > Date.now()) return fail(req, 423, 'locked', `복구코드를 여러 번 틀려 잠겼습니다. ${Math.ceil((u.locked_until - Date.now()) / 60e3)}분 뒤 다시 해 주세요.`);
        if (!CODE_RE.test(code) || !(await checkSecret(code, u.rc))) {
          const fails = u.fails + 1, lock = fails >= RESET_TRIES;
          await env.DB.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : fails, lock ? Date.now() + LOCK_MS : 0, id).run();
          return fail(req, 401, 'code', lock ? '복구코드를 5번 틀려 30분 동안 잠겼습니다.' : `아이디 또는 복구코드가 맞지 않습니다. (${RESET_TRIES - fails}번 남음)`);
        }
        await env.DB.batch([
          env.DB.prepare('UPDATE users SET pw = ?, fails = 0, locked_until = 0 WHERE id = ?').bind(await hashSecret(pw), id),
          env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        ]);
        return json(req, { id, token: await newSession(env, id) });
      }

      // Visitor counter: a browser counts once per Korean day (the game remembers it sent today's visit).
      if (path === '/visit') {
        const today = dayKst();
        if (req.method === 'POST' && !(await limited(env, `visit:${ip}:${today}`, 5, 86400e3))) {
          await env.DB.prepare('INSERT INTO visits (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1').bind(today).run();
        }
        return json(req, { day: today, ...(await visitCounts(env, today)) });
      }

      // 첫 봉화 완주: 난이도마다 흑룡을 처음 쓰러뜨린 계정 (타이틀 화면 축하 띠).
      if (path === '/firsts' && req.method === 'GET') {
        const rows = await env.DB.prepare('SELECT diff, user_id AS id, at FROM firsts').all();
        return json(req, { rows: rows.results });
      }

      // 봉수 소식 창의 의견 보내기. 로그인하지 않아도 되고, 아이디는 로그인했을 때만 함께 남긴다.
      if (path === '/feedback' && req.method === 'POST') {
        if (await limited(env, `note:${ip}:${dayKst()}`, 5, 86400e3)) return fail(req, 429, 'rate', '오늘은 의견을 더 보낼 수 없습니다. 내일 다시 보내 주세요.');
        const b = await body(req), text = String(b.text || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
        if (text.length < 2) return fail(req, 400, 'text', '내용을 두 글자 이상 적어 주세요.');
        if (text.length > NOTE_MAX) return fail(req, 400, 'text', `내용은 ${NOTE_MAX}자까지 적을 수 있습니다.`);
        await env.DB.prepare('INSERT INTO feedback (user_id, text, at) VALUES (?, ?, ?)').bind(await auth(req, env), text, Date.now()).run();
        return json(req, { ok: true });
      }

      if (path === '/rank' && req.method === 'GET') {
        const week = WEEK_RE.test(url.searchParams.get('week') || '') ? url.searchParams.get('week') : weekId();
        const rows = await env.DB.prepare('SELECT user_id AS id, score, round, win, kills, at FROM rank WHERE week = ? ORDER BY score DESC, at ASC LIMIT 50').bind(week).all();
        const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM rank WHERE week = ?').bind(week).first();
        return json(req, { week, count: cnt ? cnt.n : 0, rows: rows.results.map(r => ({ ...r, win: !!r.win })) });
      }

      // everything below needs a session
      const uid = await auth(req, env);
      if (!uid) return fail(req, 401, 'auth', '다시 로그인해 주세요.');

      if (path === '/me' && req.method === 'GET') {
        const s = await env.DB.prepare('SELECT at FROM saves WHERE user_id = ?').bind(uid).first();
        return json(req, { id: uid, savedAt: s ? s.at : 0 });
      }
      // 회원 탈퇴: 비밀번호를 한 번 더 확인하고 계정·세션·저장·랭킹을 모두 지운다.
      if (path === '/delete' && req.method === 'POST') {
        const b = await body(req), u = await env.DB.prepare('SELECT pw FROM users WHERE id = ?').bind(uid).first();
        if (!u || !(await checkSecret(String(b.pw || ''), u.pw))) return fail(req, 401, 'pw', '비밀번호가 맞지 않습니다.');
        await env.DB.batch(['rank', 'saves', 'sessions', 'firsts', 'feedback'].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(uid)).concat(env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid)));
        return json(req, { ok: true });
      }
      if (path === '/logout' && req.method === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha256((req.headers.get('Authorization') || '').slice(7))).run();
        return json(req, { ok: true });
      }
      if (path === '/save' && req.method === 'GET') {
        const s = await env.DB.prepare('SELECT data, at FROM saves WHERE user_id = ?').bind(uid).first();
        return json(req, s ? { data: JSON.parse(s.data), at: s.at } : { data: null, at: 0 });
      }
      if (path === '/save' && req.method === 'PUT') {
        const text = await req.text(); if (text.length > SAVE_MAX) return fail(req, 413, 'size', '저장 자료가 너무 큽니다.');
        let data; try { data = JSON.parse(text).data; } catch { return fail(req, 400, 'json', '저장 자료를 읽지 못했습니다.'); }
        if (!data || typeof data !== 'object') return fail(req, 400, 'json', '저장 자료를 읽지 못했습니다.');
        const at = Date.now();
        await env.DB.prepare('INSERT OR REPLACE INTO saves (user_id, data, at) VALUES (?, ?, ?)').bind(uid, JSON.stringify(data), at).run();
        return json(req, { ok: true, at });
      }
      if (path === '/rank' && req.method === 'POST') {
        if (await limited(env, `rank:${uid}`, 12, 86400e3)) return fail(req, 429, 'rate', '오늘은 랭킹 기록을 더 올릴 수 없습니다.');
        const b = await body(req), week = weekId();
        if (b.week !== week) return fail(req, 400, 'week', '이번 주 랭킹전 기록만 올릴 수 있습니다.');
        const round = int(b.round, 0, 41), kills = int(b.kills, 0, 200000), win = !!b.win;
        const score = int(b.score, 0, win ? 75999 : Math.min(40999, round * 1000 + 999)); // matches the game's runScore()
        const cur = await env.DB.prepare('SELECT score FROM rank WHERE user_id = ? AND week = ?').bind(uid, week).first();
        if (cur && cur.score >= score) return json(req, { ok: true, kept: true, prev: cur.score });
        await env.DB.prepare('INSERT OR REPLACE INTO rank (user_id, week, score, round, win, kills, at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(uid, week, score, round, win ? 1 : 0, kills, Date.now()).run();
        return json(req, { ok: true, kept: false });
      }
      if (path === '/first' && req.method === 'POST') {
        if (await limited(env, `first:${uid}`, 20, 86400e3)) return fail(req, 429, 'rate', '잠시 뒤 다시 해 주세요.');
        const diff = String((await body(req)).diff || '');
        if (!DIFF_IDS.includes(diff)) return fail(req, 400, 'diff', '없는 난이도입니다.');
        const r = await env.DB.prepare('INSERT OR IGNORE INTO firsts (diff, user_id, at) VALUES (?, ?, ?)').bind(diff, uid, Date.now()).run();
        const row = await env.DB.prepare('SELECT user_id AS id, at FROM firsts WHERE diff = ?').bind(diff).first();
        return json(req, { ok: true, first: r.meta.changes > 0, holder: row });
      }
      return fail(req, 404, 'path', '없는 주소입니다.');
    } catch (e) {
      return fail(req, 500, 'server', '서버 오류가 났습니다. 잠시 뒤 다시 해 주세요.');
    }
  },
};
