// 봉화대 사수 — engine, shop and interface.
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = n => Math.floor(Math.max(0, n)).toLocaleString('ko-KR');
const pct = v => Math.round(v * 100) + '%';
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c < 11172 && c % 28 ? a : b); };
const INV_MAX = 24, TOWER_R = 16;
// Copies of the same item stack in one bag slot (×2, ×3 …); the bag limit counts slots, not copies.
const slotsUsed = () => new Set(R.items.map(i => i.id)).size;
const owned = id => R.items.reduce((n, i) => n + (i.id === id), 0);
const bagFullFor = id => slotsUsed() >= INV_MAX && !owned(id);

// ───────────────────────── profile (persistent) ─────────────────────────
const SAVE_KEY = 'bonghwa-v1';
function newProfile() { return { v: 1, shards: 0, perks: {}, wins: {}, best: {}, runs: 0, tutorial: false, sound: true, nick: '', ranked: { day: '', used: 0 }, records: [], savedAt: 0 }; }
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const cleanNick = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
function cleanRec(id, d) {
  if (!d || typeof d !== 'object') return null;
  return { id, week: String(d.week || '').slice(0, 10), score: Math.max(0, Math.floor(num(d.score))), round: clamp(Math.floor(num(d.round)), 0, ROUNDS + 1), win: !!d.win, kills: Math.max(0, Math.floor(num(d.kills))), nick: cleanNick(d.nick) || '무명', at: num(d.at) };
}
function sanitizeProfile(o) {
  const p = newProfile(); if (!o || typeof o !== 'object') return p;
  p.shards = Math.max(0, Math.floor(num(o.shards)));
  if (o.perks && typeof o.perks === 'object') for (const k in PERK) if (o.perks[k] != null) p.perks[k] = clamp(Math.floor(num(o.perks[k])), 0, PERK[k].max);
  for (const key of ['wins', 'best']) if (o[key] && typeof o[key] === 'object') for (const d of DIFFS) if (o[key][d.id] != null) p[key][d.id] = Math.max(0, Math.floor(num(o[key][d.id])));
  p.runs = Math.max(0, Math.floor(num(o.runs)));
  p.tutorial = !!o.tutorial; p.sound = o.sound !== false; p.nick = cleanNick(o.nick);
  if (o.ranked && typeof o.ranked === 'object') p.ranked = { day: String(o.ranked.day || '').slice(0, 10), used: clamp(Math.floor(num(o.ranked.used)), 0, 9) };
  if (Array.isArray(o.records)) p.records = o.records.slice(0, 30).map(r => cleanRec('local', r)).filter(Boolean);
  p.savedAt = num(o.savedAt);
  return p;
}
function loadProfile() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return sanitizeProfile(JSON.parse(raw)); } catch (e) { /* storage unavailable */ } return newProfile(); }
function persist() { P.savedAt = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* storage unavailable */ } Cloud.queue(); }
let P = loadProfile();
const perkL = id => P.perks[id] || 0;
const unlocked = d => !d.req || (P.wins[d.req] || 0) > 0;

// Weekly ranking runs share one seed per ISO week (Korean time), so everyone sees the same shops and waves.
function kstNow() { return new Date(Date.now() + 9 * 3600e3); }
function weekId() {
  const d = kstNow(), day = (d.getUTCDay() + 6) % 7, th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const jan4 = new Date(Date.UTC(th.getUTCFullYear(), 0, 4)), wk = 1 + Math.round(((th - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${th.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
const dayId = () => kstNow().toISOString().slice(0, 10);
const RANK_TRIES = 3;
function triesLeft() { return P.ranked.day === dayId() ? Math.max(0, RANK_TRIES - P.ranked.used) : RANK_TRIES; }

// ───────────────────────── sound ─────────────────────────
const Sfx = {
  ctx: null, last: {},
  ensure() { if (!P.sound) return null; try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { return null; } return this.ctx; },
  play(name, gap = 50) {
    if (!P.sound) return; const now = performance.now(); if (this.last[name] && now - this.last[name] < gap) return; this.last[name] = now;
    const c = this.ensure(); if (!c || c.state !== 'running') return; try { SND[name] && SND[name](c); } catch (e) { /* ignore */ }
  },
};
function tone(c, { f = 440, f2 = 0, d = 0.1, type = 'square', v = 0.03, delay = 0 }) {
  const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + d + 0.02);
}
let noiseBuf = null;
function noise(c, { d = 0.2, v = 0.06, f = 900, delay = 0 }) {
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const t0 = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.value = f; g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(fl).connect(g).connect(c.destination); s.start(t0, Math.random() * 0.5, d + 0.05);
}
const SND = {
  blade: c => noise(c, { d: 0.05, v: 0.03, f: 4000 }),
  arrow: c => tone(c, { f: 700, f2: 260, d: 0.06, type: 'triangle', v: 0.03 }),
  charm: c => tone(c, { f: 900, f2: 1300, d: 0.07, type: 'sine', v: 0.03 }),
  cannon: c => noise(c, { d: 0.25, v: 0.09, f: 420 }),
  chaos: c => tone(c, { f: 500, f2: 900, d: 0.09, type: 'sawtooth', v: 0.015 }),
  coin: c => { tone(c, { f: 988, d: 0.04, v: 0.012 }); tone(c, { f: 1319, d: 0.05, v: 0.012, delay: 0.04 }); },
  hurt: c => noise(c, { d: 0.12, v: 0.05, f: 260 }),
  buy: c => { tone(c, { f: 660, d: 0.05, v: 0.03 }); tone(c, { f: 990, d: 0.08, v: 0.03, delay: 0.05 }); },
  reroll: c => tone(c, { f: 420, f2: 840, d: 0.12, type: 'triangle', v: 0.03 }),
  deny: c => tone(c, { f: 150, d: 0.12, v: 0.03 }),
  horn: c => { tone(c, { f: 196, d: 0.3, type: 'sawtooth', v: 0.025 }); tone(c, { f: 262, d: 0.4, type: 'sawtooth', v: 0.025, delay: 0.22 }); },
  boss: c => { tone(c, { f: 110, d: 0.6, type: 'sawtooth', v: 0.04 }); noise(c, { d: 0.6, v: 0.06, f: 300 }); },
  smite: c => { noise(c, { d: 0.8, v: 0.18, f: 1600 }); tone(c, { f: 80, f2: 40, d: 0.6, type: 'sawtooth', v: 0.05 }); },
  win: c => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, d: 0.22, v: 0.035, delay: i * 0.13 })),
  lose: c => [392, 330, 262, 196].forEach((f, i) => tone(c, { f, d: 0.3, type: 'triangle', v: 0.05, delay: i * 0.18 })),
  gift: c => [784, 988, 1175].forEach((f, i) => tone(c, { f, d: 0.12, v: 0.03, delay: i * 0.08 })),
};

// ───────────────────────── run state ─────────────────────────
let R = null, mode = 'menu', paused = false, speed = 1, uidSeq = 0, eidSeq = 0;
const rngFor = (...parts) => mulberry32(hashStr(R.seed + ':' + parts.join(':')));

function newRun(diffId, ranked) {
  const d = DIFF[diffId];
  R = {
    diff: d, ranked: !!ranked, seed: ranked ? 'week:' + weekId() : 'run:' + Date.now() + ':' + ((Math.random() * 1e9) | 0),
    round: 0, t: PREP_TIME, elapsed: 0, time: 0, gold: BASE.gold + perkL('gold') * 60, hp: 0, shieldNow: 0,
    items: [], weapons: [], enemies: [], shots: [], fx: [], nums: [], spawnQ: [], shop: [],
    kills: 0, smites: BASE.smites + perkL('smite'), freeRerolls: 0, paidRerolls: 0, rerollIdx: 0, halfOff: false, bonusDmg: 0,
    state: 'run', final: false, gift: null, showRange: false, banner: null, shake: 0, flash: 0, thornDealt: 0,
    armorSeq: [],
  };
  R.armorSeq = genArmorSeq();
  R.S = computeStats(); R.hp = R.S.maxHp; R.shieldNow = R.S.shield; R.freeRerolls = R.S.freeRerolls;
  rollShop();
  return R;
}
function genArmorSeq() {
  const rng = rngFor('armor'), seq = [null];
  for (let r = 1; r <= ROUNDS + 1; r++) {
    const allowed = r <= 3 ? ['light', 'medium'] : r <= 7 ? ['light', 'medium', 'heavy'] : ARMOR_IDS;
    let a = allowed[(rng() * allowed.length) | 0];
    if (seq[r - 1] === a && seq[r - 2] === a) a = allowed[(allowed.indexOf(a) + 1) % allowed.length];
    seq.push(a);
  }
  return seq;
}
const hpMul = r => Math.pow(1.15, Math.max(0, r - 1)) * R.diff.hp;

function computeStats() {
  const s = {
    dmg: perkL('might') * 0.03 + R.bonusDmg, typeDmg: { blade: 0, arrow: 0, charm: 0, cannon: 0, chaos: 0 }, aspd: 0, range: 0,
    crit: BASE.crit, critMul: BASE.critMul, elemPow: { fire: 0, frost: 0, poison: 0, bolt: 0 },
    income: (BASE.income + perkL('income') * 0.6) * R.diff.income, bounty: 0, interest: 0, interestCap: 0,
    maxHp: Math.round(BASE.hp * (1 + perkL('hp') * 0.06)), regen: BASE.regen, shield: 0, dr: 0, thorn: 0, thornPow: 0,
    freeRerolls: BASE.freeRerolls + perkL('reroll'), typeCount: {}, elemCount: {}, typeStep: {}, elemStep: {}, thornElems: [],
  };
  // Sets count DIFFERENT items: stacking copies of one weapon (×2, ×3) adds its firepower but not set progress.
  const counted = new Set();
  for (const it of R.items) {
    const d = ITEM[it.id], first = !counted.has(it.id); counted.add(it.id);
    if (d.cat === 'weapon') { if (first) s.typeCount[d.type] = (s.typeCount[d.type] || 0) + 1; }
    else {
      if (d.dmg) s.dmg += d.dmg;
      if (d.typeDmg) for (const k in d.typeDmg) s.typeDmg[k] += d.typeDmg[k];
      if (d.elemPow) for (const k in d.elemPow) s.elemPow[k] += d.elemPow[k];
      s.aspd += d.aspd || 0; s.range += d.range || 0; s.crit += d.crit || 0; s.critMul += d.critDmg || 0;
      s.income += d.income || 0; s.bounty += d.bounty || 0; s.interest += d.interest || 0; s.interestCap += d.interestCap || 0;
      s.maxHp += d.maxHp || 0; s.regen += d.regen || 0; s.shield += d.shield || 0; s.dr += d.dr || 0;
      s.thorn += d.thorn || 0; s.thornPow += d.thornPow || 0;
      if (d.cat === 'thorn' && d.elem) s.thornElems.push(d.elem);
    }
    if (first) for (const e of [d.elem, d.elem2]) if (e) s.elemCount[e] = (s.elemCount[e] || 0) + 1;
  }
  s.dr = Math.min(0.6, s.dr);
  for (const t of TYPE_IDS) { const n = s.typeCount[t] || 0, step = TYPE_SET_STEPS.filter(x => n >= x).length; s.typeStep[t] = step; if (step) s.typeDmg[t] += TYPE_SET_DMG[step - 1]; }
  for (const e of ELEM_IDS) { const n = s.elemCount[e] || 0; s.elemStep[e] = ELEM_SET_STEPS.filter(x => n >= x).length; }
  s.chaosMin = s.typeStep.chaos >= 2 ? 0.9 : 0.5;
  return s;
}
function refreshStats() {
  const before = R.S, S = computeStats(); R.S = S; celebrateSets(before, S);
  if (before) { if (S.maxHp > before.maxHp) R.hp += S.maxHp - before.maxHp; if (S.shield > before.shield) R.shieldNow += S.shield - before.shield; }
  R.hp = Math.min(R.hp, S.maxHp); R.shieldNow = Math.min(R.shieldNow, S.shield);
  R.weapons = R.items.filter(i => ITEM[i.id].cat === 'weapon');
}

// ───────────────────────── rounds & spawns ─────────────────────────
function startRound(r) {
  R.round = r; R.t = ROUND_TIME; R.elapsed = 0;
  if (r > 1 && R.S.interest > 0) { const gain = Math.min(R.S.interestCap, Math.floor(R.gold * R.S.interest)); if (gain > 0) { R.gold += gain; toast(`이자 +${fmt(gain)}냥`); } }
  R.shieldNow = R.S.shield; R.freeRerolls = R.S.freeRerolls; R.paidRerolls = 0; R.rerollIdx = 0; rollShop();
  R.spawnQ = genSpawns(r);
  const boss = MID_BOSS[r];
  if (boss) { banner(`${r} 라운드`, `${FOES[boss].name} 출현`, 'boss', '경보'); Sfx.play('boss'); bumpField(); }
  else if (TREASURE_ROUNDS.includes(r)) { banner(`${r} 라운드`, '보물 도깨비가 나타났습니다', 'gold', '보물'); Sfx.play('gift'); }
  else { banner(`${r} 라운드`, `이번 주력 ${ARMORS[R.armorSeq[r]].name}`); Sfx.play('horn'); }
  renderShop(); renderHud(true);
}
function genSpawns(r) {
  const rng = rngFor('spawn', r), prim = R.armorSeq[r], allowed = r <= 3 ? ['light', 'medium'] : r <= 7 ? ['light', 'medium', 'heavy'] : ARMOR_IDS;
  const q = [], n = Math.round((10 + r * 0.7) * R.diff.count);
  for (let i = 0; i < n; i++) {
    const armor = rng() < 0.7 ? prim : allowed[(rng() * allowed.length) | 0], pool = POOL[armor];
    q.push({ t: 0.4 + rng() * 19, kind: pool[(rng() * pool.length) | 0], side: (rng() * 4) | 0, along: rng() });
  }
  if (MID_BOSS[r]) q.push({ t: 1.2, kind: MID_BOSS[r], side: (rng() * 4) | 0, along: 0.5 });
  if (TREASURE_ROUNDS.includes(r)) q.push({ t: 2, kind: 'treasure', side: (rng() * 4) | 0, along: 0.5 });
  return q.sort((a, b) => a.t - b.t);
}
function startFinal() {
  R.final = true; R.round = ROUNDS + 1; R.t = Infinity; R.shieldNow = R.S.shield;
  spawnFoe('dragon', 0, 0.5);
  banner('최종 결전', '흑룡이 깨어났습니다', 'boss', '결전'); Sfx.play('boss'); bumpField(); renderHud(true);
}
function spawnFoe(kind, side, along, at) {
  const d = FOES[kind], r = Math.min(R.round, ROUNDS);
  let x, y;
  if (at) { x = at.x; y = at.y; }
  else if (side === 0) { x = CX + (along - 0.5) * 150; y = -12; }
  else if (side === 1) { x = FW + 12; y = CY + (along - 0.5) * 130; }
  else if (side === 2) { x = CX + (along - 0.5) * 150; y = FH + 12; }
  else { x = -12; y = CY + (along - 0.5) * 130; }
  const hp = d.boss ? d.hp * R.diff.boss : d.treasure ? d.hp * hpMul(r) * 0.6 : d.hp * hpMul(r);
  const e = {
    id: ++eidSeq, kind, d, x, y, hp, max: hp, spd: d.spd * (1 + 0.004 * r), dmg: d.dmg * (1 + 0.06 * (r - 1)) * R.diff.edmg, cd: d.cd, atkT: d.cd * 0.5,
    r: d.r, armor: d.armor === 'cycle' ? 'light' : d.armor, cycleIdx: 0, bounty: d.bounty * (1 + 0.05 * (r - 1)), boss: !!d.boss, face: x > CX ? 1 : -1,
    anim: Math.random(), flash: 0, lunge: 0, slowT: 0, slowF: 0, freezeT: 0, stunT: 0, burnT: 0, burnDps: 0, burnSrc: null,
    poisonT: 0, pStacks: 0, pDps: 0, pSrc: null, dotAcc: 0, dotTick: 0.5, sumT: 6, skillT: 4, life: 0, orbit: Math.atan2(y - CY, x - CX), fleeing: false,
  };
  R.enemies.push(e);
  return e;
}

// ───────────────────────── shop ─────────────────────────
function tierWeights(r) {
  const w = r <= 5 ? [80, 20, 0, 0] : r <= 12 ? [55, 35, 10, 0] : r <= 20 ? [32, 40, 23, 5] : r <= 30 ? [16, 36, 34, 14] : [6, 26, 40, 28];
  const luck = 1 + perkL('luck') * 0.15; return [w[0], w[1], w[2] * luck, w[3] * luck];
}
function wpick(rng, weights) { let t = 0; for (const w of weights) t += w; let x = rng() * t; for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) <= 0) return i; return 0; }
function rollShop() {
  const rng = rngFor('shop', R.round, R.rerollIdx), cats = Object.keys(CAT_WEIGHT), cw = cats.map(c => CAT_WEIGHT[c]);
  R.shop = [];
  for (let i = 0; i < 8; i++) {
    const cat = cats[wpick(rng, cw)]; let tier = wpick(rng, tierWeights(Math.max(1, R.round)));
    let cands = [];
    while (tier >= 0 && !(cands = ITEMS.filter(it => it.cat === cat && it.tier === tier)).length) tier--;
    R.shop.push({ id: cands[(rng() * cands.length) | 0].id, sold: false });
  }
}
const priceOf = id => TIERS[ITEM[id].tier].price;
function rerollCost() { return Math.round((15 + Math.max(1, R.round) * 4) * (1 + 0.5 * R.paidRerolls)); }
function buy(slot) {
  if (!R || R.state !== 'run' || R.gift) return;
  const s = R.shop[slot]; if (!s || s.sold) return;
  const price = Math.round(priceOf(s.id) * (R.halfOff ? 0.5 : 1));
  if (bagFullFor(s.id)) { toast('가방이 가득 찼습니다. 물건을 하나 되파세요'); Sfx.play('deny', 200); return; }
  if (R.gold < price) { Sfx.play('deny', 200); flashGold(); return; }
  const ico = $(`#shop .card[data-slot="${slot}"] .ico`), from = ico ? rectIn(ico) : null;
  R.gold -= price; R.halfOff = false; s.sold = true;
  addItem(s.id); Sfx.play('buy');
  renderShop(); renderInv(); renderRes();
  if (from) flyToBag(from, R.items[R.items.length - 1]);
}
// The bought item's icon arcs from its stall card into the bag slot it lands in.
function flyToBag(from, it) {
  const slot = $(`#inv .slot[data-item="${it.id}"]`), to = rectIn(slot || $('#invCount'));
  const img = document.createElement('img'); img.className = 'flyer'; img.src = iconFor(ITEM[it.id]); img.alt = '';
  img.style.left = from.x + 'px'; img.style.top = from.y + 'px'; img.style.width = from.w + 'px'; img.style.height = from.h + 'px';
  screenEl.append(img);
  const dx = to.x + to.w / 2 - (from.x + from.w / 2), dy = to.y + to.h / 2 - (from.y + from.h / 2);
  if (slot) slot.style.visibility = 'hidden';
  const done = () => { img.remove(); if (slot) { slot.style.visibility = ''; slot.classList.add('pop'); } };
  if (!img.animate) { done(); return; }
  img.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 120}px) scale(1.5) rotate(-12deg)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px) scale(.85)` }], { duration: 480, easing: 'cubic-bezier(.3,.1,.3,1)' }).onfinish = done;
}
function addItem(id) {
  const it = { uid: ++uidSeq, id, t: Math.random() * 0.3, dealt: 0, since: R.time };
  R.items.push(it); refreshStats();
}
function sellItem(uid) {
  const i = R.items.findIndex(x => x.uid === uid); if (i < 0) return;
  const it = R.items[i], refund = Math.floor(priceOf(it.id) * (BASE.sellRate + perkL('sell') * 0.1));
  R.items.splice(i, 1); R.gold += refund; refreshStats(); hideTip(); selected = null;
  toast(`${josa(ITEM[it.id].name, '을', '를')} 되팔아 ${fmt(refund)}냥을 받았습니다`); Sfx.play('coin');
  renderInv(); renderRes();
}
function reroll() {
  if (!R || R.state !== 'run' || R.gift) return;
  if (R.freeRerolls > 0) R.freeRerolls--;
  else { const c = rerollCost(); if (R.gold < c) { Sfx.play('deny', 200); flashGold(); return; } R.gold -= c; R.paidRerolls++; }
  R.rerollIdx++; rollShop(); Sfx.play('reroll'); renderShop(); renderRes();
}

// ───────────────────────── combat ─────────────────────────
const onField = e => e.x > -2 && e.x < FW + 2 && e.y > -2 && e.y < FH + 2;
const distC = e => Math.hypot(e.x - CX, e.y - CY);
function nearest(range, exclude) {
  let best = null, bd = Infinity;
  for (const e of R.enemies) { if (e.hp <= 0 || !onField(e) || (exclude && exclude.has(e))) continue; const d = distC(e) - e.r; if (d <= range && d < bd) { bd = d; best = e; } }
  return best;
}
function nearestN(range, n) { return R.enemies.filter(e => e.hp > 0 && onField(e) && distC(e) - e.r <= range).sort((a, b) => distC(a) - distC(b)).slice(0, n); }
function nearOf(e0, radius, exclude) { let best = null, bd = radius; for (const e of R.enemies) { if (e.hp <= 0 || e === e0 || (exclude && exclude.has(e))) continue; const d = Math.hypot(e.x - e0.x, e.y - e0.y); if (d < bd) { bd = d; best = e; } } return best; }

function calcDmg(def, e) {
  const S = R.S, t = def.type; let d = def.dmg * (1 + S.dmg + S.typeDmg[t]), strong = false;
  if (t === 'chaos') d *= S.chaosMin + Math.random() * (2 - S.chaosMin);
  else if (TYPES[t].strong === e.armor) { d *= 2; strong = true; }
  const critChance = S.crit + (def.crit || 0) + (t === 'arrow' && S.typeStep.arrow >= 2 ? 0.08 : 0), crit = Math.random() < critChance;
  if (crit) d *= S.critMul;
  return { d, crit, strong };
}
function updateWeapons(dt) {
  const S = R.S, as = 1 + S.aspd;
  for (const w of R.weapons) {
    w.t -= dt * as; if (w.t > 0) continue;
    const def = ITEM[w.id], range = def.range * (1 + S.range), tg = nearest(range);
    if (!tg) { w.t = 0.05; continue; }
    fire(w, def, tg, range); w.t = Math.max(w.t + def.cd, def.cd * 0.25);
  }
}
const TOP = { x: CX, y: CY - 36 };
function fire(w, def, tg, range) {
  const S = R.S;
  if (def.multi) { for (const t of nearestN(range, def.multi + (S.typeStep.charm >= 2 ? 1 : 0))) shot(w, def, t, 0); }
  else {
    const n = def.shots || 1, pool = n > 1 ? nearestN(range, 6) : null;
    for (let i = 0; i < n; i++) shot(w, def, i === 0 ? tg : pool[(Math.random() * pool.length) | 0], i * 0.07);
  }
  Sfx.play(def.type, def.type === 'blade' ? 70 : 90);
}
function shot(w, def, tg, delay) {
  const S = R.S, s = { w, def, tg, x: TOP.x, y: TOP.y, delay, mult: 1, hit: new Set(), tx: tg.x, ty: tg.y };
  switch (def.proj) {
    case 'shell': {
      const lead = tg.freezeT > 0 || tg.stunT > 0 ? 0 : 0.5;
      const ang = Math.atan2(CY - tg.y, CX - tg.x), stopped = distC(tg) <= TOWER_R + tg.r + 1;
      const tx = stopped ? tg.x : tg.x + Math.cos(ang) * tg.spd * lead, ty = stopped ? tg.y : tg.y + Math.sin(ang) * tg.spd * lead;
      Object.assign(s, { k: 'shell', x0: TOP.x, y0: TOP.y, tx, ty, tt: 0, T: 0.45 + Math.hypot(tx - TOP.x, ty - TOP.y) / 420, splash: def.splash * (S.typeStep.cannon >= 2 ? 1.3 : 1) });
      break;
    }
    case 'rocket': {
      const a = Math.atan2(tg.y - TOP.y, tg.x - TOP.x) + rand(-1.4, 1.4);
      Object.assign(s, { k: 'rocket', vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, age: 0, splash: def.splash * (S.typeStep.cannon >= 2 ? 1.3 : 1) });
      break;
    }
    case 'arrow': Object.assign(s, { k: 'arrow', spd: 320, pierce: (def.pierce || 0) + (S.typeStep.arrow >= 2 ? 1 : 0) }); break;
    case 'blade': Object.assign(s, { k: 'blade', spd: 230, bounce: (def.bounce || 0) + (S.typeStep.blade >= 2 ? 1 : 0), spin: 0 }); break;
    case 'charm': Object.assign(s, { k: 'charm', spd: 175 }); break;
    default: Object.assign(s, { k: 'wisp', spd: 185 }); break;
  }
  R.shots.push(s);
}
function stepShot(s, dt) {
  if (s.delay > 0) { s.delay -= dt; return true; }
  if (s.k === 'shell') {
    s.tt += dt; const p = Math.min(1, s.tt / s.T);
    s.x = s.x0 + (s.tx - s.x0) * p; s.y = s.y0 + (s.ty - s.y0) * p - Math.sin(Math.PI * p) * 28;
    if (p >= 1) { boom(s.w, s.def, s.tx, s.ty, s.splash); return false; }
    return true;
  }
  if (s.k === 'rocket') {
    s.age += dt; const tg = s.tg && s.tg.hp > 0 ? s.tg : null; if (tg) { s.tx = tg.x; s.ty = tg.y; }
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
    let a = Math.atan2(s.vy, s.vx), diff = Math.atan2(dy, dx) - a; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    a += clamp(diff, -(3 + s.age * 12) * dt, (3 + s.age * 12) * dt); const sp = Math.min(260, Math.hypot(s.vx, s.vy) + 300 * dt);
    s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.x += s.vx * dt; s.y += s.vy * dt;
    if (Math.random() < 0.6) R.fx.push({ k: 'p', x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.25, c: '#ee8a2c' });
    if (d < 4 || s.age > 2.2) { boom(s.w, s.def, s.x, s.y, s.splash); return false; }
    return true;
  }
  if (s.straight) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.left -= Math.hypot(s.vx, s.vy) * dt;
    for (const e of R.enemies) { if (e.hp <= 0 || s.hit.has(e)) continue; if (Math.hypot(e.x - s.x, e.y - 4 - s.y) < e.r + 2) { s.hit.add(e); hitWith(s.w, s.def, e, s.mult); s.mult *= 0.9; if (--s.pierce < 0) return false; } }
    return s.left > 0 && s.x > -10 && s.x < FW + 10 && s.y > -10 && s.y < FH + 10;
  }
  const tg = s.tg && s.tg.hp > 0 ? s.tg : null; if (tg) { s.tx = tg.x; s.ty = tg.y - 4; }
  const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = s.spd * dt;
  s.ang = Math.atan2(dy, dx); if (s.k === 'blade') s.spin += dt * 25;
  if (d <= step + 3) {
    if (!tg) return false;
    s.hit.add(tg); hitWith(s.w, s.def, tg, s.mult);
    if (s.k === 'blade' && s.bounce > 0) { const nx = nearOf(tg, 60, s.hit); if (nx) { s.bounce--; s.tg = nx; s.mult *= 0.85; s.x = tg.x; s.y = tg.y - 4; return true; } }
    if (s.k === 'arrow' && s.pierce > 0) { s.straight = true; s.pierce--; const a = s.ang; s.vx = Math.cos(a) * s.spd; s.vy = Math.sin(a) * s.spd; s.left = 140; s.mult *= 0.9; return true; }
    return false;
  }
  s.x += dx / d * step; s.y += dy / d * step;
  if (s.k === 'charm' || s.k === 'wisp') if (Math.random() < 0.5) R.fx.push({ k: 'p', x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.2, c: s.def.elem ? ELEMS[s.def.elem].color : TYPES[s.def.type].color });
  return true;
}
function boom(w, def, x, y, r) {
  for (const e of R.enemies) if (e.hp > 0 && Math.hypot(e.x - x, e.y - 4 - y) <= r + e.r) hitWith(w, def, e, 1, true);
  R.fx.push({ k: 'boom', x, y, r, t: 0, life: 0.28, c: def.elem === 'fire' ? '#ff8a3a' : '#f3c94a' });
  if (def.proj === 'shell') R.shake = Math.min(3, R.shake + 0.6);
}
function hitWith(w, def, e, mult = 1, aoe = false) {
  const res = calcDmg(def, e); let d = res.d * mult;
  damage(e, d, w, res.crit, res.strong);
  if (e.hp > 0 && def.execute && !e.boss && e.hp / e.max < def.execute) { damage(e, e.hp, w, false, false); R.fx.push({ k: 'ring', x: e.x, y: e.y - 5, r: 10, t: 0, life: 0.3, c: '#c9ced8' }); }
  const el = def.randElem ? ELEM_IDS[(Math.random() * 4) | 0] : def.elem;
  if (el) applyElem(e, el, d, w); if (def.elem2) applyElem(e, def.elem2, d, w);
  let chains = (def.chain || 0) + (el === 'bolt' ? 1 + R.S.elemStep.bolt : 0);
  if (chains > 0 && !aoe) chain(e, def, d * 0.6, chains, w);
  if (def.stun && e.hp > 0) e.stunT = Math.max(e.stunT, def.stun * (e.boss ? 0.3 : 1));
  if (el === 'bolt' && R.S.elemStep.bolt >= 2 && Math.random() < 0.15 && e.hp > 0) e.stunT = Math.max(e.stunT, e.boss ? 0.15 : 0.4);
}
function chain(e0, def, base, n, w) {
  const seen = new Set([e0]); let cur = e0; const pts = [[e0.x, e0.y - 5]];
  for (let i = 0; i < n; i++) {
    const nx = nearOf(cur, 48, seen); if (!nx) break; seen.add(nx); pts.push([nx.x, nx.y - 5]);
    const strong = def.type !== 'chaos' && TYPES[def.type].strong === nx.armor; damage(nx, base * (strong ? 2 : 1), w, false, strong); cur = nx;
  }
  if (pts.length > 1) R.fx.push({ k: 'bolt', pts, t: 0, life: 0.18, c: def.elem === 'bolt' || def.type === 'charm' ? '#ffe46b' : '#ff9ad0' });
}
function applyElem(e, el, d, w) {
  if (e.hp <= 0) return; const S = R.S, st = S.elemStep[el];
  if (el === 'fire') { const dps = d * 0.22 * (1 + S.elemPow.fire + [0, 0.5, 1.2][st]); if (dps >= e.burnDps || e.burnT <= 0) { e.burnDps = dps; e.burnSrc = w; } e.burnT = 3; }
  else if (el === 'frost') {
    e.slowT = 2 * (1 + S.elemPow.frost); e.slowF = Math.max(e.slowF, 0.3 + [0, 0.1, 0.2][st]);
    if (st >= 2 && Math.random() < 0.12) e.freezeT = Math.max(e.freezeT, e.boss ? 0.3 : 1);
  } else if (el === 'poison') {
    const cap = [8, 12, 16][st]; e.pStacks = Math.min(cap, e.pStacks + 1);
    const dps = d * 0.07 * (1 + S.elemPow.poison) * (st >= 2 ? 1.4 : 1); if (dps >= e.pDps) { e.pDps = dps; e.pSrc = w; } e.poisonT = 4;
  }
}
function damage(e, d, w, crit, strong, silent) {
  if (e.hp <= 0 || d <= 0) return;
  e.hp -= d; e.flash = 0.06;
  if (!silent && R.fx.length < 380 && (crit || Math.random() < 0.35)) R.fx.push({ k: 'hit', x: e.x + rand(-2, 2), y: e.y - e.r - rand(0, e.r), t: 0, life: 0.12 });
  if (w) w.dealt += d; else R.thornDealt += d;
  if (!silent && (R.nums.length < 70 || crit)) R.nums.push({ x: e.x + rand(-3, 3), y: e.y - e.r * 2 - 4, v: d, c: crit ? '#ff6a4a' : strong ? '#f3c94a' : '#f6f1e7', s: crit ? 2 : 1, t: 0 });
  if (e.hp <= 0) kill(e, w);
}
function kill(e, w) {
  const S = R.S;
  if (e.d.treasure) { const coins = Math.round(giftCoins(R.round) * 0.5); R.gold += coins; R.nums.push({ x: e.x, y: e.y - 20, v: coins, c: '#f3c94a', s: 2, t: 0, plus: true }); offerGift(); }
  else {
    const g = e.bounty * (1 + S.bounty) + (w && ITEM[w.id].goldOnKill ? ITEM[w.id].goldOnKill : 0);
    R.gold += g; if (g >= 6) R.nums.push({ x: e.x, y: e.y - 14, v: g, c: '#f3c94a', s: 1, t: 0.15, plus: true });
    if (FLY.length < 24) FLY.push({ x: e.x, y: e.y - 6, t: 0, T: rand(0.5, 0.75) });
  }
  if (DECALS.length < 70) DECALS.push({ x: e.x, y: e.y, k: (Math.random() * INK.length) | 0, t: 0, life: e.boss ? 12 : 4 });
  R.kills++;
  for (let i = 0; i < (e.boss ? 30 : 6); i++) R.fx.push({ k: 'p', x: e.x + rand(-e.r, e.r), y: e.y - rand(0, e.r * 2), vx: rand(-34, 34), vy: rand(-46, -4), t: 0, life: rand(0.3, 0.7), c: i % 3 === 0 ? '#fff2d0' : i % 3 === 1 ? '#3a2a3a' : '#8a7a8a' });
  if (e.burnT > 0 && S.elemStep.fire >= 2) { for (const o of R.enemies) if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 22) { o.burnT = 3; o.burnDps = Math.max(o.burnDps, e.burnDps * 0.8); o.burnSrc = e.burnSrc; } R.fx.push({ k: 'boom', x: e.x, y: e.y - 4, r: 18, t: 0, life: 0.25, c: '#ff8a3a' }); }
  if (e.boss) { R.shake = 8; hitStop = e.d.final ? 0.7 : 0.35; R.fx.push({ k: 'boom', x: e.x, y: e.y - 10, r: 46, t: 0, life: 0.6, c: '#f3c94a' }); R.fx.push({ k: 'ring', x: e.x, y: e.y - 10, r: 90, t: 0, life: 0.8, c: '#fff2a8', big: true }); if (!e.d.final) banner('보스 토벌', e.d.name, 'gold', '토벌'); }
  Sfx.play('coin', 80);
  if (e.d.final) win();
}
function smite() {
  if (!R || R.state !== 'run' || R.gift || R.smites <= 0) return;
  const live = R.enemies.filter(e => e.hp > 0 && onField(e)); if (!live.length) { Sfx.play('deny', 200); return; }
  R.smites--; R.flash = 0.5; R.shake = 8; hitStop = 0.22; Sfx.play('smite');
  for (const e of live) {
    R.fx.push({ k: 'bolt', pts: [[e.x + rand(-20, 20), -4], [e.x + rand(-6, 6), e.y * 0.5], [e.x, e.y - 6]], t: 0, life: 0.35, c: '#fff2a8' });
    if (e.boss) damage(e, e.max * (e.d.final ? 0.08 : 0.15), null, false, false); else if (!e.d.treasure) damage(e, e.hp + 1, null, false, false, true);
  }
  banner('천벌', '하늘이 봉화대를 돕습니다', 'gold', '천벌'); renderHud(true);
}
function hurtTower(d, e) {
  const S = R.S; d *= 1 - S.dr;
  if (R.shieldNow > 0) { const a = Math.min(R.shieldNow, d); R.shieldNow -= a; d -= a; }
  R.hp -= d; R.shake = Math.min(4, R.shake + (e && e.boss ? 3 : 0.4)); R.hurtT = 0.15; Sfx.play('hurt', 160);
  if (e && S.thorn > 0 && e.hp > 0) {
    const t = S.thorn * (1 + S.thornPow) * (1 + 0.1 * (Math.min(R.round, ROUNDS) - 1));
    damage(e, t, null, false, false);
    for (const el of S.thornElems) applyElem(e, el, t, null);
  }
  if (R.hp <= 0) { R.hp = 0; lose(); }
}
function updateEnemies(dt) {
  for (const e of R.enemies) {
    if (e.hp <= 0) continue;
    e.life += dt; if (e.flash > 0) e.flash -= dt; if (e.lunge > 0) e.lunge -= dt;
    // damage over time
    let dot = 0;
    if (e.burnT > 0) { e.burnT -= dt; dot += e.burnDps * dt; if (e.burnSrc) e.burnSrc.dealt += e.burnDps * dt; }
    if (e.poisonT > 0) { e.poisonT -= dt; const pd = e.pDps * e.pStacks * dt; dot += pd; if (e.pSrc) e.pSrc.dealt += pd; if (e.poisonT <= 0) e.pStacks = 0; }
    if (dot > 0) {
      e.hp -= dot; e.dotAcc += dot; e.dotTick -= dt;
      if (e.dotTick <= 0) { e.dotTick = 0.5; if (e.dotAcc >= 1 && R.nums.length < 70) R.nums.push({ x: e.x + rand(-3, 3), y: e.y - e.r * 2, v: e.dotAcc, c: e.burnT > 0 ? '#ff9a4a' : '#97e04f', s: 1, t: 0 }); e.dotAcc = 0; }
      if (e.hp <= 0) { kill(e, e.burnT > 0 ? e.burnSrc : e.pSrc); continue; }
    }
    if (e.freezeT > 0) { e.freezeT -= dt; continue; }
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    let sp = e.spd; if (e.slowT > 0) { e.slowT -= dt; sp *= 1 - Math.min(0.7, e.slowF); if (e.slowT <= 0) e.slowF = 0; }
    if (e.d.treasure) { treasureMove(e, dt, sp); continue; }
    if (e.boss) bossSkills(e, dt);
    const dx = CX - e.x, dy = CY - e.y, d = Math.hypot(dx, dy), stop = TOWER_R + e.r;
    if (Math.abs(dx) > 0.5) e.face = dx > 0 ? 1 : -1;
    if (d > stop) { const m = Math.min(sp * dt, d - stop); e.x += dx / d * m; e.y += dy / d * m; e.anim += dt; }
    else { e.atkT -= dt; if (e.atkT <= 0) { e.atkT = e.cd; e.lunge = 0.12; hurtTower(e.dmg, e); if (e.kind === 'bulga') e.hp = Math.min(e.max, e.hp + e.max * 0.01); } }
  }
  // keep crowds from stacking into one pixel
  const list = R.enemies; for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.hp <= 0 || a.d.treasure) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.hp <= 0 || b.d.treasure) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.75, d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) { const d = Math.sqrt(d2), push = (min - d) * 0.5, ux = dx / d, uy = dy / d; const wa = a.boss ? 0.1 : b.boss ? 0.9 : 0.5; a.x -= ux * push * wa * 2; a.y -= uy * push * wa * 2; b.x += ux * push * (1 - wa) * 2; b.y += uy * push * (1 - wa) * 2; }
    }
  }
}
function treasureMove(e, dt, sp) {
  const d = distC(e);
  if (!e.fleeing && e.life > 24) { e.fleeing = true; banner('보물 도깨비', '달아났습니다'); }
  if (e.fleeing) { const a = Math.atan2(e.y - CY, e.x - CX); e.x += Math.cos(a) * sp * 1.6 * dt; e.y += Math.sin(a) * sp * 1.6 * dt; e.anim += dt; if (!onField(e) && d > 230) e.hp = 0; return; }
  if (d > 104) { const a = Math.atan2(CY - e.y, CX - e.x); e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt; e.orbit = Math.atan2(e.y - CY, e.x - CX); }
  else { e.orbit += sp / 100 * dt; const nx = CX + Math.cos(e.orbit) * 100, ny = CY + Math.sin(e.orbit) * 92; e.face = nx > e.x ? 1 : -1; e.x = nx; e.y = ny; }
  e.anim += dt;
}
function bossSkills(e, dt) {
  e.sumT -= dt;
  if (e.sumT <= 0 && R.enemies.length < 140) {
    e.sumT = e.d.final ? 8 : 9;
    for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; spawnFoe(e.d.summon, 0, 0, { x: e.x + Math.cos(a) * 16, y: e.y + Math.sin(a) * 16 }); }
    R.fx.push({ k: 'ring', x: e.x, y: e.y - 8, r: 26, t: 0, life: 0.4, c: '#b995ff' });
  }
  if (e.kind === 'gumiho' || e.d.final) {
    e.skillT -= dt;
    if (e.skillT <= 0) { e.skillT = e.d.final ? 7 : 5; R.shots.push({ k: 'foe', x: e.x, y: e.y - 10, dmg: e.dmg * (e.d.final ? 1.2 : 0.4), src: e, c: e.d.final ? '#b44aff' : '#7fd3ff', delay: 0 }); }
  }
  if (e.d.final) {
    const idx = Math.min(ARMOR_IDS.length * 2 - 1, Math.floor((1 - e.hp / e.max) * 5));
    if (idx !== e.cycleIdx) { e.cycleIdx = idx; e.armor = ARMOR_IDS[idx % 4]; banner('흑룡의 비늘이 바뀝니다', `${ARMORS[e.armor].name} · 약점 ${TYPE_IDS.filter(t => TYPES[t].strong === e.armor).map(t => TYPES[t].name).join('')}`, 'boss'); renderHud(true); }
  }
}
function stepFoeShot(s, dt) {
  const dx = TOP.x - s.x, dy = CY - 10 - s.y, d = Math.hypot(dx, dy), step = 120 * dt;
  if (d <= step) { hurtTower(s.dmg, null); R.fx.push({ k: 'boom', x: TOP.x, y: CY - 10, r: 10, t: 0, life: 0.25, c: s.c }); return false; }
  s.x += dx / d * step; s.y += dy / d * step; if (Math.random() < 0.7) R.fx.push({ k: 'p', x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.3, c: s.c });
  return true;
}

function update(dt) {
  if (!R || R.state !== 'run' || R.gift) return;
  R.time += dt; R.t -= dt; R.elapsed += dt;
  if (R.t <= 0) { if (R.round === 0) startRound(1); else if (R.round < ROUNDS) startRound(R.round + 1); else if (!R.final) startFinal(); }
  while (R.spawnQ.length && R.spawnQ[0].t <= R.elapsed) { const q = R.spawnQ.shift(); spawnFoe(q.kind, q.side, q.along); }
  R.gold += R.S.income * dt;
  R.hp = Math.min(R.S.maxHp, R.hp + R.S.regen * dt);
  updateWeapons(dt);
  updateEnemies(dt);
  if (R.state !== 'run') return;
  let w = 0; for (const s of R.shots) if (s.k === 'foe' ? stepFoeShot(s, dt) : stepShot(s, dt)) R.shots[w++] = s; R.shots.length = w;
  w = 0; for (const e of R.enemies) if (e.hp > 0) R.enemies[w++] = e; R.enemies.length = w;
  ageFx(dt);
}
function ageFx(dt) {
  let w = 0; for (const f of R.fx) { f.t += dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; } if (f.t < f.life) R.fx[w++] = f; } R.fx.length = w;
  if (R.fx.length > 500) R.fx.splice(0, R.fx.length - 500);
  w = 0; for (const n of R.nums) { n.t += dt; if (n.t < 0.75) R.nums[w++] = n; } R.nums.length = w;
  R.shake = Math.max(0, R.shake - dt * 14); R.flash = Math.max(0, R.flash - dt); if (R.hurtT > 0) R.hurtT -= dt;
}

// ───────────────────────── gifts, victory, defeat ─────────────────────────
function offerGift() {
  const rng = rngFor('gift', R.round), pool = GIFTS.slice(), pick3 = [];
  while (pick3.length < 3) pick3.push(pool.splice((rng() * pool.length) | 0, 1)[0]);
  R.gift = pick3; Sfx.play('gift'); showGift();
}
function takeGift(i) {
  const g = R.gift && R.gift[i]; if (!g) return; const r = Math.min(R.round, ROUNDS);
  if (g.id === 'coins') R.gold += giftCoins(r);
  else if (g.id === 'heal') { R.hp = R.S.maxHp; R.shieldNow = R.S.shield; }
  else if (g.id === 'reroll') R.freeRerolls += 3;
  else if (g.id === 'half') R.halfOff = true;
  else if (g.id === 'chest') {
    const tier = giftTier(r), rng = rngFor('chest', r), c = ITEMS.filter(it => it.tier === tier && it.cat !== 'thorn');
    const id = c[(rng() * c.length) | 0].id;
    if (!bagFullFor(id)) { addItem(id); toast(`보물 상자에서 ${josa(ITEM[id].name, '이', '가')} 나왔습니다`); } else { R.gold += priceOf(id); toast('가방이 가득 차서 값으로 받았습니다'); }
  } else if (g.id === 'gamtu') { R.bonusDmg += 0.1; refreshStats(); }
  R.gift = null; closeModal(); renderShop(); renderInv(); renderRes();
}
function roundsCleared() { return R.state === 'won' ? ROUNDS : Math.max(0, Math.min(ROUNDS, R.round - 1)); }
function runScore() { return roundsCleared() * 1000 + R.kills * 3 + (R.state === 'won' ? 30000 + Math.round(R.hp / R.S.maxHp * 5000) : 0); }
function finishRun() {
  const d = R.diff, cleared = roundsCleared(), won = R.state === 'won';
  const shards = Math.floor(cleared * d.mem) + (won ? Math.round(25 * d.mem) : 0);
  P.shards += shards; P.runs++;
  P.best[d.id] = Math.max(P.best[d.id] || 0, won ? ROUNDS + 1 : R.round);
  if (won) P.wins[d.id] = (P.wins[d.id] || 0) + 1;
  let rec = null;
  if (R.ranked) {
    rec = { week: weekId(), score: runScore(), round: won ? ROUNDS + 1 : R.round, win: won, kills: R.kills, nick: P.nick || '', at: Date.now() };
    P.records.push(rec); P.records.sort((a, b) => b.score - a.score); P.records = P.records.slice(0, 30);
    lastRecAt = rec.at;
  }
  persist();
  return { shards, rec };
}
function win() { if (R.state !== 'run') return; R.state = 'won'; Sfx.play('win'); const res = finishRun(); setTimeout(() => showResult(res), 900); }
function lose() { if (R.state !== 'run') return; R.state = 'lost'; Sfx.play('lose'); const res = finishRun(); setTimeout(() => showResult(res), 900); }

// ───────────────────────── rendering ─────────────────────────
// Everything below is presentation: it reads the run state and never changes the simulation.
const cv = $('#cv'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
let bgCache = {}, clock = 0, hitStop = 0;
const bg = theme => bgCache[theme] || (bgCache[theme] = paintField(theme));
const AMB = [], DECALS = [], FLY = [];
const RGB = {}; const rgbOf = hex => RGB[hex] || (RGB[hex] = hexRgb(hex).join(','));
function stepAmb(dt, hpRatio, T) {
  for (const f of towerFires(hpRatio)) {
    if (f.lit && Math.random() < dt * (f.main ? 10 : 4)) AMB.push({ k: 'ember', x: f.x + rand(-2, 2), y: f.y - 5, vx: rand(-4, 10), vy: rand(-30, -14), t: 0, life: rand(0.8, 1.8) });
    if (Math.random() < dt * (f.lit ? 0.9 : 2.4)) AMB.push({ k: 'smoke', x: f.x + rand(-1, 1), y: f.y - 6, vx: rand(3, 9), vy: rand(-11, -6), t: 0, life: rand(1.8, 3), r: rand(1.5, 2.6), dark: !f.lit });
  }
  const motes = AMB.reduce((n, a) => n + (a.k === T.mote), 0);
  if (motes < (T.mote === 'leaf' ? 10 : 16) && Math.random() < dt * 4) {
    let x = rand(0, FW), y = rand(0, FH);
    if (T.mote === 'leaf') AMB.push({ k: 'leaf', x, y: -4, vx: rand(6, 14), vy: rand(9, 16), t: 0, life: 30, ph: rand(0, 6), c: T.flower[(Math.random() * 3) | 0] });
    else if (Math.hypot(x - CX, y - CY) > PLAZA_R + 20) AMB.push({ k: T.mote, x, y, vx: rand(-4, 4), vy: rand(-4, 4), t: 0, life: rand(3, 6), ph: rand(0, 6) });
  }
  let w = 0;
  for (const a of AMB) {
    a.t += dt;
    if (a.k === 'ember') { a.vx += Math.sin(clock * 3 + a.y) * 20 * dt; a.vy *= 1 - dt * 0.6; }
    if (a.k === 'smoke') { a.r += dt * 2.2; a.vx += dt * 2; }
    if (a.k === 'leaf') a.x += Math.sin(clock * 2 + a.ph) * 10 * dt;
    if (a.k === 'firefly' || a.k === 'wisp') { a.vx += rand(-20, 20) * dt; a.vy += rand(-20, 20) * dt; a.vx *= 0.98; a.vy *= 0.98; }
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.t < a.life && a.y < FH + 6 && a.y > -40) AMB[w++] = a;
  }
  AMB.length = w; if (AMB.length > 260) AMB.splice(0, AMB.length - 260);
  w = 0; for (const d of DECALS) { d.t += dt; if (d.t < d.life) DECALS[w++] = d; } DECALS.length = w;
}
function drawAmb(over) {
  for (const a of AMB) {
    const p = a.t / a.life;
    if (!over) {
      if (a.k === 'smoke') { g.globalAlpha = (a.dark ? 0.42 : 0.26) * (1 - p); pcirc(g, a.x, a.y, a.r, a.dark ? '#3a3440' : '#8a8494'); g.globalAlpha = 1; }
      else if (a.k === 'leaf') pr(g, a.x, a.y, Math.floor(clock * 6 + a.ph) % 2 ? 2 : 1, 1, a.c);
      continue;
    }
    if (a.k === 'ember') pr(g, a.x, a.y, 1, 1, p < 0.3 ? '#fff2a8' : p < 0.65 ? '#f3a33a' : '#c8452a');
    else if (a.k === 'firefly') { const on = Math.sin(clock * 3 + a.ph) > 0.2; if (on) { pr(g, a.x, a.y, 1, 1, '#e8ff9a'); g.globalAlpha = 0.25; pr(g, a.x - 1, a.y - 1, 3, 3, '#c8ff6a'); g.globalAlpha = 1; } }
    else if (a.k === 'wisp') { g.globalAlpha = Math.sin(p * Math.PI) * 0.8; pr(g, a.x, a.y, 1, 1, '#d6b4ff'); g.globalAlpha = 1; }
  }
}
function render(dt) {
  const theme = R ? R.diff.theme : 'field', T = THEMES[theme], field = bg(theme);
  const hpRatio = R ? clamp(R.hp / R.S.maxHp, 0, 1) : 1;
  stepAmb(dt, hpRatio, T);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = R && R.shake > 0.3 ? R.shake : 0, ox = sh ? Math.round(rand(-sh, sh)) : 0, oy = sh ? Math.round(rand(-sh, sh)) : 0;
  g.fillStyle = '#05040a'; g.fillRect(0, 0, FW, FH);
  g.translate(ox, oy);
  g.drawImage(field.cv, 0, 0);
  for (const d of DECALS) { g.globalAlpha = Math.min(0.55, (1 - d.t / d.life) * 0.9); g.drawImage(INK[d.k], Math.round(d.x - 8), Math.round(d.y - 5)); }
  g.globalAlpha = 1;
  for (const [x, y] of TORCHES) drawTorch(g, x, y, clock);
  if (R && R.showRange) { const seen = new Set(); for (const w of R.weapons) { const r = Math.round(ITEM[w.id].range * (1 + R.S.range)); if (seen.has(r)) continue; seen.add(r); pring(g, CX, CY, r, 'rgba(255,226,160,0.35)'); } }
  const list = R ? R.enemies.slice().sort((a, b) => a.y - b.y) : [];
  let towerDrawn = false;
  for (const e of list) { if (!towerDrawn && e.y > CY + 6) { drawTower(g, clock, hpRatio, theme); towerDrawn = true; } drawFoe(e); }
  if (!towerDrawn) drawTower(g, clock, hpRatio, theme);
  if (R) {
    if (R.shieldNow > 0) { g.globalAlpha = 0.5 + Math.sin(clock * 4) * 0.15; pring(g, CX, CY - 14, 30, '#8cd2ff'); g.globalAlpha = 1; }
    for (const s of R.shots) drawShot(s);
    for (const f of R.fx) drawFx(f);
  }
  drawAmb(false);
  // light
  const lit = litStacks(hpRatio), flick = Math.sin(clock * 9) * 3 + Math.sin(clock * 23) * 2, lights = field.lights.slice();
  lights.push({ x: CX, y: CY - 28, r: lit ? 70 + lit * 16 + flick : 46, i: 1, c: '255,150,60', ca: 0.16 + lit * 0.04 });
  lights.push({ x: CX, y: CY - 4, r: 58, i: 0.9 });
  for (const [x, y] of TORCHES) lights.push({ x, y: y - 11, r: 30 + flick * 0.6, i: 0.8, c: '255,170,90', ca: 0.16 });
  if (R) {
    for (const s of R.shots) {
      if (s.delay > 0) continue;
      const col = s.k === 'foe' ? s.c : s.def && s.def.elem ? ELEMS[s.def.elem].color : s.k === 'charm' ? '#f3c94a' : s.k === 'wisp' ? '#ff74b4' : s.k === 'rocket' ? '#ee8a2c' : null;
      if (col) lights.push({ x: s.x, y: s.y, r: s.k === 'foe' ? 22 : 13, i: 0.75, c: rgbOf(col), ca: 0.3 });
    }
    for (const f of R.fx) {
      const p = f.t / f.life;
      if (f.k === 'boom') lights.push({ x: f.x, y: f.y, r: f.r * 2.6 * (1 - p * 0.5) + 6, i: 1 - p * 0.6, c: rgbOf(f.c), ca: 0.45 * (1 - p) });
      else if (f.k === 'bolt') for (const [x, y] of f.pts) lights.push({ x, y, r: 22, i: 0.9 * (1 - p), c: '255,240,170', ca: 0.4 * (1 - p) });
    }
    for (const e of list) {
      if (e.burnT > 0) lights.push({ x: e.x, y: e.y - 4, r: 12, i: 0.6, c: '255,120,50', ca: 0.25 });
      if (e.d.treasure) lights.push({ x: e.x, y: e.y - 6, r: 30, i: 0.9, c: '255,215,90', ca: 0.35 });
      else if (e.boss) lights.push({ x: e.x, y: e.y - 10, r: 34 + e.r, i: 0.55 });
    }
  }
  for (const a of AMB) if (a.k === 'firefly' && Math.sin(clock * 3 + a.ph) > 0.2) lights.push({ x: a.x, y: a.y, r: 9, i: 0.5, c: '200,255,120', ca: 0.3 });
  darkPass(g, FW, FH, T.amb, T.dark, T.edge, lights, CX, CY);
  // eyes glint in the dark, fading out as a foe walks into the firelight
  const lightR = lit ? 70 + lit * 16 : 46;
  for (const e of list) {
    const spr = SPRITES[e.d.spr]; if (!spr || !spr.eyes.length || e._x == null) continue;
    const a = clamp((distC(e) - lightR * 0.45) / (lightR * 0.5), 0, 1); if (a <= 0.05) continue;
    g.globalAlpha = a * (0.75 + Math.sin(clock * 5 + e.id) * 0.25);
    const c = e.boss ? '#ff4a3a' : e.d.armor === 'light' ? '#fff07a' : '#ff8a4a';
    for (const [ex, ey] of spr.eyes) pr(g, e._flip ? e._x + spr.w - spr.scale - ex : e._x + ex, e._y + ey, spr.scale, spr.scale, c);
  }
  g.globalAlpha = 1;
  drawAmb(true);
  if (R) {
    for (const n of R.nums) {
      const p = n.t / 0.75; if (p < 0) continue;
      const rise = (1 - Math.pow(1 - p, 3)) * 14, pop = n.s > 1 && n.t < 0.09 ? 1 : 0;
      if (p > 0.8) g.globalAlpha = (1 - p) * 5;
      pdigits(g, (n.plus ? '+' : '') + shortNum(n.v), n.x, n.y - rise, n.c, n.s + pop);
      g.globalAlpha = 1;
    }
    const danger = R.state === 'run' ? clamp((0.35 - hpRatio) / 0.35, 0, 1) * (0.55 + Math.sin(clock * 6) * 0.25) + (R.hurtT > 0 ? 0.35 : 0) : 0;
    if (danger > 0.02) {
      const vg = g.createRadialGradient(CX, CY, 110, CX, CY, 300); vg.addColorStop(0, 'rgba(160,20,10,0)'); vg.addColorStop(1, `rgba(170,20,10,${Math.min(0.6, danger * 0.6)})`);
      g.fillStyle = vg; g.fillRect(-8, -8, FW + 16, FH + 16);
    }
    if (R.flash > 0) { g.fillStyle = `rgba(255,248,220,${Math.min(0.75, R.flash * 1.4)})`; g.fillRect(-8, -8, FW + 16, FH + 16); }
  }
}
function drawFoe(e) {
  const spr = SPRITES[e.d.spr]; if (!spr) return;
  const frame = spr.frames.length > 1 && e.freezeT <= 0 && e.stunT <= 0 ? Math.floor(e.anim * 6) % 2 : 0;
  let x = Math.round(e.x - spr.w / 2), y = Math.round(e.y - spr.h + 2);
  if (e.d.float) y -= 3 + Math.round(Math.sin(e.life * 4) * 2);
  if (e.d.hop) y -= Math.round(Math.abs(Math.sin(e.anim * 5)) * 4);
  if (e.lunge > 0) { const a = Math.atan2(CY - e.y, CX - e.x); x += Math.round(Math.cos(a) * 3); y += Math.round(Math.sin(a) * 3); }
  // shadow cast away from the beacon fire
  const d = Math.max(1, distC(e)), ux = (e.x - CX) / d, uy = (e.y - CY) / d;
  pell(g, e.x + ux * (2 + e.r * 0.3), e.y + 1 + uy * 1.5, Math.max(3, e.r), Math.max(1, Math.round(e.r * 0.35)), e.d.float ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.38)');
  const flip = e.face > 0;
  e._x = x; e._y = y; e._flip = flip;
  g.drawImage(e.flash > 0 ? (flip ? spr.whiteFlip : spr.white)[frame] : (flip ? spr.flip : spr.frames)[frame], x, y);
  if (e.freezeT > 0) { g.globalAlpha = 0.55; g.drawImage(spr.ice, x, y); g.globalAlpha = 1; }
  if (e.burnT > 0) for (let i = 0; i < 2; i++) if (Math.floor(clock * 12 + e.id + i * 5) % 3 === 0) pr(g, x + ((e.id * 7 + i * 5) % spr.w), y - 1 - i, 1, 2, i ? '#ffd27a' : '#ff8a3a');
  if (e.pStacks > 0 && Math.floor(clock * 8 + e.id) % 4 === 0) pr(g, x + ((e.id * 5 + 3) % spr.w), y + 2, 1, 1, '#97e04f');
  if (e.slowT > 0 && e.freezeT <= 0) pr(g, x, y + spr.h - 1, spr.w, 1, 'rgba(155,230,255,0.7)');
  if (e.stunT > 0) for (let i = 0; i < 2; i++) pr(g, x + spr.w / 2 + Math.round(Math.cos(clock * 8 + i * 3) * 4), y - 2, 1, 1, '#f3c94a');
  if (!e.boss && e.hp < e.max) { const w = Math.max(6, spr.w - 2); pr(g, Math.round(e.x - w / 2) - 1, y - 4, w + 2, 3, 'rgba(10,6,6,0.75)'); pr(g, Math.round(e.x - w / 2), y - 3, Math.max(1, Math.round(w * e.hp / e.max)), 1, e.hp / e.max < 0.35 ? '#ff5a3a' : '#e8c35a'); }
  if (e.d.treasure && Math.floor(clock * 6) % 2) pr(g, x + spr.w - 3, y + 2, 1, 1, '#fff2a8');
}
function drawShot(s) {
  if (s.delay > 0) return;
  const x = Math.round(s.x), y = Math.round(s.y), ec = s.def && s.def.elem ? ELEMS[s.def.elem].color : null;
  switch (s.k) {
    case 'blade': { const a = s.spin; pline(g, x - Math.cos(a) * 3, y - Math.sin(a) * 3, x + Math.cos(a) * 3, y + Math.sin(a) * 3, '#f2f6fb'); pr(g, x, y, 1, 1, ec || '#ffffff'); break; }
    case 'arrow': { const a = s.straight ? Math.atan2(s.vy, s.vx) : s.ang; pline(g, x - Math.cos(a) * 7, y - Math.sin(a) * 7, x - Math.cos(a) * 2, y - Math.sin(a) * 2, 'rgba(240,230,200,0.35)'); pline(g, x - Math.cos(a) * 5, y - Math.sin(a) * 5, x, y, '#e6d6ad'); pr(g, x, y, 1, 1, ec || '#ffffff'); break; }
    case 'charm': pr(g, x - 1, y - 2, 4, 5, '#17131c'); pr(g, x, y - 1, 2, 3, '#f3d77a'); pr(g, x, y, 1, 1, ec || '#cf4a35'); break;
    case 'wisp': pcirc(g, x, y, 2, '#ff74b4'); pr(g, x, y, 1, 1, '#ffe0f0'); break;
    case 'shell': pr(g, x - 1, y - 1, 3, 3, '#17131c'); pr(g, x, y, 1, 1, '#c9ced8'); break;
    case 'rocket': pr(g, x, y, 2, 1, '#e8edf5'); pr(g, x - 1, y, 1, 1, '#ffb347'); break;
    case 'foe': pcirc(g, x, y, 3, s.c); pr(g, x, y, 1, 1, '#ffffff'); break;
  }
}
function drawFx(f) {
  const p = f.t / f.life;
  switch (f.k) {
    case 'p': pr(g, f.x, f.y, 1, 1, f.c); break;
    case 'hit': { const r = p < 0.5 ? 2 : 1; pr(g, f.x - r, f.y, r * 2 + 1, 1, '#fff6d8'); pr(g, f.x, f.y - r, 1, r * 2 + 1, '#fff6d8'); break; }
    case 'boom': if (p < 0.5) pcirc(g, f.x, f.y, f.r * (0.4 + p * 1.2), f.c); if (p < 0.25) pcirc(g, f.x, f.y, f.r * 0.35, '#fff6d0'); pring(g, f.x, f.y, f.r * (0.4 + p * 0.9), p < 0.6 ? '#fff2a8' : '#8b919e'); break;
    case 'ring': pring(g, f.x, f.y, f.r * (0.3 + p), f.c); if (f.big) pring(g, f.x, f.y, f.r * (0.15 + p * 0.8), f.c); break;
    case 'bolt': for (let i = 0; i < f.pts.length - 1; i++) { const [x0, y0] = f.pts[i], [x1, y1] = f.pts[i + 1], mx = (x0 + x1) / 2 + rand(-3, 3), my = (y0 + y1) / 2 + rand(-3, 3); pline(g, x0, y0, mx, my, f.c); pline(g, mx, my, x1, y1, f.c); } break;
  }
}
// Gold coins fly from a fallen foe to the purse in the left wing, drawn on a screen-wide overlay.
const ov = $('#ov'), og = ov.getContext('2d'); og.imageSmoothingEnabled = false;
let purseAt = { x: 40, y: 50 }, purseTick = 0;
function measurePurse() { const w = $('#wingL'), p = $('#purse'); purseAt = { x: (w.offsetLeft + p.offsetLeft + 30) / 2, y: (w.offsetTop + p.offsetTop + p.offsetHeight / 2) / 2 }; }
function drawOverlay(dt) {
  og.clearRect(0, 0, ov.width, ov.height);
  if (!FLY.length) return;
  const fx0 = $('#field').offsetLeft / 2; let w = 0;
  for (const c of FLY) {
    c.t += dt; const p = clamp(c.t / c.T, 0, 1), e = p * p;
    const sx = fx0 + c.x, sy = c.y, mx = (sx + purseAt.x) / 2, my = Math.min(sy, purseAt.y) - 50;
    const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mx + e * e * purseAt.x, y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * my + e * e * purseAt.y;
    if (p >= 1) { if (clock - purseTick > 0.12) { purseTick = clock; const el = $('#purse'); el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } continue; }
    og.globalAlpha = 0.35; pr(og, x - 3, y - 1, 2, 2, '#f3c94a'); og.globalAlpha = 1;
    pr(og, x - 2, y - 2, 5, 5, '#3a2410'); pr(og, x - 1, y - 1, 3, 3, Math.floor(c.t * 14) % 2 ? '#f3c94a' : '#ffe28a'); pr(og, x, y - 1, 1, 1, '#fff6d0');
    FLY[w++] = c;
  }
  FLY.length = w;
}

// ───────────────────────── title scene ─────────────────────────
// A chain of relay beacons lights up along the ridges, one after another, until the fire reaches our 봉수대.
const tcv = $('#titleCv'), tg2 = tcv.getContext('2d'); tg2.imageSmoothingEnabled = false;
let titleBg = null, titleStars = [], titleRelay = [], TAMB = [];
const towerCv = document.createElement('canvas'); towerCv.width = 80; towerCv.height = 72; const towerG = towerCv.getContext('2d');
function paintTitle(W) {
  const c = document.createElement('canvas'); c.width = W; c.height = 360; const t = c.getContext('2d'), rnd = mulberry32(7);
  const sky = t.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#05060f'); sky.addColorStop(0.35, '#0f1230'); sky.addColorStop(0.58, '#2a1f45'); sky.addColorStop(0.75, '#5a2c40'); sky.addColorStop(0.9, '#8a4434'); sky.addColorStop(1, '#a5583a');
  t.fillStyle = sky; t.fillRect(0, 0, W, 360);
  for (let i = 0; i < 2600; i++) { const x = rnd() * W, y = rnd() * 300; t.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,220,200'},0.06)`; t.fillRect(x | 0, y | 0, 1, 1); }
  titleStars = Array.from({ length: 170 }, () => ({ x: rnd() * W, y: rnd() * 170, b: rnd(), ph: rnd() * 6 }));
  const ridge = (base, amp, col, f1, f2, ph) => { const hs = []; t.fillStyle = col; for (let x = 0; x < W; x++) { const h = base - amp * (0.55 + 0.45 * Math.sin(x * f1 + ph)) * (0.7 + 0.3 * Math.sin(x * f2 + ph * 2)); hs.push(h); t.fillRect(x, Math.round(h), 1, 360 - Math.round(h)); } return hs; };
  const mist = (y, a) => { const m = t.createLinearGradient(0, y - 14, 0, y + 14); m.addColorStop(0, 'rgba(180,160,200,0)'); m.addColorStop(0.5, `rgba(180,160,200,${a})`); m.addColorStop(1, 'rgba(180,160,200,0)'); t.fillStyle = m; t.fillRect(0, y - 14, W, 28); };
  const r1 = ridge(214, 74, '#2c2442', 0.011, 0.029, 1.2); mist(214, 0.1);
  const r2 = ridge(246, 62, '#1f1a33', 0.017, 0.043, 3.1); mist(250, 0.08);
  const r3 = ridge(286, 40, '#141124', 0.012, 0.061, 0.4);
  // relay beacons on peaks of the far ridges, from the left horizon toward the main tower
  titleRelay = [];
  const peaks = (hs, from, to, n) => { for (let k = 0; k < n; k++) { const a = from + (to - from) * (k + 0.5) / n, lo = Math.round(a - 26), hi = Math.round(a + 26); let bx = lo; for (let x = lo; x <= hi; x++) if (hs[x] < hs[bx]) bx = x; titleRelay.push({ x: bx, y: Math.round(hs[bx]), s: hs === r1 ? 1 : 2 }); } };
  peaks(r1, 30, W * 0.42, 4); peaks(r2, W * 0.45, W * 0.66, 2);
  for (const b of titleRelay) { pr(t, b.x - 1, b.y - 3 * b.s, 3, 3 * b.s, '#0c0a14'); }
  // foreground cliff for the main beacon, and pines
  const cx = Math.round(W * 0.8);
  t.fillStyle = '#0b0912';
  for (let x = 0; x < W; x++) { const d = Math.abs(x - cx), h = 262 + Math.max(0, d - 70) * 0.55 + Math.sin(x * 0.08) * 3; t.fillRect(x, Math.round(Math.min(h, 330)), 1, 360); }
  t.fillStyle = '#07060c'; t.fillRect(0, 330, W, 30);
  const pine = (x, y, s) => { t.fillStyle = '#06050a'; t.fillRect(x, y - 30 * s, 2 * s, 30 * s); for (let k = 0; k < 4; k++) { const yy = y - 30 * s + k * 7 * s, w = (6 + k * 5) * s; t.fillRect(x - w / 2 + s, yy, w, 4 * s); t.fillRect(x - w / 2 + 2 * s + k, yy - 2 * s, w - 4 * s, 2 * s); } };
  pine(18, 345, 1.6); pine(60, 352, 1.2); pine(W - 30, 350, 1.4);
  return c;
}
function renderTitle(dt) {
  const W = tcv.width;
  if (!titleBg || titleBg.width !== W) titleBg = paintTitle(W);
  tg2.setTransform(1, 0, 0, 1, 0, 0); tg2.drawImage(titleBg, 0, 0);
  for (const s of titleStars) { const a = 0.35 + 0.65 * Math.abs(Math.sin(clock * (0.6 + s.b) + s.ph)); tg2.globalAlpha = a * (0.4 + s.b * 0.6); pr(tg2, s.x, s.y, 1, 1, s.b > 0.85 ? '#fff2c0' : '#d8dcf0'); }
  tg2.globalAlpha = 1;
  // moon with a soft halo and drifting cloud bands
  const mx = Math.round(W * 0.6), my = 66;
  tg2.globalCompositeOperation = 'lighter';
  let gr = tg2.createRadialGradient(mx, my, 10, mx, my, 110); gr.addColorStop(0, 'rgba(255,236,200,0.22)'); gr.addColorStop(1, 'rgba(255,236,200,0)'); tg2.fillStyle = gr; tg2.fillRect(mx - 110, my - 110, 220, 220);
  tg2.globalCompositeOperation = 'source-over';
  pcirc(tg2, mx, my, 24, '#f1e8cf'); pcirc(tg2, mx - 7, my - 5, 5, '#ddd2b4'); pcirc(tg2, mx + 8, my + 7, 3, '#ddd2b4'); pcirc(tg2, mx + 4, my - 10, 2, '#ddd2b4');
  for (let k = 0; k < 3; k++) { const y = 54 + k * 22, x = ((clock * (4 + k * 2) + k * 260) % (W + 300)) - 150; tg2.globalAlpha = 0.5; pell(tg2, x, y, 90 - k * 16, 3, '#2a2240'); tg2.globalAlpha = 1; }
  // the relay: each beacon catches fire 0.6s after the one before it, then the main tower flares
  const cyc = clock % 9, glow = [];
  titleRelay.forEach((b, i) => {
    const on = cyc > 0.6 + i * 0.6 && cyc < 8.4; if (!on) return;
    const f = Math.floor(clock * 8 + i * 3) % 2, s = b.s;
    pr(tg2, b.x - s, b.y - 3 * s - 2 - f, 2 * s + 1, 2 + f, '#ee8a2c'); pr(tg2, b.x, b.y - 3 * s - 3 - f, 1, 1, '#fff2a8');
    glow.push({ x: b.x, y: b.y - 3 * s - 2, r: 10 + s * 5, a: 0.5 });
  });
  // main 봉수대, drawn at double size on its cliff
  const tx = Math.round(W * 0.8), ty = 262;
  towerG.setTransform(1, 0, 0, 1, 0, 0); towerG.clearRect(0, 0, 80, 72); towerG.translate(36 - CX, 64 - CY - 10); drawTower(towerG, clock, 1, 'field');
  const fires = towerFires(1);
  for (const f of fires) {
    const fx = tx + (f.x - CX) * 2, fy = ty + (f.y - CY - 10) * 2;
    if (Math.random() < dt * 9) TAMB.push({ k: 'ember', x: fx + rand(-3, 3), y: fy - 8, vx: rand(-6, 14), vy: rand(-46, -22), t: 0, life: rand(1.2, 2.6) });
    if (Math.random() < dt * 1.6) TAMB.push({ k: 'smoke', x: fx, y: fy - 12, vx: rand(5, 12), vy: rand(-16, -9), t: 0, life: rand(3, 5), r: rand(2, 3.5) });
  }
  let w = 0; for (const a of TAMB) { a.t += dt; if (a.k === 'ember') a.vx += Math.sin(clock * 3 + a.y * 0.1) * 24 * dt; else { a.r += dt * 3; a.vx += dt * 3; } a.x += a.vx * dt; a.y += a.vy * dt; if (a.t < a.life) TAMB[w++] = a; } TAMB.length = w;
  for (const a of TAMB) if (a.k === 'smoke') { tg2.globalAlpha = 0.22 * (1 - a.t / a.life); pcirc(tg2, a.x, a.y, a.r, '#7a7088'); }
  tg2.globalAlpha = 1;
  tg2.drawImage(towerCv, tx - 72, ty - 128, 160, 144);
  glow.push({ x: tx, y: ty - 86, r: 120 + Math.sin(clock * 9) * 6, a: 0.42 });
  tg2.globalCompositeOperation = 'lighter';
  for (const l of glow) { gr = tg2.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, `rgba(255,150,60,${l.a})`); gr.addColorStop(1, 'rgba(255,150,60,0)'); tg2.fillStyle = gr; tg2.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
  tg2.globalCompositeOperation = 'source-over';
  for (const a of TAMB) if (a.k === 'ember') { const p = a.t / a.life; pr(tg2, a.x, a.y, 1, 1, p < 0.3 ? '#fff2a8' : p < 0.7 ? '#f3a33a' : '#a8402a'); }
  // the horde marching in the dark below, only their eyes catching the light
  const kinds = ['grunt', 'bandit', 'wolf', 'guard', 'gangsi', 'runner', 'giant'];
  for (let i = 0; i < 9; i++) {
    const spr = SPRITES[kinds[i % kinds.length]], x = ((clock * (9 + (i % 3) * 2) + i * 97) % (W * 0.72)) - 30, y = 352 - (i % 3) * 5, fr = Math.floor(clock * 6 + i) % spr.frames.length;
    tg2.drawImage(spr.flip[fr], Math.round(x), y - spr.h); tg2.fillStyle = 'rgba(6,5,12,0.82)'; tg2.fillRect(Math.round(x), y - spr.h, spr.w, spr.h);
    for (const [ex, ey] of spr.eyes) pr(tg2, Math.round(x) + spr.w - spr.scale - ex, y - spr.h + ey, 1, 1, '#ff6a3a');
  }
  const vg = tg2.createRadialGradient(W * 0.55, 170, 120, W * 0.55, 170, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); tg2.fillStyle = vg; tg2.fillRect(0, 0, W, 360);
}

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now(), uiT = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
  if (mode === 'run' && R) {
    if (hitStop > 0) hitStop -= dt;
    else if (!paused && !R.gift && R.state === 'run') for (let i = 0; i < speed; i++) update(dt);
    else if (R.state !== 'run') ageFx(dt);
    render(dt); drawOverlay(dt);
    uiT -= dt; if (uiT <= 0) { uiT = 0.1; renderHud(); renderRes(); if (fpanel === 'meter') renderMeter(); }
  } else renderTitle(dt);
  requestAnimationFrame(frame);
}

// ───────────────────────── interface ─────────────────────────
const screenEl = $('#screen');
// The screen is 720 tall and between 1280 and 1600 wide: on a wide phone the two wings grow instead of leaving black bars.
let SW = 0;
// On a phone held upright the player is asked once; "가로로 보기" tries fullscreen + orientation lock and,
// where the browser refuses (iOS, embedded viewers), turns the whole stage 90° with CSS instead.
let rotateChoice = null; // null: not asked yet, 'land': show sideways, 'port': keep upright
const stageEl = $('#stage');
function fit() {
  const portrait = window.innerHeight > window.innerWidth, touch = (navigator.maxTouchPoints || 0) > 0;
  const turned = rotateChoice === 'land' && portrait;
  stageEl.style.cssText = turned ? `inset:auto;left:0;top:0;width:${window.innerHeight}px;height:${window.innerWidth}px;transform-origin:0 0;transform:translateX(${window.innerWidth}px) rotate(90deg)` : '';
  const vw = turned ? window.innerHeight : window.innerWidth, vh = turned ? window.innerWidth : window.innerHeight, w = 2 * Math.round(clamp(720 * vw / Math.max(1, vh), 1280, 1600) / 2);
  if (w !== SW) {
    SW = w; screenEl.style.width = SW + 'px'; screenEl.style.setProperty('--wing', (SW - 800) / 2 + 'px'); screenEl.classList.toggle('wide', SW >= 1440);
    ov.width = SW / 2; og.imageSmoothingEnabled = false; ov.style.width = SW + 'px'; ov.style.height = '720px';
    tcv.width = SW / 2; tg2.imageSmoothingEnabled = false;
    requestAnimationFrame(measurePurse);
  }
  const k = Math.min(vw / SW, vh / 720);
  if ('zoom' in screenEl.style && CSS.supports('zoom', '1')) screenEl.style.zoom = k;
  else { screenEl.style.transform = `scale(${k})`; screenEl.style.transformOrigin = '0 0'; screenEl.style.position = 'absolute'; screenEl.style.left = (vw - SW * k) / 2 + 'px'; screenEl.style.top = (vh - 720 * k) / 2 + 'px'; }
  $('#rotate').hidden = !(touch && portrait && Math.min(window.innerWidth, window.innerHeight) < 900 && rotateChoice === null);
}
async function goLandscape() {
  rotateChoice = 'land';
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (e) { /* refused: the CSS turn in fit() takes over */ }
  fit(); setTimeout(fit, 300);
}
window.addEventListener('resize', fit);
if (screen.orientation) screen.orientation.addEventListener('change', () => setTimeout(fit, 50));
// Element box in screen layout pixels, walked through offsets so zoom and the sideways turn don't skew it.
const rectIn = el => { let x = 0, y = 0, n = el; while (n && n !== screenEl) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };

let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }
function banner(title, sub, tone = '', stamp = '') {
  const b = $('#banner'); b.className = 'banner ' + tone; b.innerHTML = '';
  const h = document.createElement('div'); h.className = 'b-title'; h.textContent = title; b.append(h);
  if (stamp) { const st = document.createElement('div'); st.className = 'stamp'; st.textContent = stamp; b.append(st); }
  if (sub) { const s = document.createElement('div'); s.className = 'b-sub'; s.textContent = sub; b.append(s); }
  b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(banner.tm); banner.tm = setTimeout(() => { b.hidden = true; }, 2300);
}
function bumpField() { const f = $('#field'); f.classList.remove('bump'); void f.offsetWidth; f.classList.add('bump'); }
function celebrateSets(before, S) {
  if (!before || !R || mode !== 'run') return;
  let hit = null;
  for (const t of TYPE_IDS) if (S.typeStep[t] > before.typeStep[t]) { hit = [`${TYPES[t].set} ${S.typeStep[t]}단계`, `${TYPES[t].name} 피해 +${pct(TYPE_SET_DMG[S.typeStep[t] - 1])}`, TYPES[t].color]; break; }
  if (!hit) for (const e of ELEM_IDS) if (S.elemStep[e] > before.elemStep[e]) { hit = [`${ELEMS[e].set} ${S.elemStep[e]}단계`, ELEM_SET_TEXT[e][S.elemStep[e] - 1], ELEMS[e].color]; break; }
  if (!hit) return;
  banner(hit[0], `세트 완성 · ${hit[1]}`, 'set', '결속'); Sfx.play('gift');
  R.fx.push({ k: 'ring', x: CX, y: CY - 14, r: 70, t: 0, life: 0.7, c: hit[2], big: true });
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; R.fx.push({ k: 'p', x: CX + Math.cos(a) * 10, y: CY - 20 + Math.sin(a) * 6, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50 - 30, t: 0, life: 0.7, c: i % 2 ? hit[2] : '#fff2a8' }); }
}
function flashGold() { const el = $('#goldVal'); el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); }

function armorChip(a, next) { return a ? `<span class="seal${next ? ' next' : ''}" style="--sc:${ARMORS[a].color}">${ARMORS[a].name}</span>` : '-'; }
let hudKey = '';
function renderHud(force) {
  if (!R) return;
  const enemies = R.enemies.filter(e => e.hp > 0 && !e.d.treasure).length;
  const cur = R.final ? R.enemies.find(e => e.d.final)?.armor : R.armorSeq[Math.max(1, R.round)], next = R.final ? null : R.armorSeq[Math.max(1, R.round) + (R.round === 0 ? 0 : 1)];
  const time = R.final ? '결전' : `${Math.ceil(R.t)}초`;
  $('#fuse i').style.width = (R.final ? 100 : clamp(R.t / (R.round === 0 ? PREP_TIME : ROUND_TIME), 0, 1) * 100).toFixed(1) + '%';
  const key = [R.round, time, enemies, cur, next, R.smites, speed, paused].join('|');
  if (!force && key === hudKey) return; hudKey = key;
  $('#hRound').innerHTML = R.final ? '<b class="boss">최종 결전</b>' : R.round === 0 ? '출정 준비' : `제 <b>${R.round}</b> 라운드 <small class="dim">/ ${ROUNDS}</small>`;
  $('#hDiff').textContent = `${R.diff.name}${R.ranked ? ' · 랭킹전' : ''}`;
  $('#hTime').textContent = time; $('#hEnemy').textContent = enemies;
  $('#hArmor').innerHTML = R.final ? `흑룡 비늘 ${armorChip(cur)}` : `${R.round === 0 ? '첫 주력' : '이번 주력'} ${armorChip(cur)}${R.round === 0 ? '' : ` <span>다음</span> ${armorChip(next, true)}`}`;
  $('#bSmite').innerHTML = `<b>천벌</b> <span>${R.smites}</span>회 <small>[Z]</small>`; $('#bSmite').disabled = R.smites <= 0;
  $('#bSpeed').textContent = `×${speed}`; $('#bPause').textContent = paused ? '▶' : 'Ⅱ';
  const boss = R.enemies.find(e => e.boss && e.hp > 0), bb = $('#bossBar');
  if (boss) { bb.hidden = false; $('#bossName').textContent = `${boss.d.name} · ${ARMORS[boss.armor].name}`; $('#bossFill').style.width = (boss.hp / boss.max * 100).toFixed(1) + '%'; } else bb.hidden = true;
}
function renderRes() {
  if (!R) return; const S = R.S;
  $('#goldVal').textContent = fmt(R.gold); $('#incomeVal').textContent = `+${(S.income).toFixed(1).replace('.0', '')}냥/초`;
  $('#hpVal').textContent = `${fmt(R.hp)} / ${fmt(S.maxHp)}`; $('#regenVal').textContent = `+${S.regen}/초`;
  const lit = litStacks(clamp(R.hp / S.maxHp, 0, 1));
  if (lit !== renderRes.lit) { renderRes.lit = lit; $('#flames').innerHTML = [0, 1, 2, 3, 4].map(i => `<i style="background-image:url(${i < lit ? FLAME_ON : FLAME_OFF})"></i>`).join(''); }
  $('#hpFill').style.width = (R.hp / S.maxHp * 100).toFixed(1) + '%';
  $('#shFill').style.width = (S.shield ? Math.min(100, R.shieldNow / S.maxHp * 100) : 0).toFixed(1) + '%';
  $('#defVal').innerHTML = `<span title="보호막">◈ ${fmt(R.shieldNow)}</span><span title="받는 피해 감소">방어 ${pct(S.dr)}</span><span title="가시 반사">가시 ${fmt(S.thorn * (1 + S.thornPow) * (1 + 0.1 * (Math.min(Math.max(1, R.round), ROUNDS) - 1)))}</span>${R.halfOff ? '<span class="gold">반값 흥정</span>' : ''}`;
  const rr = $('#reroll'), free = R.freeRerolls > 0, c = rerollCost();
  rr.innerHTML = `새로고침 [R] <span class="${free ? 'free' : R.gold >= c ? 'gold' : 'bad'}">${free ? `무료 ${R.freeRerolls}회` : `${fmt(c)}냥`}</span>`;
  for (const card of $$('#shop .card')) { const s = R.shop[+card.dataset.slot]; if (!s || s.sold) continue; const p = Math.round(priceOf(s.id) * (R.halfOff ? 0.5 : 1)); card.classList.toggle('poor', R.gold < p); }
  $('#invCount').textContent = `${slotsUsed()} / ${INV_MAX}칸`;
}
function itemTag(d) {
  if (d.cat === 'weapon') return `<span style="color:${TYPES[d.type].color}">${TYPES[d.type].name}</span>${d.elem ? ` · <span style="color:${ELEMS[d.elem].color}">${ELEMS[d.elem].name}</span>` : ''}`;
  if (d.type) return `<span style="color:${TYPES[d.type].color}">${TYPES[d.type].name}</span> · 강화`;
  if (d.elem) return `<span style="color:${ELEMS[d.elem].color}">${ELEMS[d.elem].name}</span> · ${CATS[d.cat]}`;
  return CATS[d.cat];
}
const iconFor = d => iconUrl(d.icon || 'up', d.type ? TYPES[d.type].color : d.cat === 'eco' ? '#f3c94a' : d.cat === 'surv' ? '#e5534b' : '#c9ced8', d.elem ? ELEMS[d.elem].color : '#fff');
function renderShop() {
  const box = $('#shop'); box.innerHTML = '';
  R.shop.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'card'; b.dataset.slot = i; b.dataset.act = 'buy';
    if (s.sold) { b.classList.add('sold'); b.disabled = true; b.innerHTML = `<span class="soldmark">팔림</span><span class="key">${i + 1}</span>`; box.append(b); return; }
    const d = ITEM[s.id], price = Math.round(priceOf(s.id) * (R.halfOff ? 0.5 : 1));
    b.style.setProperty('--tier', TIERS[d.tier].color);
    b.innerHTML = `<img class="ico" alt="" src="${iconFor(d)}"><span class="nm">${d.name}</span><span class="sub"><span class="pr">${fmt(price)}냥</span><span class="tg">${itemTag(d)}</span></span>${owned(s.id) ? `<span class="own">×${owned(s.id)}→${owned(s.id) + 1}</span>` : ''}<span class="key">${i + 1}</span>`;
    b.dataset.item = s.id; box.append(b);
  });
  renderRes();
}
let invFilter = 'all', selected = null;
const INV_TABS = [['all', '전체'], ['blade', '창검'], ['arrow', '궁시'], ['charm', '부적'], ['cannon', '화포'], ['chaos', '요술'], ['thorn', '가시'], ['etc', '기타']];
function renderInv() {
  const tabs = $('#invTabs');
  tabs.innerHTML = INV_TABS.map(([k, n]) => { const c = R.items.filter(it => invMatch(ITEM[it.id], k)).length; return `<button data-act="inv" data-id="${k}" class="${k === invFilter ? 'on' : ''}">${n}${k !== 'all' && c ? `<sup>${c}</sup>` : ''}</button>`; }).join('');
  const grid = $('#inv'); grid.innerHTML = '';
  const groups = new Map();
  for (const it of R.items) if (invMatch(ITEM[it.id], invFilter)) { if (!groups.has(it.id)) groups.set(it.id, []); groups.get(it.id).push(it); }
  const list = [...groups.values()];
  for (let i = 0; i < INV_MAX; i++) {
    const cell = document.createElement('div'); cell.className = 'slot';
    const grp = list[i];
    if (grp) {
      const it = grp[grp.length - 1], d = ITEM[it.id];
      cell.classList.add('full'); cell.style.setProperty('--tier', TIERS[d.tier].color); cell.dataset.act = 'item'; cell.dataset.uid = it.uid; cell.dataset.item = it.id; cell.tabIndex = 0;
      if (selected === it.id) cell.classList.add('sel');
      cell.innerHTML = `<img alt="${d.name}" src="${iconFor(d)}">${grp.length > 1 ? `<b class="cnt">×${grp.length}</b>` : ''}`;
    }
    grid.append(cell);
  }
  renderRes();
}
// Bag slot tooltip with a sell button; a stack sells one copy at a time and stays open.
function openItemTip(id) {
  const grp = R.items.filter(x => x.id === id); if (!grp.length) return;
  const it = grp[grp.length - 1], n = grp.length; selected = id; renderInv();
  const cell = $(`#inv .slot[data-item="${id}"]`) || $('#invCount');
  showTip(cell, ITEM[id], `${n > 1 ? `<p class="gold">보유 ×${n} · 한 개씩 되팝니다</p>` : ''}<div class="actions"><button class="btn danger" data-act="sell" data-id="${it.uid}">되팔기 +${fmt(priceOf(id) * (BASE.sellRate + perkL('sell') * 0.1))}냥</button><button class="btn" data-act="untip">닫기</button></div>`);
}
function invMatch(d, k) { if (k === 'all') return true; if (k === 'thorn') return d.cat === 'thorn'; if (k === 'etc') return d.cat !== 'weapon' && d.cat !== 'thorn'; return d.cat === 'weapon' && d.type === k; }

// tooltip
const tip = $('#tip');
function itemStats(d) {
  const S = R ? R.S : null, out = [];
  if (d.cat === 'weapon') {
    out.push(`피해 <b>${d.dmg}</b>${d.shots ? ` × ${d.shots}발` : ''} · ${d.cd}초마다 · 사거리 ${d.range}`);
    if (TYPES[d.type].strong) out.push(`<span style="color:${ARMORS[TYPES[d.type].strong].color}">${ARMORS[TYPES[d.type].strong].name}</span>에 2배`); else out.push('모든 적에게 0.5~2배 무작위');
    const ex = []; if (d.splash) ex.push(`폭발 ${d.splash}`); if (d.pierce) ex.push(`관통 ${d.pierce}`); if (d.bounce) ex.push(`튕김 ${d.bounce}`); if (d.multi) ex.push(`동시 ${d.multi}명`); if (d.chain) ex.push(`연쇄 ${d.chain}`); if (d.elem) ex.push(`<span style="color:${ELEMS[d.elem].color}">${ELEMS[d.elem].name}</span>`); if (d.elem2) ex.push(`<span style="color:${ELEMS[d.elem2].color}">${ELEMS[d.elem2].name}</span>`);
    if (ex.length) out.push(ex.join(' · '));
    if (S) { const real = d.dmg * (1 + S.dmg + S.typeDmg[d.type]); out.push(`<span class="dim">지금 강화 적용 시 ${fmt(real)}</span>`); }
  }
  return out;
}
function showTip(el, d, extra = '') {
  const tier = TIERS[d.tier];
  tip.innerHTML = `<div class="t-h"><img src="${iconFor(d)}" alt=""><div><div class="t-nm" style="color:${tier.color}">${d.name}</div><div class="t-tg">${tier.name} · ${itemTag(d)}</div></div></div>${itemStats(d).map(s => `<p>${s}</p>`).join('')}<p class="t-d">${d.desc || ''}</p>${extra}`;
  tip.style.setProperty('--tt', tier.color); tip.hidden = false;
  const r = rectIn(el);
  let x = r.x, y = r.y; const tw = 330, th = tip.offsetHeight;
  x = x - tw - 10; if (x < 8) x = r.x + r.w + 10; x = Math.min(x, SW - tw - 8); y = clamp(y, 8, 720 - th - 8);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip() { tip.hidden = true; }
let lastPointer = 'mouse', armedSlot = -1;
document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; Sfx.ensure(); }, true);
document.addEventListener('pointerover', e => {
  if (lastPointer !== 'mouse' && e.pointerType !== 'mouse') return;
  const el = e.target.closest('[data-item]'); if (!el || !R) return;
  // A bag item opened by click keeps its sell tooltip; hover tips wait until it is closed.
  if (selected !== null || (!tip.hidden && tip.querySelector('[data-act="sell"]'))) return;
  const d = ITEM[el.dataset.item]; showTip(el, d, el.dataset.uid ? `<p class="hint">눌러서 되팔기</p>` : `<p class="hint">눌러서 구매 · 숫자키 ${+el.dataset.slot + 1}</p>`);
});
document.addEventListener('pointerout', e => { const el = e.target.closest('[data-item]'); if (el && !el.contains(e.relatedTarget) && selected === null) hideTip(); });

// field side panels (세트 / 딜미터 / 상성)
let fpanel = null;
function toggleFPanel(kind) {
  fpanel = fpanel === kind ? null : kind; const el = $('#fpanel');
  for (const b of $$('[data-act="fp"]')) b.classList.toggle('on', b.dataset.id === fpanel);
  if (!fpanel) { el.hidden = true; return; }
  el.hidden = false; if (fpanel === 'set') renderSets(); else if (fpanel === 'meter') renderMeter(); else renderMatch();
}
function renderSets() {
  const S = R.S; let h = '<h3>세트 효과 <span class="dim">[B]</span></h3><p class="dim small" style="margin:0 0 8px">서로 다른 물건만 셉니다. 같은 물건을 겹쳐 사도 세트 단계는 오르지 않습니다.</p><div class="sets">';
  for (const t of TYPE_IDS) { const n = S.typeCount[t] || 0, st = S.typeStep[t]; h += `<div class="set ${st ? 'on' : ''}"><b style="color:${TYPES[t].color}">${TYPES[t].set}</b> <span class="dim">서로 다른 ${TYPES[t].name} ${n}종</span><div class="steps">${TYPE_SET_STEPS.map((x, i) => `<span class="${n >= x ? 'lit' : ''}">${x}: +${pct(TYPE_SET_DMG[i])}</span>`).join('')}</div><div class="dim small">${TYPE_SET_PERK[t]}</div></div>`; }
  for (const e of ELEM_IDS) { const n = S.elemCount[e] || 0, st = S.elemStep[e]; h += `<div class="set ${st ? 'on' : ''}"><b style="color:${ELEMS[e].color}">${ELEMS[e].set}</b> <span class="dim">서로 다른 ${ELEMS[e].name} 물건 ${n}종</span><div class="steps">${ELEM_SET_STEPS.map((x, i) => `<span class="${n >= x ? 'lit' : ''}">${x}: ${ELEM_SET_TEXT[e][i]}</span>`).join('')}</div></div>`; }
  $('#fpanel').innerHTML = h + '</div>';
}
function renderMeter() {
  const byId = new Map();
  for (const w of R.weapons) { const r = byId.get(w.id) || { n: ITEM[w.id].name, k: 0, d: 0, dps: 0, c: TYPES[ITEM[w.id].type].color }; r.k++; r.d += w.dealt; r.dps += w.dealt / Math.max(1, R.time - w.since); byId.set(w.id, r); }
  const rows = [...byId.values()].map(r => (r.k > 1 ? Object.assign(r, { n: `${r.n} ×${r.k}` }) : r));
  if (R.thornDealt > 0) rows.push({ n: '가시·천벌', d: R.thornDealt, dps: R.thornDealt / Math.max(1, R.time), c: '#c9ced8' });
  rows.sort((a, b) => b.d - a.d); const top = rows[0] ? rows[0].d : 1;
  $('#fpanel').innerHTML = `<h3>딜미터 <span class="dim">[D]</span></h3>` + (rows.length ? rows.slice(0, 12).map(r => `<div class="mrow"><span class="mn" style="color:${r.c}">${r.n}</span><span class="mbar"><i style="width:${(r.d / top * 100).toFixed(1)}%;background:${r.c}"></i></span><span class="mv">${shortNum(r.d)}<small> · ${shortNum(r.dps)}/초</small></span></div>`).join('') : '<p class="dim">아직 무기가 없습니다</p>');
}
function renderMatch() {
  $('#fpanel').innerHTML = `<h3>상성표 <span class="dim">[H]</span></h3><table class="mt"><tr><th></th>${ARMOR_IDS.map(a => `<th style="color:${ARMORS[a].color}">${ARMORS[a].name}</th>`).join('')}</tr>` +
    TYPE_IDS.map(t => `<tr><th style="color:${TYPES[t].color}">${TYPES[t].name}</th>${ARMOR_IDS.map(a => t === 'chaos' ? '<td class="dim">0.5~2</td>' : `<td class="${TYPES[t].strong === a ? 'x2' : 'dim'}">${TYPES[t].strong === a ? '2배' : '1배'}</td>`).join('')}</tr>`).join('') +
    `</table><p class="dim small">${ARMOR_IDS.map(a => `${ARMORS[a].name}: ${ARMORS[a].note}`).join(' · ')}</p><p class="dim small">노란 숫자는 상성이 맞은 피해, 빨간 숫자는 치명타입니다.</p>`;
}

// modal
function openModal(html, cls = '') { const m = $('#modal'); $('#modalCard').className = 'mcard paper ' + cls; $('#modalCard').innerHTML = html; m.hidden = false; const f = $('#modalCard [data-focus]') || $('#modalCard button'); if (f) f.focus(); }
function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; }
function showGift() {
  openModal(`<div class="eyebrow gold">보물 도깨비를 잡았습니다</div><h2>복주머니를 하나 고르세요</h2><div class="gifts">${R.gift.map((g, i) => `<button class="gift" data-act="gift" data-id="${i}"><img alt="" src="${iconUrl(GIFT_ICON[g.id] || 'sack')}"><b>${g.name}</b><span>${g.desc(Math.min(R.round, ROUNDS))}</span><span class="key">${i + 1}</span></button>`).join('')}</div>`, 'wide');
}
function setPaused(v) {
  if (!R || R.state !== 'run' || R.gift) return; paused = v;
  if (paused) openModal(`<div class="eyebrow">${R.diff.name}${R.ranked ? ' · 랭킹전' : ''} · ${R.round} 라운드</div><h2>잠시 멈춤</h2><p class="dim">메뉴로 나가면 여기까지 버틴 라운드만큼 기억 조각을 받습니다.${R.ranked ? ' 랭킹전 기록도 이대로 남습니다.' : ''}</p><div class="actions"><button class="btn" data-act="quit">포기하고 나가기</button>${R.ranked ? '' : '<button class="btn" data-act="restart">처음부터 [N]</button>'}<button class="btn primary" data-act="resume" data-focus>계속 [Space]</button></div>`);
  else closeModal();
  renderHud(true);
}
function showResult(res) {
  lastRes = res;
  const won = R.state === 'won', d = R.diff, cleared = roundsCleared(), canOnline = R.ranked && Cloud.online && !Cloud.api, autoOnline = R.ranked && Cloud.api && !!Cloud.acct && !!res.rec;
  openModal(`<div class="eyebrow ${won ? 'gold' : 'bad'}">${d.name}${R.ranked ? ` · 주간 랭킹전 ${weekId()}` : ''}</div><h2>${won ? '봉화를 끝까지 지켰습니다' : R.round === 0 ? '출정 전에 물러났습니다' : `${R.round} 라운드에서 봉화가 꺼졌습니다`}</h2>
    <dl class="facts"><dt>버틴 라운드</dt><dd>${cleared} / ${ROUNDS}${won ? ' + 흑룡' : ''}</dd><dt>처치</dt><dd>${fmt(R.kills)}</dd><dt>시간</dt><dd>${Math.floor(R.time / 60)}분 ${Math.floor(R.time % 60)}초</dd><dt>기억 조각</dt><dd class="gold">+${res.shards}</dd>${res.rec ? `<dt>랭킹 점수</dt><dd class="gold big">${fmt(res.rec.score)}</dd>` : ''}</dl>
    ${won && d.id === 'hard' && P.wins.hard === 1 ? '<p class="gold">악몽 I이 열렸습니다</p>' : ''}${won && d.id === 'nm1' && P.wins.nm1 === 1 ? '<p class="gold">악몽 II가 열렸습니다</p>' : ''}${won && d.id === 'nm2' && P.wins.nm2 === 1 ? '<p class="gold">악몽 III이 열렸습니다</p>' : ''}
    ${canOnline ? `<div class="submit"><input id="nickIn" maxlength="12" placeholder="닉네임" aria-label="닉네임" autocomplete="off"><button class="btn primary" data-act="submit">온라인 랭킹 등록</button></div><p class="dim small" id="submitNote">이 기기 기록에는 자동으로 남겼습니다. 온라인에는 한 사람당 이번 주 최고 기록 하나가 올라갑니다.</p>` : autoOnline ? `<p class="small" id="submitNote">명예의 전당에 <b>${Cloud.acct.id}</b>(으)로 올리는 중입니다…</p>` : R.ranked ? `<p class="dim small">이 기기 랭킹에 기록했습니다.${Cloud.api ? ' 로그인하면 명예의 전당에 올라갑니다.' : ''}</p>` : ''}
    ${R.round > 0 ? '<button class="btn share-btn" data-act="share">기록 공유 · 자랑하기</button>' : ''}
    <div class="actions"><button class="btn" data-act="menu">메뉴로</button>${R.ranked ? '<button class="btn" data-act="hall">명예의 전당</button>' : '<button class="btn" data-act="perks">수호 기억</button>'}${R.ranked ? (triesLeft() > 0 ? '<button class="btn primary" data-act="rankStart" data-focus>다시 도전</button>' : '') : `<button class="btn primary" data-act="again" data-focus>다시 하기</button>`}</div>`, won ? 'win' : 'lose');
  const ni = $('#nickIn'); if (ni) ni.value = P.nick;
  if (autoOnline && !res.sent) { res.sent = true; autoSubmit(res.rec); }
}
// ───────────────────────── 기록 공유 카드 ─────────────────────────
// After a run, the result can be shared as a 1080×1350 picture: the night ridge and the 봉수대 as it stood at the end
// (its lit fires = remaining health), a hanji scroll with the record, the three weapons that dealt the most, and the link.
const SITE_URL = 'https://bhdefence.github.io/';
let lastRes = null, shareBlob = null, shareUrl = '';
function runSummary() {
  const won = R.state === 'won', byId = new Map();
  for (const w of R.weapons) byId.set(w.id, (byId.get(w.id) || 0) + w.dealt);
  const total = [...byId.values()].reduce((a, b) => a + b, 0) || 1;
  const top = [...byId].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, d]) => ({ id, share: d / total, n: R.items.filter(i => i.id === id).length }));
  const sets = TYPE_IDS.filter(t => R.S.typeStep[t]).map(t => `${TYPES[t].set} ${R.S.typeStep[t]}단계`).concat(ELEM_IDS.filter(e => R.S.elemStep[e]).map(e => `${ELEMS[e].set} ${R.S.elemStep[e]}단계`));
  return { won, round: R.round, cleared: roundsCleared(), diff: R.diff.name, ranked: R.ranked, kills: R.kills, time: R.time, hp: won ? clamp(R.hp / R.S.maxHp, 0, 1) : 0, score: lastRes && lastRes.rec ? lastRes.rec.score : null, top, sets, who: Cloud.acct ? Cloud.acct.id : P.nick || '' };
}
function shareText(s) {
  const what = s.won ? `${s.diff} 난이도에서 흑룡까지 쓰러뜨리고 봉화를 지켰다!` : s.round === 0 ? '봉화대 사수에 출정했다' : `${s.diff} 난이도 ${s.round}라운드까지 봉화를 지켰다`;
  return `봉화대 사수 · ${what}${s.score ? ` (랭킹 ${fmt(s.score)}점)` : ''}\n너도 지켜 봐: ${SITE_URL}`;
}
async function paintShareCard(s) {
  // Web fonts arrive in per-character slices, so ask for exactly the characters this card uses.
  const brushText = '봉화대 사수 흑룡 토벌! 0123456789 라운드', serifText = '다섯 홰의 불이 꺼지기 전에 봉화를 끝까지 지켰다 봉수';
  try { await Promise.all([document.fonts.load('130px "East Sea Dokdo"', brushText), document.fonts.load('40px "Song Myung"', serifText), document.fonts.load('30px Galmuri11')]); } catch (e) { /* fall back to whatever is loaded */ }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  // night ridge and the beacon, painted at 1/4 size then scaled up for crisp pixels
  const sky = paintTitle(270); x.drawImage(sky, 0, 0, 270, 338, 0, 0, W, H);
  const t = document.createElement('canvas'); t.width = 80; t.height = 72; const tg = t.getContext('2d');
  tg.translate(36 - CX, 64 - CY - 10); drawTower(tg, 0.4, s.hp, 'field');
  const glow = (gx, gy, r, a) => { const gr = x.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, `rgba(255,150,60,${a})`); gr.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = gr; x.fillRect(gx - r, gy - r, r * 2, r * 2); };
  x.globalCompositeOperation = 'lighter'; glow(800, 360, 300, s.hp > 0 ? 0.45 : 0.12); x.globalCompositeOperation = 'source-over';
  x.drawImage(t, 800 - 144, 610 - 256, 320, 288);
  for (let i = 0; i < 60; i++) { const ex = 700 + Math.random() * 220, ey = 120 + Math.random() * 260; x.fillStyle = i % 3 ? '#f3a33a' : '#fff2a8'; x.fillRect(ex | 0, ey | 0, 4, 4); }
  // title
  x.textBaseline = 'alphabetic'; x.shadowColor = 'rgba(255,150,60,.5)'; x.shadowBlur = 24;
  x.fillStyle = '#f7ecd2'; x.font = '150px "East Sea Dokdo", Galmuri11'; x.fillText('봉화대 사수', 64, 200);
  x.shadowBlur = 0; x.fillStyle = '#f0c560'; x.font = '34px "Song Myung", serif'; x.fillText('다섯 홰의 불이 꺼지기 전에', 70, 262);
  // hanji scroll
  const px0 = 54, py0 = 640, pw = W - 108, ph = 630;
  const pg = x.createRadialGradient(W / 2, py0 + 200, 50, W / 2, py0 + 300, 700); pg.addColorStop(0, '#f4ead2'); pg.addColorStop(0.6, '#efe4c9'); pg.addColorStop(1, '#ddcba3');
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px0 + 10, py0 + 16, pw, ph);
  x.fillStyle = pg; x.fillRect(px0, py0, pw, ph);
  for (const ry of [py0 - 10, py0 + ph - 8]) { const rg = x.createLinearGradient(0, ry, 0, ry + 20); rg.addColorStop(0, '#2a180d'); rg.addColorStop(0.45, '#b07a48'); rg.addColorStop(1, '#2a180d'); x.fillStyle = rg; x.fillRect(px0 - 16, ry, pw + 32, 20); }
  const L = px0 + 50;
  x.fillStyle = '#6d5a45'; x.font = '30px Galmuri11'; x.fillText(`${s.diff}${s.ranked ? ` · 주간 랭킹전 ${weekId()}` : ''}`, L, py0 + 70);
  x.fillStyle = s.won ? '#a8321f' : '#241a13'; x.font = '120px "East Sea Dokdo", Galmuri11';
  const head = s.won ? '흑룡 토벌!' : `${s.round} 라운드`, hw = x.measureText(head).width;
  x.fillText(head, L, py0 + 190);
  x.fillStyle = '#5b4a39'; x.font = '36px "Song Myung", serif';
  x.fillText(s.won ? '봉화를 끝까지 지켰다' : '까지 봉화를 지켰다', L + hw + 22, py0 + 186);
  // stats row
  const stats = [['버틴 라운드', `${s.cleared} / ${ROUNDS}`], ['처치', fmt(s.kills)], ['시간', `${Math.floor(s.time / 60)}분 ${Math.floor(s.time % 60)}초`]].concat(s.score ? [['랭킹 점수', fmt(s.score)]] : []);
  const cw = (pw - 100) / stats.length;
  stats.forEach(([k, v], i) => { const sx = L + i * cw; x.fillStyle = '#8a7458'; x.font = '26px Galmuri11'; x.fillText(k, sx, py0 + 305); x.fillStyle = k === '랭킹 점수' ? '#a8321f' : '#241a13'; x.font = '42px Galmuri11'; x.fillText(v, sx, py0 + 355); });
  x.fillStyle = '#c8b38a'; x.fillRect(L, py0 + 385, pw - 100, 2);
  // main weapons
  x.fillStyle = '#6d5a45'; x.font = '28px Galmuri11'; x.fillText('주력 무기', L, py0 + 432);
  if (!s.top.length) { x.fillStyle = '#8a7458'; x.fillText('무기 없이 버텼다', L, py0 + 490); }
  s.top.forEach((w, i) => {
    const d = ITEM[w.id], ix = L + i * ((pw - 100) / 3), iy = py0 + 452;
    x.fillStyle = '#1a110c'; x.fillRect(ix, iy, 84, 84);
    x.drawImage(bakeMap(ICONS[d.icon] || ICONS.up, { a: TYPES[d.type].color, z: d.elem ? ELEMS[d.elem].color : '#fff' }, 6), ix + 6, iy + 6);
    x.fillStyle = '#241a13'; x.font = '30px Galmuri11'; x.fillText(d.name + (w.n > 1 ? ` ×${w.n}` : ''), ix + 98, iy + 36);
    x.fillStyle = '#8a7458'; x.font = '24px Galmuri11'; x.fillText(`${TYPES[d.type].name} · 피해 ${Math.round(w.share * 100)}%`, ix + 98, iy + 72);
  });
  if (s.sets.length) { x.fillStyle = '#5b4a39'; x.font = '26px Galmuri11'; x.fillText('세트  ' + s.sets.slice(0, 3).join(' · '), L, py0 + 585); }
  // footer: who, when, where, seal
  const day = kstNow().toISOString().slice(0, 10).replace(/-/g, '.');
  x.fillStyle = 'rgba(239,228,201,.85)'; x.font = '30px Galmuri11';
  x.fillText(`${s.who ? s.who + ' · ' : ''}${day}`, 64, H - 34);
  x.textAlign = 'right'; x.fillStyle = '#f0c560'; x.fillText('bhdefence.github.io', W - 150, H - 34); x.textAlign = 'left';
  x.save(); x.translate(W - 92, H - 92); x.rotate(0.12); x.fillStyle = '#b8321f'; x.fillRect(-40, -52, 80, 104); x.strokeStyle = 'rgba(255,235,210,.4)'; x.lineWidth = 4; x.strokeRect(-34, -46, 68, 92);
  x.fillStyle = '#fff0de'; x.font = '38px "Song Myung", serif'; x.textAlign = 'center'; x.fillText('봉', 0, -6); x.fillText('수', 0, 38); x.restore();
  return c;
}
async function openShare() {
  if (!R) return;
  const s = runSummary();
  openModal('<h2>기록 공유</h2><p class="dim">기록 그림을 만드는 중입니다…</p>', 'share');
  const cv = await paintShareCard(s);
  shareBlob = await new Promise(r => cv.toBlob(r, 'image/png'));
  if (shareUrl) URL.revokeObjectURL(shareUrl);
  shareUrl = URL.createObjectURL(shareBlob);
  const canFile = !!(navigator.canShare && navigator.canShare({ files: [new File([shareBlob], 'bonghwa.png', { type: 'image/png' })] }));
  openModal(`<h2>기록 공유</h2><img class="share-img" src="${shareUrl}" alt="내 기록 그림"><div class="actions">${canFile ? '<button class="btn primary" data-act="share-send" data-focus>카톡·앱으로 보내기</button>' : ''}<a class="btn${canFile ? '' : ' primary'}" href="${shareUrl}" download="봉화대사수-기록.png">이미지 저장</a><button class="btn" data-act="share-copy">자랑 글 복사</button></div><p class="dim small" id="shareNote">이미지를 저장해 카톡이나 커뮤니티에 올리고, 자랑 글을 함께 붙여 넣으세요.</p><div class="actions"><button class="btn" data-act="share-back">← 결과로</button></div>`, 'share');
}
async function shareSend() {
  const s = runSummary(), note = $('#shareNote');
  try { await navigator.share({ files: [new File([shareBlob], '봉화대사수-기록.png', { type: 'image/png' })], text: shareText(s), title: '봉화대 사수' }); }
  catch (e) { if (note && e && e.name !== 'AbortError') note.textContent = '보내기를 열지 못했습니다. 이미지 저장 후 직접 올려 주세요.'; }
}
async function shareCopy(btn) {
  const t = shareText(runSummary()), note = $('#shareNote');
  try { await navigator.clipboard.writeText(t); btn.textContent = '복사됨 ✓'; }
  catch (e) { if (note) note.textContent = t; }
}

// Signed-in players' ranked runs go to the Hall of Fame on their own, under their account id.
async function autoSubmit(rec) {
  rec.nick = Cloud.acct.id; persist();
  const r = await Cloud.submit(rec), note = $('#submitNote'); if (!note) return;
  note.textContent = r.ok ? (r.kept ? `이번 주에 더 높은 기록(${fmt(r.prev)}점)이 이미 올라가 있어 그 기록을 둡니다.` : '명예의 전당에 올렸습니다 ✓') : (r.message || '올리지 못했습니다. 이 기기 기록에는 남겼습니다.');
}
async function submitRank() {
  const ni = $('#nickIn'), note = $('#submitNote'), btn = $('#modalCard [data-act="submit"]'), nick = cleanNick(ni && ni.value);
  if (!nick) { note.textContent = '랭킹에 올릴 닉네임을 적어 주세요.'; ni && ni.focus(); return; }
  P.nick = nick; const rec = P.records.find(r => r.at === lastRecAt); if (rec) rec.nick = nick; persist();
  btn.disabled = true; note.textContent = '등록하는 중입니다…';
  const res = await Cloud.submit(Object.assign({}, rec, { nick }));
  if (res.ok) note.textContent = res.kept ? `이번 주에 더 높은 기록(${fmt(res.prev)}점)이 이미 올라가 있어 그 기록을 둡니다.` : '온라인 랭킹에 올렸습니다.';
  else { note.textContent = res.reason === 'denied' ? '이 화면에서는 기록을 올릴 권한이 없습니다.' : '등록하지 못했습니다. 잠시 뒤 다시 눌러 주세요.'; btn.disabled = false; }
}
let lastRecAt = 0;

// ───────────────────────── menu screens ─────────────────────────
let menuView = 'title', selDiff = 'normal', hallView = 'online';
function showMenu(view = 'title') {
  mode = 'menu'; menuView = view; paused = false; closeModal(); hideTip(); $('#menu').hidden = false; $('#banner').hidden = true;
  const m = $('#menuBody');
  if (view === 'title') {
    const wins = DIFFS.filter(d => P.wins[d.id]).map(d => d.name);
    m.innerHTML = `${Cloud.api ? `<button class="acct-btn${Cloud.acct ? ' in' : ''}" data-act="acct">${Cloud.acct ? `${Cloud.acct.id} ✓` : '게스트 · 로그인'}</button>` : ''}<div class="title-wrap"><div class="logo"><h1>봉화대 사수</h1><span class="seal-big">봉수</span><span class="logo-sub">다섯 홰의 불이 꺼지기 전에</span></div>
      <nav class="mnav">
        <button class="mbtn main" data-act="go-select" data-focus>출정하기</button>
        <button class="mbtn" data-act="go-rank">주간 랭킹전 <span class="badge">${triesLeft()}/${RANK_TRIES}</span></button>
        <button class="mbtn" data-act="perks">수호 기억 <span class="badge gold">${fmt(P.shards)}</span></button>
        <button class="mbtn" data-act="hall">명예의 전당</button>
        <button class="mbtn" data-act="settings">설정</button>
      </nav></div>
      <aside class="corner paper"><div><span class="dim">기억 조각</span> <b class="gold">${fmt(P.shards)}</b></div><div><span class="dim">이긴 난이도</span> ${wins.length ? wins.join(' · ') : '아직 없음'}</div><div><span class="dim">플레이</span> ${fmt(P.runs)}판</div></aside>
      <div class="visits" id="visits">${visitHtml()}</div>
      <footer class="credit"><a href="about.html">게임 소개</a> · <a href="privacy.html">개인정보처리방침</a> · 글꼴 Galmuri (SIL OFL 1.1)</footer>`;
  } else if (view === 'select') renderSelect();
  else if (view === 'perks') renderPerks();
  else if (view === 'hall') renderHall();
  else if (view === 'rank') renderRankMenu();
  else if (view === 'settings') renderSettings();
  const f = $('#menuBody [data-focus]') || $('#menuBody button'); if (f) f.focus({ preventScroll: true });
}
function panelHead(title) { return `<header class="phead"><h2>${title}</h2><button class="btn" data-act="go-title">닫기 [Esc]</button></header>`; }
// Menu pages are hanging scrolls: hanji paper between two wooden rollers.
const scrollOpen = (cls = '') => `<div class="roll top ${cls}"></div><div class="roll bot ${cls}"></div><div class="panel paper ${cls}">`;
function renderSelect() {
  const d = DIFF[selDiff], boss = '흑룡', best = P.best[d.id] || 0;
  $('#menuBody').innerHTML = `${scrollOpen()}${panelHead('난이도 선택')}<div class="sel-grid"><div class="dlist">${DIFFS.map(x => { const ok = unlocked(x); return `<button class="drow ${x.id === selDiff ? 'on' : ''} ${ok ? '' : 'locked'}" data-act="diff" data-id="${x.id}" ${ok ? '' : 'disabled'}><b>${ok ? x.name : '🔒 ' + x.name}</b><span>${P.wins[x.id] ? `승리 ${P.wins[x.id]}회` : P.best[x.id] ? `최고 ${P.best[x.id] > ROUNDS ? '승리' : P.best[x.id] + '라운드'}` : ok ? '도전 기록 없음' : `${DIFF[x.req].name} 승리 시 열림`}</span></button>`; }).join('')}</div>
    <div class="dview"><canvas id="prevCv" width="300" height="96"></canvas><div class="dname"><b>${d.name}</b><span>${best ? (best > ROUNDS ? '승리 기록 있음' : `최고 ${best} 라운드`) : '아직 도전 기록 없음'}</span></div>
      <ul class="rules">${d.note.map(n => `<li>${n}</li>`).join('')}<li>적 체력 ×${d.hp} · 수 ×${d.count} · 보스 체력 ×${d.boss}</li><li>40라운드를 버티면 최종 보스 ${boss}가 깨어납니다</li></ul>
      <p class="reward">보상 · 버틴 라운드마다 기억 조각 ${d.mem} · 승리 시 +${Math.round(25 * d.mem)}</p>
      <button class="btn primary big" data-act="start" data-focus>▶ 시작 [Enter]</button></div></div></div>`;
  drawPreview(d);
}
// A lit slice of the difficulty's battlefield: the beacon in the middle, the final boss lurking at the edge.
function drawPreview(d) {
  const c = $('#prevCv'); if (!c) return; const p = c.getContext('2d'), T = THEMES[d.theme], f = bg(d.theme); p.imageSmoothingEnabled = false;
  p.setTransform(1, 0, 0, 1, 0, 0); p.translate(150 - CX, 56 - CY);
  p.drawImage(f.cv, 0, 0); drawTower(p, clock, 1, d.theme);
  const foes = [['grunt', CX - 112, CY + 30], ['wolf', CX - 86, CY + 36], ['bandit', CX + 76, CY + 28], ['guard', CX + 100, CY + 20]];
  for (const [k, x, y] of foes) { const sp = SPRITES[k]; p.drawImage(x > CX ? sp.frames[0] : sp.flip[0], x - sp.w / 2, y - sp.h); }
  const dr = SPRITES.dragon; p.drawImage(dr.frames[0], CX + 118, CY + 40 - dr.h);
  const L = f.lights.concat([{ x: CX, y: CY - 28, r: 160, i: 1, c: '255,150,60', ca: 0.22 }, ...TORCHES.map(([x, y]) => ({ x, y: y - 11, r: 30, i: 0.8, c: '255,170,90', ca: 0.16 }))]);
  darkPass(p, FW, FH, T.amb, Math.min(0.8, T.dark + 0.08), T.edge, L, CX, CY);
  for (const [k, x, y] of foes.concat([['dragon', CX + 118 + dr.w / 2, CY + 40]])) { const sp = SPRITES[k], ox = x - sp.w / 2, oy = y - sp.h; for (const [ex, ey] of sp.eyes) pr(p, x > CX ? ox + ex : ox + sp.w - sp.scale - ex, oy + ey, sp.scale, sp.scale, k === 'dragon' ? '#ff4a3a' : '#ff8a4a'); }
}
function renderPerks() {
  $('#menuBody').innerHTML = `${scrollOpen()}${panelHead('수호 기억')}<p class="lead">판을 마칠 때마다 버틴 라운드만큼 <b class="gold">기억 조각</b>이 쌓입니다. 조각으로 봉화대를 영구히 키우세요. 지금 <b class="gold">${fmt(P.shards)}</b>개.</p>
    <div class="perks">${PERKS.map(p => { const l = perkL(p.id), max = l >= p.max, cost = p.base * (l + 1); return `<div class="perk"><div class="ph"><b>${p.name}</b><span class="lv">${l} / ${p.max}</span></div><div class="pips">${Array.from({ length: p.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div><p>${l ? p.desc(l) : '아직 배우지 않음'}</p>${max ? '<p class="gold">다 배웠습니다</p>' : `<p class="dim">다음: ${p.desc(l + 1)}</p><button class="btn primary" data-act="perk" data-id="${p.id}" ${P.shards < cost ? 'disabled' : ''}>조각 ${cost}개로 배우기</button>`}</div>`; }).join('')}</div></div>`;
}
function buyPerk(id) {
  const p = PERK[id], l = perkL(id), cost = p.base * (l + 1); if (l >= p.max || P.shards < cost) return;
  P.shards -= cost; P.perks[id] = l + 1; persist(); Sfx.play('buy'); renderPerks();
  const b = $(`[data-act="perk"][data-id="${id}"]`); if (b) b.focus();
}
function renderRankMenu() {
  const wk = weekId(), left = triesLeft(), mine = P.records.filter(r => r.week === wk)[0];
  $('#menuBody').innerHTML = `${scrollOpen()}${panelHead('주간 랭킹전')}<div class="rank-grid"><div class="rank-info">
    <div class="eyebrow gold">${wk} 주차</div><h3>모두가 같은 상점과 같은 적 순서로 겨룹니다</h3>
    <ul class="rules"><li>난이도는 <b>보통</b>으로 고정됩니다</li><li>한 주 동안 상점 물건과 적이 나오는 순서가 모두에게 같습니다</li><li>하루 ${RANK_TRIES}번 도전할 수 있습니다 (한국 시간 자정에 다시 채워짐)</li><li>점수 = 버틴 라운드 × 1,000 + 처치 × 3, 승리하면 +30,000과 남은 체력 보너스</li><li>수호 기억으로 키운 능력도 그대로 적용됩니다</li></ul>
    <p>오늘 남은 도전 <b class="gold">${left} / ${RANK_TRIES}</b>${mine ? ` · 이번 주 내 최고 <b class="gold">${fmt(mine.score)}</b>점` : ''}</p>
    ${Cloud.api ? (Cloud.acct ? `<p class="field-row">참가 아이디 <b class="gold">${Cloud.acct.id}</b></p>` : '<p class="field-row">주간 랭킹전은 로그인해야 참가할 수 있습니다. 명예의 전당에는 아이디가 올라갑니다.</p>') : '<label class="field-row">닉네임 <input id="nickMenu" maxlength="12" placeholder="랭킹에 표시할 이름" autocomplete="off"></label>'}
    ${Cloud.api && !Cloud.acct ? '<button class="btn primary big" data-act="acct" data-id="login" data-focus>로그인 · 회원가입</button>' : `<button class="btn primary big" data-act="rankStart" ${left ? '' : 'disabled'} data-focus>${left ? '▶ 랭킹전 출전' : '오늘 도전을 모두 썼습니다'}</button>`}</div>
    <div class="rank-board">${boardHtml(wk)}</div></div></div>`;
  Cloud.refreshBoard(wk);
  const ni = $('#nickMenu'); if (ni) ni.value = P.nick; if (ni) ni.addEventListener('change', () => { P.nick = cleanNick(ni.value); ni.value = P.nick; persist(); });
  fillBoard(wk);
}
function boardHtml(wk) {
  const online = hallView === 'online' && Cloud.online;
  return `<div class="board-h"><h3>${wk} 순위</h3><div class="seg">${Cloud.online ? `<button class="${online ? 'on' : ''}" data-act="hallView" data-id="online">온라인</button>` : ''}<button class="${online ? '' : 'on'}" data-act="hallView" data-id="local">이 기기</button></div></div><p class="dim small" id="boardNote"></p><div class="tbl"><table class="rank"><thead><tr><th>순위</th><th>이름</th><th class="r">점수</th><th class="r">도달</th><th class="r">처치</th></tr></thead><tbody id="boardBody"></tbody></table></div>`;
}
function fillBoard(wk) {
  const body = $('#boardBody'); if (!body) return;
  const online = hallView === 'online' && Cloud.online, rows = online ? Cloud.board.filter(r => r.week === wk) : P.records.filter(r => r.week === wk);
  $('#boardNote').textContent = online ? (Cloud.boardErr ? '온라인 순위를 불러오지 못했습니다.' : Cloud.boardLoaded ? `한 사람당 이번 주 최고 기록 하나가 올라갑니다 · 참가 ${fmt(Cloud.boardCount)}명` : '불러오는 중입니다…') : (Cloud.online ? '이 기기에서 세운 이번 주 기록입니다.' : '온라인 랭킹 저장소에 연결되지 않은 화면이라 이 기기 기록만 보여 줍니다.');
  body.textContent = '';
  if (!rows.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.className = 'empty'; td.textContent = online && !Cloud.boardLoaded ? '…' : '아직 기록이 없습니다'; tr.append(td); body.append(tr); return; }
  rows.slice(0, 50).forEach((r, i) => {
    const tr = document.createElement('tr'); if (online && Cloud.uid && r.id === Cloud.uid) tr.className = 'me';
    [[String(i + 1), 'rk'], [r.nick || '무명', 'nick'], [fmt(r.score), 'r'], [r.win ? '승리' : `${r.round}R`, 'r'], [fmt(r.kills), 'r']].forEach(([t, c]) => { const td = document.createElement('td'); td.textContent = t; td.className = c; tr.append(td); });
    body.append(tr);
  });
}
function renderHall() {
  const wk = weekId();
  $('#menuBody').innerHTML = `${scrollOpen()}${panelHead('명예의 전당')}<div class="rank-grid"><div class="rank-board">${boardHtml(wk)}</div>
    <div class="rank-info"><h3>난이도별 내 기록</h3><table class="rank"><thead><tr><th>난이도</th><th class="r">최고</th><th class="r">승리</th></tr></thead><tbody>${DIFFS.map(d => `<tr><td>${d.name}</td><td class="r">${P.best[d.id] ? (P.best[d.id] > ROUNDS ? '흑룡 토벌' : P.best[d.id] + ' 라운드') : '-'}</td><td class="r">${P.wins[d.id] || 0}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  fillBoard(wk); Cloud.refreshBoard(wk);
}
let resetArmed = 0;
function renderSettings() {
  $('#menuBody').innerHTML = `${scrollOpen('narrow')}${panelHead('설정')}<div class="settings"><button class="btn" data-act="sound">소리 ${P.sound ? '켬' : '끔'}</button>
    <h3>조작</h3><table class="keys"><tr><td>1 ~ 8</td><td>상점 칸 구매 (휴대폰은 두 번 눌러 구매)</td></tr><tr><td>R</td><td>상점 새로고침</td></tr><tr><td>Z</td><td>천벌: 화면의 적을 한꺼번에 쓸어냅니다 (보스는 일부 피해)</td></tr><tr><td>B · D · G · H</td><td>세트 · 딜미터 · 사거리 · 상성표</td></tr><tr><td>Tab</td><td>배속 ×1 ×2 ×3</td></tr><tr><td>Space · Esc</td><td>잠시 멈춤</td></tr></table>
    <h3>진행</h3><p class="dim">진행은 이 브라우저${Cloud.uid ? '와 계정 저장소' : ''}에 저장됩니다.${Cloud.api ? (Cloud.acct ? ` (계정: ${Cloud.acct.id})` : ' 로그인하면 다른 기기에서도 이어서 할 수 있습니다.') : ''}</p><button class="btn danger" data-act="reset">모든 진행 지우기</button></div></div>`;
}
function startRun(diffId, ranked) {
  if (ranked) { if (triesLeft() <= 0) return; if (P.ranked.day !== dayId()) P.ranked = { day: dayId(), used: 0 }; P.ranked.used++; persist(); }
  closeModal(); newRun(diffId, ranked); mode = 'run'; paused = false; speed = 1; fpanel = null; invFilter = 'all'; selected = null; hideTip();
  $('#menu').hidden = true; $('#fpanel').hidden = true; for (const b of $$('[data-act="fp"]')) b.classList.remove('on');
  renderShop(); renderInv(); renderHud(true); Sfx.ensure();
  banner(R.ranked ? `주간 랭킹전 ${weekId()}` : R.diff.name, `${PREP_TIME}초 뒤 첫 라운드 · 장터에서 무기를 사세요`);
  if (!P.tutorial) showTutorial();
}
function showTutorial() {
  paused = true;
  openModal(`<div class="eyebrow gold">처음 오셨군요</div><h2>봉화대를 지키는 법</h2><ul class="rules">
    <li>적은 사방의 어둠에서 봉수대로 몰려옵니다. 봉수대의 <b>다섯 홰</b>는 체력이라, 체력이 20% 줄 때마다 불 하나가 꺼집니다</li>
    <li>왼쪽 <b>장터</b>에서 무기를 사면 봉수대가 저절로 쏩니다. 엽전은 초당 수입과 처치 현상금으로 모입니다</li>
    <li>무기 종류마다 강한 갑옷이 있습니다. 위쪽 <b>이번 주력 / 다음 주력</b>을 보고 맞는 무기를 고르세요 (H 상성표)</li>
    <li>같은 종류나 속성의 <b>서로 다른</b> 물건을 모으면 <b>세트 효과</b>가 붙습니다 (B)</li>
    <li>위기에는 <b>천벌</b>(Z)로 화면의 적을 쓸어내세요. 한 판에 한 번입니다</li></ul>
    <div class="actions"><button class="btn primary" data-act="tutDone" data-focus>알겠습니다</button></div>`);
}

// ───────────────────────── input ─────────────────────────
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'buy': {
      const slot = +el.dataset.slot;
      if (lastPointer !== 'mouse' && armedSlot !== slot) { armedSlot = slot; for (const c of $$('#shop .card')) c.classList.toggle('armed', +c.dataset.slot === slot); const d = R.shop[slot] && ITEM[R.shop[slot].id]; if (d) showTip(el, d, '<p class="hint">한 번 더 누르면 삽니다</p>'); return; }
      armedSlot = -1; hideTip(); buy(slot); break;
    }
    case 'item': {
      const it = R.items.find(x => x.uid === +el.dataset.uid); if (!it) return;
      if (selected === it.id) { selected = null; hideTip(); renderInv(); return; }
      openItemTip(it.id); break;
    }
    case 'sell': { const it = R.items.find(x => x.uid === +id); if (!it) break; sellItem(+id); if (owned(it.id)) openItemTip(it.id); break; }
    case 'untip': selected = null; hideTip(); renderInv(); break;
    case 'inv': invFilter = id; renderInv(); break;
    case 'reroll': reroll(); break;
    case 'smite': smite(); break;
    case 'fp': toggleFPanel(id); break;
    case 'range': R.showRange = !R.showRange; el.classList.toggle('on', R.showRange); break;
    case 'speed': speed = speed % 3 + 1; renderHud(true); break;
    case 'pause': setPaused(!paused); break;
    case 'resume': setPaused(false); break;
    case 'restart': closeModal(); startRun(R.diff.id, false); break;
    case 'quit': closeModal(); paused = false; if (R.state === 'run') { R.state = 'lost'; const res = finishRun(); showResult(res); } break;
    case 'again': startRun(R.diff.id, false); break;
    case 'share': openShare(); break;
    case 'share-send': shareSend(); break;
    case 'share-copy': shareCopy(el); break;
    case 'share-back': if (lastRes) showResult(lastRes); break;
    case 'menu': showMenu('title'); break;
    case 'gift': takeGift(+id); break;
    case 'tutDone': P.tutorial = true; persist(); paused = false; closeModal(); break;
    case 'submit': submitRank(); break;
    case 'go-title': showMenu('title'); break;
    case 'go-select': showMenu('select'); break;
    case 'go-rank': showMenu('rank'); break;
    case 'perks': showMenu('perks'); break;
    case 'hall': showMenu('hall'); break;
    case 'settings': showMenu('settings'); break;
    case 'diff': selDiff = id; renderSelect(); $(`[data-act="diff"][data-id="${id}"]`)?.focus(); break;
    case 'start': if (unlocked(DIFF[selDiff])) startRun(selDiff, false); break;
    case 'rankStart': if (Cloud.api && !Cloud.acct) { showAccount('login', '주간 랭킹전은 로그인해야 참가할 수 있습니다.'); break; } if (triesLeft() > 0) startRun('normal', true); break;
    case 'acct': showAccount(id); break;
    case 'acct-done': closeModal(); if (mode === 'menu') showMenu(menuView); break;
    case 'acct-logout': Cloud.logout().then(() => { closeModal(); toast('로그아웃했습니다. 게스트로 계속합니다'); if (mode === 'menu') showMenu(menuView); }); break;
    case 'acct-copy': { const t = $('#accCodeOut').textContent; const ok = () => { el.textContent = '복사됨 ✓'; }; if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, () => { const r = document.createRange(); r.selectNodeContents($('#accCodeOut')); getSelection().removeAllRanges(); getSelection().addRange(r); }); break; }
    case 'perk': buyPerk(id); break;
    case 'hallView': hallView = id; if (menuView === 'rank') renderRankMenu(); else renderHall(); break;
    case 'sound': P.sound = !P.sound; persist(); renderSettings(); break;
    case 'reset': if (Date.now() - resetArmed > 4000) { resetArmed = Date.now(); el.textContent = '한 번 더 누르면 모두 지워집니다'; } else { resetArmed = 0; const keep = { sound: P.sound, nick: P.nick }; P = Object.assign(newProfile(), keep); persist(); toast('모든 진행을 지웠습니다'); renderSettings(); } break;
    case 'rotate-skip': rotateChoice = 'port'; fit(); break;
    case 'rotate-go': goLandscape(); break;
  }
});
window.addEventListener('keydown', ev => {
  if (ev.target.closest && ev.target.closest('input')) return;
  const k = ev.code;
  if (mode === 'menu') {
    if (k === 'Escape' && menuView !== 'title') { showMenu('title'); ev.preventDefault(); }
    else if (k === 'Enter' && menuView === 'select') { if (unlocked(DIFF[selDiff])) startRun(selDiff, false); ev.preventDefault(); }
    else if ((k === 'ArrowUp' || k === 'ArrowDown') && menuView === 'select') { const ok = DIFFS.filter(unlocked), i = ok.findIndex(d => d.id === selDiff); selDiff = ok[(i + (k === 'ArrowUp' ? -1 : 1) + ok.length) % ok.length].id; renderSelect(); ev.preventDefault(); }
    return;
  }
  if (!R) return;
  if (R.gift) { if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') takeGift(+k.slice(5) - 1); return; }
  if (R.state !== 'run') return;
  if (!$('#modal').hidden && !paused) return;
  if (k === 'Space' || k === 'Escape') { if (!P.tutorial) return; setPaused(!paused); ev.preventDefault(); return; }
  if (paused) { if (k === 'KeyN' && !R.ranked) { closeModal(); startRun(R.diff.id, false); } return; }
  if (/^Digit[1-8]$/.test(k)) { buy(+k.slice(5) - 1); ev.preventDefault(); }
  else if (/^Numpad[1-8]$/.test(k)) { buy(+k.slice(6) - 1); ev.preventDefault(); }
  else if (k === 'KeyR') reroll();
  else if (k === 'KeyZ') smite();
  else if (k === 'KeyB') toggleFPanel('set');
  else if (k === 'KeyD') toggleFPanel('meter');
  else if (k === 'KeyH') toggleFPanel('match');
  else if (k === 'KeyG') { R.showRange = !R.showRange; $('#bRange').classList.toggle('on', R.showRange); }
  else if (k === 'Tab') { speed = speed % 3 + 1; renderHud(true); ev.preventDefault(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'run' && R && R.state === 'run' && !paused && !R.gift && P.tutorial) setPaused(true); });

// ───────────────────────── accounts, shared ranking & cloud save ─────────────────────────
// Two backends. Inside the claude.ai artifact viewer `window.claude.use` reaches a shared store (`rank/<viewer id>`,
// `data/users/<id>/save`) and the viewer is already signed in. Everywhere else (GitHub Pages) the game talks to the
// bonghwa-api Cloudflare Worker: players sign up with an English id and password, play as guests otherwise, and only
// signed-in players appear in the Hall of Fame.
const API_BASE = (() => { try { return localStorage.getItem('bonghwa-api') || 'https://bonghwa-api.kkjlg.workers.dev'; } catch (e) { return 'https://bonghwa-api.kkjlg.workers.dev'; } })();
const AUTH_KEY = 'bonghwa-auth';
const ID_RULES = [['영문 소문자로 시작', v => /^[a-z]/.test(v)], ['영문 소문자·숫자·_ 만', v => v !== '' && /^[a-z0-9_]+$/.test(v)], ['4~16자', v => v.length >= 4 && v.length <= 16]];
const PW_RULES = [['8~64자', v => v.length >= 8 && v.length <= 64], ['한글 불가', v => v !== '' && !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(v)], ['영문·숫자·특수문자 가능', v => v !== '' && /^[\x21-\x7e]+$/.test(v)]];
const Cloud = {
  mode: null, db: null, uid: null, acct: null, board: [], boardCount: 0, boardLoaded: false, boardErr: false, timer: 0, chain: Promise.resolve(), unsub: null, lastSync: 0,
  get online() { return !!this.mode; },
  get api() { return this.mode === 'api'; },
  async init() {
    if (window.claude && typeof window.claude.use === 'function') return this.initArtifact();
    this.mode = 'api';
    try { const a = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); if (a && a.id && a.token) { this.acct = a; this.uid = a.id; } } catch (e) { /* storage unavailable */ }
    this.countVisit();
    if (this.acct) { const me = await this.call('GET', '/me'); if (me.ok) await this.pullSave(); }
    if (mode === 'menu') showMenu(menuView);
  },
  async initArtifact() {
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db) return;
      this.mode = 'artifact'; this.db = db; this.uid = user ? await user.id() : null;
      this.watch();
      if (this.uid) {
        const snap = await db.doc(`data/users/${this.uid}/save`).get(), remote = snap.exists ? sanitizeProfile((snap.data() || {}).save) : null;
        if (remote && remote.savedAt > P.savedAt) { if (mode === 'menu') { adoptProfile(remote); toast('계정에 저장된 기록을 불러왔습니다'); } }
        else if (P.savedAt > 0) this.queue();
      }
      if (mode === 'menu') showMenu(menuView);
    } catch (e) { console.warn('cloud unavailable', e); }
  },
  // ── account server ──
  async call(method, path, body) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.acct) headers.Authorization = 'Bearer ' + this.acct.token;
      const r = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && j.error === 'auth' && this.acct) { this.setAcct(null); toast('로그인이 풀렸습니다. 다시 로그인해 주세요'); }
      return Object.assign({ ok: r.ok, status: r.status }, j);
    } catch (e) { return { ok: false, status: 0, message: '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.' }; }
  },
  setAcct(a) {
    this.acct = a; this.uid = a ? a.id : null;
    try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* storage unavailable */ }
  },
  async signedIn(res) {
    this.setAcct({ id: res.id, token: res.token });
    if (!P.nick) P.nick = res.id;
    await this.pullSave();
  },
  async pullSave() {
    const s = await this.call('GET', '/save');
    if (!s.ok) return;
    const remote = s.data ? sanitizeProfile(s.data) : null;
    if (remote && remote.savedAt > P.savedAt) { if (mode === 'menu') { adoptProfile(remote); toast('계정에 저장된 기록을 불러왔습니다'); } this.lastSync = s.at; }
    else if (P.savedAt > 0) this.flush(); else this.lastSync = s.at;
  },
  visits: null,
  async countVisit() {
    let sent = ''; try { sent = localStorage.getItem('bonghwa-visit') || ''; } catch (e) { /* storage unavailable */ }
    const fresh = sent !== dayId(), r = await this.call(fresh ? 'POST' : 'GET', '/visit');
    if (!r.ok) return;
    if (fresh) try { localStorage.setItem('bonghwa-visit', dayId()); } catch (e) { /* storage unavailable */ }
    this.visits = { total: r.total, today: r.today };
    const el = $('#visits'); if (el) el.innerHTML = visitHtml();
  },
  async logout() { if (this.api && this.acct) this.call('POST', '/logout'); this.setAcct(null); },
  // ── shared ──
  watch() {
    const wk = weekId(); this.week = wk;
    if (this.unsub) this.unsub();
    this.unsub = this.db.collection('rank').where('week', '==', wk).orderBy('score', 'desc').limit(50).onSnapshot(snap => {
      this.board = snap.docs.map(d => cleanRec(d.id, d.data())).filter(Boolean); this.boardCount = this.board.length; this.boardLoaded = true; this.boardErr = false;
      if (mode === 'menu' && (menuView === 'rank' || menuView === 'hall')) fillBoard(wk);
    }, () => { this.boardErr = true; if (mode === 'menu') fillBoard(wk); });
  },
  async refreshBoard(wk) {
    if (!this.api) return;
    const r = await this.call('GET', '/rank?week=' + encodeURIComponent(wk));
    if (r.ok) { this.board = (r.rows || []).map(x => cleanRec(x.id, Object.assign({}, x, { week: r.week, nick: x.id }))).filter(Boolean); this.boardCount = r.count || this.board.length; this.boardLoaded = true; this.boardErr = false; }
    else this.boardErr = true;
    if (mode === 'menu' && (menuView === 'rank' || menuView === 'hall')) fillBoard(wk);
  },
  queue() { if (!this.uid) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1500); },
  flush() {
    if (this.api) { this.chain = this.chain.then(() => this.call('PUT', '/save', { data: JSON.parse(JSON.stringify(P)) })).then(r => { if (r && r.ok) this.lastSync = r.at; }); return; }
    const body = { save: JSON.parse(JSON.stringify(P)), at: Date.now() }, ref = this.db.doc(`data/users/${this.uid}/save`); this.chain = this.chain.then(() => ref.set(body)).catch(e => console.warn('cloud save failed', e));
  },
  async submit(rec) {
    if (!this.uid || !rec) return { ok: false, reason: 'offline' };
    if (this.api) {
      const r = await this.call('POST', '/rank', { week: rec.week, score: rec.score, round: rec.round, win: !!rec.win, kills: rec.kills });
      return r.ok ? { ok: true, kept: !!r.kept, prev: r.prev } : { ok: false, reason: r.status === 401 ? 'auth' : 'error', message: r.message };
    }
    try {
      const ref = this.db.collection('rank').doc(this.uid), cur = await ref.get(), d = cur.exists ? cur.data() || {} : {};
      const prev = d.week === rec.week ? Math.floor(num(d.score)) : -1;
      if (prev >= rec.score) return { ok: true, kept: true, prev };
      await ref.set({ week: rec.week, score: rec.score, round: rec.round, win: !!rec.win, kills: rec.kills, nick: rec.nick, at: rec.at || Date.now() });
      return { ok: true };
    } catch (e) { return { ok: false, reason: e && e.code === 'invalid_argument' ? 'denied' : 'error' }; }
  },
};
const visitHtml = () => (Cloud.visits ? `누적 방문 <b>${fmt(Cloud.visits.total)}</b> · 오늘 <b>${fmt(Cloud.visits.today)}</b>` : '');
function adoptProfile(remote) { P = remote; try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* storage unavailable */ } }

// ── account window: 로그인 · 회원가입 · 비밀번호 재설정 ──
let acctBusy = false;
const ruleList = (rules, v, cls) => `<ul class="hints ${cls}">${rules.map(([t, f]) => `<li class="${f(v) ? 'ok' : ''}">${t}</li>`).join('')}</ul>`;
function showAccount(view, msg = '') {
  if (!Cloud.api) return;
  view = view || (Cloud.acct ? 'me' : 'login');
  const tabs = view === 'login' || view === 'signup' ? `<div class="acc-tabs"><button class="${view === 'login' ? 'on' : ''}" data-act="acct" data-id="login">로그인</button><button class="${view === 'signup' ? 'on' : ''}" data-act="acct" data-id="signup">회원가입</button></div>` : '';
  const err = `<p class="acc-msg" id="accErr" role="alert">${msg}</p>`, guest = '<p class="dim small">로그인하지 않아도 게스트로 계속 플레이할 수 있습니다 (지금처럼 이 브라우저에 저장). 주간 랭킹전과 명예의 전당은 로그인해야 참가합니다.</p>';
  const field = (id, label, type, extra = '') => `<label class="acc-field"><span>${label}</span><input id="${id}" type="${type}" ${extra} autocomplete="off" autocapitalize="none" spellcheck="false"></label>`;
  let h = '';
  if (view === 'login') h = `<form id="accForm" data-kind="login" novalidate>${field('accId', '아이디', 'text', 'maxlength="16" autocomplete="username"')}${field('accPw', '비밀번호', 'password', 'maxlength="64" autocomplete="current-password"')}${err}<button class="btn primary" type="submit">로그인</button></form><button class="linkish" data-act="acct" data-id="reset">비밀번호를 잊었어요 (복구코드로 재설정)</button>${guest}`;
  else if (view === 'signup') h = `<form id="accForm" data-kind="signup" novalidate>${field('accId', '아이디', 'text', 'maxlength="16" placeholder="예: hero_01"')}${ruleList(ID_RULES, '', 'id')}${field('accPw', '비밀번호', 'password', 'maxlength="64"')}${ruleList(PW_RULES, '', 'pw')}${field('accPw2', '비밀번호 확인', 'password', 'maxlength="64"')}<ul class="hints pw2"><li>비밀번호 일치</li></ul><p class="dim small">가입하면 게임 기록 저장을 위해 아이디와 게임 기록을 서버에 보관하는 데 동의하는 것으로 봅니다. 이메일 등 다른 개인정보는 받지 않습니다.</p>${err}<button class="btn primary" type="submit">가입하기</button></form>${guest}`;
  else if (view === 'reset') h = `<form id="accForm" data-kind="reset" novalidate>${field('accId', '아이디', 'text', 'maxlength="16"')}${field('accCode', '복구코드', 'text', 'maxlength="14" placeholder="XXXX-XXXX-XXXX"')}${field('accPw', '새 비밀번호', 'password', 'maxlength="64"')}${ruleList(PW_RULES, '', 'pw')}${field('accPw2', '새 비밀번호 확인', 'password', 'maxlength="64"')}<ul class="hints pw2"><li>비밀번호 일치</li></ul>${err}<button class="btn primary" type="submit">재설정</button></form><button class="linkish" data-act="acct" data-id="login">← 로그인으로</button><p class="dim small">복구코드를 5번 틀리면 30분간 잠깁니다.</p>`;
  else if (view === 'code') h = `<p>가입했습니다. <b>${Cloud.acct.id}</b> 로 로그인되었습니다.</p><p>아래 <b>복구코드</b>는 비밀번호를 잊었을 때 필요합니다. <b>지금 한 번만</b> 보여 드리니 꼭 적어 두거나 캡처해 두세요.</p><div class="code-box"><code id="accCodeOut">${msg}</code><button class="btn" data-act="acct-copy">복사</button></div><div class="actions"><button class="btn primary" data-act="acct-done" data-focus>적어 두었습니다</button></div>`;
  else if (view === 'me') {
    const ago = Cloud.lastSync ? Math.max(0, Math.round((Date.now() - Cloud.lastSync) / 60e3)) : null;
    h = `<p class="acc-me"><b>${Cloud.acct.id}</b> 로 로그인됨</p><p class="good">✓ 서버에 저장됨${ago === null ? '' : ` · 마지막 저장 ${ago ? ago + '분 전' : '방금 전'}`}</p>${msg ? `<p class="good">${msg}</p>` : ''}<div class="actions"><button class="btn primary" data-act="acct-done" data-focus>확인</button></div><p class="dim small">기록은 자동으로 서버에 저장됩니다. 다른 기기에서 같은 아이디로 로그인하면 이어서 할 수 있어요.</p><div class="acc-links"><button class="linkish" data-act="acct" data-id="delete">회원 탈퇴</button><button class="linkish" data-act="acct-logout">로그아웃</button></div>`;
  } else if (view === 'delete') {
    h = `<p><b>${Cloud.acct.id}</b> 계정을 지웁니다. 서버에 저장된 진행과 명예의 전당 기록도 함께 지워지며 되돌릴 수 없습니다. 이 브라우저의 진행은 게스트로 남습니다.</p><form id="accForm" data-kind="delete" novalidate>${field('accPw', '비밀번호 확인', 'password', 'maxlength="64" autocomplete="current-password"')}${err}<button class="btn danger" type="submit">계정 지우기</button></form><button class="linkish" data-act="acct" data-id="me">← 돌아가기</button>`;
  }
  openModal(`<button class="mclose" data-act="acct-done" aria-label="닫기">✕</button><h2 class="acc-h">${view === 'reset' ? '비밀번호 재설정' : view === 'delete' ? '회원 탈퇴' : '계정'}</h2>${tabs}${h}`, 'acct');
  const f = $('#accId'); if (f) f.focus();
}
function acctHints() {
  const v = id => ($('#' + id) || {}).value || '';
  const id = $('#accId'); if (id && id.value !== id.value.toLowerCase()) id.value = id.value.toLowerCase();
  const set = (sel, rules, val) => { const ul = $(sel); if (ul) [...ul.children].forEach((li, i) => li.classList.toggle('ok', rules[i][1](val))); };
  set('#modalCard .hints.id', ID_RULES, v('accId')); set('#modalCard .hints.pw', PW_RULES, v('accPw'));
  const m = $('#modalCard .hints.pw2 li'); if (m) m.classList.toggle('ok', v('accPw2') !== '' && v('accPw2') === v('accPw'));
}
async function acctSubmit(kind) {
  if (acctBusy) return;
  const v = id => (($('#' + id) || {}).value || '').trim(), errEl = $('#accErr'), say = t => { if (errEl) errEl.textContent = t; };
  const id = v('accId').toLowerCase(), pw = ($('#accPw') || {}).value || '';
  if (kind === 'signup' || kind === 'reset') {
    if (kind === 'signup' && !ID_RULES.every(([, f]) => f(id))) return say('아이디 규칙을 확인해 주세요.');
    if (!PW_RULES.every(([, f]) => f(pw))) return say('비밀번호 규칙을 확인해 주세요.');
    if (pw !== ($('#accPw2') || {}).value) return say('비밀번호 확인이 일치하지 않습니다.');
  } else if (kind === 'delete') {
    if (!pw) return say('비밀번호를 적어 주세요.');
    acctBusy = true; say('지우는 중입니다…');
    const r = await Cloud.call('POST', '/delete', { pw }); acctBusy = false;
    if (!r.ok) return say(r.message || '다시 시도해 주세요.');
    Cloud.setAcct(null); closeModal(); toast('계정을 지웠습니다. 게스트로 계속합니다'); if (mode === 'menu') showMenu(menuView); return;
  } else if (!id || !pw) return say('아이디와 비밀번호를 적어 주세요.');
  acctBusy = true; say('잠시만요…'); $$('#accForm button').forEach(b => { b.disabled = true; });
  const body = kind === 'reset' ? { id, code: v('accCode').toUpperCase(), pw } : { id, pw };
  const r = await Cloud.call('POST', '/' + kind, body);
  acctBusy = false;
  if (!r.ok) { $$('#accForm button').forEach(b => { b.disabled = false; }); return say(r.message || '다시 시도해 주세요.'); }
  await Cloud.signedIn(r);
  const ab = $('.acct-btn'); if (ab) { ab.textContent = `${r.id} ✓`; ab.classList.add('in'); }
  if (kind === 'signup') showAccount('code', r.code);
  else showAccount('me', kind === 'reset' ? '비밀번호를 바꾸고 로그인했습니다 ✓' : '로그인했습니다 ✓');
}
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#accForm')) acctHints(); });
document.addEventListener('submit', e => { if (e.target.id === 'accForm') { e.preventDefault(); acctSubmit(e.target.dataset.kind); } });

// ───────────────────────── boot ─────────────────────────
// Hanji fibre and lacquer grain, generated once and handed to CSS as images.
function makeTextures() {
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), mulberry32(w * 31 + h)); return c.toDataURL(); };
  const hanji = mk(256, 256, (t, r) => {
    for (let i = 0; i < 2200; i++) { t.fillStyle = `rgba(${r() < 0.5 ? '90,70,40' : '255,255,245'},${0.05 + r() * 0.08})`; t.fillRect(r() * 256, r() * 256, 1, 1); }
    t.lineWidth = 0.6; for (let i = 0; i < 140; i++) { const x = r() * 256, y = r() * 256, a = r() * Math.PI, l = 6 + r() * 22; t.strokeStyle = `rgba(${r() < 0.6 ? '120,95,60' : '255,250,235'},${0.08 + r() * 0.12})`; t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 4, y + Math.sin(a) * l * 0.5 + r() * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); t.stroke(); }
  });
  const wood = mk(256, 128, (t, r) => {
    for (let y = 0; y < 128; y++) { const a = 0.04 + 0.05 * Math.sin(y * 0.7 + Math.sin(y * 0.13) * 3) ** 2; t.fillStyle = `rgba(0,0,0,${a})`; t.fillRect(0, y, 256, 1); }
    for (let i = 0; i < 90; i++) { const y = r() * 128, x = r() * 256; t.fillStyle = `rgba(255,210,150,${0.02 + r() * 0.04})`; t.fillRect(x, y, 20 + r() * 80, 1); }
  });
  document.documentElement.style.setProperty('--hanji-tex', `url(${hanji})`);
  document.documentElement.style.setProperty('--wood-tex', `url(${wood})`);
}
let FLAME_ON = '', FLAME_OFF = '';
const GIFT_ICON = { coins: 'coin', heal: 'potion', reroll: 'sack', half: 'target', chest: 'chest', gamtu: 'mask' };
(function boot() {
  bakeSprites(); makeTextures();
  FLAME_ON = bakeMap(ICONS.flame, {}, 1).toDataURL(); FLAME_OFF = bakeMap(ICONS.flame, { o: '#3a2a24', y: '#2c2420', f: '#4a3a30' }, 1).toDataURL();
  $('#purse .pouch').src = iconUrl('sack');
  fit(); showMenu('title');
  if (document.fonts && document.fonts.load) for (const f of ['22px Galmuri11', '40px "East Sea Dokdo"', '20px "Song Myung"']) document.fonts.load(f).catch(() => {});
  if (location.hash === '#dev') window.__bh = { get R() { return R; }, get P() { return P; }, newRun, startRun, update, buy, reroll, smite, sellItem, addItem, refreshStats, showMenu, takeGift, offerGift, ITEMS, ITEM, FOES, computeStats };
  requestAnimationFrame(frame);
  Cloud.init();
})();
