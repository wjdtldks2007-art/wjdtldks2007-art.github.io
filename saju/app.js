/** SIAN LAB 사주 — 화면 조립과 공유 */

import {
  computeChart, compatibility, todayFortune, lunarMonths, termTime,
  GAN_HANJA, ZHI_HANJA, ZHI_HOUR, ZHI, ELEMENT_HANJA, LUNAR_RANGE, TERM_RANGE, dateKey,
} from './engine.js';
import { ILJU, DAY_MASTER, ELEMENT_TEXT, LUCKY, STRENGTH } from './content.js';

const $ = (sel, root = document) => root.querySelector(sel);
const EL_CLASS = { 목: 'el-mok', 화: 'el-hwa', 토: 'el-to', 금: 'el-geum', 수: 'el-su' };
const EL_HEX = { 목: '#7ED9A0', 화: '#FF8A7A', 토: '#E8C27A', 금: '#DCE4F2', 수: '#6FA8FF' };
const BRANCH_HOUR = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
const HOUR_OF_BRANCH = BRANCH_HOUR;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const state = { cal: 'solar', hourBranch: null, chart: null, partner: null, compat: null };

/* ------------------------------------------------------------------ */
/* 유틸                                                               */
/* ------------------------------------------------------------------ */

/** 받침 유무로 조사 고르기 — '은/는' 처럼 넘긴다 */
function josa(word, pair) {
  const [a, b] = pair.split('/');
  const bare = String(word).replace(/\([^)]*\)$/, '');   // '화(火)' → '화'
  const code = bare.charCodeAt(bare.length - 1);
  if (!code || code < 0xac00 || code > 0xd7a3) return a;
  return (code - 0xac00) % 28 === 0 ? a : b;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-on'), 2200);
}

/* ------------------------------------------------------------------ */
/* 폼                                                                 */
/* ------------------------------------------------------------------ */

function fillSelect(el, items, value) {
  el.innerHTML = items.map((it) => {
    const v = typeof it === 'object' ? it.value : it;
    const l = typeof it === 'object' ? it.label : it;
    return `<option value="${v}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`;
  }).join('');
}

function daysInSolarMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function refreshDays(preserve = true) {
  const y = +$('#sel-year').value;
  const m = +$('#sel-month').value;
  const cur = +$('#sel-day').value || 1;
  let max = 31;
  if (state.cal === 'solar') {
    max = daysInSolarMonth(y, m);
  } else {
    const months = lunarMonths(y);
    const leap = $('#chk-leap').checked;
    const found = months && months.find((x) => x.m === m && x.leap === leap);
    max = found ? found.days : (months && months[0] ? months[0].days : 30);
  }
  const day = preserve ? Math.min(cur, max) : 1;
  fillSelect($('#sel-day'), Array.from({ length: max }, (_, i) => i + 1), day);
}

function refreshMonths() {
  const y = +$('#sel-year').value;
  if (state.cal === 'lunar') {
    const months = lunarMonths(y);
    const cur = +$('#sel-month').value || 1;
    const items = (months || []).map((x) => ({ value: x.m, label: x.leap ? `윤${x.m}` : `${x.m}` }));
    fillSelect($('#sel-month'), items, cur);
    $('#chk-leap').checked = false;
    $('#leap-wrap').hidden = false;
  } else {
    fillSelect($('#sel-month'), Array.from({ length: 12 }, (_, i) => i + 1), +$('#sel-month').value || 1);
    $('#leap-wrap').hidden = true;
  }
  refreshDays();
}

function setCalendar(cal) {
  state.cal = cal;
  document.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.cal === cal));
  const [minY, maxY] = cal === 'lunar' ? LUNAR_RANGE : TERM_RANGE;
  const cur = +$('#sel-year').value;
  fillSelect($('#sel-year'), Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i),
    Math.min(Math.max(cur, minY), maxY));
  $('#date-hint').textContent = `${minY} – ${maxY}`;
  refreshMonths();
}

function buildHourGrid() {
  const grid = $('#hour-grid');
  grid.innerHTML = ZHI_HOUR.map((label, i) => {
    const [name, time] = label.split(' ');
    return `<button type="button" class="hour" data-branch="${i}"><b>${name}</b><span>${time}</span></button>`;
  }).join('') + '<button type="button" class="hour unknown" data-branch="x"><b>시간 모름</b><span>시주 없이 세 기둥으로</span></button>';

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.hour');
    if (!btn) return;
    grid.querySelectorAll('.hour').forEach((b) => b.classList.remove('is-on'));
    btn.classList.add('is-on');
    const v = btn.dataset.branch;
    state.hourBranch = v === 'x' ? null : +v;
  });
  selectHour(null);
}

function selectHour(branch) {
  state.hourBranch = branch;
  document.querySelectorAll('.hour').forEach((b) => {
    const v = b.dataset.branch;
    b.classList.toggle('is-on', branch === null ? v === 'x' : +v === branch);
  });
}

function initForm() {
  const yearSel = $('#sel-year');
  fillSelect(yearSel, Array.from({ length: TERM_RANGE[1] - TERM_RANGE[0] + 1 }, (_, i) => TERM_RANGE[0] + i), 2007);
  fillSelect($('#sel-month'), Array.from({ length: 12 }, (_, i) => i + 1), 9);
  refreshDays(false);
  fillSelect($('#sel-day'), Array.from({ length: 30 }, (_, i) => i + 1), 8);

  document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => setCalendar(b.dataset.cal)));
  yearSel.addEventListener('change', refreshMonths);
  $('#sel-month').addEventListener('change', () => { $('#chk-leap').checked = false; refreshDays(); });
  $('#chk-leap').addEventListener('change', refreshDays);
  buildHourGrid();
  $('#go-btn').addEventListener('click', submit);
}

function readForm() {
  const y = +$('#sel-year').value;
  const m = +$('#sel-month').value;
  const d = +$('#sel-day').value;
  return {
    y, m, d,
    lunar: state.cal === 'lunar',
    leap: state.cal === 'lunar' && $('#chk-leap').checked,
    hour: state.hourBranch === null ? null : HOUR_OF_BRANCH[state.hourBranch],
    branch: state.hourBranch,
  };
}

function submit() {
  const v = readForm();
  const chart = computeChart({ y: v.y, m: v.m, d: v.d, hour: v.hour, lunar: v.lunar, leap: v.leap });
  const err = $('#form-error');
  if (chart.error) {
    err.hidden = false;
    err.textContent = chart.error === 'lunar_range'
      ? '음력 표 범위(1900~2050년)를 벗어났어요. 양력으로 바꿔서 다시 해 주세요.'
      : chart.error === 'range'
        ? '양력 1900~2100년 사이만 계산할 수 있어요. 연도를 다시 확인해 주세요.'
        : '이 날짜는 계산할 수 없어요. 날짜를 다시 확인해 주세요.';
    return;
  }
  err.hidden = true;
  state.chart = chart;
  state.compat = null;
  render(chart, v);
  updateURL(v);
  $('#form-panel').hidden = true;
  $('#hero').hidden = true;
  $('#nav-result').hidden = false;
  $('#nav-compat').hidden = false;
  $('#result').hidden = false;
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ */
/* 결과 렌더                                                          */
/* ------------------------------------------------------------------ */

function fmtDate(y, m, d) { return `${y}. ${m}. ${d}.`; }
function fmtTerm(t) {
  if (!t) return '';
  return `${t.name} ${t.m}. ${t.d}. ${String(t.h).padStart(2, '0')}:${String(t.mi).padStart(2, '0')}`;
}

function render(chart, v) {
  const ilju = ILJU[chart.pillars[2].gapja.korean];
  const el = chart.elements;
  const dm = chart.dayMaster;
  const dmText = DAY_MASTER[dm.gan];
  const luckyEl = el.missing.length ? el.missing[0] : (el.counts[el.weakest] <= 1 ? el.weakest : dm.element);
  const lucky = LUCKY[luckyEl];
  const fort = todayFortune(chart);
  const strength = strengthOf(chart);

  const lunarText = chart.lunar
    ? `${fmtDate(chart.lunar.y, chart.lunar.m, chart.lunar.d)}${chart.lunar.leap ? ' (윤달)' : ''}`
    : null;
  const dateLine = v.lunar
    ? (lunarText ? `음력 <b>${lunarText}</b> · 양력 <b>${fmtDate(chart.solar.y, chart.solar.m, chart.solar.d)}</b>`
      : `음력 <b>${fmtDate(chart.solar.y, chart.solar.m, chart.solar.d)}</b>`)
    : `양력 <b>${fmtDate(chart.solar.y, chart.solar.m, chart.solar.d)}</b>`
      + (lunarText ? ` · 음력 <b>${lunarText}</b>` : '');
  const hourText = chart.hourKnown
    ? ZHI_HOUR[chart.pillars[3].gapja.z]
    : '시간 모름';

  $('#result').innerHTML = `
    <article class="card result-head reveal">
      <p class="eyebrow">당신의 일주</p>
      <h2 class="ilju-name">${esc(chart.ilju.name)}</h2>
      <p class="ilju-hanja">${chart.pillars[2].gapja.hanja}日柱</p>
      <div class="result-tags">
        <span>${esc(ilju.tag)}</span>
        <span>${esc(dm.element)} ${esc(dm.yin)} 일간</span>
        <span>${esc(chart.pillars[0].gapja.korean)}년</span>
      </div>
      <div class="head-share">
        <button type="button" class="btn-ghost" id="btn-copy-top">링크 복사</button>
        <button type="button" class="btn-ghost" id="btn-image-top">카드 저장</button>
      </div>
      <p class="result-meta">
        ${dateLine}
        · <b>${esc(hourText)}</b><br />
        ${chart.pillars.slice(0, chart.hourKnown ? 4 : 3).map((p) => p.gapja.korean).join(' · ')}
        <br />${chart.jeol.prev ? `${fmtTerm(chart.jeol.prev)}${josa(chart.jeol.prev.name, '을/를')} 지난` : ''}
        ${chart.jeol.next ? ` · 다음 절기 ${fmtTerm(chart.jeol.next)}` : ''}
      </p>
    </article>

    <article class="card reveal" style="animation-delay:.05s">
      <div class="card-head"><span class="label label-gold">四柱 · 사주팔자</span><span class="label">${chart.hourKnown ? '8글자' : '6글자'}</span></div>
      <div class="pillars">${chart.pillars.map(pillarCard).join('')}</div>
    </article>

    <article class="card reveal" style="animation-delay:.1s">
      <div class="card-head"><span class="label label-gold">五行 · 오행 밸런스</span><span class="label">${el.missing.length ? `${el.missing.join('·')} 없음` : '다섯 기운'}</span></div>
      <div class="ohang-grid">
        <div class="bars">${['목', '화', '토', '금', '수'].map((e) => barRow(e, el)).join('')}</div>
        <div class="radar-wrap">${radar(el)}</div>
      </div>
      <p class="ohang-note">${ohangNote(el, dm)}</p>
    </article>

    <article class="card reveal" style="animation-delay:.14s">
      <div class="card-head"><span class="label label-gold">日干 · 나의 중심</span><span class="label">${esc(dmText.hanja)}</span></div>
      <div class="dm-top">
        <div class="dm-hanja">${esc(dm.hanja)}</div>
        <div>
          <p class="dm-title">${esc(dmText.title)} · ${esc(dm.yin)}의 기운</p>
          <p class="dm-sub">${esc(dmText.keyword)}</p>
        </div>
      </div>
      <p class="dm-desc">${esc(dmText.desc)}</p>
      <div class="dm-split">
        <div><b>강점</b>${esc(dmText.light)}</div>
        <div><b>그림자</b>${esc(dmText.shadow)}</div>
        <div><b>기운</b>${esc(strength.label)} — ${esc(strength.desc)}</div>
      </div>
    </article>

    <article class="card reveal" style="animation-delay:.18s">
      <div class="card-head"><span class="label label-gold">${esc(chart.pillars[2].gapja.korean)}일주 풀이</span><span class="label">${esc(ilju.tag)}</span></div>
      <div class="trio">
        <div class="trio-card"><p class="t-k"><em aria-hidden="true">✦</em>성격</p><p>${esc(ilju.persona)}</p></div>
        <div class="trio-card"><p class="t-k"><em aria-hidden="true">♥</em>연애</p><p>${esc(ilju.love)}</p></div>
        <div class="trio-card"><p class="t-k"><em aria-hidden="true">₩</em>재물</p><p>${esc(ilju.money)}</p></div>
      </div>
    </article>

    <article class="card reveal" style="animation-delay:.22s" id="today">
      <div class="card-head"><span class="label label-gold">오늘의 운세</span><span class="label">${fmtDate(...dateParts())}</span></div>
      <div class="today-top">
        ${ring(fort.score, '종합')}
        <div>
          <p class="today-headline">${esc(fort.headline)}</p>
          <p class="today-line">${esc(fort.line)}</p>
        </div>
      </div>
      <div class="today-sub">
        <p><b>연애</b>${esc(fort.love)}</p>
        <p><b>재물</b>${esc(fort.money)}</p>
        <p><b>행운의 시간</b>${esc(fort.luckyHour)} · ${esc(fort.tags.join(' · '))}</p>
      </div>
    </article>

    <article class="card reveal" style="animation-delay:.26s">
      <div class="card-head"><span class="label label-gold">행운 아이템</span><span class="label">${esc(luckyEl)} 보충</span></div>
      <div class="lucky-grid">
        <div class="lucky-item"><span class="swatches">${lucky.hex.map((h) => `<i style="background:${h}"></i>`).join('')}</span><div><p class="l-k">행운 컬러</p><p class="l-v">${esc(lucky.colors.join(' · '))}</p></div></div>
        <div class="lucky-item"><span class="swatches"><i style="background:linear-gradient(140deg,#F8E7BC,#C9A055)"></i></span><div><p class="l-k">행운 숫자</p><p class="l-v">${lucky.numbers.join(' · ')}</p></div></div>
        <div class="lucky-item"><span class="swatches" style="display:grid;place-items:center;font-size:15px">✦</span><div><p class="l-k">행운 아이템</p><p class="l-v">${esc(lucky.items[0])}</p></div></div>
      </div>
      <p class="share-note">${esc(ELEMENT_TEXT[luckyEl].keyword)} 기운을 채워 주는 조합이에요. ${esc(ELEMENT_TEXT[luckyEl].desc)}</p>
    </article>

    <article class="card reveal" style="animation-delay:.3s" id="compat">
      <div class="card-head"><span class="label label-gold">궁합</span><span class="label">일주 · 오행으로 보기</span></div>
      <p class="today-line">상대 생일을 넣으면 두 사람의 일주와 오행으로 점수를 매겨 드려요. 친구·연인에게 보내 보세요.</p>
      <div class="compat-form">
        <div class="compat-fields">
          <div class="compat-row">
            <select id="c-year" aria-label="상대 태어난 해"></select>
            <select id="c-month" aria-label="상대 태어난 달"></select>
            <select id="c-day" aria-label="상대 태어난 날"></select>
          </div>
          <div class="compat-hour">
            <select id="c-hour" aria-label="상대 태어난 시간"></select>
            <button type="button" class="btn-ghost" id="c-go">궁합 보기</button>
          </div>
        </div>
      </div>
      <div class="compat-result" id="compat-result" hidden></div>
    </article>

    <article class="card reveal" style="animation-delay:.34s">
      <div class="card-head"><span class="label label-gold">공유하기</span><span class="label">내 사주 링크</span></div>
      <div class="share-row">
        <button type="button" class="share-btn" id="btn-copy">링크 복사</button>
        <button type="button" class="share-btn" id="btn-image">카드 이미지 저장</button>
        <button type="button" class="share-btn" id="btn-native">공유하기</button>
      </div>
      <p class="share-note">링크에는 생년월일만 담겨요. 이름·전화번호 같은 건 저장하지 않습니다.</p>
      <button type="button" class="restart" id="btn-restart">다른 생일로 다시 보기</button>
    </article>

    <p class="disclaimer">사주는 태어난 시각을 기준으로 계산합니다. 시각을 모르면 시주를 빼고 세 기둥으로 풀어요. 절기 시각은 한국천문연구원 「24기 입기 시각」 기준이고, 결과는 재미와 참고를 위한 것입니다.</p>
  `;

  wireResult(chart, v, luckyEl);
}

function pillarCard(p) {
  if (!p.gapja) {
    return `<div class="pillar is-off">
      <p class="p-label">${p.label}</p>
      <p class="p-hanja" style="opacity:.35">？</p>
      <p class="p-kr">모름</p>
      <p class="p-off">삼주로 봄</p>
    </div>`;
  }
  const hanja = p.gapja.hanja.split('').join('<br />');
  return `<div class="pillar${p.key === 'day' ? ' is-day' : ''}">
    <p class="p-label">${p.label}</p>
    <p class="p-hanja">${hanja}</p>
    <p class="p-kr">${p.gapja.korean}</p>
    <p class="p-el ${EL_CLASS[p.ganElement]}"><i style="background:${EL_HEX[p.ganElement]}"></i>${p.ganElement}
      <span class="${EL_CLASS[p.zhiElement]}"><i style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${EL_HEX[p.zhiElement]};margin:0 3px 1px 5px"></i>${p.zhiElement}</span></p>
    <p class="p-tg">${esc(p.tenGod)}</p>
  </div>`;
}

function barRow(e, el) {
  const pct = el.pct[e];
  const max = Math.max(...Object.values(el.pct), 1);
  return `<div class="bar-row">
    <span class="b-name ${EL_CLASS[e]}">${e}<small>${ELEMENT_HANJA[e]}</small></span>
    <div class="bar-track"><div class="bar-fill" style="background:linear-gradient(90deg,${EL_HEX[e]},${EL_HEX[e]}aa);width:${Math.round((pct / max) * 100)}%"></div></div>
    <span class="b-pct">${pct}%</span>
  </div>`;
}

function radar(el) {
  const cx = 140; const cy = 132; const r = 96;
  const order = ['목', '화', '토', '금', '수'];
  const max = Math.max(...order.map((e) => el.pct[e]), 1);
  const pt = (i, ratio) => {
    const ang = (-90 + i * 72) * (Math.PI / 180);
    const rr = r * ratio;
    return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
  };
  const rings = [0.25, 0.5, 0.75, 1].map((k) => {
    const pts = order.map((_, i) => pt(i, k).map((n) => n.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1" />`;
  }).join('');
  const axes = order.map((_, i) => {
    const [x, y] = pt(i, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.09)" stroke-width="1" />`;
  }).join('');
  const shape = order.map((e, i) => pt(i, Math.max(el.pct[e] / max, 0.06)).map((n) => n.toFixed(1)).join(',')).join(' ');
  const dots = order.map((e, i) => {
    const [x, y] = pt(i, Math.max(el.pct[e] / max, 0.06));
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${EL_HEX[e]}" />`;
  }).join('');
  const labels = order.map((e, i) => {
    const [x, y] = pt(i, 1.22);
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="800" fill="${EL_HEX[e]}" font-family="Pretendard, sans-serif">${e}</text>`;
  }).join('');
  return `<svg class="radar" viewBox="0 0 280 264" role="img" aria-label="오행 밸런스 레이더">
    ${rings}${axes}
    <polygon points="${shape}" fill="rgba(231,197,123,.18)" stroke="#E7C57B" stroke-width="1.6" stroke-linejoin="round" />
    ${dots}${labels}
  </svg>`;
}

function ohangNote(el, dm) {
  const strongest = el.strongest;
  const weakest = el.weakest;
  const parts = [];
  parts.push(`<b>${strongest}(${ELEMENT_HANJA[strongest]})</b>${josa(strongest, '이/가')} 가장 많아요. ${ELEMENT_TEXT[strongest].desc}`);
  if (el.missing.length) {
    parts.push(`<b>${el.missing.join('·')}</b>${josa(el.missing[el.missing.length - 1], '은/는')} 아예 없어요. ${ELEMENT_TEXT[el.missing[0]].lack}`);
  } else if (el.counts[weakest] <= 1) {
    parts.push(`<b>${weakest}(${ELEMENT_HANJA[weakest]})</b>${josa(weakest, '이/가')} 얇아요. ${ELEMENT_TEXT[weakest].lack}`);
  }
  if (!el.missing.length && el.counts[weakest] > 1) {
    parts.push('다섯 기운이 고르게 섞여 있어요. 한쪽으로 크게 치우치지 않아 상황에 맞게 골라 쓰기 좋은 사주예요.');
  }
  return parts.join(' ');
}

let ringSeq = 0;
function ring(score, caption) {
  const gid = `rg${++ringSeq}`;
  const r = 40; const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return `<div class="ring">
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="7" />
      <circle cx="46" cy="46" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${(c - dash).toFixed(1)}" />
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F8E7BC" /><stop offset="1" stop-color="#C9A055" /></linearGradient></defs>
    </svg>
    <div class="ring-txt"><b>${score}</b><span>${caption}</span></div>
  </div>`;
}

function strengthOf(chart) {
  const el = chart.elements;
  const dm = chart.dayMaster.element;
  const gen = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' }[dm];
  const support = el.counts[dm] + el.counts[gen];
  const drain = el.counts[{ 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' }[dm]] + el.counts[{ 목: '금', 화: '수', 토: '목', 금: '화', 수: '토' }[dm]];
  if (support - drain >= 2) return STRENGTH.strong;
  if (drain - support >= 1) return STRENGTH.weak;
  return STRENGTH.balanced;
}

function dateParts() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/* ------------------------------------------------------------------ */
/* 궁합 / 공유                                                        */
/* ------------------------------------------------------------------ */

function wireResult(chart, v, luckyEl) {
  // 궁합 셀렉트
  fillSelect($('#c-year'), Array.from({ length: TERM_RANGE[1] - TERM_RANGE[0] + 1 }, (_, i) => TERM_RANGE[0] + i), 2004);
  fillSelect($('#c-month'), Array.from({ length: 12 }, (_, i) => i + 1), 3);
  fillSelect($('#c-day'), Array.from({ length: 31 }, (_, i) => i + 1), 21);
  fillSelect($('#c-hour'), [{ value: 'x', label: '시간 모름' },
    ...ZHI_HOUR.map((z, i) => ({ value: i, label: z }))], 'x');
  $('#c-month').addEventListener('change', () => {
    const max = daysInSolarMonth(+$('#c-year').value, +$('#c-month').value);
    fillSelect($('#c-day'), Array.from({ length: max }, (_, i) => i + 1), Math.min(+$('#c-day').value, max));
  });
  $('#c-year').addEventListener('change', () => $('#c-month').dispatchEvent(new Event('change')));
  $('#c-go').addEventListener('click', () => {
    const hb = $('#c-hour').value;
    const p = computeChart({
      y: +$('#c-year').value, m: +$('#c-month').value, d: +$('#c-day').value,
      hour: hb === 'x' ? null : HOUR_OF_BRANCH[+hb],
    });
    if (p.error) { toast('상대 생일을 다시 확인해 주세요'); return; }
    state.partner = p;
    state.compat = compatibility(chart, p);
    renderCompat(state.compat, p);
  });

  $('#btn-copy').addEventListener('click', copyLink);
  $('#btn-copy-top')?.addEventListener('click', copyLink);
  $('#btn-image-top')?.addEventListener('click', () => saveCard(chart, v, luckyEl));
  $('#btn-image').addEventListener('click', () => saveCard(chart, v, luckyEl));
  $('#btn-native').addEventListener('click', nativeShare);
  $('#btn-restart').addEventListener('click', () => {
    $('#result').hidden = true;
    $('#form-panel').hidden = false;
    $('#hero').hidden = false;
    $('#nav-result').hidden = true;
    $('#nav-compat').hidden = true;
    history.replaceState(null, '', location.pathname);
    window.scrollTo({ top: 0 });
  });
}

function renderCompat(c, partner) {
  const box = $('#compat-result');
  box.hidden = false;
  box.innerHTML = `
    <div class="compat-pair">
      <span class="cp"><small>나</small>${c.a.gapja.korean} · ${esc(c.a.ilju.name)}</span>
      <span style="color:#8A7A57">×</span>
      <span class="cp"><small>상대</small>${c.b.gapja.korean} · ${esc(c.b.ilju.name)}</span>
    </div>
    <div class="compat-score">
      ${ring(c.score, '궁합')}
      <div>
        <p class="compat-tier">${esc(c.tier)} · ${c.score}점</p>
        <p class="compat-comment">${esc(c.comment)}</p>
      </div>
    </div>
    <div class="compat-notes">${c.notes.map((n) => `<span>${esc(n)}</span>`).join('')}</div>
  `;
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function shareURL(v) {
  const base = location.origin + location.pathname;
  const p = new URLSearchParams();
  p.set('b', `${v.y}${String(v.m).padStart(2, '0')}${String(v.d).padStart(2, '0')}`);
  p.set('t', v.branch === null ? 'x' : String(v.branch));
  if (v.lunar) p.set('c', 'l');
  if (v.leap) p.set('lp', '1');
  return `${base}?${p.toString()}`;
}

async function copyLink() {
  const v = readForm();
  const url = shareURL(v);
  try {
    await navigator.clipboard.writeText(url);
    toast('링크를 복사했어요');
  } catch {
    window.prompt('이 링크를 복사해서 보내 주세요', url);
  }
}

async function nativeShare() {
  const v = readForm();
  const url = shareURL(v);
  const text = `내 사주는 ${state.chart.ilju.name} ${state.chart.pillars[2].gapja.korean}일주래`;
  if (navigator.share) {
    try { await navigator.share({ title: 'SIAN LAB 사주', text, url }); return; } catch { /* 취소 */ }
  }
  copyLink();
}

function updateURL(v) {
  try { history.replaceState(null, '', shareURL(v)); } catch { /* file:// 등 */ }
}

/* ------------------------------------------------------------------ */
/* 결과 카드 이미지 (1080 × 1620)                                     */
/* ------------------------------------------------------------------ */

async function saveCard(chart, v, luckyEl) {
  toast('카드를 만드는 중…');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const W = 1080; const H = 1620;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const lucky = LUCKY[luckyEl];
  const el = chart.elements;
  const ilju = ILJU[chart.pillars[2].gapja.korean];

  // 배경
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0B0D14'); bg.addColorStop(.55, '#090B10'); bg.addColorStop(1, '#120E18');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * .8, -120, 40, W * .8, -120, 900);
  glow.addColorStop(0, 'rgba(231,197,123,.26)'); glow.addColorStop(1, 'rgba(231,197,123,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const glow2 = g.createRadialGradient(60, H * .95, 40, 60, H * .95, 760);
  glow2.addColorStop(0, 'rgba(124,58,237,.2)'); glow2.addColorStop(1, 'rgba(124,58,237,0)');
  g.fillStyle = glow2; g.fillRect(0, 0, W, H);

  // 테두리
  g.strokeStyle = 'rgba(231,197,123,.32)'; g.lineWidth = 2;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.strokeStyle = 'rgba(231,197,123,.14)'; g.lineWidth = 1;
  g.strokeRect(52, 52, W - 104, H - 104);

  const center = (t, y, size, color, weight = 800, family = 'Pretendard') => {
    g.font = `${weight} ${size}px ${family}, sans-serif`;
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(t, W / 2, y);
  };

  center('SIAN LAB · SAJU', 132, 24, 'rgba(231,197,123,.85)', 800);
  center('四柱八字', 236, 40, 'rgba(231,197,123,.55)', 500, '"SIAN Serif"');

  center(chart.ilju.name, 400, 104, '#F8E7BC');
  center(`${chart.pillars[2].gapja.hanja}日柱 · ${ilju.tag}`, 460, 34, 'rgba(226,211,174,.9)', 700);

  // 4기둥
  const pillars = chart.pillars;
  const pw = 200; const gap = 24;
  const startX = (W - (pw * 4 + gap * 3)) / 2;
  pillars.forEach((p, i) => {
    const x = startX + i * (pw + gap);
    const y = 540;
    g.fillStyle = p.key === 'day' ? 'rgba(231,197,123,.14)' : 'rgba(255,255,255,.05)';
    roundRect(g, x, y, pw, 300, 24); g.fill();
    g.strokeStyle = p.key === 'day' ? 'rgba(231,197,123,.55)' : 'rgba(255,255,255,.12)';
    g.lineWidth = p.key === 'day' ? 2 : 1;
    roundRect(g, x, y, pw, 300, 24); g.stroke();
    centerIn(g, p.label, x + pw / 2, y + 48, 24, 'rgba(160,170,190,.95)', 700);
    if (p.gapja) {
      centerIn(g, p.gapja.hanja[0], x + pw / 2, y + 130, 62, '#F4EDDC', 500, '"SIAN Serif"');
      centerIn(g, p.gapja.hanja[1], x + pw / 2, y + 200, 62, '#F4EDDC', 500, '"SIAN Serif"');
      centerIn(g, p.gapja.korean, x + pw / 2, y + 252, 28, 'rgba(210,220,236,.95)', 800);
      centerIn(g, `${p.ganElement}·${p.zhiElement}`, x + pw / 2, y + 284, 20, 'rgba(231,197,123,.8)', 700);
    } else {
      centerIn(g, '？', x + pw / 2, y + 170, 62, 'rgba(140,148,166,.5)', 500, '"SIAN Serif"');
      centerIn(g, '시간 모름', x + pw / 2, y + 252, 26, 'rgba(140,148,166,.8)', 700);
    }
  });

  // 오행
  center('오행 밸런스', 930, 24, 'rgba(231,197,123,.8)', 800);
  const order = ['목', '화', '토', '금', '수'];
  const hex = { 목: '#7ED9A0', 화: '#FF8A7A', 토: '#E8C27A', 금: '#DCE4F2', 수: '#6FA8FF' };
  order.forEach((e, i) => {
    const y = 975 + i * 62;
    g.textAlign = 'left'; g.font = '800 26px Pretendard, sans-serif'; g.fillStyle = hex[e];
    g.fillText(e, 130, y);
    g.fillStyle = 'rgba(255,255,255,.08)';
    roundRect(g, 190, y - 20, 620, 18, 9); g.fill();
    g.fillStyle = hex[e];
    roundRect(g, 190, y - 20, Math.max(620 * (el.pct[e] / 100), 10), 18, 9); g.fill();
    g.textAlign = 'right'; g.font = '800 26px Pretendard, sans-serif'; g.fillStyle = 'rgba(220,228,240,.9)';
    g.fillText(`${el.pct[e]}%`, 950, y);
  });

  // 행운
  g.textAlign = 'center';
  g.font = '700 26px Pretendard, sans-serif'; g.fillStyle = 'rgba(160,170,190,.9)';
  g.fillText('오늘의 행운', W / 2, 1330);
  g.font = '800 30px Pretendard, sans-serif'; g.fillStyle = '#EADFC6';
  g.fillText(`${lucky.colors[0]} · ${lucky.numbers.join('·')} · ${lucky.items[0]}`, W / 2, 1380);

  g.font = '700 22px Pretendard, sans-serif'; g.fillStyle = 'rgba(120,130,150,.9)';
  g.fillText('SIAN LAB · wjdtldks2007-art.github.io/saju', W / 2, 1500);
  g.fillStyle = 'rgba(231,197,123,.85)'; g.font = '800 20px Pretendard, sans-serif';
  g.fillText(`${fmtDate(chart.solar.y, chart.solar.m, chart.solar.d)} · ${chart.hourKnown ? ZHI_HOUR[chart.pillars[3].gapja.z] : '시간 모름'}`, W / 2, 1540);

  const url = cv.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `사주_${chart.pillars[2].gapja.korean}일주_${dateKey()}.png`;
  a.click();
  toast('카드 이미지를 저장했어요');
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function centerIn(g, t, x, y, size, color, weight = 800, family = 'Pretendard') {
  g.font = `${weight} ${size}px ${family}, sans-serif`;
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(t, x, y);
}

/* ------------------------------------------------------------------ */
/* 공유 링크로 바로 열기                                              */
/* ------------------------------------------------------------------ */

function fromQuery() {
  const p = new URLSearchParams(location.search);
  const b = p.get('b');
  if (!b || !/^\d{8}$/.test(b)) return null;
  const y = +b.slice(0, 4); const m = +b.slice(4, 6); const d = +b.slice(6, 8);
  const t = p.get('t');
  const branch = t === null || t === 'x' ? null : Math.max(0, Math.min(11, +t));
  const lunar = p.get('c') === 'l';
  const [y0, y1] = lunar ? LUNAR_RANGE : TERM_RANGE;
  // 범위를 벗어나거나 깨진 링크는 조용히 무시하고 입력 화면을 그대로 둔다
  if (!(y >= y0 && y <= y1) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return {
    y, m, d, lunar,
    leap: p.get('lp') === '1',
    branch,
    hour: branch === null ? null : HOUR_OF_BRANCH[branch],
  };
}

function setForm(v) {
  if (v.lunar) setCalendar('lunar');
  fillSelect($('#sel-year'), Array.from({
    length: (v.lunar ? LUNAR_RANGE[1] : TERM_RANGE[1]) - (v.lunar ? LUNAR_RANGE[0] : TERM_RANGE[0]) + 1,
  }, (_, i) => (v.lunar ? LUNAR_RANGE[0] : TERM_RANGE[0]) + i), v.y);
  fillSelect($('#sel-month'), Array.from({ length: 12 }, (_, i) => i + 1), v.m);
  if (v.lunar) $('#chk-leap').checked = !!v.leap;
  refreshDays();
  fillSelect($('#sel-day'), Array.from({ length: 31 }, (_, i) => i + 1), v.d);
  refreshDays(true);
  selectHour(v.branch);
}

function boot() {
  initForm();
  const q = fromQuery();
  if (q) {
    setForm(q);
    state.cal = q.lunar ? 'lunar' : 'solar';
    submit();
  }
}

boot();
