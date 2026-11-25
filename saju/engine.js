/**
 * SIAN LAB 사주 엔진 — 브라우저 안에서 도는 순수 JS 만세력 계산기
 *
 * - 24절기 시각 표(1900~2100, KST 분 단위)로 년주·월주 경계를 잡는다. 표는 ephem(VSOP87)
 *   으로 태양 겉보기 황경 315°+30k 통과 시각을 구해 생성했고, 천문연구원 발표값과 분 단위로 맞춘다.
 * - 일주는 율리우스일(JDN)에서 바로 계산한다: index = (JDN + 49) mod 60.
 * - 음력 입력은 1900~2050 한국 음력 표(설날 양력일 + 월 길이)로 양력으로 바꿔 계산한다.
 */
import { TERM_BASE_YEAR, TERM_PACKED } from './terms.js';
import { LUNAR_BASE_YEAR, LUNAR_PACKED } from './lunar.js';

export const GAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const ZHI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const GAN_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const ZHI_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const ELEMENTS = ['목', '화', '토', '금', '수'];
export const ELEMENT_HANJA = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
export const GAN_ELEMENT = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
export const ZHI_ELEMENT = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
export const ZHI_ANIMAL = ['쥐', '소', '범', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
export const GAN_COLOR = ['푸른', '푸른', '붉은', '붉은', '노란', '노란', '흰', '흰', '검은', '검은'];
export const GAN_COLOR_HANJA = ['靑', '靑', '赤', '赤', '黃', '黃', '白', '白', '黑', '黑'];
export const ZHI_HOUR = ['자시 23:00–00:59', '축시 01:00–02:59', '인시 03:00–04:59', '묘시 05:00–06:59',
  '진시 07:00–08:59', '사시 09:00–10:59', '오시 11:00–12:59', '미시 13:00–14:59',
  '신시 15:00–16:59', '유시 17:00–18:59', '술시 19:00–20:59', '해시 21:00–22:59'];
export const TERM_NAMES = ['소한', '대한', '입춘', '우수', '경칩', '춘분', '청명', '곡우',
  '입하', '소만', '망종', '하지', '소서', '대서', '입추', '처서',
  '백로', '추분', '한로', '상강', '입동', '소설', '대설', '동지'];
const TERM_HANJA = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '淸明', '穀雨',
  '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const KST_OFFSET = 9 * 3600 * 1000;
const DAY = 86400000;

/* ------------------------------------------------------------------ *
 * 24절기 표
 * ------------------------------------------------------------------ */

/** KST 벽시계 → UTC epoch ms */
function kstMs(y, mo, d, h = 0, mi = 0) {
  return Date.UTC(y, mo - 1, d, h - 9, mi);
}

/** UTC epoch ms → KST 벽시계 조각 */
function kstParts(ms) {
  const d = new Date(ms + KST_OFFSET);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), w: d.getUTCDay(),
  };
}

export const TERM_RANGE = [TERM_BASE_YEAR, TERM_BASE_YEAR + 200];

/** 그 해 k번째 절기(0=소한 … 23=동지)의 KST 시각(ms). 표 범위 밖이면 null */
export function termTime(year, k) {
  if (year < TERM_BASE_YEAR || year > TERM_BASE_YEAR + 200) return null;
  const at = ((year - TERM_BASE_YEAR) * 24 + k) * 4;
  const minutes = parseInt(TERM_PACKED.slice(at, at + 4), 36);
  return kstMs(year, 1, 1) + minutes * 60000;
}

/** ts 이전(포함) 마지막 '절'(월 경계) 과 다음 절 */
export function jeolAround(ts) {
  const { y } = kstParts(ts);
  let prev = null;
  let next = null;
  for (let yy = y - 1; yy <= y + 1; yy++) {
    for (let k = 0; k < 24; k += 2) {
      const t = termTime(yy, k);
      if (t === null) continue;
      if (t <= ts) {
        if (!prev || t > prev.t) prev = { year: yy, k, t };
      } else if (!next || t < next.t) {
        next = { year: yy, k, t };
      }
    }
  }
  return { prev, next };
}

/** 그 해 입춘 시각 */
function ipchunOf(year) { return termTime(year, 2); }

/* ------------------------------------------------------------------ *
 * 음력 표
 * ------------------------------------------------------------------ */

export const LUNAR_RANGE = [LUNAR_BASE_YEAR, LUNAR_BASE_YEAR + LUNAR_PACKED.length - 1];

function lunarYearInfo(y) {
  if (y < LUNAR_RANGE[0] || y > LUNAR_RANGE[1]) return null;
  const code = LUNAR_PACKED[y - LUNAR_BASE_YEAR];
  const month = +code.slice(0, 2);
  const day = +code.slice(2, 4);
  const leap = B36.indexOf(code[4]);
  const bits = code.slice(5);
  // bits 는 실제 월 순서(윤달 포함)대로 들어 있다
  const seq = [];
  let i = 0;
  for (let m = 1; m <= 12; m++) {
    seq.push({ m, leap: false, days: bits[i++] === '1' ? 30 : 29 });
    if (leap === m) seq.push({ m, leap: true, days: bits[i++] === '1' ? 30 : 29 });
  }
  return { newYear: [month, day], months: seq };
}

/** 음력 → 양력 (모두 KST 달력 날짜). 실패하면 null */
export function lunarToSolar(y, m, d, leap = false) {
  const info = lunarYearInfo(y);
  if (!info) return null;
  const idx = info.months.findIndex((x) => x.m === m && x.leap === leap);
  if (idx < 0) return null;
  if (d < 1 || d > info.months[idx].days) return null;
  let offset = 0;
  for (let i = 0; i < idx; i++) offset += info.months[i].days;
  const base = kstMs(y, info.newYear[0], info.newYear[1]);
  const t = kstParts(base + (offset + d - 1) * DAY);
  return { y: t.y, m: t.m, d: t.d };
}

/** 그 해 음력 월 목록 (윤달 포함) — UI 월 선택용 */
export function lunarMonths(year) {
  const info = lunarYearInfo(year);
  return info ? info.months.map((x) => ({ ...x })) : null;
}

/** 양력 → 음력. 표 범위 밖이면 null */
export function solarToLunar(y, m, d) {
  const ts = kstMs(y, m, d);
  let ly = y;
  for (const cand of [y, y - 1, y + 1]) {
    const info = lunarYearInfo(cand);
    if (!info) continue;
    const start = kstMs(cand, info.newYear[0], info.newYear[1]);
    const nextInfo = lunarYearInfo(cand + 1);
    const end = nextInfo ? kstMs(cand + 1, nextInfo.newYear[0], nextInfo.newYear[1])
      : start + 400 * DAY;
    if (ts >= start && ts < end) { ly = cand; break; }
  }
  const info = lunarYearInfo(ly);
  if (!info) return null;
  const start = kstMs(ly, info.newYear[0], info.newYear[1]);
  let rest = Math.round((ts - start) / DAY);
  for (const mm of info.months) {
    if (rest < mm.days) return { y: ly, m: mm.m, d: rest + 1, leap: mm.leap };
    rest -= mm.days;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 사주 계산
 * ------------------------------------------------------------------ */

function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2
    + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

/** 60갑자 index → {gan, zhi, hanja, korean} */
export function gapja(index) {
  const i = ((index % 60) + 60) % 60;
  const g = i % 10;
  const z = i % 12;
  return { index: i, g, z, gan: GAN[g], zhi: ZHI[z], hanja: GAN_HANJA[g] + ZHI_HANJA[z], korean: GAN[g] + ZHI[z] };
}

/**
 * 사주 계산.
 * @param {{y:number,m:number,d:number,hour:number|null,lunar?:boolean,leap?:boolean}} input
 *        hour: 0~23 (null 이면 시간 모름 → 삼주)
 */
export function computeChart(input) {
  const { y, m, d, hour = null, lunar = false, leap = false } = input;
  let solar;
  let lunarDate = null;
  if (lunar) {
    solar = lunarToSolar(y, m, d, leap);
    if (!solar) return { error: 'lunar_range' };
    lunarDate = { y, m, d, leap: !!leap };
  } else {
    solar = { y, m, d };
    lunarDate = solarToLunar(y, m, d);   // 표 범위(1900~2050) 밖이면 null — 양력 계산은 그대로
  }

  const ts = kstMs(solar.y, solar.m, solar.d, hour ?? 12, 0);

  // 년주: 입춘 전이면 전년도
  const ipchun = ipchunOf(solar.y);
  let sajuYear = solar.y;
  if (ipchun !== null && ts < ipchun) sajuYear = solar.y - 1;
  const yearIdx = ((sajuYear - 4) % 60 + 60) % 60;
  const yp = gapja(yearIdx);

  // 월주: 가장 최근 절입 (절입 = 짝수 번째 절기)
  const { prev, next } = jeolAround(ts);
  let mp = gapja(0);
  if (prev) {
    const monthOrder = ((prev.k - 2) / 2 + 12) % 12;      // 인월=0, 축월=11
    const monthGan = ((((yp.g % 5) * 2 + 2) % 10) + monthOrder) % 10;
    const zhiIdx = (monthOrder + 2) % 12;
    let idx = 0;
    while (idx % 10 !== monthGan || idx % 12 !== zhiIdx) idx++;
    mp = gapja(idx);
  }

  // 일주: 율리우스일 기반
  const dayIdx = (toJDN(solar.y, solar.m, solar.d) + 49) % 60;
  const dp = gapja(dayIdx);

  // 시주
  let hp = null;
  if (hour !== null) {
    const zhiIdx = Math.floor(((hour + 1) % 24) / 2);
    const gan = (((dp.g % 5) * 2) % 10 + zhiIdx) % 10;
    let idx = 0;
    while (idx % 10 !== gan || idx % 12 !== zhiIdx) idx++;
    hp = gapja(idx);
  }

  const pillars = [
    { key: 'year', label: '년주', title: '태어난 해', gapja: yp },
    { key: 'month', label: '월주', title: '태어난 달', gapja: mp },
    { key: 'day', label: '일주', title: '나 자신', gapja: dp },
    { key: 'hour', label: '시주', title: '태어난 때', gapja: hp },
  ];
  for (const p of pillars) {
    if (!p.gapja) continue;
    p.ganElement = GAN_ELEMENT[p.gapja.g];
    p.zhiElement = ZHI_ELEMENT[p.gapja.z];
    p.tenGod = p.key === 'day' ? '일간(나)' : tenGod(dp.g, p.gapja.g);
  }

  return {
    solar, lunar: lunarDate, sajuYear, hour,
    hourKnown: hp !== null,
    pillars,
    dayMaster: {
      g: dp.g, gan: dp.gan, hanja: GAN_HANJA[dp.g], element: GAN_ELEMENT[dp.g],
      yin: dp.g % 2 === 0 ? '양' : '음',
    },
    elements: elementStats(pillars),
    jeol: { prev: prev ? describeTerm(prev) : null, next: next ? describeTerm(next) : null },
    ilju: { index: dp.index, name: GAN_COLOR[dp.g] + ' ' + ZHI_ANIMAL[dp.z], animal: ZHI_ANIMAL[dp.z] },
  };
}

function describeTerm(t) {
  const p = kstParts(t.t);
  return { name: TERM_NAMES[t.k], hanja: TERM_HANJA[t.k], ...p, ts: t.t, k: t.k };
}

/** 오행 분포 (글자 수 기준 + 월지 계절 가중) */
export function elementStats(pillars) {
  const counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  let total = 0;
  for (const p of pillars) {
    if (!p.gapja) continue;
    counts[p.ganElement] += 1;
    counts[p.zhiElement] += 1;
    total += 2;
  }
  // 최대잉여법으로 반올림 오차를 흡수해 합이 정확히 100%가 되게 한다
  const exact = ELEMENTS.map((e) => (counts[e] / total) * 100);
  const pct = {};
  let used = 0;
  ELEMENTS.forEach((e, i) => { pct[e] = Math.floor(exact[i]); used += pct[e]; });
  const rest = ELEMENTS.map((e, i) => ({ e, frac: exact[i] - Math.floor(exact[i]) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < 100 - used; i++) pct[rest[i % 5].e] += 1;
  const sorted = [...ELEMENTS].sort((a, b) => counts[b] - counts[a]);
  return {
    counts, pct, total,
    order: sorted,
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    missing: ELEMENTS.filter((e) => counts[e] === 0),
  };
}

/** 오행 상생상극: a 가 b 를 (생/극/비화) */
export function elementRelation(a, b) {
  const order = ['목', '화', '토', '금', '수'];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai === bi) return '비화';
  if ((ai + 1) % 5 === bi) return '상생'; // 내가 생하는 쪽
  if ((bi + 1) % 5 === ai) return '생받음';
  if ((ai + 2) % 5 === bi) return '상극'; // 내가 극하는 쪽
  return '극받음';
}

const TEN_GOD_NAMES = {
  비견: '비견', 겁재: '겁재', 식신: '식신', 상관: '상관',
  편재: '편재', 정재: '정재', 편관: '편관', 정관: '정관', 편인: '편인', 정인: '정인',
};

/** 일간(dayGan) 기준으로 다른 천간(gan)의 십성 */
export function tenGod(dayGan, gan) {
  if (gan === dayGan) return '비견';
  const de = GAN_ELEMENT[dayGan];
  const oe = GAN_ELEMENT[gan];
  const same = dayGan % 2 === gan % 2; // 같은 음양
  const rel = elementRelation(de, oe);
  // elementRelation 은 '내가 생/극' 기준이므로 반대로 해석
  if (rel === '비화') return same ? '비견' : '겁재';
  if (rel === '상생') return same ? '식신' : '상관';   // 내가 생하는 오행 = 식상
  if (rel === '상극') return same ? '편재' : '정재';   // 내가 극하는 오행 = 재성
  if (rel === '극받음') return same ? '편관' : '정관'; // 나를 극하는 오행 = 관성
  return same ? '편인' : '정인';                       // 나를 생하는 오행 = 인성
}

/* ------------------------------------------------------------------ *
 * 오늘의 운세 (날짜 시드)
 * ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateKey(ms = Date.now()) {
  const p = kstParts(ms);
  return `${p.y}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}`;
}

/** 그날의 일진 */
export function dayGapjaOf(ms = Date.now()) {
  const p = kstParts(ms);
  return gapja((toJDN(p.y, p.m, p.d) + 49) % 60);
}

const TODAY_LINES = {
  목: ['새로 시작하는 일에 힘이 붙는 날', '미뤄 둔 연락 하나가 반가운 소식으로 돌아오는 날',
    '조금만 더 밀어붙이면 다 풀리는 날', '머리보다 발이 먼저 나가야 열리는 날'],
  화: ['말 한마디가 분위기를 바꾸는 날', '사람들 사이에서 존재감이 확 살아나는 날',
    '열정이 과열되니 한 박자만 천천히', '웃는 얼굴 하나가 오늘의 최고 무기인 날'],
  토: ['손에 잡히는 일부터 차곡차곡 쌓이는 날', '느려도 한 번 정한 건 끝까지 가는 날',
    '돈 나갈 데와 들어올 데를 다시 점검하면 좋은 날', '중간에서 균형 잡는 역할이 딱인 날'],
  금: ['정리하고 자르는 결정이 잘 먹히는 날', '말보다 결과물로 말해야 하는 날',
    '미루던 결제·서류를 끝내면 속이 뻥 뚫리는 날', '칼같은 판단이 오히려 상대를 편하게 하는 날'],
  수: ['생각이 깊어지고 아이디어가 흐르는 날', '조용히 정보를 모으면 판이 보이는 날',
    '감정에 휩쓸리지 않으면 이기는 날', '잠깐의 혼자만의 시간이 약이 되는 날'],
};

const LOVE_LINES = {
  목: '먼저 다가가는 쪽이 오늘은 이득이에요. 가벼운 안부 한 줄이면 충분해요.',
  화: '표현이 세지면 오해가 생겨요. 마음은 뜨겁게, 말은 부드럽게.',
  토: '약속을 지키는 모습이 제일 매력으로 보이는 날이에요.',
  금: '정확하게 말할수록 관계가 편해져요. 애매한 건 오늘 정리해요.',
  수: '상대 이야기를 끝까지 들어주면 관계 온도가 확 올라가요.',
};

const MONEY_LINES = {
  목: '작은 씨앗에 투자해 보기 좋은 날. 큰돈보다 시작이 이득이에요.',
  화: '흥에 겨워 지르는 결제만 참으면 돈이 남아요.',
  토: '고정지출 점검하면 새는 돈이 보여요. 오늘 하나만 줄여 봐요.',
  금: '받을 돈·못 받은 돈을 정리하기 좋은 날이에요.',
  수: '정보가 곧 돈이 되는 날. 비교 견적 한 번만 더 돌려 보세요.',
};

/** 오늘의 운세 — 일주와 날짜로 결정되는 고정 결과 */
export function todayFortune(chart, ms = Date.now()) {
  const key = dateKey(ms);
  const dj = dayGapjaOf(ms);
  const seed = (chart.ilju.index + 1) * 7919 + Number(key) % 100003 + dj.index * 131;
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const me = chart.dayMaster.element;
  const score = 58 + Math.floor(rnd() * 40);
  const rel = elementRelation(me, GAN_ELEMENT[dj.g]);
  const bonus = {
    상생: '기운이 밖으로 잘 뻗는', 생받음: '도움을 받는', 비화: '내 편이 늘어나는',
    상극: '에너지가 쏠리는', 극받음: '눌렀다 올라오는',
  }[rel] || '';
  const relTag = {
    상생: '내가 살려 주는 날', 생받음: '도움받는 날', 비화: '동지가 많은 날',
    상극: '내가 끌고 가는 날', 극받음: '압박을 이기는 날',
  }[rel] || '흐름을 타는 날';
  return {
    key, dayGapja: dj,
    score,
    headline: `${dj.korean}일 · ${bonus} 하루`.trim(),
    line: pick(TODAY_LINES[me]),
    love: LOVE_LINES[me],
    money: MONEY_LINES[me],
    luckyHour: ZHI[Math.floor(rnd() * 12)] + '시',
    tags: [GAN_ELEMENT[dj.g] + ' 기운', relTag],
  };
}

/* ------------------------------------------------------------------ *
 * 궁합
 * ------------------------------------------------------------------ */

const YUKHAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];      // 육합
const CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];       // 충
const SAMHAP = [[2, 6, 10], [3, 7, 11], [0, 4, 8], [1, 5, 9]];          // 삼합
const HYEONG = [[2, 5, 8], [1, 4, 10], [0, 3]];                          // 형

function pairInPairs(pairs, a, b) {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}
function inTrio(trios, a, b) {
  return trios.some((t) => t.includes(a) && t.includes(b));
}

export function compatibility(chartA, chartB) {
  const a = chartA.pillars[2].gapja;
  const b = chartB.pillars[2].gapja;
  let score = 50;
  const notes = [];

  // 1) 일간 오행 관계 (방향과 무관하게 같은 점수 — 누가 먼저 넣든 결과가 같아야 한다)
  const rel = elementRelation(GAN_ELEMENT[a.g], GAN_ELEMENT[b.g]);
  if (rel === '상생' || rel === '생받음') { score += 15; notes.push('서로를 살려 주는 상생 관계'); }
  if (rel === '비화') { score += 8; notes.push('결이 비슷해 말이 통하는 동지 관계'); }
  if (rel === '상극') { score += 2; notes.push('한쪽이 끌고 한쪽이 밀리는 긴장 관계'); }
  if (rel === '극받음') { score += 2; notes.push('서로를 자극하는 관계'); }

  // 2) 일지 관계
  if (pairInPairs(YUKHAP, a.z, b.z)) { score += 20; notes.push('일지 육합(六合) — 붙으면 떨어지기 아쉬운 사이'); }
  if (inTrio(SAMHAP, a.z, b.z)) { score += 12; notes.push('일지 삼합(三合) — 함께 있을 때 시너지'); }
  if (pairInPairs(CHUNG, a.z, b.z)) { score -= 14; notes.push('일지 충(沖) — 부딪히지만 그만큼 강하게 끌림'); }
  if (inTrio(HYEONG, a.z, b.z)) { score -= 8; notes.push('일지 형(刑) — 서로 예민해지는 지점이 있음'); }

  // 3) 오행 보완
  const ea = chartA.elements;
  const eb = chartB.elements;
  let fill = 0;
  for (const e of ELEMENTS) {
    if (ea.counts[e] === 0 && eb.counts[e] >= 2) fill++;
    if (eb.counts[e] === 0 && ea.counts[e] >= 2) fill++;
  }
  score += Math.min(fill * 6, 12);
  if (fill) notes.push('서로에게 없는 기운을 채워 주는 조합');

  // 4) 같은 일주 / 상극 일주 보정
  if (a.index === b.index) { score += 3; notes.push('같은 일주 — 거울을 보는 듯한 사이'); }

  score = Math.max(28, Math.min(98, Math.round(score)));
  let tier;
  let comment;
  if (score >= 85) {
    tier = '천생연분';
    comment = '딱 봐도 붙어 다녀야 하는 사이. 서로의 빈 곳을 정확히 채워 줘요.';
  } else if (score >= 72) {
    tier = '찰떡궁합';
    comment = '같이 있으면 편하고 웃을 일이 많아요. 다퉈도 금방 풀리는 편.';
  } else if (score >= 60) {
    tier = '좋은 인연';
    comment = '노력하면 오래 가는 사이. 서로의 리듬만 맞추면 안정적이에요.';
  } else if (score >= 46) {
    tier = '알콩달콩';
    comment = '다른 점이 많지만 그게 끌림이에요. 말 한 번 더 하면 훨씬 좋아져요.';
  } else {
    tier = '환장궁합';
    comment = '부딪히면 아프지만 자꾸 신경 쓰이는 사이. 거리 조절이 관건이에요.';
  }
  return {
    score, tier, comment, notes: notes.slice(0, 3),
    a: { ilju: chartA.ilju, gapja: a }, b: { ilju: chartB.ilju, gapja: b },
    rel, dayRelation: { yukhap: pairInPairs(YUKHAP, a.z, b.z), chung: pairInPairs(CHUNG, a.z, b.z) },
  };
}
