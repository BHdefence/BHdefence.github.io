// 봉화대 사수 — game data: damage types, armors, items, foes, difficulties, perks.
'use strict';

const ROUNDS = 40, ROUND_TIME = 30, PREP_TIME = 10;
const BASE = { hp: 1000, regen: 2, income: 4, gold: 200, crit: 0.05, critMul: 1.75, freeRerolls: 1, sellRate: 0.5, smites: 1 };

// Weapon damage types. Each lands double damage on the armor it is strong against; 요술 rolls 0.5–2× on anything.
const TYPES = {
  blade:  { name: '창검', strong: 'medium', color: '#dfe4ec', set: '검계' },
  arrow:  { name: '궁시', strong: 'light',  color: '#86d86f', set: '명궁대' },
  charm:  { name: '부적', strong: 'heavy',  color: '#b995ff', set: '도술원' },
  cannon: { name: '화포', strong: 'fort',   color: '#ff9f45', set: '화포청' },
  chaos:  { name: '요술', strong: null,     color: '#ff74b4', set: '요괴굴' },
};
const TYPE_IDS = ['blade', 'arrow', 'charm', 'cannon', 'chaos'];
const ARMORS = {
  light:  { name: '경갑', color: '#b4e86a', note: '날랜 무리' },
  medium: { name: '중갑', color: '#ecc96c', note: '도깨비·산적' },
  heavy:  { name: '철갑', color: '#93b8ff', note: '철갑 무사·강시' },
  fort:   { name: '석갑', color: '#d7aa80', note: '돌하르방·바위 거인' },
};
const ARMOR_IDS = ['light', 'medium', 'heavy', 'fort'];
const ELEMS = {
  fire:   { name: '화염', color: '#ff7f3f', set: '염화', note: '불이 붙어 3초 동안 탑니다' },
  frost:  { name: '냉기', color: '#9be6ff', set: '빙결', note: '2초 동안 발이 느려집니다' },
  poison: { name: '독',   color: '#97e04f', set: '맹독', note: '맞을수록 독이 겹쳐 쌓입니다' },
  bolt:   { name: '뇌전', color: '#ffe46b', set: '뇌공', note: '가까운 적에게 번개가 튑니다' },
};
const ELEM_IDS = ['fire', 'frost', 'poison', 'bolt'];
const TIERS = [
  { name: '일반', color: '#a9b2c1', price: 100 },
  { name: '고급', color: '#62d36e', price: 260 },
  { name: '희귀', color: '#5ea6ff', price: 650 },
  { name: '전설', color: '#ffb347', price: 1500 },
];
// Stacking: weapons stack freely (each copy fires). Any other item stacks up to STACK_MAX copies, and each extra
// copy adds less: 1st 100%, 2nd 60%, 3rd 40%, 4th and later 30%.
const STACK_MAX = 10, STACK_EFF = [1, 0.6, 0.4, 0.3];
const stackEff = k => STACK_EFF[Math.min(k, STACK_EFF.length - 1)];
const CATS = { weapon: '무기', upg: '강화', eco: '경제', surv: '생존', thorn: '가시' };

// Set bonuses. Type sets count weapons of one type; element sets count every item carrying that element.
const TYPE_SET_STEPS = [2, 4, 6];
// 요괴굴 has only 5 요술 weapons, so its steps are lower. Sets count different items (see computeStats).
const TYPE_SET_STEPS_BY = { chaos: [2, 3, 5] };
const setSteps = t => TYPE_SET_STEPS_BY[t] || TYPE_SET_STEPS;
const TYPE_SET_DMG = [0.15, 0.35, 0.7];
const TYPE_SET_PERK = {
  blade:  '4종부터 튕김 +1',
  arrow:  '4종부터 관통 +1, 치명타 +8%',
  charm:  '4종부터 동시 대상 +1',
  cannon: '4종부터 폭발 범위 +30%',
  chaos:  '3종부터 최소 배율 0.5 → 0.9',
};
const ELEM_SET_STEPS = [2, 4];
const ELEM_SET_TEXT = {
  fire:   ['불 피해 +50%', '불 피해 +120%, 불타 죽으면 주변으로 번짐'],
  frost:  ['감속 +10%', '감속 +20%, 12% 확률로 1초 빙결'],
  poison: ['독 최대 중첩 8 → 12', '독 최대 중첩 16, 독 피해 +40%'],
  bolt:   ['번개 튕김 +1', '번개 튕김 +2, 15% 확률로 0.4초 기절'],
};

function W(id, name, tier, type, o) { return Object.assign({ id, name, tier, type, cat: 'weapon', proj: type }, o); }
function U(id, name, tier, o) { return Object.assign({ id, name, tier, cat: 'upg', icon: 'up' }, o); }
function E(id, name, tier, o) { return Object.assign({ id, name, tier, cat: 'eco', icon: 'coin' }, o); }
function S(id, name, tier, o) { return Object.assign({ id, name, tier, cat: 'surv', icon: 'heart' }, o); }
function T(id, name, tier, o) { return Object.assign({ id, name, tier, cat: 'thorn', icon: 'thorn' }, o); }

const ITEMS = [
  // 창검 — 빠른 연타, 중갑에 2배
  W('bido', '비도', 0, 'blade', { dmg: 9, cd: 0.55, range: 95, icon: 'knife', desc: '날붙이를 쉼 없이 던집니다.' }),
  W('ssangbido', '쌍비도', 0, 'blade', { dmg: 6, cd: 0.6, range: 95, shots: 2, icon: 'knife', desc: '비도 두 자루를 함께 던집니다.' }),
  W('hwando', '환도', 1, 'blade', { dmg: 22, cd: 0.6, range: 100, bounce: 1, icon: 'saber', desc: '맞힌 뒤 옆의 적에게 한 번 튕깁니다.' }),
  W('yeomdo', '염도', 1, 'blade', { dmg: 18, cd: 0.6, range: 100, elem: 'fire', icon: 'saber', desc: '불붙은 칼날이 적을 태웁니다.' }),
  W('bigeom', '비검술', 2, 'blade', { dmg: 48, cd: 0.5, range: 105, bounce: 2, icon: 'sword', desc: '날아다니는 검이 두 번 튕깁니다.' }),
  W('binggeom', '빙검', 2, 'blade', { dmg: 44, cd: 0.55, range: 105, elem: 'frost', icon: 'sword', desc: '서리 서린 검이 발을 묶습니다.' }),
  W('chilseong', '칠성검', 3, 'blade', { dmg: 95, cd: 0.45, range: 110, bounce: 3, icon: 'star', desc: '북두칠성의 검. 세 번 튕깁니다.' }),
  W('noesin', '뇌신검', 3, 'blade', { dmg: 105, cd: 0.55, range: 110, elem: 'bolt', icon: 'sword', desc: '벼락을 머금은 검.' }),
  // 궁시 — 긴 사거리·관통, 경갑에 2배
  W('gakgung', '각궁', 0, 'arrow', { dmg: 13, cd: 0.95, range: 150, icon: 'bow', desc: '물소 뿔로 만든 활. 멀리 쏩니다.' }),
  W('dokhwasal', '독화살', 0, 'arrow', { dmg: 10, cd: 0.95, range: 150, elem: 'poison', icon: 'arrow', desc: '독을 바른 화살.' }),
  W('pyeonjeon', '편전', 1, 'arrow', { dmg: 32, cd: 0.9, range: 170, pierce: 1, icon: 'arrow', desc: '짧고 빠른 애기살. 하나를 꿰뚫습니다.' }),
  W('bulhwasal', '불화살', 1, 'arrow', { dmg: 26, cd: 0.95, range: 160, elem: 'fire', icon: 'arrow', desc: '기름 먹인 불화살.' }),
  W('singung', '신궁', 2, 'arrow', { dmg: 80, cd: 0.9, range: 180, pierce: 2, crit: 0.1, icon: 'bow', desc: '명사수의 활. 치명타 +10%.' }),
  W('noegung', '뇌전궁', 2, 'arrow', { dmg: 66, cd: 0.95, range: 170, elem: 'bolt', icon: 'bow', desc: '시위에서 번개가 튑니다.' }),
  W('cheongung', '천궁', 3, 'arrow', { dmg: 170, cd: 0.85, range: 200, pierce: 3, icon: 'bow', desc: '하늘을 꿰는 활. 셋을 꿰뚫습니다.' }),
  W('seorigung', '서리궁', 3, 'arrow', { dmg: 140, cd: 0.9, range: 190, elem: 'frost', pierce: 1, icon: 'bow', desc: '얼음 화살이 길을 얼립니다.' }),
  // 부적 — 상태 이상, 철갑에 2배
  W('hwabu', '화부', 0, 'charm', { dmg: 11, cd: 1.0, range: 120, elem: 'fire', icon: 'charm', desc: '불 부적.' }),
  W('bingbu', '빙부', 0, 'charm', { dmg: 9, cd: 1.0, range: 120, elem: 'frost', icon: 'charm', desc: '얼음 부적.' }),
  W('dokbu', '독부', 1, 'charm', { dmg: 24, cd: 1.0, range: 125, elem: 'poison', icon: 'charm', desc: '독 기운이 스미는 부적.' }),
  W('noebu', '뇌부', 1, 'charm', { dmg: 26, cd: 1.0, range: 125, elem: 'bolt', icon: 'charm', desc: '번개를 부르는 부적.' }),
  W('obang', '오방신장부', 2, 'charm', { dmg: 58, cd: 1.0, range: 130, multi: 3, icon: 'charm5', desc: '다섯 방위의 신장이 셋을 한꺼번에 칩니다.' }),
  W('jeoseung', '저승부', 2, 'charm', { dmg: 62, cd: 1.05, range: 130, execute: 0.12, icon: 'skull', desc: '체력 12% 아래의 적을 저승으로 보냅니다.' }),
  W('cheondung', '천둥신부', 3, 'charm', { dmg: 140, cd: 1.0, range: 140, elem: 'bolt', chain: 3, icon: 'charm5', desc: '천둥 신장이 넷을 잇따라 칩니다.' }),
  W('taegeuk', '태극부', 3, 'charm', { dmg: 130, cd: 1.0, range: 140, elem: 'frost', elem2: 'fire', icon: 'yinyang', desc: '음양의 기운으로 얼리고 태웁니다.' }),
  // 화포 — 광역 폭발, 석갑에 2배
  W('jincheonroe', '비격진천뢰', 0, 'cannon', { dmg: 22, cd: 1.9, range: 130, splash: 16, proj: 'shell', icon: 'bomb', desc: '터지는 쇳덩이 폭탄.' }),
  W('chongtong', '총통', 1, 'cannon', { dmg: 50, cd: 1.9, range: 140, splash: 20, proj: 'shell', icon: 'cannon', desc: '화약으로 쏘는 포.' }),
  W('hwacha', '화차', 1, 'cannon', { dmg: 15, cd: 2.8, range: 150, splash: 10, shots: 5, elem: 'fire', proj: 'rocket', icon: 'hwacha', desc: '불화살 다섯 발을 한꺼번에 날립니다.' }),
  W('daejanggun', '대장군포', 2, 'cannon', { dmg: 130, cd: 2.3, range: 150, splash: 26, proj: 'shell', icon: 'cannon', desc: '성문도 부수는 큰 포.' }),
  W('singijeon', '신기전', 2, 'cannon', { dmg: 34, cd: 2.6, range: 160, splash: 12, shots: 6, elem: 'fire', proj: 'rocket', icon: 'hwacha', desc: '신기전 여섯 발이 무리를 덮칩니다.' }),
  W('hongi', '홍이포', 3, 'cannon', { dmg: 290, cd: 2.5, range: 170, splash: 32, proj: 'shell', icon: 'cannon', desc: '가장 큰 포. 넓게 터집니다.' }),
  W('cheonja', '천자총통', 3, 'cannon', { dmg: 240, cd: 2.4, range: 165, splash: 28, stun: 0.5, proj: 'shell', icon: 'cannon', desc: '맞은 적을 0.5초 기절시킵니다.' }),
  // 요술 — 0.5~2배 무작위, 약점 없음
  W('dokkaebibul', '도깨비불', 0, 'chaos', { dmg: 15, cd: 0.9, range: 115, icon: 'wisp', desc: '떠도는 푸른 불.' }),
  W('bangmangi', '도깨비 방망이', 1, 'chaos', { dmg: 36, cd: 0.9, range: 115, goldOnKill: 1, icon: 'club', desc: '때려잡은 적마다 엽전 1냥이 더 나옵니다.' }),
  W('dungap', '둔갑술', 2, 'chaos', { dmg: 78, cd: 0.95, range: 125, randElem: true, icon: 'mask', desc: '칠 때마다 아무 속성이나 붙습니다.' }),
  W('geoul', '요괴 거울', 2, 'chaos', { dmg: 72, cd: 1.0, range: 125, chain: 2, icon: 'mirror', desc: '빛이 둘에게 더 튑니다.' }),
  W('yeouiju', '여의주', 3, 'chaos', { dmg: 190, cd: 0.95, range: 140, chain: 3, icon: 'pearl', desc: '용의 구슬. 셋에게 더 튑니다.' }),

  // 강화
  U('blade1', '창검 수련', 0, { typeDmg: { blade: 0.15 }, type: 'blade', desc: '창검 피해 +15%' }),
  U('blade2', '검술 비급', 1, { typeDmg: { blade: 0.3 }, type: 'blade', desc: '창검 피해 +30%' }),
  U('blade3', '검성의 가르침', 2, { typeDmg: { blade: 0.55 }, type: 'blade', desc: '창검 피해 +55%' }),
  U('arrow1', '궁술 수련', 0, { typeDmg: { arrow: 0.15 }, type: 'arrow', desc: '궁시 피해 +15%' }),
  U('arrow2', '활터 비급', 1, { typeDmg: { arrow: 0.3 }, type: 'arrow', desc: '궁시 피해 +30%' }),
  U('arrow3', '신궁의 가르침', 2, { typeDmg: { arrow: 0.55 }, type: 'arrow', desc: '궁시 피해 +55%' }),
  U('charm1', '도술 수련', 0, { typeDmg: { charm: 0.15 }, type: 'charm', desc: '부적 피해 +15%' }),
  U('charm2', '둔갑 비급', 1, { typeDmg: { charm: 0.3 }, type: 'charm', desc: '부적 피해 +30%' }),
  U('charm3', '도사의 가르침', 2, { typeDmg: { charm: 0.55 }, type: 'charm', desc: '부적 피해 +55%' }),
  U('cannon1', '포술 수련', 0, { typeDmg: { cannon: 0.15 }, type: 'cannon', desc: '화포 피해 +15%' }),
  U('cannon2', '화약 비급', 1, { typeDmg: { cannon: 0.3 }, type: 'cannon', desc: '화포 피해 +30%' }),
  U('cannon3', '포도대장의 가르침', 2, { typeDmg: { cannon: 0.55 }, type: 'cannon', desc: '화포 피해 +55%' }),
  U('chaos1', '요술 수련', 0, { typeDmg: { chaos: 0.15 }, type: 'chaos', desc: '요술 피해 +15%' }),
  U('chaos2', '요괴 비급', 1, { typeDmg: { chaos: 0.3 }, type: 'chaos', desc: '요술 피해 +30%' }),
  U('dmg1', '기세', 0, { dmg: 0.08, desc: '모든 피해 +8%' }),
  U('dmg2', '기세등등', 1, { dmg: 0.16, desc: '모든 피해 +16%' }),
  U('dmg3', '파죽지세', 2, { dmg: 0.3, desc: '모든 피해 +30%' }),
  U('dmg4', '천하무적', 3, { dmg: 0.55, desc: '모든 피해 +55%' }),
  U('spd1', '속공', 0, { aspd: 0.08, icon: 'feather', desc: '공격 속도 +8%' }),
  U('spd2', '질풍', 1, { aspd: 0.16, icon: 'feather', desc: '공격 속도 +16%' }),
  U('spd3', '신속', 2, { aspd: 0.28, icon: 'feather', desc: '공격 속도 +28%' }),
  U('range1', '매의 눈', 0, { range: 0.1, icon: 'eye', desc: '사거리 +10%' }),
  U('range2', '천리안', 2, { range: 0.22, icon: 'eye', desc: '사거리 +22%' }),
  U('crit1', '급소 찌르기', 0, { crit: 0.05, icon: 'target', desc: '치명타 확률 +5%' }),
  U('crit2', '일격필살', 1, { crit: 0.1, icon: 'target', desc: '치명타 확률 +10%' }),
  U('critd', '회심', 2, { critDmg: 0.6, icon: 'target', desc: '치명타 피해 +60%' }),
  U('burn', '화염 심화', 1, { elemPow: { fire: 0.6 }, elem: 'fire', icon: 'flame', desc: '불 피해 +60%. 화염 세트에 셉니다.' }),
  U('chill', '한기', 1, { elemPow: { frost: 0.5 }, elem: 'frost', icon: 'snow', desc: '감속이 더 오래 갑니다. 냉기 세트에 셉니다.' }),
  U('venom', '맹독', 1, { elemPow: { poison: 0.6 }, elem: 'poison', icon: 'drop', desc: '독 피해 +60%. 독 세트에 셉니다.' }),
  U('storm', '뇌운', 1, { elemPow: { bolt: 0.5 }, elem: 'bolt', icon: 'bolt', desc: '번개 피해 +50%. 뇌전 세트에 셉니다.' }),

  // 경제
  E('jangteo', '장터', 0, { income: 1, desc: '초당 수입 +1냥' }),
  E('sangdan', '보부상단', 1, { income: 2.5, desc: '초당 수입 +2.5냥' }),
  E('daesang', '개성 상인', 2, { income: 6, desc: '초당 수입 +6냥' }),
  E('gukgo', '국고', 3, { income: 13, desc: '초당 수입 +13냥' }),
  E('bounty1', '현상금', 0, { bounty: 0.2, icon: 'sack', desc: '처치 현상금 +20%' }),
  E('bounty2', '현상수배', 2, { bounty: 0.4, icon: 'sack', desc: '처치 현상금 +40%' }),
  E('pawn', '전당포', 1, { interest: 0.04, interestCap: 60, icon: 'sack', desc: '라운드마다 가진 엽전의 4% 이자 (최대 60냥). 이자는 겹치지 않고 가장 좋은 하나만' }),
  E('exchange', '환전상', 2, { interest: 0.06, interestCap: 150, icon: 'sack', desc: '라운드마다 가진 엽전의 6% 이자 (최대 150냥). 이자는 겹치지 않고 가장 좋은 하나만' }),

  // 생존
  S('wall1', '성벽 보강', 0, { maxHp: 250, icon: 'wall', desc: '봉화대 최대 체력 +250' }),
  S('wall2', '석축', 1, { maxHp: 700, icon: 'wall', desc: '봉화대 최대 체력 +700' }),
  S('wall3', '철옹성', 2, { maxHp: 1800, icon: 'wall', desc: '봉화대 최대 체력 +1,800' }),
  S('wall4', '금성탕지', 3, { maxHp: 4500, icon: 'wall', desc: '봉화대 최대 체력 +4,500' }),
  S('regen1', '약수', 0, { regen: 3, icon: 'potion', desc: '초당 체력 회복 +3' }),
  S('regen2', '산삼', 1, { regen: 9, icon: 'potion', desc: '초당 체력 회복 +9' }),
  S('regen3', '불로초', 2, { regen: 25, icon: 'potion', desc: '초당 체력 회복 +25' }),
  S('shield1', '호신부', 1, { shield: 300, icon: 'shield', desc: '라운드마다 다시 차는 보호막 +300' }),
  S('shield2', '금강부', 2, { shield: 900, icon: 'shield', desc: '라운드마다 다시 차는 보호막 +900' }),
  S('shield3', '천신 가호', 3, { shield: 2500, icon: 'shield', desc: '라운드마다 다시 차는 보호막 +2,500' }),
  S('dr1', '망루 보강', 1, { dr: 0.06, icon: 'shield', desc: '받는 피해 -6%' }),
  S('dr2', '철갑 망루', 2, { dr: 0.12, icon: 'shield', desc: '받는 피해 -12%' }),

  // 가시 — 봉화대를 때린 적에게 피해를 돌려줍니다 (라운드가 오를수록 강해짐)
  T('tangja', '탱자 가시', 0, { thorn: 12, desc: '때린 적에게 12 반사' }),
  T('eomnamu', '엄나무 가시', 1, { thorn: 36, desc: '때린 적에게 36 반사' }),
  T('dokgasi', '독가시', 1, { thorn: 20, elem: 'poison', desc: '20 반사 + 독. 독 세트에 셉니다.' }),
  T('soegasi', '쇠가시', 2, { thorn: 110, desc: '때린 적에게 110 반사' }),
  T('bulgasi', '불가시', 2, { thorn: 70, elem: 'fire', desc: '70 반사 + 화상. 화염 세트에 셉니다.' }),
  T('gasiseong', '가시 성채', 3, { thorn: 320, desc: '때린 적에게 320 반사' }),
  T('gasison', '가시 손질', 1, { thornPow: 0.6, icon: 'up', desc: '가시 반사 피해 +60%' }),
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const CAT_WEIGHT = { weapon: 42, upg: 28, eco: 12, surv: 12, thorn: 6 };

// Foes. Speeds are pixels per second on the 400×360 field; hp is the round-1 value before scaling.
const FOES = {
  grunt:     { name: '도깨비 졸개', armor: 'medium', hp: 40,  spd: 16, dmg: 6,  cd: 1.2, bounty: 3, r: 6, spr: 'grunt' },
  runner:    { name: '날쌘 도깨비', armor: 'light',  hp: 26,  spd: 30, dmg: 4,  cd: 0.9, bounty: 3, r: 5, spr: 'runner' },
  wolf:      { name: '들개',        armor: 'light',  hp: 34,  spd: 26, dmg: 5,  cd: 1.0, bounty: 3, r: 6, spr: 'wolf' },
  wisp:      { name: '도깨비불',    armor: 'light',  hp: 22,  spd: 24, dmg: 4,  cd: 0.9, bounty: 3, r: 4, spr: 'wisp', float: true },
  bandit:    { name: '산적',        armor: 'medium', hp: 56,  spd: 15, dmg: 8,  cd: 1.2, bounty: 4, r: 6, spr: 'bandit' },
  guard:     { name: '철갑 무사',   armor: 'heavy',  hp: 95,  spd: 11, dmg: 10, cd: 1.3, bounty: 5, r: 6, spr: 'guard' },
  gangsi:    { name: '강시',        armor: 'heavy',  hp: 78,  spd: 14, dmg: 9,  cd: 1.1, bounty: 5, r: 6, spr: 'gangsi', hop: true },
  hareubang: { name: '돌하르방',    armor: 'fort',   hp: 140, spd: 8,  dmg: 14, cd: 1.6, bounty: 6, r: 7, spr: 'hareubang' },
  giant:     { name: '바위 거인',   armor: 'fort',   hp: 200, spd: 7,  dmg: 20, cd: 1.8, bounty: 8, r: 9, spr: 'giant' },
  treasure:  { name: '보물 도깨비', armor: 'medium', hp: 380, spd: 34, dmg: 0,  cd: 99,  bounty: 0, r: 7, spr: 'treasure', treasure: true },
  chief:     { name: '두억시니',    armor: 'medium', hp: 3800,  spd: 9,  dmg: 60,  cd: 1.6, bounty: 150, r: 13, spr: 'chief', boss: true, summon: 'grunt' },
  bulga:     { name: '불가사리',    armor: 'heavy',  hp: 15000, spd: 7,  dmg: 110, cd: 2.0, bounty: 300, r: 15, spr: 'bulga', boss: true, summon: 'guard' },
  gumiho:    { name: '구미호',      armor: 'light',  hp: 42000, spd: 15, dmg: 140, cd: 1.2, bounty: 600, r: 14, spr: 'gumiho', boss: true, summon: 'wisp' },
  dragon:    { name: '흑룡',        armor: 'cycle',  hp: 170000, spd: 5, dmg: 150, cd: 2.0, bounty: 0, r: 20, spr: 'dragon', boss: true, final: true, summon: 'giant' },
};
const POOL = { light: ['runner', 'wolf', 'wisp'], medium: ['grunt', 'bandit'], heavy: ['guard', 'gangsi'], fort: ['hareubang', 'giant'] };
const MID_BOSS = { 10: 'chief', 20: 'bulga', 30: 'gumiho' };
const TREASURE_ROUNDS = [5, 15, 25, 35];

const DIFFS = [
  { id: 'easy',  name: '쉬움',    hp: 0.7, count: 0.85, boss: 0.7, edmg: 0.8, income: 1.1, mem: 0.5, theme: 'field',  note: ['적 체력이 낮습니다', '처음이라면 여기서 시작하세요'] },
  { id: 'normal', name: '보통',   hp: 1.0, count: 1.0, boss: 1.0, edmg: 1.0, income: 1.0, mem: 1.0, theme: 'field',  note: ['기준 난이도', '주간 랭킹전도 이 난이도입니다'] },
  { id: 'hard',  name: '어려움',  hp: 1.35, count: 1.1, boss: 1.4, edmg: 1.15, income: 1.0, mem: 1.5, theme: 'autumn', note: ['적 체력과 수가 늘어납니다', '이기면 악몽 I이 열립니다'] },
  { id: 'nm1',   name: '악몽 I',   hp: 1.8, count: 1.2, boss: 2.0, edmg: 1.3, income: 1.0, mem: 2.0, trait: 'scale', theme: 'night',  note: ['어둠이 깔린 전장', '보스가 훨씬 단단합니다'], req: 'hard' },
  { id: 'nm2',   name: '악몽 II',  hp: 2.4, count: 1.3, boss: 2.8, edmg: 1.45, income: 1.0, mem: 2.5, trait: 'wind', theme: 'night',  note: ['적이 더 많이 몰려옵니다'], req: 'nm1' },
  { id: 'nm3',   name: '악몽 III', hp: 3.2, count: 1.4, boss: 3.8, edmg: 1.6, income: 1.0, mem: 3.0, trait: 'pure', theme: 'night',  note: ['가장 깊은 악몽', '이기면 저승길 I이 열립니다'], req: 'nm2' },
  { id: 'nether',  name: '저승길 I',   hp: 3.3, count: 1.4,  boss: 3.9, edmg: 1.6,  income: 1.0, mem: 3.5, trait: 'fire', theme: 'nether', revive: 0.15, ghost: 0.35, note: ['꽃무릇이 핀 저승 들판', '쓰러진 적의 15%가 원혼으로 다시 일어납니다 (체력 35%)'], req: 'nm3' },
  { id: 'nether2', name: '저승길 II',  hp: 3.6, count: 1.45, boss: 4.3, edmg: 1.65, income: 1.0, mem: 4.0, trait: 'break', theme: 'nether', revive: 0.2,  ghost: 0.4,  note: ['원혼이 더 자주 일어납니다', '쓰러진 적의 20%가 원혼으로 (체력 40%)'], req: 'nether' },
  { id: 'nether3', name: '저승길 III', hp: 4.0, count: 1.5,  boss: 4.8, edmg: 1.785, income: 1.0, mem: 4.5, trait: 'adapt', theme: 'nether', revive: 0.25, ghost: 0.5,  note: ['저승의 가장 깊은 곳', '쓰러진 적의 25%가 원혼으로 (체력 50%)'], req: 'nether2' },
];
// 보스 특성: every boss of a difficulty (10·20·30 round bosses and 흑룡) carries that difficulty's trait.
const BOSS_TRAITS = {
  scale: { name: '철갑 비늘', desc: '보스가 받는 창검 피해 50%', half: 'blade' },
  wind:  { name: '바람막이', desc: '보스가 받는 궁시 피해 50%, 관통이 보스에서 멈춤', half: 'arrow' },
  pure:  { name: '부정 타지 않음', desc: '보스가 받는 부적 피해 50%, 냉기로 느려지지 않음', half: 'charm' },
  fire:  { name: '불 먹는 몸', desc: '보스가 받는 화포 피해 50%, 불에 타지 않음', half: 'cannon' },
  break: { name: '요술 꺾기', desc: '보스에게 요술 배율 0.5~1배, 독은 절반만 쌓임' },
  adapt: { name: '적응하는 원귀', desc: '20초마다 그동안 가장 많이 맞은 무기 종류에 10초 동안 70% 저항' },
};
const DIFF = Object.fromEntries(DIFFS.map(d => [d.id, d]));

// 수호 기억: permanent perks bought with memory shards earned from every run.
const PERKS = [
  { id: 'gold',   name: '비상금',     max: 5, base: 6,  desc: l => `시작 엽전 +${l * 60}냥` },
  { id: 'income', name: '장터 인맥',  max: 5, base: 8,  desc: l => `초당 수입 +${(l * 0.6).toFixed(1)}냥` },
  { id: 'hp',     name: '굳센 봉화대', max: 5, base: 6,  desc: l => `최대 체력 +${l * 6}%` },
  { id: 'reroll', name: '행운의 엽전', max: 3, base: 12, desc: l => `라운드마다 무료 새로고침 +${l}` },
  { id: 'luck',   name: '눈썰미',     max: 5, base: 10, desc: l => `상점에 희귀·전설이 ${l * 15}% 더 자주` },
  { id: 'sell',   name: '되팔기',     max: 3, base: 8,  desc: l => `되팔 때 ${50 + l * 10}% 환급` },
  { id: 'might',  name: '노련함',     max: 5, base: 10, desc: l => `모든 피해 +${l * 3}%` },
  { id: 'smite',  name: '천벌 재충전', max: 1, base: 40, desc: l => `천벌 ${1 + l}회` },
];
const PERK = Object.fromEntries(PERKS.map(p => [p.id, p]));

const GIFTS = [
  { id: 'coins',  name: '엽전 꾸러미', desc: r => `엽전 ${giftCoins(r)}냥` },
  { id: 'heal',   name: '약수 한 사발', desc: () => '체력을 모두 채우고 보호막도 다시 채웁니다' },
  { id: 'reroll', name: '공짜 흥정',   desc: () => '무료 새로고침 3회' },
  { id: 'half',   name: '반값 흥정',   desc: () => '다음 구매 하나를 반값에' },
  { id: 'chest',  name: '보물 상자',   desc: r => `${TIERS[giftTier(r)].name} 등급 물건 하나를 공짜로` },
  { id: 'gamtu',  name: '도깨비 감투', desc: () => '이번 판 모든 피해 +10%' },
];
const giftCoins = r => 120 + r * 30;
const giftTier = r => Math.min(3, 1 + Math.floor(r / 15));

// 봉수 소식: newest first. A new `id` lights the NEW mark on the title screen until the player opens it.
const NEWS = [
  { id: '2026-10-14e', date: '10월 14일', title: '주간 랭킹전 갱신 시간', items: [
    '주간 랭킹전은 이제 매주 일요일 22시(한국 시간)에 새 주가 시작됩니다. 랭킹전 화면에 다음 갱신까지 남은 시간이 나옵니다.',
    '하루 3번 도전 횟수도 매일 22시에 다시 채워집니다.',
  ] },
  { id: '2026-10-14d', date: '10월 14일', title: '겹치기 · 경제 조정, 보스 특성', items: [
    '무기가 아닌 물건은 같은 것을 10개까지 겹칠 수 있고, 겹칠수록 효과가 줄어듭니다 (1개째 100%, 2개째 60%, 3개째 40%, 4개째부터 30%). 무기는 지금처럼 겹친 만큼 모두 쏩니다.',
    '경제 물건 수입을 줄였습니다: 장터 +1, 보부상단 +2.5, 개성 상인 +6, 국고 +13냥/초. 현상금 +20%, 현상수배 +40%.',
    '전당포 4%(최대 60냥), 환전상 6%(최대 150냥). 이자는 겹치지 않고 가장 좋은 하나만 적용됩니다.',
    '악몽 I부터 보스마다 특성이 붙습니다: 악몽 I 창검 50% · 악몽 II 궁시 50% · 악몽 III 부적 50%·감속 면역 · 저승길 I 화포 50%·화상 면역 · 저승길 II 요술 꺾기 · 저승길 III 적응하는 원귀. 난이도 선택 화면과 도감에서 볼 수 있습니다.',
  ] },
  { id: '2026-10-14c', date: '10월 14일', title: '새 난이도 저승길 I · II · III', items: [
    '악몽 III을 이기면 저승길 I이 열리고, 하나씩 이길 때마다 다음 단계가 열립니다. 꽃무릇이 핀 저승 들판에서 싸웁니다.',
    '쓰러진 적의 일부가 몇 걸음 뒤에서 원혼으로 한 번 더 일어납니다. 원혼은 절반 세기로 때리고 엽전을 주지 않습니다.',
    '저승길 I: 원혼 15%(체력 35%) · II: 20%(40%) · III: 25%(50%). 버틴 라운드마다 기억 조각 3.5 · 4 · 4.5개.',
  ] },
  { id: '2026-10-14', date: '10월 14일', title: '첫 봉화 완주 · 봉수 소식 · 장작 보태기', items: [
    '난이도마다 흑룡을 처음 쓰러뜨린 수호자의 이름이 타이틀 화면에 걸립니다. (로그인해야 이름이 남습니다)',
    '봉수 소식 창이 생겼습니다. 업데이트 내역을 보고 의견을 보낼 수 있습니다.',
    '서버비를 보태 주실 수 있는 \'장작 보태기\'를 열었습니다.',
  ] },
  { id: '2026-10-13c', date: '10월 13일', title: '주간 랭킹전 규칙 변경', items: [
    '랭킹전에서는 수호 기억이 적용되지 않습니다. 모두 같은 출발선에서 겨룹니다.',
    '점수 = 버틴 라운드 × 1,000 + 그 라운드에서 버틴 정도(0~999). 처치 수는 기록으로만 남습니다.',
  ] },
  { id: '2026-10-13b', date: '10월 13일', title: '도감 · 배경음악 · 공유 카드', items: [
    '도감에서 물건 93종, 상점 확률, 라운드별 적, 세트 효과를 볼 수 있습니다.',
    '국악풍 배경음악이 생겼습니다. M 키나 설정에서 끌 수 있습니다.',
    '판이 끝나면 결과 공유 카드를 만들어 자랑할 수 있습니다.',
    '세트 효과는 서로 다른 물건만 셉니다. 요괴굴 세트는 2·3·5종으로 낮췄습니다.',
  ] },
  { id: '2026-10-13a', date: '10월 13일', title: '봉화대 사수 첫 공개', items: [
    '게스트로 바로 하거나, 영문 아이디로 가입해 기록을 저장하고 명예의 전당에 오를 수 있습니다.',
    '휴대폰은 가로 화면으로 즐길 수 있고, 같은 물건은 ×2 ×3으로 겹쳐 봇짐 한 칸만 씁니다.',
  ] },
];

// 장작 보태기 (후원). A button shows only for links that are filled in; supporters are added by hand.
const SUPPORT = {
  links: [
    { label: '카카오페이로 보태기', url: 'https://qr.kakaopay.com/FdKSz3NCa' },
    { label: '토스로 보태기', url: '' },
  ],
  thanks: [],
};
