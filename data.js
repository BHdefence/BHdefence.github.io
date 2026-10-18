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
  W('woldo', '월도', 1, 'blade', { dmg: 16, cd: 1.0, range: 58, sweep: true, icon: 'glaive', desc: '봉화대 둘레를 크게 베어 가까이 온 적을 모두 칩니다.' }),
  // 궁시 — 긴 사거리·관통, 경갑에 2배
  W('gakgung', '각궁', 0, 'arrow', { dmg: 13, cd: 0.95, range: 150, icon: 'bow', desc: '물소 뿔로 만든 활. 멀리 쏩니다.' }),
  W('dokhwasal', '독화살', 0, 'arrow', { dmg: 10, cd: 0.95, range: 150, elem: 'poison', icon: 'arrow', desc: '독을 바른 화살.' }),
  W('pyeonjeon', '편전', 1, 'arrow', { dmg: 32, cd: 0.9, range: 170, pierce: 1, icon: 'arrow', desc: '짧고 빠른 애기살. 하나를 꿰뚫습니다.' }),
  W('bulhwasal', '불화살', 1, 'arrow', { dmg: 26, cd: 0.95, range: 160, elem: 'fire', icon: 'arrow', desc: '기름 먹인 불화살.' }),
  W('singung', '신궁', 2, 'arrow', { dmg: 80, cd: 0.9, range: 180, pierce: 2, crit: 0.1, icon: 'bow', desc: '명사수의 활. 치명타 +10%.' }),
  W('noegung', '뇌전궁', 2, 'arrow', { dmg: 66, cd: 0.95, range: 170, elem: 'bolt', icon: 'bow', desc: '시위에서 번개가 튑니다.' }),
  W('cheongung', '천궁', 3, 'arrow', { dmg: 170, cd: 0.85, range: 200, pierce: 3, icon: 'bow', desc: '하늘을 꿰는 활. 셋을 꿰뚫습니다.' }),
  W('seorigung', '서리궁', 3, 'arrow', { dmg: 140, cd: 0.9, range: 190, elem: 'frost', pierce: 1, icon: 'bow', desc: '얼음 화살이 길을 얼립니다.' }),
  W('soenoe', '쇠뇌', 1, 'arrow', { dmg: 44, cd: 1.5, range: 190, bossDmg: 0.6, icon: 'crossbow', desc: '무거운 쇠뇌 화살. 보스에게 피해 +60%.' }),
  W('sunogi', '수노기', 2, 'arrow', { dmg: 30, cd: 1.0, range: 160, shots: 3, icon: 'crossbow', desc: '연발 쇠뇌. 세 발을 잇달아 쏩니다.' }),
  // 부적 — 상태 이상, 철갑에 2배
  W('hwabu', '화부', 0, 'charm', { dmg: 11, cd: 1.0, range: 120, elem: 'fire', icon: 'charm', desc: '불 부적.' }),
  W('bingbu', '빙부', 0, 'charm', { dmg: 9, cd: 1.0, range: 120, elem: 'frost', icon: 'charm', desc: '얼음 부적.' }),
  W('dokbu', '독부', 1, 'charm', { dmg: 24, cd: 1.0, range: 125, elem: 'poison', icon: 'charm', desc: '독 기운이 스미는 부적.' }),
  W('noebu', '뇌부', 1, 'charm', { dmg: 26, cd: 1.0, range: 125, elem: 'bolt', icon: 'charm', desc: '번개를 부르는 부적.' }),
  W('obang', '오방신장부', 2, 'charm', { dmg: 58, cd: 1.0, range: 130, multi: 3, icon: 'charm5', desc: '다섯 방위의 신장이 셋을 한꺼번에 칩니다.' }),
  W('jeoseung', '저승부', 2, 'charm', { dmg: 62, cd: 1.05, range: 130, execute: 0.12, icon: 'skull', desc: '체력 12% 아래의 적을 저승으로 보냅니다.' }),
  W('cheondung', '천둥신부', 3, 'charm', { dmg: 140, cd: 1.0, range: 140, elem: 'bolt', chain: 3, icon: 'charm5', desc: '천둥 신장이 넷을 잇따라 칩니다.' }),
  W('taegeuk', '태극부', 3, 'charm', { dmg: 130, cd: 1.0, range: 140, elem: 'frost', elem2: 'fire', icon: 'yinyang', desc: '음양의 기운으로 얼리고 태웁니다.' }),
  W('nakinbu', '낙인부', 1, 'charm', { dmg: 16, cd: 1.1, range: 130, mark: 4, icon: 'charm', desc: '낙인이 찍힌 적은 4초 동안 모든 피해를 25% 더 받습니다.' }),
  W('gyeolgye', '결계부', 2, 'charm', { dmg: 40, cd: 1.6, range: 130, field: { r: 24, t: 3, dps: 0.45, slow: 0.35, c: '#9be6ff' }, elem: 'frost', icon: 'charm5', desc: '맞은 자리에 3초 동안 결계를 쳐서 들어온 적을 느리게 하고 깎습니다.' }),
  // 화포 — 광역 폭발, 석갑에 2배
  W('jincheonroe', '비격진천뢰', 0, 'cannon', { dmg: 22, cd: 1.9, range: 130, splash: 16, proj: 'shell', icon: 'bomb', desc: '터지는 쇳덩이 폭탄.' }),
  W('chongtong', '총통', 1, 'cannon', { dmg: 50, cd: 1.9, range: 140, splash: 20, proj: 'shell', icon: 'cannon', desc: '화약으로 쏘는 포.' }),
  W('hwacha', '화차', 1, 'cannon', { dmg: 15, cd: 2.8, range: 150, splash: 10, shots: 5, elem: 'fire', proj: 'rocket', icon: 'hwacha', desc: '불화살 다섯 발을 한꺼번에 날립니다.' }),
  W('daejanggun', '대장군포', 2, 'cannon', { dmg: 130, cd: 2.3, range: 150, splash: 26, proj: 'shell', icon: 'cannon', desc: '성문도 부수는 큰 포.' }),
  W('singijeon', '신기전', 2, 'cannon', { dmg: 34, cd: 2.6, range: 160, splash: 12, shots: 6, elem: 'fire', proj: 'rocket', icon: 'hwacha', desc: '신기전 여섯 발이 무리를 덮칩니다.' }),
  W('hongi', '홍이포', 3, 'cannon', { dmg: 290, cd: 2.5, range: 170, splash: 32, proj: 'shell', icon: 'cannon', desc: '가장 큰 포. 넓게 터집니다.' }),
  W('cheonja', '천자총통', 3, 'cannon', { dmg: 240, cd: 2.4, range: 165, splash: 28, stun: 0.5, proj: 'shell', icon: 'cannon', desc: '맞은 적을 0.5초 기절시킵니다.' }),
  W('jillyeo', '질려포통', 1, 'cannon', { dmg: 26, cd: 2.2, range: 140, splash: 16, field: { r: 18, t: 3, dps: 0.35, slow: 0.3, c: '#c9a36a' }, proj: 'shell', icon: 'caltrop', desc: '터지면서 마름쇠를 뿌려 3초 동안 밟는 적을 깎고 늦춥니다.' }),
  W('pajinpo', '파진포', 2, 'cannon', { dmg: 110, cd: 2.4, range: 150, splash: 24, knock: 16, proj: 'shell', icon: 'cannon', desc: '폭발로 적을 뒤로 밀어냅니다.' }),
  // 요술 — 0.5~2배 무작위, 약점 없음
  W('dokkaebibul', '도깨비불', 0, 'chaos', { dmg: 15, cd: 0.9, range: 115, icon: 'wisp', desc: '떠도는 푸른 불.' }),
  W('bangmangi', '도깨비 방망이', 1, 'chaos', { dmg: 36, cd: 0.9, range: 115, goldOnKill: 1, icon: 'club', desc: '때려잡은 적마다 엽전 1냥이 더 나옵니다.' }),
  W('dungap', '둔갑술', 2, 'chaos', { dmg: 78, cd: 0.95, range: 125, randElem: true, icon: 'mask', desc: '칠 때마다 아무 속성이나 붙습니다.' }),
  W('geoul', '요괴 거울', 2, 'chaos', { dmg: 72, cd: 1.0, range: 125, chain: 2, icon: 'mirror', desc: '빛이 둘에게 더 튑니다.' }),
  W('yeouiju', '여의주', 3, 'chaos', { dmg: 190, cd: 0.95, range: 140, chain: 3, icon: 'pearl', desc: '용의 구슬. 셋에게 더 튑니다.' }),
  W('horibyeong', '요괴 호리병', 1, 'chaos', { dmg: 34, cd: 0.95, range: 115, lifeOnKill: 4, icon: 'gourd', desc: '쓰러뜨린 적의 기운을 빨아들여 봉화대 체력을 4 채웁니다.' }),
  W('samjokoh', '삼족오', 3, 'chaos', { dmg: 70, cd: 0.95, range: 150, shots: 3, randElem: true, icon: 'crow', desc: '태양의 세 발 까마귀. 세 발을 흩뿌리고, 칠 때마다 아무 속성이나 붙습니다.' }),

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
  U('bossdmg', '토벌 비책', 2, { bossDmg: 0.25, icon: 'target', desc: '보스에게 주는 피해 +25%' }),

  // 경제
  E('jangteo', '장터', 0, { income: 1, desc: '초당 수입 +1냥' }),
  E('sangdan', '보부상단', 1, { income: 2.5, desc: '초당 수입 +2.5냥' }),
  E('daesang', '개성 상인', 2, { income: 6, desc: '초당 수입 +6냥' }),
  E('gukgo', '국고', 3, { income: 13, desc: '초당 수입 +13냥' }),
  E('bounty1', '현상금', 0, { bounty: 0.2, icon: 'sack', desc: '처치 현상금 +20%' }),
  E('bounty2', '현상수배', 2, { bounty: 0.4, icon: 'sack', desc: '처치 현상금 +40%' }),
  E('pawn', '전당포', 1, { interest: 0.04, interestCap: 60, icon: 'sack', desc: '라운드마다 가진 엽전의 4% 이자 (최대 60냥). 이자는 겹치지 않고 가장 좋은 하나만' }),
  E('exchange', '환전상', 2, { interest: 0.06, interestCap: 150, icon: 'sack', desc: '라운드마다 가진 엽전의 6% 이자 (최대 150냥). 이자는 겹치지 않고 가장 좋은 하나만' }),
  E('segok', '세곡선', 1, { roundGold: 40, roundGoldPer: 3, icon: 'boat', desc: '라운드가 시작할 때마다 엽전 (40 + 라운드×3)냥' }),

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
  S('signal', '봉수 신호', 3, { smites: 1, icon: 'flame', desc: '이번 판 천벌 +1회. 살 때 바로 채워지고, 되팔아도 그대로입니다.' }),

  // 가시 — 봉화대를 때린 적에게 피해를 돌려줍니다 (라운드가 오를수록 강해짐)
  T('tangja', '탱자 가시', 0, { thorn: 12, desc: '때린 적에게 12 반사' }),
  T('eomnamu', '엄나무 가시', 1, { thorn: 36, desc: '때린 적에게 36 반사' }),
  T('dokgasi', '독가시', 1, { thorn: 20, elem: 'poison', desc: '20 반사 + 독. 독 세트에 셉니다.' }),
  T('soegasi', '쇠가시', 2, { thorn: 110, desc: '때린 적에게 110 반사' }),
  T('bulgasi', '불가시', 2, { thorn: 70, elem: 'fire', desc: '70 반사 + 화상. 화염 세트에 셉니다.' }),
  T('gasiseong', '가시 성채', 3, { thorn: 320, desc: '때린 적에게 320 반사' }),
  T('gasison', '가시 손질', 1, { thornPow: 0.6, icon: 'up', desc: '가시 반사 피해 +60%' }),
  T('mareumsoe', '마름쇠', 1, { thorn: 15, thornSlow: 0.4, desc: '때린 적에게 15 반사, 2초 동안 40% 느려짐' }),
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
  changgwi:  { name: '창귀',        armor: 'light',  hp: 18,  spd: 27, dmg: 3,  cd: 0.9, bounty: 2, r: 5, spr: 'changgwi', pack: 3, from: 6, note: '6라운드부터 · 셋씩 무리 지어 몰려옵니다' },
  geuseundae: { name: '그슨대',     armor: 'heavy',  hp: 150, spd: 9,  dmg: 15, cd: 1.6, bounty: 6, r: 9, spr: 'geuseundae', split: 'shadow', from: 12, note: '12라운드부터 · 쓰러지면 그림자 둘로 갈라집니다' },
  shadow:    { name: '그림자',      armor: 'medium', hp: 45,  spd: 19, dmg: 6,  cd: 1.0, bounty: 2, r: 5, spr: 'shadow', float: true, note: '그슨대가 갈라져 나옵니다' },
  treasure:  { name: '보물 도깨비', armor: 'medium', hp: 380, spd: 34, dmg: 0,  cd: 99,  bounty: 0, r: 7, spr: 'treasure', treasure: true },
  chief:     { name: '두억시니',    armor: 'medium', hp: 3800,  spd: 9,  dmg: 60,  cd: 1.6, bounty: 150, r: 13, spr: 'chief', boss: true, summon: 'grunt' },
  bulga:     { name: '불가사리',    armor: 'heavy',  hp: 15000, spd: 7,  dmg: 110, cd: 2.0, bounty: 300, r: 15, spr: 'bulga', boss: true, summon: 'guard' },
  gumiho:    { name: '구미호',      armor: 'light',  hp: 42000, spd: 15, dmg: 140, cd: 1.2, bounty: 600, r: 14, spr: 'gumiho', boss: true, summon: 'wisp' },
  dragon:    { name: '흑룡',        armor: 'cycle',  hp: 170000, spd: 5, dmg: 150, cd: 2.0, bounty: 0, r: 20, spr: 'dragon', boss: true, final: true, summon: 'giant' },
};
const POOL = { light: ['runner', 'wolf', 'wisp', 'changgwi'], medium: ['grunt', 'bandit'], heavy: ['guard', 'gangsi', 'geuseundae'], fort: ['hareubang', 'giant'] };
// A foe with `from` joins its pool only from that round on.
const poolAt = (armor, r) => POOL[armor].filter(k => !FOES[k].from || r >= FOES[k].from);
const MID_BOSS = { 10: 'chief', 20: 'bulga', 30: 'gumiho' };
const TREASURE_ROUNDS = [5, 15, 25, 35];

const DIFFS = [
  { id: 'easy',  name: '쉬움',    hp: 0.7, count: 0.85, boss: 0.7, edmg: 0.8, income: 1.1, mem: 0.5, theme: 'field',  note: ['적 체력이 낮습니다', '처음이라면 여기서 시작하세요'] },
  { id: 'normal', name: '보통',   hp: 1.0, count: 1.0, boss: 1.0, edmg: 1.0, income: 1.0, mem: 1.0, theme: 'field',  note: ['기준 난이도', '주간 랭킹전도 이 난이도입니다'] },
  { id: 'hard',  name: '어려움',  hp: 1.35, count: 1.1, boss: 1.4, edmg: 1.15, income: 1.0, mem: 1.5, theme: 'autumn', note: ['적 체력과 수가 늘어납니다', '이기면 악몽 I이 열립니다'] },
  { id: 'nm1',   name: '악몽 I',   hp: 1.65, count: 1.15, boss: 1.65, edmg: 1.25, income: 1.0, mem: 2.0, trait: 'scale', theme: 'night',  note: ['어둠이 깔린 전장', '보스가 훨씬 단단합니다'], req: 'hard' },
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

// ───────────────────────── 봉수로 지도 ─────────────────────────
// The five main beacon routes of Joseon (오봉수로) carried fire from the borders to the capital. Each route here is
// five short legs; clearing a route opens the next, and when all five are done, 목멱산 in the capital opens last.
const RULES = {
  rich:  { name: '장시',     desc: '장이 서는 고을. 수입 ×1.3',                 apply: d => { d.income *= 1.3; } },
  poor:  { name: '흉년',     desc: '수입 ×0.75',                                  apply: d => { d.income *= 0.75; } },
  fog:   { name: '안개',     desc: '모든 무기 사거리 -20%',                       apply: d => { d.range = (d.range || 0) - 0.2; } },
  swarm: { name: '떼',       desc: '적 수 ×1.4, 체력 ×0.8',                       apply: d => { d.count *= 1.4; d.hp *= 0.8; } },
  elite: { name: '정예',     desc: '적 체력 ×1.35, 수 ×0.8',                      apply: d => { d.hp *= 1.35; d.count *= 0.8; } },
  ghost: { name: '원혼',     desc: '쓰러진 적의 15%가 원혼으로 한 번 더 일어남',   apply: d => { d.revive = 0.15; d.ghost = 0.35; } },
  dark:  { name: '먹구름',   desc: '하늘이 가려 천벌을 쓸 수 없음',               apply: d => { d.noSmite = true; } },
  cold:  { name: '혹한',     desc: '적이 15% 느리지만 체력 +20%',                 apply: d => { d.spd = 0.85; d.hp *= 1.2; } },
  rush:  { name: '급보',     desc: '라운드가 25초로 짧아짐',                      apply: d => { d.roundTime = 25; } },
  armor: { name: a => ({ light: '날랜 무리', medium: '산적 소굴', heavy: '철기', fort: '돌산길' })[a], desc: a => `주력 갑옷이 자주 ${ARMORS[a].name}`, apply: (d, a) => { d.armorBias = a; } },
  shop:  { name: t => `${TYPES[t].name} 장터`, desc: t => `상점 무기의 절반 넘게가 ${TYPES[t].name}`, apply: (d, t) => { d.shopType = t; } },
  trait: { name: t => BOSS_TRAITS[t].name, desc: t => `보스 특성 · ${BOSS_TRAITS[t].desc}`, apply: (d, t) => { d.trait = t; } },
};
const ruleOf = r => { const [k, a] = r.split(':'); return [RULES[k], a]; };
const ruleName = r => { const [x, a] = ruleOf(r); return typeof x.name === 'function' ? x.name(a) : x.name; };
const ruleDesc = r => { const [x, a] = ruleOf(r); return typeof x.desc === 'function' ? x.desc(a) : x.desc; };
const ROUTES = [
  { id: 'r2', name: '동래길', no: '제2거', from: '동래 다대포에서 광주 천림산까지', color: '#d8503a', theme: 'field', base: 0.8, stages: [
    { id: 'dadaepo', name: '다대포', at: [128.97, 35.05], rules: [] },
    { id: 'gyeongju', name: '경주', at: [129.22, 35.85], rules: ['rich'] },
    { id: 'andong', name: '안동', at: [128.73, 36.57], rules: ['armor:fort'], theme: 'autumn' },
    { id: 'chungju', name: '충주', at: [127.93, 36.99], rules: ['swarm'], theme: 'autumn' },
    { id: 'cheollim', name: '천림산', at: [127.1, 37.42], rules: ['trait:scale'] } ] },
  { id: 'r5', name: '남해길', no: '제5거', from: '순천 돌산포에서 양천 개화산까지', color: '#3f8fb8', theme: 'field', base: 1.0, stages: [
    { id: 'dolsan', name: '돌산포', at: [127.75, 34.7], rules: ['fog'] },
    { id: 'haenam', name: '해남', at: [126.6, 34.57], rules: ['rich', 'elite'] },
    { id: 'buan', name: '부안', at: [126.73, 35.73], rules: ['shop:arrow'] },
    { id: 'seosan', name: '서산', at: [126.45, 36.78], rules: ['fog', 'ghost'], theme: 'night' },
    { id: 'gaehwa', name: '개화산', at: [126.81, 37.58], rules: ['trait:wind'] } ] },
  { id: 'r1', name: '관북길', no: '제1거', from: '경흥 서수라에서 양주 아차산까지', color: '#6fb6d8', theme: 'snow', base: 1.15, stages: [
    { id: 'seosura', name: '서수라', at: [130.67, 42.3], rules: ['cold'] },
    { id: 'hoeryeong', name: '회령', at: [129.75, 42.44], rules: ['cold', 'dark'] },
    { id: 'hamheung', name: '함흥', at: [127.53, 39.92], rules: ['armor:heavy'] },
    { id: 'cheorwon', name: '철원', at: [127.31, 38.15], rules: ['cold', 'swarm'] },
    { id: 'acha', name: '아차산', at: [127.1, 37.57], rules: ['trait:pure'], theme: 'field' } ] },
  { id: 'r3', name: '강계길', no: '제3거', from: '강계 만포진에서 무악 동봉까지', color: '#8a5ad8', theme: 'night', base: 1.3, stages: [
    { id: 'manpo', name: '만포진', at: [126.25, 41.15], rules: ['swarm'] },
    { id: 'ganggye', name: '강계', at: [126.6, 40.97], rules: ['ghost'] },
    { id: 'yeongbyeon', name: '영변', at: [125.8, 39.81], rules: ['poor', 'shop:charm'] },
    { id: 'pyeongyang', name: '평양', at: [125.75, 39.03], rules: ['swarm', 'ghost'] },
    { id: 'muak_e', name: '무악 동봉', at: [126.95, 37.58], rules: ['trait:fire'] } ] },
  { id: 'r4', name: '의주길', no: '제4거', from: '의주에서 무악 서봉까지', color: '#c99a2e', theme: 'autumn', base: 1.5, stages: [
    { id: 'uiju', name: '의주', at: [124.53, 40.2], rules: ['armor:heavy'] },
    { id: 'jeongju', name: '정주', at: [125.2, 39.7], rules: ['rush'] },
    { id: 'haeju', name: '해주', at: [125.72, 38.04], rules: ['fog'], theme: 'night' },
    { id: 'gaeseong', name: '개성', at: [126.55, 37.97], rules: ['rush', 'dark'], theme: 'night' },
    { id: 'muak_w', name: '무악 서봉', at: [126.94, 37.58], rules: ['trait:break'] } ] },
];
const FINALE = { id: 'mongmyeok', name: '목멱산', at: [126.99, 37.55], rules: ['trait:adapt'], theme: 'night' };
// Every leg in the same place along a route plays alike: longer, and ending on a bigger boss.
const LEG = [
  { rounds: 12, boss: 'chief', bossHp: 0.8,  mid: {} },
  { rounds: 15, boss: 'chief', bossHp: 1.2,  mid: {} },
  { rounds: 18, boss: 'bulga', bossHp: 0.6,  mid: { 10: 'chief' } },
  { rounds: 20, boss: 'bulga', bossHp: 0.85, mid: { 10: 'chief' } },
  { rounds: 24, boss: 'gumiho', bossHp: 0.45, mid: { 10: 'chief', 20: 'bulga' } },
];
const STAGES = [];
ROUTES.forEach((rt, ri) => rt.stages.forEach((st, si) => {
  const leg = LEG[si], k = rt.base * (1 + 0.05 * si);
  STAGES.push(Object.assign({ route: rt, ri, si, theme: rt.theme, rounds: leg.rounds, boss: leg.boss, bossHp: leg.bossHp * k, mid: leg.mid,
    treasure: [5, 15].filter(r => r < leg.rounds), hp: k, count: 0.95 + 0.04 * ri + 0.02 * si, midBoss: k * 0.8, edmg: 1 + (k - 1) * 0.45,
    mem: +(0.9 + ri * 0.35 + si * 0.1).toFixed(2), bonus: Math.round(20 + si * 8 + ri * 12) }, st));
}));
STAGES.push(Object.assign({ route: null, ri: 5, si: 0, rounds: 30, boss: 'dragon', bossHp: 1.5, mid: { 10: 'chief', 20: 'bulga' }, treasure: [5, 15, 25],
  hp: 1.9, count: 1.2, midBoss: 1.8, edmg: 1.4, mem: 3.0, bonus: 200 }, FINALE));
const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));
// The run's difficulty for a leg: the leg's own numbers, then its rules.
function stageDiff(st) {
  const d = { id: 'map', name: st.name, hp: st.hp, count: st.count, boss: st.midBoss, edmg: st.edmg, income: 1, mem: st.mem, theme: st.theme, note: [] };
  for (const r of st.rules) { const [x, a] = ruleOf(r); x.apply(d, a); }
  return d;
}

const routeDone = (rt, p) => rt.stages.every(st => p.map[st.id] && p.map[st.id].clears > 0);

// 업적: once earned, any of them can be worn as a 칭호 next to your name in 명예의 전당. `goal` shows progress.
// ── 조합 ──
// Certain items held TOGETHER switch on a hidden combo (repeat an id for "×N" of one item); selling any part switches
// it off. The first time a combo switches on it is written into the 조합 도감 for good. Combos stay smaller than sets.
// The effects themselves are read in game.js wherever R.S.cmb.has(id) appears.
const COMBOS = [
  { id: 'hwacha', name: '화차 일제사격', items: ['hwacha', 'singijeon'], type: 'cannon', eff: '화포 폭발 범위 +25% · 화차와 신기전이 한 발 더', lore: '문종 때 만든 화차는 신기전 백 발을 한꺼번에 쏘아 올렸다고 합니다.', hint: '수레 위에서 불화살이 하늘을 덮는다' },
  { id: 'aegisal', name: '애기살 쌍궁', items: ['gakgung', 'pyeonjeon'], type: 'arrow', eff: '궁시 관통 +1', lore: '편전(애기살)은 통아에 넣어 쏘는 짧은 화살로, 각궁과 짝을 이룹니다.', hint: '짧은 화살에는 뿔활이 제격' },
  { id: 'bido3', name: '비도 삼연', items: ['bido', 'bido', 'bido'], type: 'blade', eff: '비도가 한 번에 세 자루씩 날아감', lore: '같은 날을 셋 겹치면 손이 셋인 듯 빨라집니다.', hint: '같은 칼을 셋 모아라' },
  { id: 'eumyang', name: '음양 상극', items: ['hwabu', 'bingbu'], type: 'charm', eff: '불타면서 느려진 적이 받는 피해 +30%', lore: '불은 얼음을 녹이고 얼음은 불을 끕니다. 둘이 한 몸에 닿으면 버티지 못합니다.', hint: '불과 얼음이 한 부적에서 만나면' },
  { id: 'yugeuijeon', name: '육의전', items: ['jangteo', 'sangdan', 'daesang'], type: 'eco', eff: '장터 새로고침 비용 -30%', lore: '한양 종로의 큰 시전 여섯 곳. 장사꾼이 모이면 값이 내려갑니다.', hint: '장터, 보부상, 개성의 장사꾼' },
  { id: 'sanseong', name: '산성 축조', items: ['wall1', 'wall2', 'wall3'], type: 'surv', eff: '받는 피해 -10% · 최대 체력 +10%', lore: '돌을 쌓고 또 쌓아 무너지지 않는 산성이 됩니다.', hint: '성벽을 세 겹으로' },
  { id: 'gasi', name: '가시 울타리', items: ['tangja', 'eomnamu'], type: 'thorn', eff: '가시 반사 피해가 둘레의 적에게도 50%', lore: '탱자와 엄나무 가지는 예부터 잡귀를 막는 울타리로 썼습니다.', hint: '잡귀를 막는 두 가지 나무' },
  { id: 'samdok', name: '삼독', items: ['dokhwasal', 'dokbu', 'dokgasi'], type: 'poison', eff: '독 최대 중첩 +6', lore: '화살, 부적, 가시에 모두 독을 바르면 해독할 틈이 없습니다.', hint: '화살과 부적과 가시, 모두 독으로' },
  { id: 'noegong', name: '뇌공 강림', items: ['noebu', 'noegung', 'noesin'], type: 'bolt', eff: '번개가 튈 때 10% 확률로 작은 천벌 벼락', lore: '뇌공은 벼락을 다스리는 신입니다. 세 가지 번개가 모이면 그가 내려옵니다.', hint: '부적, 활, 검. 모두 벼락을 품었다' },
  { id: 'baekbo', name: '백보천양', items: ['range1', 'range2', 'singung'], type: 'arrow', eff: '신궁 사거리 +30% · 치명타 +10%', lore: '백 걸음 밖 버들잎을 맞힌다는 명궁의 고사입니다.', hint: '매의 눈으로 천 리를 본 명궁' },
  { id: 'dokkaebi', name: '도깨비 잔치', items: ['bangmangi', 'dokkaebibul', 'dungap'], type: 'chaos', eff: '처치할 때 3% 확률로 엽전 주머니 (금 나와라 뚝딱)', lore: '방망이를 두드리면 금이 나온다는 그 도깨비 이야기입니다.', hint: '방망이, 불, 둔갑. 도깨비 셋이 모이면' },
  { id: 'chilseong', name: '칠성 태극진', items: ['chilseong', 'taegeuk'], type: 'blade', eff: '칠성검이 튕길 때마다 피해가 줄지 않고 10%씩 늘어남', lore: '북두칠성과 태극이 한 진을 이룹니다.', hint: '일곱 별과 음양이 만나는 진' },
  { id: 'yongseung', name: '용의 승천', items: ['yeouiju', 'cheondung'], type: 'chaos', eff: '최종 결전 보스(흑룡 등)에게 주는 피해 +25%', lore: '여의주를 문 용만이 하늘로 오릅니다. 그 힘으로 흑룡을 누릅니다.', hint: '구슬과 천둥, 하늘로 오르는 것' },
  { id: 'podo', name: '포도청 대포진', items: ['hongi', 'cheonja'], type: 'cannon', eff: '석갑에게 주는 화포 피해 3배 (원래 2배)', lore: '가장 큰 두 대포를 나란히 걸면 바위도 가루가 됩니다.', hint: '가장 무거운 대포 둘' },
  { id: 'geoul', name: '거울 속 요괴', items: ['geoul', 'dungap'], type: 'chaos', eff: '요술 최소 배율 1.0 (운이 나빠도 손해 없음)', lore: '거울에 비친 요괴는 제 모습을 바꾸지 못합니다.', hint: '비추는 것과 모습을 바꾸는 것' },
  { id: 'jeoseung', name: '저승사자 행차', items: ['jeoseung', 'obang'], type: 'charm', eff: '부적에 맞은 체력 15% 이하 적은 바로 쓰러짐 (보스 제외)', lore: '오방 신장이 길을 열면 저승사자가 데려갑니다.', hint: '다섯 방위의 신장과 저승' },
  { id: 'bullo', name: '불로장생', items: ['regen1', 'regen2', 'regen3'], type: 'surv', eff: '체력 재생 2배', lore: '약수, 산삼, 불로초. 진시황도 찾던 것들입니다.', hint: '물과 뿌리와 풀, 늙지 않는 세 가지' },
  { id: 'jincheon', name: '진천뢰 연발', items: ['jincheonroe', 'jincheonroe', 'jincheonroe'], type: 'cannon', eff: '비격진천뢰가 터진 자리에서 작은 폭발 두 번 더', lore: '임진왜란 때 성을 지킨 시한폭탄, 비격진천뢰입니다.', hint: '같은 폭탄을 셋 모아라' },
  { id: 'yeonno', name: '연노진', items: ['soenoe', 'sunogi'], type: 'arrow', eff: '수노기가 한 발 더 · 쇠뇌 장전 20% 빠름', lore: '큰 쇠뇌와 연달아 쏘는 수노기를 한 진에 세우면 화살이 끊이지 않습니다.', hint: '방아쇠 달린 활 둘' },
  { id: 'gyeoljin', name: '결계진', items: ['gyeolgye', 'nakinbu'], type: 'charm', eff: '결계 지대에 선 적에게 낙인 (받는 피해 +25%)', lore: '결계로 가두고 낙인을 찍으면 달아날 곳이 없습니다.', hint: '가두는 부적과 찍는 부적' },
  { id: 'segun', name: '세곡 운송', items: ['segok', 'jangteo'], type: 'eco', eff: '세곡선 수입 +50%', lore: '조운선이 실어 온 세곡은 장터를 거쳐 한양을 먹여 살렸습니다.', hint: '배와 장터' },
  { id: 'jilryeo', name: '질려 진지', items: ['jillyeo', 'mareumsoe'], type: 'thorn', eff: '질려포통 지대가 30% 넓고 1초 더 남음', lore: '마름쇠를 뿌린 땅에 질려포통까지 터지면 발 디딜 곳이 없습니다.', hint: '쇠 가시를 흩뿌리는 두 가지' },
];
const COMBO = Object.fromEntries(COMBOS.map(c => [c.id, c]));
const COMBO_OF = {}; // item id → combos it belongs to
for (const c of COMBOS) for (const id of new Set(c.items)) (COMBO_OF[id] = COMBO_OF[id] || []).push(c.id);

const ACHS = [
  { id: 'first', g: '진행', name: '첫 출정', title: '신참 봉수군', desc: '첫 판을 마칩니다' },
  { id: 'w_easy', g: '진행', name: '첫 봉화', title: '봉수군', desc: '쉬움에서 이깁니다' },
  { id: 'w_normal', g: '진행', name: '보통의 봉화', title: '파수꾼', desc: '보통에서 이깁니다' },
  { id: 'w_hard', g: '진행', name: '가을 산을 넘어', title: '봉수장', desc: '어려움에서 이깁니다' },
  { id: 'w_nm1', g: '진행', name: '첫 악몽', title: '악몽을 걷는 자', desc: '악몽 I에서 이깁니다' },
  { id: 'w_nm3', g: '진행', name: '악몽의 끝', title: '새벽을 부른 자', desc: '악몽 III에서 이깁니다' },
  { id: 'w_nether', g: '진행', name: '저승 문턱', title: '저승을 거닌 자', desc: '저승길 I에서 이깁니다' },
  { id: 'w_nether3', g: '진행', name: '저승의 끝', title: '불멸의 수호자', desc: '저승길 III에서 이깁니다' },
  { id: 'runs10', g: '쌓기', name: '열 번의 봉화', title: '단골 수호자', desc: '10판을 마칩니다', goal: p => [p.runs, 10] },
  { id: 'runs50', g: '쌓기', name: '쉰 번의 봉화', title: '백전노장', desc: '50판을 마칩니다', goal: p => [p.runs, 50] },
  { id: 'runs100', g: '쌓기', name: '백 번의 봉화', title: '봉화의 화신', desc: '100판을 마칩니다', goal: p => [p.runs, 100] },
  { id: 'kills5k', g: '쌓기', name: '도깨비 사냥', title: '도깨비 사냥꾼', desc: '적을 모두 5,000 쓰러뜨립니다', goal: p => [p.stats.kills, 5000] },
  { id: 'kills50k', g: '쌓기', name: '추풍낙엽', title: '만 명을 벤 자', desc: '적을 모두 50,000 쓰러뜨립니다', goal: p => [p.stats.kills, 50000] },
  { id: 'bosses20', g: '쌓기', name: '토벌대', title: '토벌대장', desc: '보스를 모두 20 쓰러뜨립니다', goal: p => [p.stats.bosses, 20] },
  { id: 'treasure10', g: '쌓기', name: '보물 사냥', title: '보물 사냥꾼', desc: '보물 도깨비를 모두 10 잡습니다', goal: p => [p.stats.treasures, 10] },
  { id: 'perk1', g: '쌓기', name: '배움의 길', title: '배우는 수호자', desc: '수호 기억을 모두 1단계 이상 배웁니다', goal: p => [PERKS.filter(x => (p.perks[x.id] || 0) >= 1).length, PERKS.length] },
  { id: 'perkmax', g: '쌓기', name: '천년의 기억', title: '천년 수호자', desc: '수호 기억을 모두 끝까지 배웁니다', goal: p => [PERKS.filter(x => (p.perks[x.id] || 0) >= x.max).length, PERKS.length] },
  { id: 'nosmite', g: '도전', name: '하늘에 기대지 않고', title: '스스로 선 자', desc: '천벌을 쓰지 않고 이깁니다' },
  { id: 'mono', g: '도전', name: '외길', title: '외길 무사', desc: '한 종류 무기만 사서 이깁니다' },
  { id: 'all5', g: '도전', name: '오방', title: '오방장군', desc: '다섯 종류 무기를 모두 지닌 채 이깁니다' },
  { id: 'noeco', g: '도전', name: '맨손 살림', title: '청렴한 관리', desc: '경제 물건 없이 이깁니다' },
  { id: 'clutch', g: '도전', name: '구사일생', title: '구사일생', desc: '체력 10% 이하로 이깁니다' },
  { id: 'flawless', g: '도전', name: '흠 없는 봉화', title: '철옹성', desc: '홰가 하나도 꺼지지 않고 이깁니다' },
  { id: 'dragon60', g: '도전', name: '번개 토벌', title: '용 잡는 자', desc: '흑룡을 60초 안에 쓰러뜨립니다' },
  { id: 'treasure4', g: '도전', name: '복 받은 날', title: '복 받은 자', desc: '한 판에 보물 도깨비 넷을 모두 잡습니다' },
  { id: 'kills1500', g: '도전', name: '구름 같은 적', title: '천하장사', desc: '한 판에 적 1,500을 쓰러뜨립니다' },
  { id: 'set3', g: '도전', name: '장인의 길', title: '장인', desc: '무기 세트 하나를 마지막 단계까지 켭니다' },
  { id: 'elem2', g: '도전', name: '오행 통달', title: '도사', desc: '속성 세트 둘을 함께 2단계로 켭니다' },
  { id: 'ranked', g: '겨룸', name: '첫 겨룸', title: '겨루는 자', desc: '주간 랭킹전에 나갑니다' },
  { id: 'rankwin', g: '겨룸', name: '명예의 전당', title: '명예로운 수호자', desc: '주간 랭킹전에서 이깁니다' },
  { id: 'route1', g: '봉수로', name: '첫 봉수로', title: '봉수로 순찰사', desc: '봉수로 하나를 한양까지 잇습니다' },
  { id: 'route5', g: '봉수로', name: '다섯 봉수로', title: '팔도 순찰사', desc: '다섯 봉수로를 모두 잇습니다', goal: p => [ROUTES.filter(rt => routeDone(rt, p)).length, ROUTES.length] },
  { id: 'capital', g: '봉수로', name: '목멱산 봉화', title: '도성 봉수대장', desc: '목멱산에서 흑룡을 쓰러뜨립니다' },
  { id: 'combo1', g: '조합', name: '첫 비법', title: '호기심 많은 봉수군', desc: '조합 하나를 처음 켭니다', goal: p => [Object.keys(p.combos).length, 1] },
  { id: 'combo6', g: '조합', name: '비법 여섯', title: '비법가', desc: '서로 다른 조합 6개를 찾습니다', goal: p => [Object.keys(p.combos).length, 6] },
  { id: 'comboall', g: '조합', name: '조합 도감 완성', title: '대장장이', desc: `조합 ${COMBOS.length}개를 모두 찾습니다`, goal: p => [Object.keys(p.combos).length, COMBOS.length] },
];
const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
// 도전 achievements count only in 40-round runs on 보통 or harder (주간 랭킹전 included).
const ACH_HARD = ['nosmite', 'mono', 'all5', 'noeco', 'clutch', 'flawless'];

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
// Level costs climb steeply (base × 5 × level^1.5, rounded to 5): the first levels come quickly, the last ones
// are a long-term goal. All perks together cost 6,745 shards.
const perkCost = (p, l) => Math.max(5, Math.round(p.base * 5 * Math.pow(l + 1, 1.5) / 5) * 5);
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
  { id: '2026-10-18a', date: '10월 18일', title: '대규모 패치: 봉수로 지도 · 조합 도감 · 업적과 칭호 · 새 무기와 적', items: [
    '<b>봉수로 지도</b>가 열렸습니다. 조선의 다섯 봉수로(동래길 · 남해길 · 관북길 · 강계길 · 의주길) 25구간을 하나씩 이어 한양 목멱산까지 봉화를 올리는 모드입니다. 구간마다 라운드 수와 규칙(안개, 큰 장, 혹한, 돌격 등)이 다르고, 처음 봉화를 올리면 기억 조각을 더 받습니다.',
    '다섯 길을 모두 이으면 마지막 봉화 <b>목멱산</b>이 열립니다. 관북길은 눈 덮인 전장에서 싸웁니다.',
    '<b>조합 도감</b>이 생겼습니다. 특정 물건을 함께 봇짐에 넣으면 숨은 조합 22가지가 켜집니다(예: 화차 + 신기전, 비도 ×3). 처음 켜면 도감에 남고 기억 조각 +3을 받습니다. 장터에서 매듭 표시가 붙은 물건이 재료이고, 무엇과 짝인지는 도감의 단서로 찾아보세요.',
    '<b>업적 36개와 칭호</b>가 생겼습니다. 업적을 이루면 칭호를 얻고, 하나를 골라 달면 명예의 전당에서 이름 옆에 보입니다. 이미 이룬 승리 · 판수 · 수호 기억은 바로 인정되고, 처치 수 같은 누적 기록은 오늘부터 셉니다.',
    '<b>새 물건 13가지</b>: 월도, 쇠뇌, 수노기, 낙인부, 결계부, 질려포통, 파진포, 요괴 호리병, 삼족오, 토벌 비책, 세곡선, 봉수 신호, 마름쇠. 도감에서 자세히 볼 수 있습니다.',
    '<b>새 적</b>: 창귀(6라운드부터 셋씩 무리 지어 옴), 그슨대(12라운드부터, 쓰러지면 그림자 둘로 갈라짐).',
    '<b>악몽 I 조정</b>: 10라운드 두억시니에서 너무 많이 막혀서 조금 쉽게 했습니다. 적 체력 ×1.8 → ×1.65, 적 수 ×1.2 → ×1.15, 보스 체력 ×2.0 → ×1.65, 적 공격 ×1.3 → ×1.25. 악몽 II부터는 그대로입니다.',
    '새 물건과 적은 이번 주(W43) 주간 랭킹전부터 함께 나옵니다.',
  ] },
  { id: '2026-10-14g', date: '10월 14일', title: '첫 출정 안내', items: [
    '처음 하는 분을 위해 봉수군이 필요한 순간마다 한 가지씩 알려 줍니다: 봉수대 체력, 무기 사기, 상성, 엽전, 새로고침, 세트, 천벌, 보물 도깨비, 수호 기억.',
    '처음이면 난이도 선택에서 쉬움이 먼저 골라져 있습니다. 안내는 언제든 끌 수 있고, 설정의 "첫 출정 안내 다시 보기"로 다시 볼 수 있습니다.',
  ] },
  { id: '2026-10-14f', date: '10월 14일', title: '수호 기억 비용 조정 · 플레이 시간 기록', items: [
    '수호 기억이 너무 빨리 다 채워져서 비용을 올렸습니다. 1레벨은 비교적 빨리, 높은 레벨일수록 크게 비싸집니다 (전부 배우는 데 760 → 6,745조각).',
    '이미 배운 수호 기억은 그대로 유지됩니다.',
    '타이틀 화면 오른쪽 위에 총 플레이 시간이 나오고, 악몽 III을 처음 이기면 저승길까지 걸린 시간이 기록됩니다.',
  ] },
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
