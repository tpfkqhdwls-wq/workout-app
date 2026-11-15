// 오운완 노트 — 기록은 이 기기의 localStorage에만 저장됩니다.
const KEY = 'ounwan.v1';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const $ = (s) => document.querySelector(s);

const DEFAULT = {
  routines: {
    0: [],
    1: ['벤치프레스', '인클라인 덤벨프레스', '케이블 플라이'],
    2: ['랫풀다운', '바벨로우', '시티드 로우'],
    3: ['스쿼트', '레그프레스', '루마니안 데드리프트'],
    4: ['오버헤드프레스', '사이드 레터럴 레이즈', '페이스풀'],
    5: ['바벨컬', '케이블 푸시다운', '플랭크'],
    6: [],
  },
  sets: [],      // {id, date, ex, w, r}
  checks: {},    // {date: [ex, ...]}
  body: [],      // {date, kg}
  settings: { autoRest: true, rest: 90 },
};

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
  } catch (e) { /* 저장소 사용 불가 시 기본값 */ }
  return structuredClone(DEFAULT);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const md = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const longDate = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`; };
const fmtKg = (n) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------------- 탭 ---------------- */
const TITLES = { today: '오늘', log: '기록', timer: '휴식 타이머', graph: '그래프' };
let currentTab = 'today';
function go(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.go === tab));
  $('#title').textContent = TITLES[tab];
  $('#subtitle').textContent = tab === 'today' ? longDate(ymd()) : '';
  if (tab === 'today') renderToday();
  if (tab === 'log') renderHistory();
  if (tab === 'graph') renderGraphs();
  updatePill();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------------- 오늘 ---------------- */
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
    return `<li class="ex ${isDone ? 'done' : ''}">
      <button class="check" data-check="${esc(ex)}" aria-label="${esc(ex)} 완료 표시" aria-pressed="${isDone}">✓</button>
      <span class="ex-name">${esc(ex)}</span>
      <button class="add-set" data-add="${esc(ex)}">+ 세트</button>
      <div class="sets">${sets.map((s, i) => `<span class="set-tag">${i + 1}세트 ${s.w ? fmtKg(s.w) + 'kg × ' : ''}${s.r}회</span>`).join('')}</div>
    </li>`;
  }).join('');
}
$('#todayList').addEventListener('click', (e) => {
  const c = e.target.closest('[data-check]');
  const a = e.target.closest('[data-add]');
  if (c) {
    const today = ymd(), ex = c.dataset.check;
    const arr = S.checks[today] || (S.checks[today] = []);
    const i = arr.indexOf(ex);
    i >= 0 ? arr.splice(i, 1) : arr.push(ex);
    save(); renderToday();
    if (navigator.vibrate && i < 0) navigator.vibrate(20);
  }
  if (a) openSetDialog(a.dataset.add);
});
$('#addOther').addEventListener('click', () => openSetDialog(''));

/* 세트 기록 */
function allExerciseNames() {
  const names = new Set();
  Object.values(S.routines).flat().forEach((n) => names.add(n));
  S.sets.forEach((s) => names.add(s.ex));
  return [...names];
}
function lastSetOf(ex) {
  for (let i = S.sets.length - 1; i >= 0; i--) if (S.sets[i].ex === ex) return S.sets[i];
  return null;
}
function fillFromLast() {
  const last = lastSetOf($('#setEx').value.trim());
  if (last) {
    $('#setW').value = last.w || '';
    $('#setR').value = last.r;
    $('#setHint').textContent = `지난 기록: ${last.w ? fmtKg(last.w) + 'kg × ' : ''}${last.r}회 (${md(last.date)})`;
  } else {
    $('#setHint').textContent = '';
  }
}
function openSetDialog(ex) {
  $('#exNames').innerHTML = allExerciseNames().map((n) => `<option value="${esc(n)}">`).join('');
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
$('#editRoutine').addEventListener('click', () => { editDay = new Date().getDay(); renderRoutineEditor(); $('#routineDialog').showModal(); });
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
function renderHistory() {
  const byDate = {};
  S.sets.forEach((s) => (byDate[s.date] ||= []).push(s));
  const dates = Object.keys(byDate).sort().reverse();
  if (!dates.length) { $('#history').innerHTML = '<p class="empty">아직 기록이 없어요.<br>오늘 탭에서 첫 세트를 기록해보세요.</p>'; return; }
  $('#history').innerHTML = dates.map((date) => {
    const sets = byDate[date];
    const volume = sets.reduce((t, s) => t + s.w * s.r, 0);
    const exs = [...new Set(sets.map((s) => s.ex))];
    return `<div class="card day"><h3>${longDate(date)}<span>${sets.length}세트${volume ? ` · 볼륨 ${fmtKg(volume)}kg` : ''}</span></h3>
      ${exs.map((ex) => `<div class="hist-ex"><strong>${esc(ex)}</strong><div class="hist-sets">
        ${sets.filter((s) => s.ex === ex).map((s) => `<span class="set-tag">${s.w ? fmtKg(s.w) + 'kg × ' : ''}${s.r}회<button data-delset="${s.id}" aria-label="세트 삭제">✕</button></span>`).join('')}
      </div></div>`).join('')}</div>`;
  }).join('');
}
$('#history').addEventListener('click', (e) => {
  const b = e.target.closest('[data-delset]');
  if (!b || !confirm('이 세트를 삭제할까요?')) return;
  S.sets = S.sets.filter((s) => s.id !== b.dataset.delset);
  save(); renderHistory();
});

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
  const show = currentTab !== 'timer' && (T.running || T.left <= 0 && T.endAt);
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
  T.running ? startTimer(sec) : (T.total = sec, T.left = sec, drawTimer());
});
function nudge(d) {
  if (T.running) { T.endAt += d * 1000; T.total = Math.max(5, T.total + d); loop(); }
  else { T.total = Math.max(5, T.total + d); T.left = Math.max(5, Math.min(T.total, T.left + d)); if (T.left <= 0) T.left = T.total; drawTimer(); }
}
$('#minus10').addEventListener('click', () => nudge(-10));
$('#plus10').addEventListener('click', () => nudge(10));
$('#autoRest').checked = S.settings.autoRest;
$('#autoRest').addEventListener('change', (e) => { S.settings.autoRest = e.target.checked; save(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && T.running) loop(); });

/* ---------------- 그래프 ---------------- */
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

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} 추이 그래프">
    <g class="grid">${ticks.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((t) => `<text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmtKg(t)}</text>`).join('')}
      ${xLabels.map((p, i, a) => `<text x="${x(p.d)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${md(p.d)}</text>`).join('')}</g>
    <path class="series" d="${path}"/>
    ${showDots ? points.map((p) => `<circle class="dot" r="4" cx="${x(p.d)}" cy="${y(p.v)}"/>`).join('') : ''}
    <line class="cross hidden" y1="${m.t - 6}" y2="${H - m.b}"/>
    <circle class="hot hidden" r="5"/>
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" class="hit"/>
  </svg><div class="tip hidden"></div>
  <details><summary>표로 보기</summary><table>${points.slice().reverse().map((p) => `<tr><td>${longDate(p.d)}</td><td>${fmtKg(p.v)} ${unit}</td></tr>`).join('')}</table></details>`;

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
    tip.innerHTML = `<b>${fmtKg(best.v)}${unit}</b> · ${md(best.d)}`;
    const left = (bx / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 50), r.width - 50)}px`;
  };
  const hide = () => [cross, hot, tip].forEach((n) => n.classList.add('hidden'));
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}
function stat(label, value) { return `<div class="stat"><b>${value}</b><span>${label}</span></div>`; }
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtKg(Math.abs(n))}kg`;

function renderGraphs() {
  // 체중
  const body = S.body.slice().sort((a, b) => a.date.localeCompare(b.date));
  $('#bodyStats').innerHTML = body.length
    ? stat('현재', fmtKg(body[body.length - 1].kg) + 'kg') + (body.length > 1 ? stat('처음 대비', signed(body[body.length - 1].kg - body[0].kg)) : '')
    : '';
  lineChart($('#bodyChart'), body.map((b) => ({ d: b.date, v: b.kg })), 'kg');

  // 운동별
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
    ? stat('최고 기록', fmtKg(Math.max(...pts.map((p) => p.v))) + 'kg') + (pts.length > 1 ? stat('처음 대비', signed(pts[pts.length - 1].v - pts[0].v)) : '') + stat('운동한 날', pts.length + '일')
    : '';
  lineChart($('#exChart'), pts, 'kg');
}
$('#exSelect').addEventListener('change', renderExChart);
$('#bodyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const kg = parseFloat($('#bodyKg').value);
  if (!kg) return;
  const today = ymd();
  S.body = S.body.filter((b) => b.date !== today).concat({ date: today, kg });
  $('#bodyKg').value = '';
  save(); renderGraphs();
});
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => currentTab === 'graph' && renderGraphs(), 150); });

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
    S = { ...structuredClone(DEFAULT), ...data };
    save(); $('#settingsDialog').close(); go(currentTab);
  } catch (err) { alert('백업 파일을 읽지 못했어요.'); }
  e.target.value = '';
});
$('#resetAll').addEventListener('click', () => {
  if (!confirm('모든 기록과 루틴을 지울까요? 되돌릴 수 없어요.')) return;
  S = structuredClone(DEFAULT); save(); $('#settingsDialog').close(); go('today');
});

/* ---------------- 시작 ---------------- */
// 자정이 지나 앱을 다시 열면 오늘 화면을 새로 그림
let lastDay = ymd();
document.addEventListener('visibilitychange', () => { if (!document.hidden && ymd() !== lastDay) { lastDay = ymd(); go(currentTab); } });

drawTimer();
go('today');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
