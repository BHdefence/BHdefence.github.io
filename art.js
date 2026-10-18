// 봉화대 사수 — pixel art: palette, sprite maps, item icons, battlefield painting and pixel primitives.
'use strict';

const PAL = {
  k: '#17131c', K: '#2b2530', w: '#f6f1e7', s: '#c9ced8', g: '#8b919e', G: '#5b6070',
  b: '#4f86ad', B: '#2f5677', r: '#cf4a35', R: '#8c2b22', o: '#ee8a2c', y: '#f3c94a', Y: '#b88a2a',
  n: '#8a5a34', N: '#563620', t: '#e0b083', T: '#b9845b', e: '#4fae5f', E: '#2c6e3c', q: '#b3d3a6',
  p: '#9a6ad8', P: '#5d3a8e', m: '#ee6aa6', c: '#a6e6ff', C: '#4fa8d8', v: '#d8d0c0', V: '#a39a89', x: '#6e665b',
  f: '#fff2a8', l: '#a8e66b', d: '#3a2f45', D: '#221b2b',
};

// Sprite maps: rows of palette letters, '.' is transparent. `alt` replaces the last rows for a second walking frame.
const SPR = {
  grunt: { rows: [
    '.....kk.....',
    '....kyyk....',
    '...kkbbkk...',
    '..kbbbbbbk..',
    '..kbwkbwkk..',
    '..kbwkkwbk.k',
    '...kbbbbk.kn',
    '..kbbbbbbkkn',
    '.kbkyyyykbnk',
    '.kkkyKyKkkk.',
    '...kyyyyk...',
    '...kbkkbk...',
    '...kbk.kbk..',
    '...kk...kk..'], alt: [
    '...kbkkbk...',
    '..kbk...kbk.',
    '..kk.....kk.'] },
  runner: { rows: [
    '..k....k..',
    '.kyk..kyk.',
    '..krrrrk..',
    '.krrrrrrk.',
    '.krwkrwkk.',
    '.krrkkrrk.',
    '..krrrrk..',
    '.krkyyykrk',
    '.kk.yyy.kk',
    '...kyyyk..',
    '..krk.krk.',
    '..kk...kk.'], alt: [
    '.krk...krk',
    '.kk.....kk'] },
  bandit: { rows: [
    '....kkkk....',
    '...kKKKKk...',
    '...krrrrk...',
    '...kttttk.k.',
    '...ktkktk.ks',
    '...kKKKKk.ks',
    '....kKKk..ks',
    '..knnnnnnkks',
    '.ktknnnnktks',
    '.kkkNNNNkkk.',
    '...knnnnk...',
    '...kNkkNk...',
    '...kN..Nk...',
    '...kk..kk...'], alt: [
    '...kNkkNk...',
    '..kN....Nk..',
    '..kk....kk..'] },
  guard: { rows: [
    '.....rr.....',
    '....krrk....',
    '...kggggk..s',
    '..kgssssgk.s',
    '..kgkGGkgk.n',
    '..kgGGGGgk.n',
    '...kggggk..n',
    '..kssssssk.n',
    '.ksgsgsgssnk',
    '.kgkssssgkn.',
    '..kGGGGGGkn.',
    '...kgkkgk...',
    '...kg..gk...',
    '...kk..kk...'], alt: [
    '...kgkkgk...',
    '..kg....gk..',
    '..kk....kk..'] },
  gangsi: { rows: [
    '...kkkkkk...',
    '..kKKKKKKk..',
    '...kkkkkk...',
    '...kqyyqk...',
    '...kqRRqk...',
    '...kkqqkk...',
    '.kqkBBBBkqk.',
    '.kqBBBBBBqk.',
    '..kByyyyBk..',
    '...kBBBBk...',
    '...kBBBBk...',
    '...kBkkBk...',
    '...kq..qk...',
    '...kk..kk...'] },
  hareubang: { rows: [
    '....kkkk....',
    '...kxxxxk...',
    '..kxVVVVxk..',
    '.kkkkkkkkkk.',
    '..kVVVVVVk..',
    '..kVwkkwVk..',
    '..kVwkkwVk..',
    '..kVVkkVVk..',
    '..kVVVVVVk..',
    '..kVkkkkVk..',
    '.kVVVVVVVVk.',
    '.kVkkVVkkVk.',
    '.kVVVVVVVVk.',
    '.kVVVVVVVVk.',
    '..kxxxxxxk..',
    '..kkkkkkkk..'] },
  giant: { rows: [
    '.....kkkkkk.....',
    '....kVVVVVVk....',
    '...kVvVVVVvVk...',
    '...kVkyVVykVk...',
    '...kVVVVVVVVk...',
    '.kkkxVVVVVVxkkk.',
    'kVVkxxVVVVxxkVVk',
    'kVvkVVVVVVVVkvVk',
    'kVVkVVxVVxVVkVVk',
    '.kkkVVVVVVVVkkk.',
    '...kVVVVVVVVk...',
    '...kxxVVVVxxk...',
    '...kVVk..kVVk...',
    '...kVVk..kVVk...',
    '..kxxxk..kxxxk..',
    '..kkkkk..kkkkk..'] },
  wolf: { rows: [
    '.kk...........',
    'kgGk..........',
    'kgggkkkkkkk...',
    'kwkgggggggGkk.',
    '.kgggggggggGGk',
    '..kggggggggGk.',
    '..kGkkkkkGkk..',
    '..kgk...kgk...',
    '..kgk...kgk...',
    '..kk....kk....'], alt: [
    '.kgk.....kgk..',
    '.kk......kk...'] },
  wisp: { rows: [
    '...k....',
    '..kck...',
    '..kCck..',
    '.kcCCck.',
    '.kCwwCk.',
    'kcCwkwCk',
    'kcCwwwCk',
    '.kcCCck.',
    '..kkkk..'], alt: [
    '.kcCCck.',
    '..kkkk..'] },
  changgwi: { rows: [
    '..kk....kk..',
    '.kock..kcok.',
    '.kcccccccck.',
    'kcoccccccock',
    'kcrkcccckrck',
    'kcccccccccck',
    '.kcwkwwkwck.',
    '..kcccccck..',
    '.kcoCCCCock.',
    'kccCoCCoCcck',
    'kwkCCCCCCkwk',
    '.k.kCooCk.k.',
    '...kckkck...',
    '...kk..kk...'], alt: [
    '..kck..kck..',
    '..kk....kk..'] },
  treasure: { rows: [
    '.....kk.......',
    '....kyyk.kkk..',
    '...kkeekkYYYk.',
    '..keeeeeekyYYk',
    '..kewkewkkYyYk',
    '..kewkkwekYYYk',
    '...keeeek.kkk.',
    '..keeeeeek....',
    '.kekyyyykek...',
    '.kkkyKyKkkk...',
    '...kyyyyk.....',
    '...kekkek.....',
    '...kek.kek....',
    '...kk...kk....'], alt: [
    '...kekkek.....',
    '..kek...kek...',
    '..kk.....kk...'] },
  bulga: { rows: [
    '......k.k.k.k.......',
    '.....kskskskskk.....',
    '....kggggggggggk....',
    '..kkgggggggggggGk...',
    '.kgggggggggggggGGk..',
    'kgykggggggggggggGGk.',
    'kggggggggggggggGGGk.',
    'kgkkgggggggggggGGk..',
    'kgk.kGGGGGGGGGGGk...',
    'kgk.kgk.kgk.kgk.....',
    '.kk.kgk.kgk.kgk.....',
    '....kGk.kGk.kGk.....',
    '....kkk.kkk.kkk.....'] },
  gumiho: { rows: [
    '..........kk..kk..kk',
    '.........kwmkkwmkkwk',
    '.k.k.....kwwkwwkwwk.',
    'kwkwk.....kwwwwwwk..',
    'kwwwwk.....kwwwwk...',
    'kwrwwwkkkkkkwwwk....',
    '.kwwwwwwwwwwwwk.....',
    '..kwwwwwwwwwwwk.....',
    '..kwwkkkkkkwwk......',
    '..kwk.....kwk.......',
    '..kwk.....kwk.......',
    '..kk......kk........'] },
  dragon: { rows: [
    '..kk..................kk..',
    '.kRRk.....kkkkkk.....kRRk.',
    '.kRdRk...kddddddk...kRdRk.',
    '..kddk..kddddddddk..kddk..',
    '...kddkkddrddddrddkkddk...',
    '...kdddddddddddddddddk....',
    '..kPdddkddddddddddkdddPk..',
    '.kPPPdk.kddwddwddk.kdPPPk.',
    'kPPPPk...kddddddk...kPPPPk',
    'kPPPk....kdyyyydk....kPPPk',
    'kPPk.....kddddddk.....kPPk',
    '.kk.....kdddddddk......kk.',
    '.......kdddkkdddk.........',
    '......kdddk..kdddk........',
    '......kddk....kddk........',
    '......kkk......kkk........'] },
};
// Bosses that reuse a smaller map with their own colors.
const SPR_ALIAS = {
  chief: { base: 'grunt', pal: { b: '#c8503a', B: '#8c2b22', y: '#f3d36a' } },
  geuseundae: { base: 'giant', pal: { V: '#2e2640', v: '#433858', x: '#1b1526', y: '#ff5a4a' } },
  shadow: { base: 'wisp', pal: { c: '#55467a', C: '#2e2640', w: '#ff7a6a' } },
};
const SPR_SCALE = { chief: 2, bulga: 2, gumiho: 2, dragon: 2 };

// 12×12 item icons. 'a' is replaced by the item's type colour, 'z' by its element colour.
const ICONS = {
  knife: [
    '............', '.........kk.', '........ksk.', '.......ksk..', '......ksk...', '.....ksk....',
    '..k.ksk.....', '...kNk......', '...kNNk.....', '..kNk.k.....', '.kNk........', '..k.........'],
  saber: [
    '..........k.', '.........ksk', '........ksk.', '.......ksk..', '......ksk...', '.....ksk....',
    '....ksk.....', '..kkyk......', '...kyk......', '..kNkk......', '.kNk........', '.kk.........'],
  sword: [
    '..........kk', '.........kwk', '........kwsk', '.......kwsk.', '......kwsk..', '.....kwsk...',
    '..kkkkwsk...', '...kykk.....', '...kyyk.....', '..kNk.k.....', '.kNk........', '.kk.........'],
  star: [
    '.....kk.....', '....kyyk....', 'kkkkkyykkkkk', 'kyyyyyyyyyyk', '.kyyyyyyyyk.', '..kyyyyyyk..',
    '..kyyyyyyk..', '.kyyykkyyyk.', '.kyyk..kyyk.', 'kyyk....kyyk', 'kkk......kkk', '............'],
  bow: [
    '...kkk......', '..knnnk.....', '..kn.kwk....', '.kn...kwk...', '.kn....kwk..', 'kn......kwk.',
    'kn......kwk.', '.kn....kwk..', '.kn...kwk...', '..kn.kwk....', '..knnnk.....', '...kkk......'],
  arrow: [
    '..........kk', '.........ksk', '........ksk.', '.......kNk..', '......kNk...', '.....kNk....',
    '....kNk.....', '...kNk......', '.kkNk.......', 'krkk........', '.krk........', '..k.........'],
  charm: [
    '..kkkkkkkk..', '..kyyyyyyk..', '..kyRRRRyk..', '..kyyRyyyk..', '..kyRRRRyk..', '..kyyyyRyk..',
    '..kyRRRRyk..', '..kyyRyyyk..', '..kyRRRyyk..', '..kyyyyyyk..', '..kkkkkkkk..', '............'],
  charm5: [
    'kkkkk..kkkkk', 'kyRyk..kyRyk', 'kyyyk..kyyyk', 'kyRyk..kyRyk', 'kkkkkkkkkkk.', '...kyRyk....',
    '...kyyyk....', '...kyRyk....', '...kkkkk....', '............', '............', '............'],
  skull: [
    '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.',
    '..kwwwwwwk..', '...kwkwkk...', '...kkkkk....', '............', '............', '............'],
  yinyang: [
    '...kkkkkk...', '..krrrrrrk..', '.krrrrrrrrk.', 'krrrkrrrrrrk', 'krrrrrrrrrrk', 'krrrrrrBBBBk',
    'kBBBBrrrrBBk', 'kBBBBBBkBBBk', 'kBBBBBBBBBBk', '.kBBBBBBBBk.', '..kBBBBBBk..', '...kkkkkk...'],
  bomb: [
    '.......k.y..', '......kNky..', '.....kNk....', '...kkkkkk...', '..kGGGGGGk..', '.kGGsGGGGGk.',
    '.kGsGGGGGGk.', '.kGGGGGGGGk.', '.kGGGGGGGGk.', '..kGGGGGGk..', '...kkkkkk...', '............'],
  cannon: [
    '............', '..........k.', '......kkkkok', '....kkYYYYk.', '..kkYYYYYYk.', '.kYYYYYYkk..',
    'kYYYYYYk....', 'kkYYkkk.....', '.kNNNNNk....', 'kNkNNNkNk...', 'kkk.kk.kk...', '............'],
  hwacha: [
    '.......k.k.k', '......kokoko', '.....kNkNkNk', '....kNNNNNNk', '...kNNkNNkNk', '..kNNNNNNNk.',
    '.kNNkNNkNk..', '.kNNNNNNk...', 'kNNNNNNk....', 'kkkNNkkk....', '.kk..kk.....', '............'],
  wisp: [
    '.....k......', '....kck.....', '....kcCk....', '...kcCck....', '..kcCCCck...', '.kcCwwCCck..',
    '.kcwwwwCck..', '.kCwwwwCck..', '.kcCwwCck...', '..kcCCck....', '...kkkk.....', '............'],
  club: [
    '.......kkkk.', '......kNNNNk', '.....kNyNNyk', '....kNNNNNNk', '...kNNyNNyNk', '..kNNNNNNkk.',
    '.kNNNNNkk...', 'kNNNkkk.....', 'knnk........', 'knk.........', 'kk..........', '............'],
  mask: [
    '..kkkkkkkk..', '.krrrrrrrrk.', 'krrrrrrrrrrk', 'krkkrrrrkkrk', 'krkwrrrrwkrk', 'krrrrrrrrrrk',
    'krrrrkkrrrrk', '.krrkwwkrrk.', '.krrrkkrrrk.', '..krrrrrrk..', '...kkkkkk...', '............'],
  mirror: [
    '...kkkkkk...', '..kYYYYYYk..', '.kYccccccYk.', '.kYcwwccccYk', '.kYcwccccYk.', '.kYccccccYk.',
    '.kYccccccYk.', '..kYYYYYYk..', '....kYYk....', '....kYYk....', '...kYYYYk...', '...kkkkkk...'],
  pearl: [
    '....kkkk....', '...kmmmmk...', '..kmwwmmmk..', '.kmwwmmmmmk.', '.kmwmmmmmmk.', '.kmmmmmmmmk.',
    '.kmmmmmmPmk.', '..kmmmmPPk..', '...kmPPPk...', '....kkkk....', '...kyyyyk...', '..kkkkkkkk..'],
  glaive: [
    '.......kkkk.', '......kwsssk', '......ksk.kk', '.....kNsk...', '....kNk.k...', '...kNk......',
    '..kNk.......', '.kNk........', 'kNk.........', 'kk..........', '............', '............'],
  crossbow: [
    '............', 'kkkk....kkkk', 'kNNNkkkkNNNk', '.kk.kssk.kk.', '....kNNk....', '....kNNk....',
    '...kkNNkk...', '....kNNk....', '....kNNk....', '....kNNk....', '....kkkk....', '............'],
  caltrop: [
    '.....k......', '..k.kwk.k...', '.kwkkkkkwk..', '..kGGGGGGk..', '.kGGsGGGGGk.', 'kwkGGGGGGkwk',
    '.kGGGGGGGGk.', '.kGGGGGGGGk.', '..kGGGGGGk..', '.kwkkkkkkwk.', '..k......k..', '............'],
  gourd: [
    '.....kk.....', '....kNNk....', '.....kk.....', '....kaak....', '...kaawak...', '....kaak....',
    '...kaaaak...', '..kaawaaak..', '..kaaaaaak..', '..kaaaaaak..', '...kaaaak...', '....kkkk....'],
  crow: [
    '....kkk.....', '...kKKKk....', '..kKyKKk....', '.kkKKKKkk...', 'kKKKKKKKKk..', '.kKKKKKKKKk.',
    '..kKKKKKKKKk', '...kKKKKKkk.', '....kkkkk...', '....y.y.y...', '....y.y.y...', '............'],
  boat: [
    '.....k......', '.....kk.....', '.....kwk....', '.....kwwk...', '.....kwwwk..', '.....kkkkkk.',
    'kkkkkkkkkkkk', 'kNYNYNYNYNNk', '.kNNNNNNNNk.', '..kkkkkkkk..', '.cc..cc..cc.', '............'],
  up: [
    '.....kk.....', '....kaak....', '...kaaaak...', '..kaaaaaak..', '.kaaaaaaaak.', 'kkkkaaaakkkk',
    '...kaaaak...', '...kaaaak...', '...kaaaak...', '...kaaaak...', '...kkkkkk...', '............'],
  feather: [
    '.........kk.', '........kwk.', '.......kwwk.', '......kwwsk.', '.....kwwsk..', '....kwwsk...',
    '...kwwsk....', '..kwwsk.....', '..kwsk......', '.kkkk.......', 'kk..........', '............'],
  eye: [
    '............', '............', '...kkkkkk...', '..kwwwwwwk..', '.kwwkkkkwwk.', 'kwwkCCCCkwwk',
    'kwwkCkkCkwwk', '.kwwkkkkwwk.', '..kwwwwwwk..', '...kkkkkk...', '............', '............'],
  target: [
    '...kkkkkk...', '..krrrrrrk..', '.krwwwwwwrk.', 'krwrrrrrrwrk', 'krwrwwwwrwrk', 'krwrwrrwrwrk',
    'krwrwrrwrwrk', 'krwrwwwwrwrk', 'krwrrrrrrwrk', '.krwwwwwwrk.', '..krrrrrrk..', '...kkkkkk...'],
  flame: [
    '.....k......', '....kok.....', '....kook....', '...kooyk....', '..kooyyok...', '..koyyfyok..',
    '.kooyffyok..', '.koyyffyyok.', '.koyffffyok.', '..kooyyook..', '...kkkkkk...', '............'],
  snow: [
    '.....kk.....', '..k..cc..k..', '...k.cc.k...', '....kcck....', 'kccccwwcccck', 'kccccwwcccck',
    '....kcck....', '...k.cc.k...', '..k..cc..k..', '.....kk.....', '............', '............'],
  drop: [
    '.....k......', '....klk.....', '....klk.....', '...klllk....', '...klllk....', '..kllwllk...',
    '..klwlllk...', '.klllllllk..', '.klllllllk..', '..klllllk...', '...kkkkk....', '............'],
  bolt: [
    '.......kkk..', '......kyyk..', '.....kyyk...', '....kyyk....', '...kyyykkk..', '..kyyyyyyk..',
    '..kkkkyyk...', '.....kyk....', '....kyk.....', '...kyk......', '...kk.......', '............'],
  coin: [
    '...kkkkkk...', '..kyyyyyyk..', '.kyyYYYYyyk.', 'kyyYkkkkYyyk', 'kyyYk..kYyyk', 'kyyYk..kYyyk',
    'kyyYkkkkYyyk', 'kyyYYYYYYyyk', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kkkkkk...', '............'],
  sack: [
    '....kkkk....', '.....kk.....', '....kYYk....', '...kYnnYk...', '..knnnnnnk..', '.knnnyynnnk.',
    '.knnyYYynnk.', '.knnnyynnnk.', '.knnnnnnnnk.', '..knnnnnnk..', '...kkkkkk...', '............'],
  heart: [
    '............', '.kkk...kkk..', 'krrrk.krrrk.', 'krwrrkrrrrk.', 'krrrrrrrrrk.', 'krrrrrrrrrk.',
    '.krrrrrrrk..', '..krrrrrk...', '...krrrk....', '....krk.....', '.....k......', '............'],
  potion: [
    '....kkkk....', '....kNNk....', '....kwwk....', '...kwwwwk...', '..kwCCCCwk..', '.kwCCcCCCwk.',
    '.kwCcCCCCwk.', '.kwCCCCCCwk.', '.kwCCCCCCwk.', '..kwwwwwwk..', '...kkkkkk...', '............'],
  shield: [
    '.kkkkkkkkkk.', '.kssssssssk.', '.ksBBBBBBsk.', '.ksBByyBBsk.', '.ksByyyyBsk.', '.ksBByyBBsk.',
    '.ksBBBBBBsk.', '..ksBBBBsk..', '...ksBBsk...', '....kssk....', '.....kk.....', '............'],
  wall: [
    '............', 'kkkk.kkkk.kk', 'kVVk.kVVk.kV', 'kkkkkkkkkkkk', 'kVVVkVVVVkVk', 'kVVVkVVVVkVk',
    'kkkkkkkkkkkk', 'kVkVVVVkVVVk', 'kVkVVVVkVVVk', 'kkkkkkkkkkkk', 'kVVVkVVVVkVk', 'kkkkkkkkkkkk'],
  chest: [
    '............', '..kkkkkkkk..', '.kNNNNNNNNk.', 'kNnnnnnnnnNk', 'kkkkkkkkkkkk', 'kNnnnkyknnNk',
    'kNnnnkykknNk', 'kNnnnnkknnNk', 'kNnnnnnnnnNk', 'kNNNNNNNNNNk', 'kkkkkkkkkkkk', '............'],
  thorn: [
    '.....k......', '....kGk.....', '..k.kGk.k...', '..kkkGkkk...', '...kGGGk....', 'k..kGGGk..k.',
    'kkkGGGGGkkk.', '..kGGGGGk...', '.kGGGGGGGk..', 'kGGGkkkGGGk.', 'kkk.....kkk.', '............'],
};

// 3×5 digits for floating damage numbers.
const DIGITS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], 'k': ['100', '101', '110', '101', '101'],
  'm': ['000', '111', '111', '101', '101'], '.': ['000', '000', '000', '000', '010'], '!': ['010', '010', '010', '000', '010'],
};

// ───────── sprite baking ─────────
function bakeMap(rows, pal, scale = 1) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x]; if (!ch || ch === '.') continue;
    const col = pal[ch] || PAL[ch]; if (!col) continue;
    g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale);
  }
  return cv;
}
function silhouette(src, color) {
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
function flipped(src) {
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return cv;
}
const SPRITES = {};
function bakeSprites() {
  const make = (key, def, pal = {}, scale = 1) => {
    const rows = def.rows, frames = [rows];
    if (def.alt) frames.push(rows.slice(0, rows.length - def.alt.length).concat(def.alt));
    const imgs = frames.map(f => bakeMap(f, pal, scale));
    SPRITES[key] = {
      w: imgs[0].width, h: imgs[0].height, frames: imgs, flip: imgs.map(flipped),
      white: imgs.map(i => silhouette(i, '#ffffff')), whiteFlip: imgs.map(i => silhouette(flipped(i), '#ffffff')),
      ice: silhouette(imgs[0], '#bfeaff'), eyes: (EYES[key] || []).map(([x, y]) => [x * scale, y * scale]), scale,
    };
  };
  for (const k in SPR) make(k, SPR[k], {}, SPR_SCALE[k] || 1);
  for (const k in SPR_ALIAS) make(k, SPR[SPR_ALIAS[k].base], SPR_ALIAS[k].pal, SPR_SCALE[k] || 1);
  bakeInk();
}
const ICON_URL = {};
function iconUrl(name, typeColor = '#e6e6e6', elemColor = '#ffffff') {
  const key = name + typeColor + elemColor;
  if (ICON_URL[key]) return ICON_URL[key];
  const rows = ICONS[name] || ICONS.up;
  ICON_URL[key] = bakeMap(rows, { a: typeColor, z: elemColor }, 1).toDataURL();
  return ICON_URL[key];
}

// ───────── pixel primitives (integer coordinates on the 400×360 field) ─────────
function pr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function pcirc(g, cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.max(0, Math.round(r)); g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1); }
}
function pring(g, cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r); g.fillStyle = c;
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + a, cy + b, 1, 1);
    y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}
function pline(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); g.fillStyle = c;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, n = 0;
  while (n++ < 800) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function pdigits(g, str, x, y, c, scale = 1) {
  const w = str.length * 4 * scale - scale; let cx = Math.round(x - w / 2); y = Math.round(y);
  for (const ch of str) {
    const d = DIGITS[ch]; if (d) {
      g.fillStyle = '#17131c';
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (d[r][q] === '1') g.fillRect(cx + q * scale - 1, y + r * scale - 1, scale + 2, scale + 2);
      g.fillStyle = c;
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (d[r][q] === '1') g.fillRect(cx + q * scale, y + r * scale, scale, scale);
    }
    cx += 4 * scale;
  }
}
function shortNum(n) { n = Math.round(n); if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'm'; if (n >= 1e4) return Math.round(n / 1e3) + 'k'; return String(n); }

// ───────── battlefield ─────────
// The field is painted once per theme. Night is not a filter on top: `darkPass` carves light out of a darkness
// layer every frame, so the beacon, stone lanterns, cottage windows, shots and explosions all light the ground.
const FW = 400, FH = 360, CX = 200, CY = 184, PLAZA_R = 62;
const THEMES = {
  field:  { grass: ['#2c5233', '#36633a', '#417443', '#55894b'], flower: ['#f0d36a', '#e98fb8', '#f4f1e7'], path: ['#6a5a40', '#7a684a', '#887555'], stone: ['#7d8290', '#8f94a0', '#6a6f7c'], rim: '#474b57', tree: ['#1f4528', '#2c5c34', '#3b7343'], trunk: '#4a3322', amb: '10,14,46', dark: 0.6, edge: 0.32, mote: 'firefly' },
  autumn: { grass: ['#5e4f28', '#6e5e2f', '#7f6c35', '#95803f'], flower: ['#e0672f', '#f0b24a', '#c94a2c'], path: ['#5f4a34', '#6e563c', '#7d6446'], stone: ['#857b70', '#968a7c', '#6f665c'], rim: '#4a423a', tree: ['#8a3a20', '#b5532c', '#d27a33'], trunk: '#432c1c', amb: '26,12,34', dark: 0.64, edge: 0.3, mote: 'leaf' },
  nether: { grass: ['#13232a', '#182c33', '#1e363c', '#284446'], flower: ['#d8283a', '#ff4a5a', '#e8e4dc'], path: ['#4a4a50', '#58585e', '#68676c'], stone: ['#5c6670', '#6c7680', '#4a525c'], rim: '#262c34', tree: ['#16222a', '#1e2c34', '#283840'], trunk: '#1a2228', amb: '2,10,18', dark: 0.74, edge: 0.28, mote: 'soul', dead: true, lily: true, seed: 5, win: '#9ff0e6', winLight: '120,240,220', lamp: '120,220,255' },
  snow:   { grass: ['#b9c5d4', '#c9d3e0', '#d8e0ea', '#e8eef5'], flower: ['#8fa8c8', '#ffffff', '#6f8fb8'], path: ['#6a6460', '#7c7570', '#8d8680'], stone: ['#8a909c', '#9ca2ad', '#767c88'], rim: '#4e5260', tree: ['#1c3a33', '#27493f', '#33584c'], trunk: '#3a2a20', amb: '16,24,56', dark: 0.52, edge: 0.3, mote: 'snow', seed: 11, snowcap: true },
  night:  { grass: ['#211d33', '#29243e', '#322c4a', '#3d3658'], flower: ['#8a5ad8', '#5ab0d8', '#c84a6a'], path: ['#3c3346', '#463c52', '#51465e'], stone: ['#5a5868', '#6a6878', '#4c4a5a'], rim: '#2a2834', tree: ['#241c32', '#30263f', '#3d3150'], trunk: '#221a2a', amb: '8,4,22', dark: 0.7, edge: 0.24, mote: 'wisp', dead: true },
};
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// Smooth value noise, used for grass patches and worn road edges.
function vnoise(rnd, cell) {
  const gw = 64, grid = Array.from({ length: gw * gw }, rnd), s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell + 1, gy = y / cell + 1, x0 = Math.floor(gx), y0 = Math.floor(gy), u = s(gx - x0), v = s(gy - y0);
    const at = (i, j) => grid[((j % gw) * gw + (i % gw)) | 0];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function pell(g, cx, cy, rx, ry, c) {
  g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -ry; dy <= ry; dy++) { const dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01)))); if (dx > 0) g.fillRect(cx - dx, cy + dy, dx * 2, 1); }
}
const HOUSES = [[58, 64], [346, 70], [62, 304], [338, 300]];
const LANTERNS = [[CX - 22, CY - 78], [CX + 22, CY - 78], [CX - 22, CY + 96], [CX + 22, CY + 96], [CX - 92, CY - 20], [CX + 92, CY + 26]];
const TORCHES = [[CX - 44, CY - 42], [CX + 43, CY - 42], [CX - 44, CY + 46], [CX + 43, CY + 46]];
function paintField(theme) {
  const T = THEMES[theme], cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
  const g = cv.getContext('2d'), rnd = mulberry32(theme.length * 9173 + 41 + (T.seed || 0)), lights = [];
  const n1 = vnoise(rnd, 46), n2 = vnoise(rnd, 13), n3 = vnoise(rnd, 7);
  const grass = T.grass.map(hexRgb), path = T.path.map(hexRgb), stone = T.stone.map(hexRgb), rim = hexRgb(T.rim);
  const img = g.createImageData(FW, FH), px = img.data;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const i = (y * FW + x) * 4, dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy);
    let c;
    const wob = (n2(x, y) - 0.5) * 6, road = Math.abs(dx) < 12 + wob || Math.abs(dy) < 12 + wob;
    if (d <= PLAZA_R) {
      // radial paving: rings of cut stone around the beacon
      const ring = Math.floor(d / 11), segs = Math.max(6, Math.floor((2 * Math.PI * (ring * 11 + 5)) / 13)), a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * segs + ring * 0.5;
      const mortar = d % 11 < 1 || Math.abs(a - Math.round(a)) * (ring * 11 + 5) * 2 * Math.PI / segs < 0.7;
      const sh = n3(x, y) + rnd() * 0.25;
      c = mortar ? stone[2] : sh > 0.85 ? stone[1] : stone[0];
      if (!mortar && (dx + dy) / Math.max(1, d) < -0.6 && d % 11 < 2.2) c = stone[1];
    } else if (d <= PLAZA_R + 3) c = (Math.floor(Math.atan2(dy, dx) * 24) % 2) ? rim : stone[2];
    else if (road) {
      const edge = Math.min(Math.abs(Math.abs(dx) - (12 + wob)), Math.abs(Math.abs(dy) - (12 + wob)));
      const rut = (Math.abs(dx) < 12 && (Math.abs(Math.abs(dx) - 6) < 1)) || (Math.abs(dy) < 12 && Math.abs(Math.abs(dy) - 6) < 1);
      const sh = n3(x, y) + rnd() * 0.3;
      c = edge < 1.5 ? path[0] : rut && rnd() < 0.7 ? path[0] : sh > 0.95 ? path[2] : path[1];
    } else {
      const v = n1(x, y) * 0.62 + n2(x, y) * 0.38 + (rnd() - 0.5) * 0.16;
      c = v < 0.36 ? grass[0] : v < 0.52 ? grass[1] : v < 0.68 ? grass[2] : grass[3];
    }
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  pring(g, CX, CY, PLAZA_R + 4, 'rgba(0,0,0,0.25)');
  // ground clutter
  const clear = (x, y, m = 0) => Math.hypot(x - CX, y - CY) < PLAZA_R + 8 + m || Math.abs(x - CX) < 18 + m || Math.abs(y - CY) < 18 + m || HOUSES.some(([hx, hy]) => Math.hypot(x - hx, y - hy + 8) < 24 + m);
  for (let i = 0; i < 300; i++) { const a = rnd() * Math.PI * 2, d = 76 + rnd() * 180, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d * 0.95; if (!clear(x, y)) pr(g, x, y, 1, 1, T.flower[(rnd() * 3) | 0]); }
  for (let i = 0; i < 220; i++) { const x = rnd() * FW, y = rnd() * FH; if (clear(x, y)) continue; const c = T.grass[3]; pr(g, x, y, 1, 2, c); pr(g, x + 1, y + 1, 1, 1, c); pr(g, x - 1, y + 1, 1, 1, c); }
  for (let i = 0; i < 26; i++) { const x = rnd() * FW, y = rnd() * FH; if (clear(x, y, 4)) continue; pell(g, x + 1, y + 2, 3, 1, 'rgba(0,0,0,0.3)'); pell(g, x, y, 3, 2, T.stone[2]); pr(g, x - 1, y - 1, 2, 1, T.stone[1]); }
  // cottages and lanterns: their windows and paper shades are light sources at night
  // 저승길: red spider lilies (꽃무릇) crowd the roadsides
  if (T.lily) for (let i = 0; i < 90; i++) {
    const along = rnd() * FW, off = (16 + rnd() * 10) * (rnd() < 0.5 ? -1 : 1), v = rnd() < 0.5, x = v ? CX + off : along, y = v ? along * FH / FW : CY + off;
    if (Math.hypot(x - CX, y - CY) < PLAZA_R + 10 || HOUSES.some(([hx, hy]) => Math.hypot(x - hx, y - hy + 8) < 24)) continue;
    pr(g, x, y, 1, 3, '#2e5a3a'); pr(g, x - 1, y - 1, 3, 1, T.flower[0]); pr(g, x - 2, y - 2, 1, 1, T.flower[1]); pr(g, x + 2, y - 2, 1, 1, T.flower[1]); pr(g, x, y - 2, 1, 1, T.flower[1]);
  }
  for (const [hx, hy] of HOUSES) lights.push(drawHouse(g, hx, hy, rnd, T));
  for (const [lx, ly] of LANTERNS) lights.push(drawLantern(g, lx, ly, T));
  // trees around the edge, keeping roads and yards clear
  const trees = [];
  for (let i = 0; i < 600 && trees.length < 44; i++) {
    const x = 6 + rnd() * (FW - 12), y = 10 + rnd() * (FH - 10), edge = Math.min(x, FW - x, y, FH - y);
    if (edge > 56 || clear(x, y, 6)) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.y - y) < 15)) continue;
    trees.push({ x, y });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) drawTree(g, t.x, t.y, T, rnd);
  return { cv, lights };
}
function drawTree(g, x, y, T, rnd) {
  x = Math.round(x); y = Math.round(y);
  pell(g, x + 3, y + 3, 8, 2, 'rgba(0,0,0,0.32)');
  pr(g, x - 1, y - 3, 3, 7, PAL.k); pr(g, x, y - 3, 1, 6, T.trunk);
  if (T.dead) { pline(g, x, y - 2, x - 5, y - 11, T.trunk); pline(g, x, y - 4, x + 6, y - 12, T.trunk); pline(g, x - 3, y - 8, x - 8, y - 9, T.trunk); pline(g, x + 3, y - 8, x + 3, y - 14, T.trunk); return; }
  // layered pine canopy (소나무): dark outline, three tiers, lit from the upper left
  pell(g, x, y - 8, 8, 5, PAL.k); pell(g, x - 1, y - 13, 7, 4, PAL.k);
  pell(g, x, y - 8, 7, 4, T.tree[0]); pell(g, x - 1, y - 13, 6, 3, T.tree[1]); pell(g, x - 2, y - 15, 3, 2, T.tree[2]);
  for (let i = 0; i < 7; i++) pr(g, x - 6 + rnd() * 11, y - 16 + rnd() * 11, 1, 1, i % 2 ? T.tree[2] : T.tree[0]);
  if (T.snowcap) { pell(g, x - 2, y - 15, 3, 1, '#f2f6fb'); pell(g, x - 1, y - 10, 5, 1, '#e4ecf4'); pell(g, x, y - 6, 6, 1, '#dbe4ee'); }
}
function drawHouse(g, x, y, rnd, T) {
  // 초가집: plaster walls with timber posts, a rounded thatch roof, one lit window
  pell(g, x + 4, y + 2, 16, 3, 'rgba(0,0,0,0.33)');
  pr(g, x - 13, y - 12, 26, 13, PAL.k);
  pr(g, x - 12, y - 11, 24, 11, '#cdbb92'); pr(g, x - 12, y - 2, 24, 2, '#7d7568');
  for (const px of [-12, -4, 4, 11]) pr(g, x + px, y - 11, 1, 10, '#5a3c26');
  pr(g, x - 9, y - 9, 4, 8, '#3a2a1c'); pr(g, x - 9, y - 9, 4, 1, '#5a3c26');
  pr(g, x + 5, y - 9, 5, 4, PAL.k); pr(g, x + 6, y - 8, 3, 2, T.win || '#ffd982');
  for (let r = 0; r <= 11; r++) {
    const w = Math.round(17 * Math.sqrt(Math.max(0, 1 - ((11 - r) / 11.5) ** 2))), yy = y - 23 + r;
    pr(g, x - w - 1, yy, w * 2 + 2, 1, PAL.k);
    if (w > 0) pr(g, x - w, yy, w * 2, 1, r < 3 ? '#d9b46c' : '#b8924e');
  }
  for (let i = 0; i < 40; i++) { const r = 2 + rnd() * 9, w = 16 * Math.sqrt(1 - ((11 - r) / 11.5) ** 2); pr(g, x - w + rnd() * w * 2, y - 23 + r, 1, 2, '#8e6a34'); }
  pr(g, x - 18, y - 12, 36, 1, '#6a4c26');
  return { x: x + 7, y: y - 7, r: 26, i: 0.85, c: T.winLight || '255,190,110', ca: 0.22 };
}
function drawLantern(g, x, y, T = {}) {
  // 청사초롱 on a wooden post: red silk top, blue skirt (저승길: pale soul-fire lamps)
  pr(g, x, y - 16, 1, 17, '#3a2a1c'); pr(g, x - 3, y - 16, 4, 1, '#3a2a1c');
  pr(g, x - 5, y - 15, 5, 7, PAL.k);
  if (T.lamp) { pr(g, x - 4, y - 14, 3, 5, '#e8f4f0'); pr(g, x - 3, y - 13, 1, 3, '#9ff0e6'); return { x: x - 3, y: y - 12, r: 26, i: 0.8, c: T.lamp, ca: 0.24 }; }
  pr(g, x - 4, y - 14, 3, 3, '#e04a32'); pr(g, x - 4, y - 11, 3, 2, '#3c5ac0'); pr(g, x - 3, y - 14, 1, 2, '#ffd2a0');
  return { x: x - 3, y: y - 12, r: 24, i: 0.8, c: '255,120,80', ca: 0.2 };
}
// The beacon: a Joseon 봉수대 — a stone platform with five chimneys (연조). Each lit chimney is 20% of the beacon's health,
// so the fires going out one by one is the health bar.
const STACK_X = [-16, -8, 0, 8, 16], STACK_H = [14, 18, 22, 18, 14], STACK_ORDER = [2, 1, 3, 0, 4];
const litStacks = hpRatio => (hpRatio <= 0 ? 0 : Math.max(1, Math.ceil(hpRatio * 5 - 1e-6)));
function towerFires(hpRatio) {
  const base = CY + 10, n = litStacks(hpRatio);
  return STACK_X.map((sx, i) => ({ x: CX + sx, y: base - 18 - STACK_H[i], lit: STACK_ORDER.indexOf(i) < n, main: i === 2 }));
}
function drawFlame(g, x, y, t, k) {
  const f = Math.floor(t * 12) % 4, h = Math.round((7 + (f % 2) + (f === 2 ? 2 : 0)) * k);
  for (let i = 0; i < h; i++) {
    const q = i / h, w = Math.max(1, Math.round((6 - q * 6) * k * 0.9) + ((i + f) % 2)), sway = Math.round(Math.sin(t * 7 + i * 0.7) * q * 1.6);
    pr(g, x - (w >> 1) + sway, y - i, w, 1, q < 0.25 ? '#d8452a' : q < 0.5 ? '#ee8a2c' : q < 0.78 ? '#f3c94a' : '#fff2a8');
  }
  pr(g, x - 1, y - 1, 2, 1, '#fff7d0');
}
function drawTower(g, t, hpRatio, theme) {
  const x = CX, base = CY + 10;
  pell(g, x + 3, base + 1, 28, 5, 'rgba(0,0,0,0.38)');
  // platform: top face and brick front
  pr(g, x - 25, base - 22, 51, 23, PAL.k);
  pr(g, x - 24, base - 21, 49, 7, '#b0a794'); pr(g, x - 24, base - 21, 49, 1, '#cfc6b0');
  pr(g, x - 24, base - 14, 49, 14, '#8a8273');
  for (let r = 0; r < 3; r++) { const yy = base - 14 + r * 5; pr(g, x - 24, yy, 49, 1, '#5d574c'); for (let c = 0; c < 7; c++) pr(g, x - 24 + c * 8 + (r % 2) * 4, yy, 1, 5, '#5d574c'); }
  pr(g, x - 24, base - 14, 2, 14, '#a39a89'); pr(g, x + 23, base - 14, 2, 14, '#6a6356');
  pr(g, x - 5, base - 5, 10, 5, PAL.k); pr(g, x - 4, base - 4, 8, 2, '#a39a89'); pr(g, x - 4, base - 2, 8, 2, '#8a8273');
  // five chimneys, outer ones go dark first
  const n = litStacks(hpRatio);
  for (let i = 0; i < 5; i++) {
    const sx = x + STACK_X[i], h = STACK_H[i], top = base - 18 - h;
    pr(g, sx - 4, top, 8, h + 2, PAL.k);
    pr(g, sx - 3, top + 1, 6, h, '#9a917f'); pr(g, sx - 3, top + 1, 2, h, '#bdb39e'); pr(g, sx + 2, top + 1, 1, h, '#6f685b');
    for (let yy = top + 5; yy < base - 18; yy += 5) pr(g, sx - 3, yy, 6, 1, '#6f685b');
    pr(g, sx - 4, top - 1, 8, 2, PAL.k); pr(g, sx - 3, top - 1, 6, 1, '#d6ccb4');
    if (STACK_ORDER.indexOf(i) < n) drawFlame(g, sx, top - 1, t + i * 0.37, i === 2 ? 1.35 : 1);
    else { pr(g, sx - 2, top - 1, 4, 1, '#2a1a14'); if (Math.floor(t * 3 + i) % 3 === 0) pr(g, sx, top - 1, 1, 1, '#a8402a'); }
  }
  // signal banner
  pr(g, x + 27, base - 50, 1, 34, PAL.k);
  const wave = Math.floor(t * 4) % 2;
  pr(g, x + 28, base - 50, 9, 7 + wave, '#cf4a35'); pr(g, x + 28, base - 50, 9, 1, '#8c2b22'); pr(g, x + 31, base - 47, 3, 2, '#f3c94a');
}
// 석등: stone lanterns at the plaza corners
function drawTorch(g, x, y, t) {
  pr(g, x - 3, y - 1, 7, 2, '#5d574c'); pr(g, x - 1, y - 7, 3, 6, PAL.k); pr(g, x, y - 7, 1, 6, '#9a917f');
  pr(g, x - 3, y - 12, 7, 5, PAL.k); pr(g, x - 2, y - 11, 5, 3, '#8a8273');
  const f = Math.floor(t * 8 + x) % 3; pr(g, x - 1, y - 11, 3, 2, f ? '#f3c94a' : '#ee8a2c'); pr(g, x, y - 11, 1, 1, '#fff2a8');
  pr(g, x - 4, y - 14, 9, 2, PAL.k); pr(g, x - 3, y - 14, 7, 1, '#b0a794'); pr(g, x, y - 16, 1, 2, PAL.k);
}

// Darkness with light carved out of it, then a warm additive glow on top. `lights` are {x, y, r, i, c?, ca?}.
const DARK = {};
function darkPass(g, w, h, amb, alpha, edge, lights, cx, cy) {
  const P = 10, key = w + 'x' + h; let L = DARK[key];
  if (!L) { L = DARK[key] = document.createElement('canvas'); L.width = w + P * 2; L.height = h + P * 2; }
  const l = L.getContext('2d');
  l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, L.width, L.height);
  l.fillStyle = `rgba(${amb},${alpha})`; l.fillRect(0, 0, L.width, L.height);
  if (edge) { const vg = l.createRadialGradient(cx + P, cy + P, h * 0.3, cx + P, cy + P, Math.max(w, h) * 0.78); vg.addColorStop(0, `rgba(${amb},0)`); vg.addColorStop(1, `rgba(${amb},${edge})`); l.fillStyle = vg; l.fillRect(0, 0, L.width, L.height); }
  l.globalCompositeOperation = 'destination-out';
  for (const s of lights) {
    if (s.r < 1) continue;
    const gr = l.createRadialGradient(s.x + P, s.y + P, 0, s.x + P, s.y + P, s.r);
    gr.addColorStop(0, `rgba(0,0,0,${s.i})`); gr.addColorStop(0.45, `rgba(0,0,0,${s.i * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = gr; l.fillRect(s.x + P - s.r, s.y + P - s.r, s.r * 2, s.r * 2);
  }
  g.drawImage(L, -P, -P);
  g.globalCompositeOperation = 'lighter';
  for (const s of lights) {
    if (!s.c) continue; const r = s.r * 0.75;
    const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    gr.addColorStop(0, `rgba(${s.c},${s.ca || 0.16})`); gr.addColorStop(1, `rgba(${s.c},0)`);
    g.fillStyle = gr; g.fillRect(s.x - r, s.y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'source-over';
}
// Where each sprite's eyes are, so foes in the dark show glinting eyes before their bodies.
const EYES = { grunt: [[4, 4], [7, 4]], chief: [[4, 4], [7, 4]], runner: [[3, 4], [6, 4]], bandit: [[5, 4], [6, 4]], guard: [[4, 4], [7, 4]], gangsi: [[5, 4], [6, 4]], hareubang: [[4, 5], [7, 5]], giant: [[6, 3], [9, 3]], wolf: [[1, 3]], treasure: [[4, 4], [7, 4]], bulga: [[2, 5]], gumiho: [[2, 5]], dragon: [[10, 4], [15, 4]], changgwi: [[2, 4], [9, 4]], geuseundae: [[6, 3], [9, 3]] };
// Ink splats left where a foe falls.
const INK = [];
function bakeInk() {
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 12; const g = c.getContext('2d'), rnd = mulberry32(77 + k);
    pell(g, 8, 6, 4 + (k % 2), 2, '#140e18');
    for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, d = 3 + rnd() * 4; pr(g, 8 + Math.cos(a) * d * 1.4, 6 + Math.sin(a) * d * 0.7, rnd() < 0.5 ? 2 : 1, 1, '#140e18'); }
    INK.push(c);
  }
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
