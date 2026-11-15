// 오운완 노트 — 기록은 이 기기의 localStorage에만 저장됩니다.
const KEY = 'ounwan.v1';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const $ = (s) => document.querySelector(s);

const DEFAULT = {
  routines: {
    0: [],
    1: ['벤치프레스', '인클라인 덤벨프레스', '케이블 플라이'],
    2: ['랫풀다운', '체스트 서포티드 로우', '시티드 케이블 로우'],
    3: ['바벨 스쿼트', '레그프레스', '루마니안 데드리프트'],
    4: ['덤벨 숄더프레스', '사이드 레터럴 레이즈', '페이스풀'],
    5: ['바벨컬', '케이블 푸시다운', '플랭크'],
    6: [],
  },
  sets: [],      // {id, date, ex, w, r}
  checks: {},    // {date: [ex, ...]}
  inbody: [],    // {id, date, weight, smm, fatPct, fatKg, visceral, bmr, memo}
  profile: { sex: 'm', age: '', height: '', weight: '', fat: '', activity: '1.55', goal: 'cut' },
  settings: { autoRest: true, rest: 90 },
};

let S = load();
function normalize(data) {
  const s = { ...structuredClone(DEFAULT), ...data };
  s.profile = { ...DEFAULT.profile, ...(data.profile || {}) };
  s.settings = { ...DEFAULT.settings, ...(data.settings || {}) };
  // 예전 버전의 체중 기록을 인바디 기록으로 옮김
  if (Array.isArray(data.body) && data.body.length && !(data.inbody || []).length) {
    s.inbody = data.body.map((b) => ({ id: uid(), date: b.date, weight: b.kg }));
  }
  delete s.body;
  return s;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* 저장소 사용 불가 시 기본값 */ }
  return structuredClone(DEFAULT);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const md = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const longDate = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`; };
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 탭 ---------------- */
const TITLES = { today: '오늘', log: '기록', timer: '휴식 타이머', body: '인바디', diet: '식단 칼로리', guide: '운동법' };
let currentTab = 'today';
function go(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.go === tab));
  $('#openTimer').classList.toggle('on', tab === 'timer');
  $('#title').textContent = TITLES[tab];
  $('#subtitle').textContent = tab === 'today' ? longDate(ymd()) : '';
  ({ today: renderToday, log: renderLog, body: renderBody, diet: renderDiet, guide: renderGuide })[tab]?.();
  updatePill();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
$('#openTimer').addEventListener('click', () => go(currentTab === 'timer' ? 'today' : 'timer'));

/* ---------------- 오늘 ---------------- */
const findGuide = (name) => EXERCISES.find((e) => e.name === name) || EXERCISES.find((e) => name.includes(e.name) || e.name.includes(name));
function todayExercises() {
  const today = ymd();
  const list = [...(S.routines[new Date().getDay()] || [])];
  S.sets.filter((s) => s.date === today).forEach((s) => { if (!list.includes(s.ex)) list.push(s.ex); });
  return list;
}
function renderToday() {
  const today = ymd();
  const list = todayExercises();
  const done = S.checks[today] || [];
  const doneCount = list.filter((x) => done.includes(x)).length;
  $('#progressText').textContent = `${doneCount} / ${list.length} 완료`;
  $('#progressBar').style.width = list.length ? `${(doneCount / list.length) * 100}%` : '0';
  $('#restDay').classList.toggle('hidden', list.length > 0);

  $('#todayList').innerHTML = list.map((ex) => {
    const sets = S.sets.filter((s) => s.date === today && s.ex === ex);
    const isDone = done.includes(ex);
    const g = findGuide(ex);
    return `<li class="ex ${isDone ? 'done' : ''}">
      <button class="check" data-check="${esc(ex)}" aria-label="${esc(ex)} 완료 표시" aria-pressed="${isDone}">✓</button>
      <span class="ex-name">${esc(ex)}${g ? ` <button class="how" data-how="${esc(g.name)}">방법</button>` : ''}</span>
      <button class="add-set" data-add="${esc(ex)}">+ 세트</button>
      <div class="sets">${sets.map((s, i) => `<span class="set-tag">${i + 1}세트 ${s.w ? fmt(s.w) + 'kg × ' : ''}${s.r}회</span>`).join('')}</div>
    </li>`;
  }).join('');
}
$('#todayList').addEventListener('click', (e) => {
  const c = e.target.closest('[data-check]');
  const a = e.target.closest('[data-add]');
  const h = e.target.closest('[data-how]');
  if (c) {
    const today = ymd(), ex = c.dataset.check;
    const arr = S.checks[today] || (S.checks[today] = []);
    const i = arr.indexOf(ex);
    i >= 0 ? arr.splice(i, 1) : arr.push(ex);
    save(); renderToday();
    if (navigator.vibrate && i < 0) navigator.vibrate(20);
  }
  if (a) openSetDialog(a.dataset.add);
  if (h) openGuideFor(h.dataset.how);
});
$('#addOther').addEventListener('click', () => openSetDialog(''));

/* 세트 기록 */
function allExerciseNames() {
  const names = new Set();
  Object.values(S.routines).flat().forEach((n) => names.add(n));
  S.sets.forEach((s) => names.add(s.ex));
  EXERCISES.forEach((e) => names.add(e.name));
  return [...names];
}
function fillNames() { $('#exNames').innerHTML = allExerciseNames().map((n) => `<option value="${esc(n)}">`).join(''); }
function lastSetOf(ex) {
  for (let i = S.sets.length - 1; i >= 0; i--) if (S.sets[i].ex === ex) return S.sets[i];
  return null;
}
function fillFromLast() {
  const last = lastSetOf($('#setEx').value.trim());
  if (last) {
    $('#setW').value = last.w || '';
    $('#setR').value = last.r;
    $('#setHint').textContent = `지난 기록: ${last.w ? fmt(last.w) + 'kg × ' : ''}${last.r}회 (${md(last.date)})`;
  } else {
    $('#setHint').textContent = '';
  }
}
function openSetDialog(ex) {
  fillNames();
  $('#setEx').value = ex;
  $('#setW').value = ''; $('#setR').value = '';
  fillFromLast();
  $('#setDialog').showModal();
  (ex ? $('#setR') : $('#setEx')).focus();
}
$('#setEx').addEventListener('change', fillFromLast);
document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const [id, d] = b.dataset.step.split(':');
  const input = document.getElementById(id);
  const v = Math.max(0, (parseFloat(input.value) || 0) + parseFloat(d));
  input.value = id === 'setR' ? Math.max(1, Math.round(v)) : v;
}));
$('#setDialog').addEventListener('close', () => {
  if ($('#setDialog').returnValue !== 'ok') return;
  const ex = $('#setEx').value.trim();
  const r = parseInt($('#setR').value, 10);
  const w = parseFloat($('#setW').value) || 0;
  if (!ex || !r) return;
  S.sets.push({ id: uid(), date: ymd(), ex, w, r });
  save(); renderToday();
  if (S.settings.autoRest) startTimer(S.settings.rest);
});

/* 루틴 편집 */
let editDay = new Date().getDay();
function renderRoutineEditor() {
  $('#dayChips').innerHTML = DAYS.map((d, i) => `<button type="button" data-day="${i}" class="${i === editDay ? 'on' : ''}">${d}</button>`).join('');
  const list = S.routines[editDay];
  $('#routineList').innerHTML = list.length
    ? list.map((ex, i) => `<li><span>${esc(ex)}</span><span class="tools">
        <button type="button" data-up="${i}" aria-label="위로">↑</button>
        <button type="button" data-del="${i}" aria-label="삭제">✕</button></span></li>`).join('')
    : `<li class="empty">${DAYS[editDay]}요일은 쉬는 날이에요</li>`;
}
$('#editRoutine').addEventListener('click', () => { editDay = new Date().getDay(); fillNames(); renderRoutineEditor(); $('#routineDialog').showModal(); });
$('#dayChips').addEventListener('click', (e) => { const b = e.target.closest('[data-day]'); if (b) { editDay = +b.dataset.day; renderRoutineEditor(); } });
$('#routineList').addEventListener('click', (e) => {
  const list = S.routines[editDay];
  const up = e.target.closest('[data-up]'), del = e.target.closest('[data-del]');
  if (up) { const i = +up.dataset.up; if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]]; }
  if (del) list.splice(+del.dataset.del, 1);
  if (up || del) { save(); renderRoutineEditor(); }
});
function addRoutineEx() {
  const v = $('#newEx').value.trim();
  if (!v || S.routines[editDay].includes(v)) return;
  S.routines[editDay].push(v); $('#newEx').value = '';
  save(); renderRoutineEditor(); $('#newEx').focus();
}
$('#addEx').addEventListener('click', addRoutineEx);
$('#newEx').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRoutineEx(); } });
$('#routineDialog').addEventListener('close', renderToday);

/* ---------------- 기록 ---------------- */
function renderLog() {
  renderExOptions();
  const byDate = {};
  S.sets.forEach((s) => (byDate[s.date] ||= []).push(s));
  const dates = Object.keys(byDate).sort().reverse();
  if (!dates.length) { $('#history').innerHTML = '<p class="empty">아직 기록이 없어요.<br>오늘 탭에서 첫 세트를 기록해보세요.</p>'; return; }
  $('#history').innerHTML = dates.map((date) => {
    const sets = byDate[date];
    const volume = sets.reduce((t, s) => t + s.w * s.r, 0);
    const exs = [...new Set(sets.map((s) => s.ex))];
    return `<div class="card day"><h3>${longDate(date)}<span>${sets.length}세트${volume ? ` · 볼륨 ${fmt(volume)}kg` : ''}</span></h3>
      ${exs.map((ex) => `<div class="hist-ex"><strong>${esc(ex)}</strong><div class="hist-sets">
        ${sets.filter((s) => s.ex === ex).map((s) => `<span class="set-tag">${s.w ? fmt(s.w) + 'kg × ' : ''}${s.r}회<button data-delset="${s.id}" aria-label="세트 삭제">✕</button></span>`).join('')}
      </div></div>`).join('')}</div>`;
  }).join('');
}
$('#history').addEventListener('click', (e) => {
  const b = e.target.closest('[data-delset]');
  if (!b || !confirm('이 세트를 삭제할까요?')) return;
  S.sets = S.sets.filter((s) => s.id !== b.dataset.delset);
  save(); renderLog();
});
function renderExOptions() {
  const names = [...new Set(S.sets.filter((s) => s.w > 0).map((s) => s.ex))];
  const sel = $('#exSelect');
  const prev = sel.value;
  sel.innerHTML = names.length ? names.map((n) => `<option>${esc(n)}</option>`).join('') : '<option>무게를 기록한 운동이 없어요</option>';
  sel.disabled = !names.length;
  if (names.includes(prev)) sel.value = prev;
  renderExChart();
}
function renderExChart() {
  const ex = $('#exSelect').value;
  const best = {};
  S.sets.filter((s) => s.ex === ex && s.w > 0).forEach((s) => { best[s.date] = Math.max(best[s.date] || 0, s.w); });
  const pts = Object.keys(best).sort().map((d) => ({ d, v: best[d] }));
  $('#exStats').innerHTML = pts.length
    ? stat('최고 기록', fmt(Math.max(...pts.map((p) => p.v))) + 'kg') + (pts.length > 1 ? stat('처음 대비', signed(pts[pts.length - 1].v - pts[0].v, 'kg')) : '') + stat('운동한 날', pts.length + '일')
    : '';
  lineChart($('#exChart'), pts, 'kg');
}
$('#exSelect').addEventListener('change', renderExChart);

/* ---------------- 타이머 ---------------- */
const RING = 2 * Math.PI * 88;
const ringFg = $('#ringFg');
ringFg.style.strokeDasharray = RING;
let T = { total: S.settings.rest, left: S.settings.rest, endAt: 0, running: false, tick: 0 };
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${pad(Math.max(0, sec) % 60)}`;

function drawTimer() {
  const sec = Math.ceil(T.left);
  $('#timerTime').textContent = fmtTime(sec);
  ringFg.style.strokeDashoffset = RING * (1 - Math.max(0, T.left) / T.total);
  $('#startPause').textContent = T.running ? '일시정지' : (T.left < T.total && T.left > 0 ? '계속' : '시작');
  $('#timerState').textContent = T.running ? '쉬는 중…' : (T.left <= 0 ? '다음 세트 시작!' : '휴식 준비');
  $('.timer-wrap').classList.toggle('finished', T.left <= 0);
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('on', +b.dataset.sec === T.total));
  updatePill();
}
function loop() {
  if (!T.running) return;
  T.left = (T.endAt - Date.now()) / 1000;
  if (T.left <= 0) { T.left = 0; T.running = false; finish(); }
  drawTimer();
  if (T.running) T.tick = setTimeout(loop, 250);
}
function startTimer(sec) {
  if (sec) { T.total = sec; T.left = sec; }
  if (T.left <= 0) T.left = T.total;
  T.endAt = Date.now() + T.left * 1000;
  T.running = true; clearTimeout(T.tick); unlockAudio(); loop();
}
function pauseTimer() { T.running = false; clearTimeout(T.tick); drawTimer(); }
function resetTimer() { pauseTimer(); T.left = T.total; drawTimer(); }

let audioCtx;
function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* 소리 미지원 */ }
}
function finish() {
  if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
  if (!audioCtx) return;
  [0, 0.35, 0.7].forEach((t) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    const at = audioCtx.currentTime + t;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.4, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    o.start(at); o.stop(at + 0.3);
  });
}
function updatePill() {
  const pill = $('#timerPill');
  const show = currentTab !== 'timer' && (T.running || (T.left <= 0 && T.endAt));
  pill.classList.toggle('hidden', !show);
  if (show) pill.textContent = T.running ? `⏱ 휴식 ${fmtTime(Math.ceil(T.left))}` : '⏱ 휴식 끝! 다음 세트';
}
$('#timerPill').addEventListener('click', () => go('timer'));
$('#startPause').addEventListener('click', () => (T.running ? pauseTimer() : startTimer()));
$('#resetTimer').addEventListener('click', () => { T.endAt = 0; resetTimer(); });
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sec]'); if (!b) return;
  const sec = +b.dataset.sec;
  S.settings.rest = sec; save();
  if (T.running) startTimer(sec); else { T.total = sec; T.left = sec; drawTimer(); }
});
function nudge(d) {
  if (T.running) { T.endAt += d * 1000; T.total = Math.max(5, T.total + d); loop(); }
  else { T.total = Math.max(5, T.total + d); T.left = Math.max(5, Math.min(T.total, T.left + d)); drawTimer(); }
}
$('#minus10').addEventListener('click', () => nudge(-10));
$('#plus10').addEventListener('click', () => nudge(10));
$('#autoRest').checked = S.settings.autoRest;
$('#autoRest').addEventListener('change', (e) => { S.settings.autoRest = e.target.checked; save(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && T.running) loop(); });

/* ---------------- 그래프 공통 ---------------- */
function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
function lineChart(el, points, unit) {
  if (points.length < 2) {
    el.innerHTML = `<p class="empty small">${points.length ? '기록이 하나 더 쌓이면 그래프가 그려져요.' : '아직 기록이 없어요.'}</p>`;
    return;
  }
  const W = Math.max(280, el.clientWidth || 320), H = 190;
  const m = { t: 34, r: 12, b: 24, l: 40 };
  const vals = points.map((p) => p.v);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const t0 = parseYmd(points[0].d).getTime(), t1 = parseYmd(points[points.length - 1].d).getTime();
  const x = (d) => m.l + ((parseYmd(d).getTime() - t0) / (t1 - t0 || 1)) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const xLabels = [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]]
    .filter((p, i, a) => a.findIndex((q) => q.d === p.d) === i);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const showDots = points.length <= 30;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="변화 그래프">
    <g class="grid">${ticks.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((t) => `<text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
      ${xLabels.map((p, i, a) => `<text x="${x(p.d)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${md(p.d)}</text>`).join('')}</g>
    <path class="series" d="${path}"/>
    ${showDots ? points.map((p) => `<circle class="dot" r="4" cx="${x(p.d)}" cy="${y(p.v)}"/>`).join('') : ''}
    <line class="cross hidden" y1="${m.t - 6}" y2="${H - m.b}"/>
    <circle class="hot hidden" r="5"/>
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>
  </svg><div class="tip hidden"></div>
  <details><summary>표로 보기</summary><table>${points.slice().reverse().map((p) => `<tr><td>${longDate(p.d)}</td><td>${fmt(p.v)} ${unit}</td></tr>`).join('')}</table></details>`;

  const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
  const cross = svg.querySelector('.cross'), hot = svg.querySelector('.hot');
  const show = (evt) => {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    let best = points[0];
    points.forEach((p) => { if (Math.abs(x(p.d) - px) < Math.abs(x(best.d) - px)) best = p; });
    const bx = x(best.d), by = y(best.v);
    cross.setAttribute('x1', bx); cross.setAttribute('x2', bx);
    hot.setAttribute('cx', bx); hot.setAttribute('cy', by);
    [cross, hot, tip].forEach((n) => n.classList.remove('hidden'));
    tip.innerHTML = `<b>${fmt(best.v)}${unit}</b> · ${md(best.d)}`;
    const left = (bx / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 50), r.width - 50)}px`;
  };
  const hide = () => [cross, hot, tip].forEach((n) => n.classList.add('hidden'));
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}
function stat(label, value) { return `<div class="stat"><b>${value}</b><span>${label}</span></div>`; }
const signed = (n, unit) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}${unit}`;
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (currentTab === 'log') renderExChart(); if (currentTab === 'body') renderBodyChart(); }, 150);
});

/* ---------------- 인바디 ---------------- */
const METRICS = [
  { k: 'weight', label: '체중', unit: 'kg' },
  { k: 'smm', label: '골격근량', unit: 'kg', up: true },
  { k: 'fatPct', label: '체지방률', unit: '%' },
  { k: 'fatKg', label: '체지방량', unit: 'kg' },
];
let metric = 'weight';
const inbodySorted = () => S.inbody.slice().sort((a, b) => a.date.localeCompare(b.date));
const latestInbody = () => { const l = inbodySorted(); return l[l.length - 1]; };

function bmiOf(w) { const h = num(S.profile.height); return h && w ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null; }
function bmiLabel(b) { return b < 18.5 ? '저체중' : b < 23 ? '정상' : b < 25 ? '과체중' : '비만'; }
function fatLabel(p) {
  const [lo, hi] = S.profile.sex === 'f' ? [18, 28] : [10, 20];
  return p < lo ? '표준 이하' : p <= hi ? '표준' : '표준 이상';
}

function renderBody() {
  const list = inbodySorted();
  const last = list[list.length - 1], prev = list[list.length - 2];
  if (!last) {
    $('#inbodyLatest').innerHTML = '<div class="card empty">아직 인바디 기록이 없어요.<br>결과지를 받으면 위 버튼으로 숫자만 옮겨 적어보세요.</div>';
  } else {
    const tile = (label, v, unit, key, note) => {
      if (v == null || v === '') return '';
      const d = prev && prev[key] != null && key ? v - prev[key] : null;
      return `<div class="tile"><span>${label}</span><b>${fmt(v)}<small>${unit}</small></b>
        ${d != null && d !== 0 ? `<em>${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</em>` : ''}${note ? `<i>${note}</i>` : ''}</div>`;
    };
    const bmi = bmiOf(last.weight);
    $('#inbodyLatest').innerHTML = `<div class="card">
      <div class="row between"><h2>최근 결과</h2><span class="muted small">${longDate(last.date)}${prev ? ` · 지난번 ${md(prev.date)} 대비` : ''}</span></div>
      <div class="tiles">
        ${tile('체중', last.weight, 'kg', 'weight')}
        ${tile('골격근량', last.smm, 'kg', 'smm')}
        ${tile('체지방률', last.fatPct, '%', 'fatPct', last.fatPct != null ? fatLabel(last.fatPct) : '')}
        ${tile('체지방량', last.fatKg, 'kg', 'fatKg')}
        ${bmi ? tile('BMI', bmi, '', '', bmiLabel(bmi)) : ''}
        ${tile('내장지방', last.visceral, '레벨', 'visceral', last.visceral != null ? (last.visceral < 10 ? '표준' : '높음') : '')}
        ${tile('기초대사량', last.bmr, 'kcal', 'bmr')}
      </div>
      ${!bmi ? '<p class="muted small">식단 탭에 키를 적으면 BMI도 계산해 드려요.</p>' : ''}
      ${last.memo ? `<p class="muted small">메모: ${esc(last.memo)}</p>` : ''}
    </div>`;
  }
  $('#metricChips').innerHTML = METRICS.map((m) => `<button type="button" data-metric="${m.k}" class="${m.k === metric ? 'on' : ''}">${m.label}</button>`).join('');
  renderBodyChart();
  $('#inbodyList').innerHTML = list.length ? `<div class="card"><h2>전체 기록</h2>${list.slice().reverse().map((r) => `
    <div class="ib-row"><div><strong>${longDate(r.date)}</strong><br><span class="muted small">
      체중 ${fmt(r.weight)}kg${r.smm != null ? ` · 골격근 ${fmt(r.smm)}kg` : ''}${r.fatPct != null ? ` · 체지방 ${fmt(r.fatPct)}%` : ''}</span></div>
      <button class="icon-del" data-delib="${r.id}" aria-label="삭제">✕</button></div>`).join('')}</div>` : '';
}
function renderBodyChart() {
  const m = METRICS.find((x) => x.k === metric);
  const pts = inbodySorted().filter((r) => r[metric] != null).map((r) => ({ d: r.date, v: r[metric] }));
  $('#bodyStats').innerHTML = pts.length > 1 ? stat('처음 대비', signed(pts[pts.length - 1].v - pts[0].v, m.unit)) + stat('측정 횟수', pts.length + '회') : '';
  lineChart($('#bodyChart'), pts, m.unit);
}
$('#metricChips').addEventListener('click', (e) => { const b = e.target.closest('[data-metric]'); if (b) { metric = b.dataset.metric; renderBody(); } });
$('#inbodyList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-delib]');
  if (!b || !confirm('이 인바디 기록을 삭제할까요?')) return;
  S.inbody = S.inbody.filter((r) => r.id !== b.dataset.delib);
  save(); renderBody();
});
$('#addInbody').addEventListener('click', () => {
  $('#inbodyForm').reset();
  $('#ibDate').value = ymd();
  const last = latestInbody();
  if (last) $('#ibWeight').placeholder = `지난번 ${fmt(last.weight)}`;
  $('#inbodyDialog').showModal();
});
$('#inbodyDialog').addEventListener('close', () => {
  if ($('#inbodyDialog').returnValue !== 'ok') return;
  const weight = num($('#ibWeight').value);
  if (!weight) return;
  const fatPct = num($('#ibFatPct').value);
  let fatKg = num($('#ibFatKg').value);
  if (fatKg == null && fatPct != null) fatKg = Math.round(weight * fatPct) / 100;
  const rec = { id: uid(), date: $('#ibDate').value || ymd(), weight, smm: num($('#ibSmm').value), fatPct, fatKg,
    visceral: num($('#ibVisceral').value), bmr: num($('#ibBmr').value), memo: $('#ibMemo').value.trim() };
  Object.keys(rec).forEach((k) => rec[k] == null && delete rec[k]);
  S.inbody = S.inbody.filter((r) => r.date !== rec.date).concat(rec);
  // 식단 계산에도 최신 값 반영
  const last = latestInbody();
  S.profile.weight = String(last.weight);
  if (last.fatPct != null) S.profile.fat = String(last.fatPct);
  save(); renderBody();
});

$('#inbodyGuide').innerHTML = `
  <dl class="glossary">
    <dt>골격근량</dt><dd>팔·다리·몸통을 움직이는 근육의 무게예요. 운동을 꾸준히 하면 늘어나는 숫자라, 체중보다 이게 늘었는지 보는 게 더 중요해요.</dd>
    <dt>체지방량 · 체지방률</dt><dd>몸에 있는 지방의 무게(kg)와 체중 중 지방의 비율(%)이에요. 표준 범위는 대략 <b>남성 10~20%, 여성 18~28%</b>예요.</dd>
    <dt>BMI</dt><dd>체중(kg) ÷ 키(m)². 국내 기준 <b>18.5~22.9 정상, 23~24.9 과체중, 25 이상 비만</b>. 근육이 많으면 높게 나올 수 있어서 체지방률과 같이 봐야 해요.</dd>
    <dt>내장지방 레벨</dt><dd>배 속 장기 주변 지방의 정도예요. <b>10 미만</b>이 권장돼요. 유산소·식단 관리에 비교적 빨리 반응해요.</dd>
    <dt>기초대사량</dt><dd>가만히 누워 있어도 쓰는 하루 에너지예요. 근육이 늘면 조금씩 올라가요. 식단 칼로리를 이보다 크게 낮추지 않는 게 좋아요.</dd>
  </dl>
  <h3>체형 모양 (C·I·D형)</h3>
  <p>결과지 “골격근·지방 분석”의 막대 3개(체중·골격근량·체지방량) 끝을 이어 보세요.</p>
  <ul class="plain">
    <li><b>C형</b> — 체지방 막대가 가장 길고 골격근이 짧음. 근력운동 + 체지방 감량이 우선.</li>
    <li><b>I형</b> — 세 막대가 거의 일직선. 균형형. 지금 습관을 유지하며 근육을 조금씩.</li>
    <li><b>D형</b> — 골격근 막대가 가장 길게 튀어나옴. 근육형. 운동하는 사람의 목표 모양.</li>
  </ul>
  <h3>정확하게 재는 법</h3>
  <ul class="plain">
    <li>항상 <b>같은 시간</b>(아침 공복, 화장실 다녀온 뒤)에 재요.</li>
    <li>운동·샤워·사우나 직후, 과음 다음 날은 피해요. 수분 때문에 숫자가 흔들려요.</li>
    <li>하루 숫자보다 <b>2~4주 간격의 흐름</b>을 보세요.</li>
  </ul>`;

/* ---------------- 식단 ---------------- */
const GOALS = {
  cut: { label: '다이어트', sub: '체지방 감량', factor: 0.8, protein: 2.0, desc: '유지 칼로리보다 약 20% 적게 먹어요. 일주일에 체중의 0.5~1%씩 빠지는 속도가 근손실이 적어요. 단백질을 넉넉히(체중×2g) 먹는 게 핵심!' },
  keep: { label: '유지', sub: '지금 체형 유지', factor: 1.0, protein: 1.6, desc: '먹는 만큼 쓰는 칼로리예요. 체중이 2주 넘게 한 방향으로 움직이면 100~200kcal씩 조절하세요.' },
  lean: { label: '린매스업', sub: '군살 없이 근육', factor: 1.08, protein: 1.8, desc: '유지 칼로리보다 5~10% 더 먹어서 지방은 최소로, 근육은 천천히 늘려요. 한 달에 0.5~1kg 증가가 적당해요.' },
  bulk: { label: '벌크업', sub: '확실한 증량', factor: 1.15, protein: 1.8, desc: '유지 칼로리보다 약 15% 더 먹어요. 한 달에 1~2kg 증가가 목표. 너무 빨리 늘면 대부분 지방이에요.' },
};
function calcDiet() {
  const p = S.profile;
  const w = num(p.weight), h = num(p.height), a = num(p.age), fat = num(p.fat), act = num(p.activity) || 1.55;
  if (!w || !h || !a) return null;
  const mifflin = 10 * w + 6.25 * h - 5 * a + (p.sex === 'f' ? -161 : 5);
  const lbm = fat != null ? w * (1 - fat / 100) : null;
  const bmr = lbm ? 370 + 21.6 * lbm : mifflin;
  const tdee = bmr * act;
  const g = GOALS[p.goal] || GOALS.cut;
  const kcal = Math.round(tdee * g.factor / 10) * 10;
  const protein = Math.round(w * g.protein);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carb = Math.max(0, Math.round((kcal - protein * 4 - fatG * 9) / 4));
  return { bmr, tdee, kcal, protein, fatG, carb, g, w, act, lbm, method: lbm ? 'katch' : 'mifflin', mifflin, a, h, sex: p.sex, fat };
}
function renderDiet() {
  const last = latestInbody();
  const p = S.profile;
  if (!p.weight && last) p.weight = String(last.weight);
  if (!p.fat && last?.fatPct != null) p.fat = String(last.fatPct);
  $('#pSex').value = p.sex; $('#pAge').value = p.age; $('#pHeight').value = p.height;
  $('#pWeight').value = p.weight; $('#pFat').value = p.fat; $('#pActivity').value = p.activity;
  $('#goalChips').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button type="button" data-goal="${k}" class="${k === p.goal ? 'on' : ''}"><b>${g.label}</b><span>${g.sub}</span></button>`).join('');
  $('#goalDesc').textContent = (GOALS[p.goal] || GOALS.cut).desc;
  renderDietResult();
}
function renderDietResult() {
  const r = calcDiet();
  if (!r) {
    $('#dietResult').innerHTML = '<p class="empty">아래 <b>내 정보</b>에 나이·키·체중을 적으면<br>하루 목표 칼로리를 계산해 드려요.</p>';
    $('#dietHow').innerHTML = '<p class="muted">정보를 입력하면 내 숫자로 계산 과정을 보여드려요.</p>';
    return;
  }
  const total = r.protein * 4 + r.fatG * 9 + r.carb * 4;
  const pct = (k) => Math.round((k / total) * 100);
  const floor = r.sex === 'f' ? 1200 : 1500;
  const warn = r.kcal < r.bmr ? '목표가 기초대사량보다 낮아요. 오래 유지하기 어렵고 근손실 위험이 커요. 활동량을 늘리는 쪽을 먼저 고려하세요.'
    : r.kcal < floor ? `하루 ${floor}kcal 아래로는 영양이 부족해지기 쉬워요.` : '';
  $('#dietResult').innerHTML = `
    <div class="kcal"><span>${r.g.label} 목표</span><b>${r.kcal.toLocaleString('ko-KR')}</b><small>kcal / 하루</small></div>
    <div class="macro-bar" aria-hidden="true">
      <i class="p" style="width:${pct(r.protein * 4)}%"></i><i class="c" style="width:${pct(r.carb * 4)}%"></i><i class="f" style="width:${pct(r.fatG * 9)}%"></i>
    </div>
    <div class="macros">
      <div><i class="dot-p"></i><span>단백질</span><b>${r.protein}g</b><small>${pct(r.protein * 4)}%</small></div>
      <div><i class="dot-c"></i><span>탄수화물</span><b>${r.carb}g</b><small>${pct(r.carb * 4)}%</small></div>
      <div><i class="dot-f"></i><span>지방</span><b>${r.fatG}g</b><small>${pct(r.fatG * 9)}%</small></div>
    </div>
    <p class="per-meal">한 끼(하루 3끼)당 약 <b>${Math.round(r.kcal / 3)}kcal</b> · 단백질 <b>${Math.round(r.protein / 3)}g</b></p>
    <div class="row between muted small"><span>기초대사량 ${Math.round(r.bmr).toLocaleString('ko-KR')}kcal</span><span>유지 칼로리 ${Math.round(r.tdee).toLocaleString('ko-KR')}kcal</span></div>
    ${warn ? `<p class="warn">⚠ ${warn}</p>` : ''}`;

  const bmrLine = r.method === 'katch'
    ? `체지방률을 알아서 <b>Katch-McArdle 공식</b>을 썼어요.<br>제지방량 = ${fmt(r.w)} × (1 − ${fmt(r.fat)}%) = ${fmt(r.lbm)}kg<br>기초대사량 = 370 + 21.6 × ${fmt(r.lbm)} = <b>${Math.round(r.bmr)}kcal</b>`
    : `<b>Mifflin-St Jeor 공식</b>(가장 많이 쓰는 공식)을 썼어요.<br>10 × ${fmt(r.w)} + 6.25 × ${fmt(r.h)} − 5 × ${r.a} ${r.sex === 'f' ? '− 161' : '+ 5'} = <b>${Math.round(r.bmr)}kcal</b>`;
  $('#dietHow').innerHTML = `
    <ol class="how-steps">
      <li><b>기초대사량</b> — ${bmrLine}</li>
      <li><b>유지 칼로리</b> = 기초대사량 × 활동량 ${r.act} = <b>${Math.round(r.tdee)}kcal</b></li>
      <li><b>목표 칼로리</b> = 유지 칼로리 × ${r.g.factor} (${r.g.label}) = <b>${r.kcal}kcal</b></li>
      <li><b>단백질</b> = 체중 × ${r.g.protein}g = ${r.protein}g (1g = 4kcal)</li>
      <li><b>지방</b> = 목표 칼로리의 25% ÷ 9 = ${r.fatG}g (1g = 9kcal)</li>
      <li><b>탄수화물</b> = 남은 칼로리 ÷ 4 = ${r.carb}g (1g = 4kcal)</li>
    </ol>
    <h3>단백질 감 잡기</h3>
    <ul class="plain">
      <li>닭가슴살 100g ≈ 단백질 23g</li><li>계란 1개 ≈ 6g</li><li>그릭요거트 100g ≈ 9~10g</li>
      <li>소고기(우둔) 100g ≈ 21g</li><li>두부 반 모(150g) ≈ 13g</li><li>프로틴 1스쿱 ≈ 20~25g</li>
    </ul>
    <p class="muted small">공식은 평균값이에요. 2~3주 먹어보고 체중 변화를 보며 100~200kcal씩 조절하는 게 가장 정확해요. 질환이 있거나 임신 중이라면 전문가와 상담하세요.</p>`;
}
$('#goalChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goal]'); if (!b) return;
  S.profile.goal = b.dataset.goal; save(); renderDiet();
});
$('#profileForm').addEventListener('input', () => {
  Object.assign(S.profile, { sex: $('#pSex').value, age: $('#pAge').value, height: $('#pHeight').value,
    weight: $('#pWeight').value, fat: $('#pFat').value, activity: $('#pActivity').value });
  save(); renderDietResult();
});
$('#profileForm').addEventListener('submit', (e) => e.preventDefault());

/* ---------------- 운동법 ---------------- */
let guidePart = '전체';
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
function exCard(e, open = false) {
  return `<details class="ex-card" ${open ? 'open' : ''}>
    <summary>
      <div><strong>${esc(e.name)}</strong>${e.trend ? '<span class="badge">트렌드</span>' : ''}<br><span class="muted small">${esc(e.en)}</span></div>
      <div class="tags">${e.muscles.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
    </summary>
    <ol class="how-steps">${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="tipline">💡 ${esc(e.tip)}</p>
    ${e.trend ? `<p class="tipline trend">🔥 요즘 포인트: ${esc(e.trend)}</p>` : ''}
    <button type="button" class="btn ghost small-btn" data-toroutine="${esc(e.name)}">+ 내 루틴에 추가</button>
  </details>`;
}
function renderGuide() {
  $('#partChips').innerHTML = ['전체', ...PARTS].map((p) => `<button type="button" data-part="${p}" class="${p === guidePart ? 'on' : ''}">${p}</button>`).join('');
  const q = norm($('#guideSearch').value);
  let html = '';
  if (q) {
    const exs = EXERCISES.filter((e) => norm(e.name + e.en + e.part + e.muscles.join('')).includes(q));
    const mus = Object.entries(MUSCLES).flatMap(([part, list]) => list.map((m) => ({ ...m, part }))).filter((m) => norm(m.n + m.en).includes(q));
    if (mus.length) html += `<div class="card"><h2>근육</h2>${mus.map(muscleItem).join('')}</div>`;
    html += exs.length ? `<h2 class="sec">운동 ${exs.length}개</h2>${exs.map((e) => exCard(e, exs.length === 1)).join('')}` : '';
    if (!html) html = '<p class="empty">찾는 운동이 없어요. 다른 이름으로 검색해 보세요.</p>';
  } else if (guidePart === '전체') {
    html = `<div class="card trends"><h2>🔥 요즘 운동 트렌드</h2>${TRENDS.map((t, i) => `<div class="trend-item"><b>${i + 1}. ${t.t}</b><p>${t.d}</p></div>`).join('')}</div>
      ${PARTS.map((p) => `<h2 class="sec">${p}</h2>${EXERCISES.filter((e) => e.part === p).map((e) => exCard(e)).join('')}`).join('')}`;
  } else {
    html = `<details class="card guide" open><summary><h2>${guidePart} 근육 알아보기</h2></summary>${MUSCLES[guidePart].map(muscleItem).join('')}</details>
      <h2 class="sec">${guidePart} 운동</h2>${EXERCISES.filter((e) => e.part === guidePart).map((e) => exCard(e)).join('')}`;
  }
  $('#guideBody').innerHTML = html;
}
function muscleItem(m) {
  return `<div class="muscle"><b>${esc(m.n)}</b><span class="muted small">${esc(m.en)}${m.part ? ` · ${m.part}` : ''}</span><p>${esc(m.d)}</p></div>`;
}
function openGuideFor(name) {
  $('#guideSearch').value = name; guidePart = '전체'; go('guide');
}
$('#partChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-part]'); if (!b) return;
  guidePart = b.dataset.part; $('#guideSearch').value = ''; renderGuide(); window.scrollTo(0, 0);
});
$('#guideSearch').addEventListener('input', renderGuide);

let toRoutineEx = '', toRoutineDay = new Date().getDay();
$('#guideBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-toroutine]'); if (!b) return;
  toRoutineEx = b.dataset.toroutine; toRoutineDay = new Date().getDay();
  $('#toRoutineTitle').textContent = `“${toRoutineEx}” 루틴에 추가`;
  drawToRoutineDays();
  $('#toRoutineDialog').showModal();
});
function drawToRoutineDays() {
  $('#toRoutineDays').innerHTML = DAYS.map((d, i) => `<button type="button" data-tday="${i}" class="${i === toRoutineDay ? 'on' : ''}">${d}</button>`).join('');
}
$('#toRoutineDays').addEventListener('click', (e) => { const b = e.target.closest('[data-tday]'); if (b) { toRoutineDay = +b.dataset.tday; drawToRoutineDays(); } });
$('#toRoutineDialog').addEventListener('close', () => {
  if ($('#toRoutineDialog').returnValue !== 'ok') return;
  const list = S.routines[toRoutineDay];
  if (!list.includes(toRoutineEx)) list.push(toRoutineEx);
  save(); toast(`${DAYS[toRoutineDay]}요일 루틴에 추가했어요`);
});

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

/* ---------------- 설정 / 백업 ---------------- */
$('#openSettings').addEventListener('click', () => $('#settingsDialog').showModal());
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `오운완-백업-${ymd()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.routines || !Array.isArray(data.sets)) throw new Error('형식 오류');
    if (!confirm('지금 기록을 백업 파일 내용으로 바꿀까요?')) return;
    S = normalize(data);
    save(); $('#settingsDialog').close(); go(currentTab);
  } catch (err) { alert('백업 파일을 읽지 못했어요.'); }
  e.target.value = '';
});
$('#resetAll').addEventListener('click', () => {
  if (!confirm('모든 기록과 루틴을 지울까요? 되돌릴 수 없어요.')) return;
  S = structuredClone(DEFAULT); save(); $('#settingsDialog').close(); go('today');
});

/* ---------------- 시작 ---------------- */
let lastDay = ymd();
document.addEventListener('visibilitychange', () => { if (!document.hidden && ymd() !== lastDay) { lastDay = ymd(); go(currentTab); } });

save();
drawTimer();
go('today');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
