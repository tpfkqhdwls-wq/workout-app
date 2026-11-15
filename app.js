// 오운완 노트 — 기록은 이 기기의 localStorage에만 저장됩니다.
const KEY = 'ounwan.v1';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const DEFAULT_ROUTINES = [
  { name: '초보 전신 루틴', ex: ['레그프레스', '머신 체스트프레스', '랫풀다운', '덤벨 숄더프레스', '플랭크'] },
  { name: '상체 A · 가슴/어깨/삼두', ex: ['벤치프레스', '인클라인 덤벨프레스', '사이드 레터럴 레이즈', '케이블 푸시다운'] },
  { name: '상체 B · 등/이두', ex: ['랫풀다운', '체스트 서포티드 로우', '시티드 케이블 로우', '바벨컬'] },
  { name: '하체 · 엉덩이', ex: ['바벨 스쿼트', '루마니안 데드리프트', '힙 쓰러스트', '시티드 레그컬'] },
];
const freshState = () => ({
  ver: 3,
  dday: null,          // {title, date, start, goalWeight}
  routines: DEFAULT_ROUTINES.map((r) => ({ id: uid(), ...structuredClone(r) })),
  workouts: {},        // {date: {items: [{ex, sets: [{w,r,s,m,km,done}]}], memo}}
  custom: [],          // 직접 만든 운동
  inbody: [],
  profile: { sex: 'm', age: '', height: '', weight: '', fat: '', activity: '1.55', goal: 'cut' },
  settings: { autoRest: true, rest: 90 },
});

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const md = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const longDate = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`; };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 저장 / 예전 버전 변환 ---------------- */
function migrate(data) {
  const s = { ...freshState(), ...data };
  s.profile = { ...freshState().profile, ...(data.profile || {}) };
  s.settings = { ...freshState().settings, ...(data.settings || {}) };
  if (!data.ver || data.ver < 3) {
    // v1: 요일 루틴 + 세트 목록
    s.workouts = {};
    (data.sets || []).forEach((x) => {
      const day = (s.workouts[x.date] ||= { items: [], memo: '' });
      let it = day.items.find((i) => i.ex === x.ex);
      if (!it) day.items.push(it = { ex: x.ex, sets: [] });
      it.sets.push({ w: x.w || null, r: x.r, done: true });
    });
    if (data.routines && !Array.isArray(data.routines)) {
      const mine = Object.entries(data.routines).filter(([, l]) => l.length).map(([d, l]) => ({ id: uid(), name: `${DAYS[d]}요일 루틴`, ex: l }));
      s.routines = [...mine, ...freshState().routines];
    }
    if (Array.isArray(data.body) && data.body.length && !(data.inbody || []).length) {
      s.inbody = data.body.map((b) => ({ id: uid(), date: b.date, weight: b.kg }));
    }
    ['sets', 'checks', 'body'].forEach((k) => delete s[k]);
    s.ver = 3;
  }
  return s;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* 기본값 */ }
  return freshState();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

/* ---------------- 운동 사전 ---------------- */
const FIELDS = {
  weight: [['w', 'kg', 'decimal'], ['r', '회', 'numeric']],
  body: [['r', '회', 'numeric']],
  time: [['s', '초', 'numeric']],
  cardio: [['m', '분', 'numeric'], ['km', 'km', 'decimal']],
};
const allEx = () => EXERCISES.concat(S.custom);
const exMap = () => new Map(allEx().map((e) => [e.name, e]));
function getEx(name) { return exMap().get(name) || { name, part: '기타', type: 'weight', muscles: [], custom: true }; }
const typeOf = (name) => (FIELDS[getEx(name).type] ? getEx(name).type : 'weight');
const norm = (s) => String(s).toLowerCase().replace(/[\s·\-()]/g, '');
function exMatches(e, q) {
  return norm([e.name, e.en, e.part, e.eq, ...(e.aliases || []), ...(e.muscles || [])].join(' ')).includes(q);
}
function setText(type, st) {
  const v = (k) => st[k] != null && st[k] !== '' ? fmt(st[k]) : null;
  if (type === 'weight') return v('w') ? `${v('w')}kg×${v('r') ?? '-'}` : `${v('r') ?? '-'}회`;
  if (type === 'body') return `${v('r') ?? '-'}회`;
  if (type === 'time') return `${v('s') ?? '-'}초`;
  return `${v('m') ?? '-'}분${v('km') ? ` ${v('km')}km` : ''}`;
}

/* ---------------- 탭 ---------------- */
const TITLES = { home: '디데이', log: '운동 기록', guide: '운동법', body: '인바디', diet: '식단 칼로리', timer: '휴식 타이머' };
let currentTab = 'home';
function go(tab) {
  currentTab = tab;
  $$('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.go === tab));
  $('#openTimer').classList.toggle('on', tab === 'timer');
  $('#title').textContent = TITLES[tab];
  $('#subtitle').textContent = tab === 'home' ? longDate(ymd()) : '';
  ({ home: renderHome, log: renderLog, guide: renderGuide, body: renderBody, diet: renderDiet })[tab]?.();
  updatePill();
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
$('#openTimer').addEventListener('click', () => go(currentTab === 'timer' ? 'log' : 'timer'));
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]');
  if (c) document.getElementById(c.dataset.close).close();
});

/* ---------------- 홈 (디데이) ---------------- */
const doneSets = (date) => (S.workouts[date]?.items || []).reduce((t, it) => t + it.sets.filter((x) => x.done).length, 0);
const workedOut = (date) => doneSets(date) > 0;
function weekStart(date) { const d = parseYmd(date); const dow = (d.getDay() + 6) % 7; return addDays(date, -dow); }
const inbodySorted = () => S.inbody.slice().sort((a, b) => a.date.localeCompare(b.date));
const latestInbody = () => { const l = inbodySorted(); return l[l.length - 1]; };

function renderHome() {
  const today = ymd();
  const d = S.dday;
  let ddayHtml;
  if (!d) {
    ddayHtml = `<button class="card dday empty-dday" id="ddayEdit">
      <span class="dday-num">D-?</span>
      <b>목표 날짜를 정해보세요</b>
      <span class="muted small">바디프로필, 다이어트, 여행… 날짜가 있으면 훨씬 꾸준해져요.</span>
    </button>`;
  } else {
    const left = daysBetween(today, d.date);
    const total = Math.max(1, daysBetween(d.start, d.date));
    const pct = Math.min(100, Math.max(0, Math.round((daysBetween(d.start, today) / total) * 100)));
    const label = left > 0 ? `D-${left}` : left === 0 ? 'D-DAY' : `D+${-left}`;
    const w = latestInbody()?.weight;
    let goal = '';
    if (d.goalWeight && w) {
      const diff = Math.round((w - d.goalWeight) * 10) / 10;
      goal = `<div class="dday-goal">${Math.abs(diff) < 0.05 ? '🎉 목표 체중 달성!' : `목표 체중 ${fmt(d.goalWeight)}kg까지 <b>${diff > 0 ? '−' : '+'}${fmt(Math.abs(diff))}kg</b>`}<span class="muted small"> (현재 ${fmt(w)}kg)</span></div>`;
    } else if (d.goalWeight) {
      goal = `<div class="dday-goal muted small">목표 체중 ${fmt(d.goalWeight)}kg · 체중을 기록하면 남은 무게를 알려드려요</div>`;
    }
    ddayHtml = `<button class="card dday" id="ddayEdit">
      <span class="dday-title">${esc(d.title)}</span>
      <span class="dday-num">${label}</span>
      <span class="muted small">${longDate(d.date)}${left < 0 ? ' · 수고했어요! 새 목표를 정해볼까요?' : ''}</span>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="row between small muted"><span>${md(d.start)} 시작</span><span>${pct}% 지났어요</span></div>
      ${goal}
    </button>`;
  }

  const ws = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekCount = week.filter(workedOut).length;
  const monthKey = today.slice(0, 7);
  const monthCount = Object.keys(S.workouts).filter((k) => k.startsWith(monthKey) && workedOut(k)).length;
  const todayDone = doneSets(today);
  const ib = latestInbody();

  $('#homeBody').innerHTML = `
    ${ddayHtml}
    <button class="btn primary wide huge" id="startToday">${todayDone ? `오늘 운동 이어하기 · ${todayDone}세트 완료` : '오늘 운동 시작하기'}</button>
    <div class="card">
      <div class="row between"><h2>이번 주 출석</h2><span class="muted small">이번 달 ${monthCount}일</span></div>
      <div class="stamps">${week.map((day) => `<div class="stamp ${workedOut(day) ? 'on' : ''} ${day === today ? 'today' : ''}">
        <i>${workedOut(day) ? '✓' : ''}</i><span>${DAYS[parseYmd(day).getDay()]}</span></div>`).join('')}</div>
      <p class="cheer">${weekCount === 0 ? '이번 주 첫 운동을 시작해볼까요? 💪' : weekCount < 3 ? `이번 주 ${weekCount}번 운동했어요. 좋아요!` : `이번 주 ${weekCount}번! 아주 잘하고 있어요 🔥`}</p>
    </div>
    <div class="quick">
      <button class="card quick-btn" id="quickWeight"><b>⚖️ 체중 기록</b><span>${ib ? `최근 ${fmt(ib.weight)}kg · ${md(ib.date)}` : '아직 기록 없음'}</span></button>
      <button class="card quick-btn" id="quickRoutine"><b>📋 루틴 불러오기</b><span>${S.routines.length}개 저장됨</span></button>
    </div>`;
  $('#ddayEdit').onclick = openDday;
  $('#startToday').onclick = () => { viewDate = ymd(); logView = 'day'; go('log'); };
  $('#quickWeight').onclick = () => openInbody();
  $('#quickRoutine').onclick = () => { viewDate = ymd(); logView = 'day'; go('log'); openRoutines(); };
}

const DD_PRESETS = ['바디프로필 촬영', '다이어트 성공', '여행 가기 전', '대회', 'PT 마지막 날', '결혼식'];
function openDday() {
  const d = S.dday;
  $('#ddTitle').value = d?.title || '';
  $('#ddStart').value = d?.start || ymd();
  $('#ddDate').value = d?.date || addDays(ymd(), 84);
  $('#ddWeight').value = d?.goalWeight || '';
  $('#ddDelete').classList.toggle('hidden', !d);
  $('#ddPresets').innerHTML = DD_PRESETS.map((p) => `<button type="button" data-preset="${p}">${p}</button>`).join('');
  $('#ddayDialog').showModal();
}
$('#ddPresets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) $('#ddTitle').value = b.dataset.preset; });
$('#ddayDialog').addEventListener('close', () => {
  const v = $('#ddayDialog').returnValue;
  if (v === 'delete') { if (confirm('디데이를 지울까요?')) { S.dday = null; save(); renderHome(); } return; }
  if (v !== 'ok') return;
  let start = $('#ddStart').value, date = $('#ddDate').value;
  if (!date || !$('#ddTitle').value.trim()) return;
  if (start > date) [start, date] = [date, start];
  S.dday = { title: $('#ddTitle').value.trim(), start, date, goalWeight: num($('#ddWeight').value) };
  save(); renderHome();
});

/* ---------------- 기록: 운동 일지 ---------------- */
let viewDate = ymd();
let logView = 'day';
const dayData = (date) => S.workouts[date];
const ensureDay = (date) => (S.workouts[date] ||= { items: [], memo: '' });
function cleanupDay(date) {
  const d = S.workouts[date];
  if (d && !d.items.length && !d.memo) delete S.workouts[date];
}
function prevSetsOf(ex, beforeDate) {
  const dates = Object.keys(S.workouts).filter((d) => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const it = S.workouts[d].items.find((i) => i.ex === ex && i.sets.some((x) => x.done));
    if (it) return { date: d, sets: it.sets.filter((x) => x.done) };
  }
  return null;
}

function renderLog() {
  $$('#logSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === logView));
  $('#logDay').classList.toggle('hidden', logView !== 'day');
  $('#logStats').classList.toggle('hidden', logView !== 'stats');
  if (logView === 'day') renderDay(); else renderStats();
}
$('#logSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { logView = b.dataset.view; renderLog(); } });

function renderWeek() {
  const ws = weekStart(viewDate);
  const today = ymd();
  $('#weekDays').innerHTML = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => `
    <button data-date="${d}" class="${d === viewDate ? 'on' : ''} ${d === today ? 'today' : ''} ${workedOut(d) ? 'has' : ''}">
      <span>${DAYS[parseYmd(d).getDay()]}</span><b>${parseYmd(d).getDate()}</b><i></i></button>`).join('');
}
$('#weekDays').addEventListener('click', (e) => { const b = e.target.closest('[data-date]'); if (b) { viewDate = b.dataset.date; renderDay(); } });
$('#weekPrev').addEventListener('click', () => { viewDate = addDays(viewDate, -7); renderDay(); });
$('#weekNext').addEventListener('click', () => { viewDate = addDays(viewDate, 7); renderDay(); });

function renderDay() {
  renderWeek();
  const day = dayData(viewDate);
  const isToday = viewDate === ymd();
  const head = `<div class="day-head"><h2>${isToday ? '오늘' : longDate(viewDate)}</h2>${!isToday ? '<button class="link" id="goToday">오늘로</button>' : ''}</div>`;
  if (!day || !day.items.length) {
    $('#dayBody').innerHTML = `${head}
      <div class="card empty-day">
        <p>${isToday ? '아직 오늘 운동이 없어요.' : '이날은 운동 기록이 없어요.'}</p>
        <button class="btn primary wide" id="addExBtn">+ 운동 추가</button>
        <button class="btn ghost wide" id="loadRoutineBtn">📋 루틴 불러오기</button>
      </div>
      ${day?.memo ? memoBox(day) : ''}`;
  } else {
    const total = day.items.reduce((t, it) => t + it.sets.filter((x) => x.done).length, 0);
    const vol = day.items.reduce((t, it) => t + it.sets.filter((x) => x.done).reduce((a, x) => a + (num(x.w) || 0) * (num(x.r) || 0), 0), 0);
    $('#dayBody').innerHTML = `${head}
      ${day.items.map((it, idx) => exBlock(it, idx)).join('')}
      <div class="row gap"><button class="btn ghost grow" id="addExBtn">+ 운동 추가</button><button class="btn ghost grow" id="loadRoutineBtn">📋 루틴</button></div>
      ${memoBox(day)}
      <div class="card summary">
        <div class="stats">${stat('완료 세트', total + '세트')}${vol ? stat('총 볼륨', fmt(vol) + 'kg') : ''}${stat('운동', day.items.length + '개')}</div>
        <div class="row gap">
          <button class="btn primary grow" id="shareDay">💬 카톡으로 공유</button>
          <button class="btn ghost grow" id="saveRoutine">루틴으로 저장</button>
        </div>
      </div>`;
  }
  $('#addExBtn').onclick = () => openPicker('day');
  $('#loadRoutineBtn').onclick = openRoutines;
  $('#goToday') && ($('#goToday').onclick = () => { viewDate = ymd(); renderDay(); });
  $('#shareDay') && ($('#shareDay').onclick = shareDay);
  $('#saveRoutine') && ($('#saveRoutine').onclick = () => askName('루틴 이름', '', (name) => {
    S.routines.unshift({ id: uid(), name, ex: day.items.map((i) => i.ex) });
    save(); toast('루틴으로 저장했어요');
  }));
}
function memoBox(day) {
  return `<label class="memo card"><span>📝 오늘 메모 <span class="muted small">(컨디션, 트레이너 피드백 등)</span></span>
    <textarea id="dayMemo" rows="2" placeholder="예: 어깨가 조금 뻐근했음">${esc(day?.memo || '')}</textarea></label>`;
}
function exBlock(it, idx) {
  const ex = getEx(it.ex);
  const type = typeOf(it.ex);
  const f = FIELDS[type];
  const prev = prevSetsOf(it.ex, viewDate);
  const rows = it.sets.map((st, i) => {
    const p = prev?.sets[i] || prev?.sets[prev.sets.length - 1];
    return `<div class="set-row ${st.done ? 'done' : ''}">
      <span class="set-no">${i + 1}</span>
      ${f.map(([k, unit, mode]) => `<label class="cell"><input type="number" inputmode="${mode}" step="${mode === 'decimal' ? '0.5' : '1'}" min="0"
        data-i="${idx}" data-s="${i}" data-k="${k}" value="${st[k] ?? ''}" placeholder="${p?.[k] ?? ''}"><small>${unit}</small></label>`).join('')}
      <button class="tick" data-tick="${idx}:${i}" aria-label="${i + 1}세트 완료">✓</button>
    </div>`;
  }).join('');
  return `<div class="card ex-block">
    <div class="ex-head">
      <button class="ex-title" data-how="${esc(it.ex)}"><b>${esc(it.ex)}</b><span class="muted small">${esc(ex.part)}${ex.custom ? ' · 내 운동' : ''} ›</span></button>
      <button class="icon-del" data-rmex="${idx}" aria-label="${esc(it.ex)} 빼기">✕</button>
    </div>
    ${prev ? `<p class="prev">지난번 ${md(prev.date)}: ${prev.sets.map((x) => setText(type, x)).join(', ')}</p>` : ''}
    <div class="sets-box">${rows}</div>
    <div class="row gap set-tools">
      <button class="link" data-addset="${idx}">+ 세트 추가</button>
      ${it.sets.length > 1 ? `<button class="link muted" data-rmset="${idx}">− 마지막 세트 빼기</button>` : ''}
    </div>
  </div>`;
}
$('#dayBody').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'dayMemo') { ensureDay(viewDate).memo = t.value; cleanupDay(viewDate); save(); return; }
  if (t.dataset.k == null) return;
  const st = dayData(viewDate).items[+t.dataset.i].sets[+t.dataset.s];
  st[t.dataset.k] = t.value === '' ? null : num(t.value);
  save();
});
$('#dayBody').addEventListener('click', (e) => {
  const day = dayData(viewDate);
  const tick = e.target.closest('[data-tick]');
  if (tick) {
    const [i, s] = tick.dataset.tick.split(':').map(Number);
    const it = day.items[i], st = it.sets[s];
    if (!st.done) {
      // 빈 칸은 지난번 값(회색 글씨)으로 채움
      $$(`input[data-i="${i}"][data-s="${s}"]`).forEach((inp) => { if (inp.value === '' && inp.placeholder !== '') st[inp.dataset.k] = num(inp.placeholder); });
      const keys = FIELDS[typeOf(it.ex)].map(([k]) => k);
      if (keys.every((k) => st[k] == null)) { toast('숫자를 먼저 적어주세요'); return; }
      st.done = true;
      if (navigator.vibrate) navigator.vibrate(20);
      if (S.settings.autoRest && viewDate === ymd()) startTimer(S.settings.rest);
    } else st.done = false;
    save(); renderDay(); return;
  }
  const add = e.target.closest('[data-addset]');
  if (add) {
    const it = day.items[+add.dataset.addset];
    const last = it.sets[it.sets.length - 1] || {};
    const copy = {}; FIELDS[typeOf(it.ex)].forEach(([k]) => { copy[k] = last[k] ?? null; });
    it.sets.push({ ...copy, done: false }); save(); renderDay(); return;
  }
  const rmset = e.target.closest('[data-rmset]');
  if (rmset) { day.items[+rmset.dataset.rmset].sets.pop(); save(); renderDay(); return; }
  const rmex = e.target.closest('[data-rmex]');
  if (rmex) {
    const it = day.items[+rmex.dataset.rmex];
    if (it.sets.some((x) => x.done) && !confirm(`${it.ex} 기록을 지울까요?`)) return;
    day.items.splice(+rmex.dataset.rmex, 1); cleanupDay(viewDate); save(); renderDay(); return;
  }
  const how = e.target.closest('[data-how]');
  if (how) openGuideFor(how.dataset.how);
});
function addExercisesToDay(names) {
  const day = ensureDay(viewDate);
  names.forEach((name) => {
    if (day.items.some((i) => i.ex === name)) return;
    const prev = prevSetsOf(name, viewDate);
    const n = Math.min(Math.max(prev?.sets.length || 3, 1), 6);
    day.items.push({ ex: name, sets: Array.from({ length: n }, () => ({ done: false })) });
  });
  save();
}

function shareText(date) {
  const day = dayData(date);
  const lines = [`🏋️ ${longDate(date)} 운동 완료!`, ''];
  let total = 0, vol = 0;
  day.items.forEach((it) => {
    const done = it.sets.filter((x) => x.done);
    if (!done.length) return;
    total += done.length;
    vol += done.reduce((a, x) => a + (num(x.w) || 0) * (num(x.r) || 0), 0);
    lines.push(`• ${it.ex}  ${done.map((x) => setText(typeOf(it.ex), x)).join(', ')}`);
  });
  lines.push('', `총 ${total}세트${vol ? ` · 볼륨 ${fmt(vol)}kg` : ''}`);
  if (day.memo) lines.push(`메모: ${day.memo}`);
  return { text: lines.join('\n'), total };
}
async function shareDay() {
  const { text, total } = shareText(viewDate);
  if (!total) { toast('✓ 누른 세트가 있어야 공유할 수 있어요'); return; }
  await shareOrCopy({ text }, '운동 기록을 복사했어요. 카톡에 붙여넣기 하세요');
}
async function shareOrCopy(data, copiedMsg) {
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText([data.text, data.url].filter(Boolean).join('\n')); toast(copiedMsg); }
  catch (e) { prompt('아래 내용을 복사하세요', [data.text, data.url].filter(Boolean).join('\n')); }
}

/* ---------------- 기록: 나의 성장 ---------------- */
function renderStats() {
  const weightEx = [...new Set(Object.values(S.workouts).flatMap((d) => d.items.filter((i) => typeOf(i.ex) === 'weight' && i.sets.some((x) => x.done && num(x.w))).map((i) => i.ex)))];
  const dates = Object.keys(S.workouts).filter(workedOut).sort().reverse();
  const monthKey = ymd().slice(0, 7);
  $('#logStats').innerHTML = `
    <div class="card"><div class="stats">${stat('이번 달 운동', dates.filter((d) => d.startsWith(monthKey)).length + '일')}${stat('지금까지', dates.length + '일')}</div></div>
    <div class="card">
      <h2>운동별 최고 무게</h2>
      ${weightEx.length ? `<select id="exSelect">${weightEx.map((n) => `<option>${esc(n)}</option>`).join('')}</select>` : '<p class="empty small">무게를 기록한 운동이 생기면 그래프가 그려져요.</p>'}
      <div class="stats" id="exStats"></div>
      <div class="chart" id="exChart"></div>
    </div>
    <div class="card"><h2>지난 운동</h2>
      ${dates.length ? dates.slice(0, 60).map((d) => `<button class="hist-row" data-open="${d}"><b>${longDate(d)}</b>
        <span class="muted small">${S.workouts[d].items.filter((i) => i.sets.some((x) => x.done)).map((i) => esc(i.ex)).join(', ')}</span>
        <span class="pill-n">${doneSets(d)}세트</span></button>`).join('') : '<p class="empty small">아직 기록이 없어요.</p>'}
    </div>`;
  if (weightEx.length) {
    if (weightEx.includes(statEx)) $('#exSelect').value = statEx;
    $('#exSelect').onchange = (e) => { statEx = e.target.value; renderExChart(); };
    renderExChart();
  }
}
let statEx = '';
function renderExChart() {
  const ex = $('#exSelect').value; statEx = ex;
  const pts = Object.keys(S.workouts).sort().map((d) => {
    const it = S.workouts[d].items.find((i) => i.ex === ex);
    const best = it ? Math.max(0, ...it.sets.filter((x) => x.done).map((x) => num(x.w) || 0)) : 0;
    return best ? { d, v: best } : null;
  }).filter(Boolean);
  $('#exStats').innerHTML = pts.length ? stat('최고 기록', fmt(Math.max(...pts.map((p) => p.v))) + 'kg') + (pts.length > 1 ? stat('처음 대비', signed(pts[pts.length - 1].v - pts[0].v, 'kg')) : '') : '';
  lineChart($('#exChart'), pts, 'kg');
}
$('#logStats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) { viewDate = b.dataset.open; logView = 'day'; renderLog(); window.scrollTo(0, 0); }
});

/* ---------------- 운동 고르기 ---------------- */
let pickMode = 'day', pickPart = '전체', picked = [];
function openPicker(mode) {
  pickMode = mode; picked = []; pickPart = '전체';
  $('#pickSearch').value = '';
  $('#pickerTitle').textContent = mode === 'day' ? '운동 추가' : '새 루틴 – 운동 고르기';
  renderPicker();
  $('#picker').showModal();
}
function renderPicker() {
  const q = norm($('#pickSearch').value);
  const parts = ['전체', ...PARTS, ...(S.custom.length ? ['내 운동'] : [])];
  $('#pickParts').innerHTML = parts.map((p) => `<button type="button" data-ppart="${p}" class="${p === pickPart ? 'on' : ''}">${p}</button>`).join('');
  let list = allEx();
  if (pickPart === '내 운동') list = S.custom;
  else if (pickPart !== '전체') list = list.filter((e) => e.part === pickPart);
  if (q) list = list.filter((e) => exMatches(e, q));
  const exact = q && allEx().some((e) => norm(e.name) === q);
  const raw = $('#pickSearch').value.trim();
  $('#pickList').innerHTML = list.slice(0, 200).map((e) => `<li><button type="button" data-pick="${esc(e.name)}" class="${picked.includes(e.name) ? 'on' : ''}">
      <span><b>${esc(e.name)}</b><small>${esc(e.part)}${e.eq ? ' · ' + esc(e.eq) : ''}${e.trend ? ' · 🔥' : ''}</small></span><i>${picked.includes(e.name) ? picked.indexOf(e.name) + 1 : '+'}</i></button></li>`).join('')
    + (raw && !exact ? `<li><button type="button" class="make" data-make="1"><span><b>“${esc(raw)}” 직접 만들기</b><small>찾는 운동이 없으면 내 운동으로 추가해요</small></span><i>＋</i></button></li>` : '')
    + (!list.length && !raw ? '<li class="empty">운동이 없어요</li>' : '');
  const n = picked.length;
  $('#pickDone').disabled = !n;
  $('#pickDone').textContent = n ? `${n}개 ${pickMode === 'day' ? '추가하기' : '골랐어요 · 다음'}` : '운동을 골라주세요';
}
$('#pickSearch').addEventListener('input', renderPicker);
$('#pickParts').addEventListener('click', (e) => { const b = e.target.closest('[data-ppart]'); if (b) { pickPart = b.dataset.ppart; renderPicker(); $('#pickList').scrollTop = 0; } });
$('#pickList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (b) { const n = b.dataset.pick; picked = picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]; renderPicker(); return; }
  if (e.target.closest('[data-make]')) {
    const name = $('#pickSearch').value.trim();
    const part = PARTS.includes(pickPart) ? pickPart : '기타';
    const type = part === '유산소' ? 'cardio' : part === '스트레칭' ? 'time' : 'weight';
    S.custom.push({ name, en: '', part, eq: '', type, aliases: [], muscles: [], custom: true });
    save(); picked.push(name); $('#pickSearch').value = ''; renderPicker();
    toast(`“${name}”을 내 운동에 추가했어요`);
  }
});
$('#pickDone').addEventListener('click', () => {
  const names = picked.slice();
  $('#picker').close();
  if (pickMode === 'day') { addExercisesToDay(names); renderDay(); }
  else askName('새 루틴 이름', '', (name) => { S.routines.unshift({ id: uid(), name, ex: names }); save(); renderRoutines(); toast('루틴을 만들었어요'); });
});

/* ---------------- 루틴 ---------------- */
function openRoutines() { renderRoutines(); if (!$('#routines').open) $('#routines').showModal(); }
function renderRoutines() {
  $('#routineList').innerHTML = S.routines.length ? S.routines.map((r) => `<li class="routine-card">
    <button class="r-main" data-load="${r.id}"><b>${esc(r.name)}</b><span class="muted small">${r.ex.map(esc).join(' · ')}</span></button>
    <div class="r-tools"><button class="link" data-share="${r.id}">공유</button><button class="link muted" data-delr="${r.id}">삭제</button></div>
  </li>`).join('') : '<li class="empty">저장된 루틴이 없어요</li>';
}
$('#routineList').addEventListener('click', (e) => {
  const load = e.target.closest('[data-load]'), share = e.target.closest('[data-share]'), del = e.target.closest('[data-delr]');
  const find = (id) => S.routines.find((r) => r.id === id);
  if (load) {
    const r = find(load.dataset.load);
    addExercisesToDay(r.ex); $('#routines').close();
    if (currentTab !== 'log') { logView = 'day'; go('log'); } else { logView = 'day'; renderLog(); }
    toast(`“${r.name}” 불러왔어요`);
  }
  if (share) shareRoutine(find(share.dataset.share));
  if (del) {
    const r = find(del.dataset.delr);
    if (confirm(`“${r.name}” 루틴을 삭제할까요?`)) { S.routines = S.routines.filter((x) => x !== r); save(); renderRoutines(); }
  }
});
$('#newRoutine').addEventListener('click', () => { $('#routines').close(); openPicker('routine'); });

const b64e = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
function shareRoutine(r) {
  const url = `${location.origin}${location.pathname}#r=${b64e(JSON.stringify({ n: r.name, e: r.ex }))}`;
  shareOrCopy({ title: r.name, text: `📋 루틴 “${r.name}”\n${r.ex.join(' · ')}\n\n아래 링크를 누르면 오운완 노트에 바로 저장돼요 👇`, url }, '루틴 링크를 복사했어요. 카톡에 붙여넣기 하세요');
}
let incoming = null;
function checkIncoming() {
  const m = location.hash.match(/^#r=(.+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  try {
    const d = JSON.parse(b64d(m[1]));
    if (!d.n || !Array.isArray(d.e) || !d.e.length) return;
    incoming = { name: String(d.n).slice(0, 30), ex: d.e.map((x) => String(x).slice(0, 40)).slice(0, 30) };
    $('#importInfo').innerHTML = `<b>${esc(incoming.name)}</b> · 운동 ${incoming.ex.length}개`;
    $('#importList').innerHTML = incoming.ex.map((x) => `<li>${esc(x)}</li>`).join('');
    $('#importDialog').showModal();
  } catch (e) { toast('루틴 링크를 읽지 못했어요'); }
}
$('#importDialog').addEventListener('close', () => {
  if ($('#importDialog').returnValue !== 'ok' || !incoming) return;
  S.routines.unshift({ id: uid(), name: incoming.name, ex: incoming.ex });
  save(); toast('내 루틴에 저장했어요! 기록 탭에서 불러오세요');
  incoming = null;
});

/* 이름 입력 */
let nameCb = null;
function askName(title, value, cb) {
  $('#nameTitle').textContent = title; $('#nameInput').value = value; nameCb = cb;
  $('#nameDialog').showModal();
}
$('#nameDialog').addEventListener('close', () => {
  const v = $('#nameInput').value.trim();
  if ($('#nameDialog').returnValue === 'ok' && v && nameCb) nameCb(v);
  nameCb = null;
});

/* ---------------- 운동법 ---------------- */
let guidePart = '전체';
const ytLink = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' 자세')}`;
function exCard(e, open = false) {
  return `<details class="ex-card" ${open ? 'open' : ''}>
    <summary>
      <div class="ex-card-top"><strong>${esc(e.name)}</strong>${e.trend ? '<span class="badge">🔥 트렌드</span>' : ''}</div>
      <span class="muted small">${esc(e.en || '')}${e.eq ? ` · ${esc(e.eq)}` : ''}</span>
      <div class="tags">${(e.muscles || []).map((m) => `<span>${esc(m)}</span>`).join('')}</div>
    </summary>
    ${e.steps ? `<ol class="how-steps">${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted small">직접 추가한 운동이에요.</p>'}
    ${e.tip ? `<p class="tipline">💡 ${esc(e.tip)}</p>` : ''}
    ${e.trend ? `<p class="tipline trend">🔥 요즘 포인트: ${esc(e.trend)}</p>` : ''}
    <div class="row gap card-actions">
      <button type="button" class="btn primary grow" data-today="${esc(e.name)}">+ 오늘 운동에 추가</button>
      <a class="btn ghost" href="${ytLink(e.name)}" target="_blank" rel="noopener">▶ 영상</a>
    </div>
  </details>`;
}
function muscleItem(m) {
  return `<div class="muscle"><b>${esc(m.n)}</b><span class="muted small">${esc(m.en)}${m.part ? ` · ${m.part}` : ''}</span><p>${esc(m.d)}</p></div>`;
}
function renderGuide() {
  $('#partChips').innerHTML = ['전체', ...PARTS].map((p) => `<button type="button" data-part="${p}" class="${p === guidePart ? 'on' : ''}">${p}</button>`).join('');
  const q = norm($('#guideSearch').value);
  const list = allEx();
  let html = '';
  if (q) {
    const exs = list.filter((e) => exMatches(e, q));
    const mus = Object.entries(MUSCLES).flatMap(([part, l]) => l.map((m) => ({ ...m, part }))).filter((m) => norm(m.n + m.en).includes(q));
    if (mus.length) html += `<div class="card"><h2>근육</h2>${mus.map(muscleItem).join('')}</div>`;
    if (exs.length) html += `<h2 class="sec">운동 ${exs.length}개</h2>${exs.map((e) => exCard(e, exs.length === 1)).join('')}`;
    if (!html) html = `<div class="card empty">“${esc($('#guideSearch').value)}”에 맞는 운동이 없어요.<br><a class="link" href="${ytLink($('#guideSearch').value)}" target="_blank" rel="noopener">▶ 유튜브에서 찾아보기</a></div>`;
  } else if (guidePart === '전체') {
    html = `<div class="part-grid">${PARTS.map((p) => `<button data-part="${p}"><b>${p}</b><span>${list.filter((e) => e.part === p).length}개</span></button>`).join('')}</div>
      <div class="card trends"><h2>🔥 요즘 운동 트렌드</h2>${TRENDS.map((t, i) => `<div class="trend-item"><b>${i + 1}. ${t.t}</b><p>${t.d}</p></div>`).join('')}</div>`;
  } else {
    const exs = list.filter((e) => e.part === guidePart);
    const info = MUSCLES[guidePart]
      ? `<details class="card guide"><summary><h2>${guidePart} 근육 알아보기</h2></summary>${MUSCLES[guidePart].map(muscleItem).join('')}</details>`
      : PART_INFO[guidePart] ? `<div class="card"><p class="info">${PART_INFO[guidePart]}</p></div>` : '';
    html = `${info}<h2 class="sec">${guidePart} 운동 ${exs.length}개</h2>${exs.map((e) => exCard(e)).join('')}`;
  }
  $('#guideBody').innerHTML = html;
}
function openGuideFor(name) { $('#guideSearch').value = name; guidePart = '전체'; go('guide'); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-part]');
  if (b && currentTab === 'guide') { guidePart = b.dataset.part; $('#guideSearch').value = ''; renderGuide(); window.scrollTo(0, 0); }
});
$('#guideSearch').addEventListener('input', renderGuide);
$('#guideBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-today]'); if (!b) return;
  viewDate = ymd(); addExercisesToDay([b.dataset.today]);
  toast(`오늘 운동에 “${b.dataset.today}” 추가했어요`);
});

/* ---------------- 휴식 타이머 ---------------- */
const RING = 2 * Math.PI * 88;
const ringFg = $('#ringFg');
ringFg.style.strokeDasharray = RING;
let T = { total: S.settings.rest, left: S.settings.rest, endAt: 0, running: false, tick: 0 };
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${pad(Math.max(0, sec) % 60)}`;
function drawTimer() {
  $('#timerTime').textContent = fmtTime(Math.ceil(T.left));
  ringFg.style.strokeDashoffset = RING * (1 - Math.max(0, T.left) / T.total);
  $('#startPause').textContent = T.running ? '일시정지' : (T.left < T.total && T.left > 0 ? '계속' : '시작');
  $('#timerState').textContent = T.running ? '쉬는 중…' : (T.left <= 0 ? '다음 세트 시작!' : '휴식 준비');
  $('.timer-wrap').classList.toggle('finished', T.left <= 0);
  $$('#presets button').forEach((b) => b.classList.toggle('on', +b.dataset.sec === T.total));
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
let audioCtx;
function unlockAudio() { try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* 소리 미지원 */ } }
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
$('#timerPill').addEventListener('click', () => {
  if (!T.running) { T.endAt = 0; T.left = T.total; drawTimer(); return; }
  go('timer');
});
$('#startPause').addEventListener('click', () => (T.running ? pauseTimer() : startTimer()));
$('#resetTimer').addEventListener('click', () => { T.endAt = 0; pauseTimer(); T.left = T.total; drawTimer(); });
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sec]'); if (!b) return;
  const sec = +b.dataset.sec; S.settings.rest = sec; save();
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
  const xLabels = [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]].filter((p, i, a) => a.findIndex((q) => q.d === p.d) === i);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="변화 그래프">
    <g class="grid">${ticks.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((t) => `<text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
      ${xLabels.map((p, i, a) => `<text x="${x(p.d)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${md(p.d)}</text>`).join('')}</g>
    <path class="series" d="${path}"/>
    ${points.length <= 30 ? points.map((p) => `<circle class="dot" r="4" cx="${x(p.d)}" cy="${y(p.v)}"/>`).join('') : ''}
    <line class="cross hidden" y1="${m.t - 6}" y2="${H - m.b}"/><circle class="hot hidden" r="5"/>
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>
  </svg><div class="tip hidden"></div>
  <details><summary>표로 보기</summary><table>${points.slice().reverse().map((p) => `<tr><td>${longDate(p.d)}</td><td>${fmt(p.v)} ${unit}</td></tr>`).join('')}</table></details>`;
  const svg = $('svg', el), tip = $('.tip', el), cross = $('.cross', svg), hot = $('.hot', svg);
  const show = (evt) => {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    let best = points[0];
    points.forEach((p) => { if (Math.abs(x(p.d) - px) < Math.abs(x(best.d) - px)) best = p; });
    const bx = x(best.d);
    cross.setAttribute('x1', bx); cross.setAttribute('x2', bx);
    hot.setAttribute('cx', bx); hot.setAttribute('cy', y(best.v));
    [cross, hot, tip].forEach((n) => n.classList.remove('hidden'));
    tip.innerHTML = `<b>${fmt(best.v)}${unit}</b> · ${md(best.d)}`;
    tip.style.left = `${Math.min(Math.max((bx / W) * r.width, 50), r.width - 50)}px`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => [cross, hot, tip].forEach((n) => n.classList.add('hidden')));
}
function stat(label, value) { return `<div class="stat"><b>${value}</b><span>${label}</span></div>`; }
const signed = (n, unit) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}${unit}`;
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (currentTab === 'log' && logView === 'stats' && $('#exSelect')) renderExChart(); if (currentTab === 'body') renderBodyChart(); }, 150);
});

/* ---------------- 인바디 ---------------- */
const METRICS = [
  { k: 'weight', label: '체중', unit: 'kg' },
  { k: 'smm', label: '골격근량', unit: 'kg' },
  { k: 'fatPct', label: '체지방률', unit: '%' },
  { k: 'fatKg', label: '체지방량', unit: 'kg' },
];
let metric = 'weight';
function bmiOf(w) { const h = num(S.profile.height); return h && w ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null; }
// ---------- 결과지 사진 (IndexedDB, 이 폰에만 저장) ----------
const PhotoDB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ounwan-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => {
    const t = db.transaction('p', mode); const req = fn(t.objectStore('p'));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }); };
  return {
    get: (k) => run('readonly', (st) => st.get(k)),
    set: (k, v) => run('readwrite', (st) => st.put(v, k)),
    del: (k) => run('readwrite', (st) => st.delete(k)),
    clear: () => run('readwrite', (st) => st.clear()),
    all: async () => { const db = await open(); return new Promise((res, rej) => {
      const out = {}; const t = db.transaction('p'); const c = t.objectStore('p').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    }); },
  };
})();
// 긴 변 1600px JPEG로 줄여서 숫자는 또렷하게, 용량은 수백 KB로
function shrinkImage(file, max = 1600) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
function openPhotoView(src, title) {
  $('#photoFull').src = src; $('#photoFull').classList.remove('zoom');
  $('#photoTitle').textContent = title;
  $('#photoDialog').showModal();
}
async function showPhoto(date) {
  const d = await PhotoDB.get(date).catch(() => null);
  if (!d) { toast('사진을 찾지 못했어요'); return; }
  openPhotoView(d, longDate(date) + ' 결과지');
}
$('#photoFull').addEventListener('click', () => $('#photoFull').classList.toggle('zoom'));
// null = 그대로, '' = 사진 빼기, dataURL = 새 사진
let pendingPhoto = null;
function setPhotoPreview(d) {
  $('#ibPhotoPrev').hidden = !d; $('#ibPhotoBtn').hidden = !!d;
  if (d) $('#ibPhotoImg').src = d;
}
$('#ibPhoto').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { pendingPhoto = await shrinkImage(f); setPhotoPreview(pendingPhoto); }
  catch (err) { alert('사진을 불러오지 못했어요. 다른 사진으로 해볼까요?'); }
});
$('#ibPhotoDel').addEventListener('click', () => { pendingPhoto = ''; setPhotoPreview(null); });
$('#ibPhotoImg').addEventListener('click', () => { if (pendingPhoto) openPhotoView(pendingPhoto, '미리보기'); });
document.addEventListener('click', (e) => { const p = e.target.closest('[data-photo]'); if (p) showPhoto(p.dataset.photo); });

const bmiLabel = (b) => (b < 18.5 ? '저체중' : b < 23 ? '정상' : b < 25 ? '과체중' : '비만');
function fatLabel(p) { const [lo, hi] = S.profile.sex === 'f' ? [18, 28] : [10, 20]; return p < lo ? '표준 이하' : p <= hi ? '표준' : '표준 이상'; }
function renderBody() {
  const list = inbodySorted();
  const last = list[list.length - 1], prev = list[list.length - 2];
  if (!last) {
    $('#inbodyLatest').innerHTML = '<div class="card empty">아직 기록이 없어요.<br>체중만 적어도 시작할 수 있어요.</div>';
  } else {
    const tile = (label, v, unit, key, note) => {
      if (v == null || v === '') return '';
      const d = key && prev && prev[key] != null ? v - prev[key] : null;
      return `<div class="tile"><span>${label}</span><b>${fmt(v)}<small>${unit}</small></b>
        ${d ? `<em>${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</em>` : ''}${note ? `<i>${note}</i>` : ''}</div>`;
    };
    const bmi = bmiOf(last.weight);
    $('#inbodyLatest').innerHTML = `<div class="card">
      <div class="row between"><h2>최근 결과</h2><span class="muted small">${longDate(last.date)}${prev ? ` · ${md(prev.date)} 대비` : ''}</span></div>
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
      ${last.photo ? `<button type="button" class="btn ghost wide" data-photo="${last.date}">📷 결과지 사진 보기</button>` : ''}
    </div>`;
  }
  $('#metricChips').innerHTML = METRICS.map((m) => `<button type="button" data-metric="${m.k}" class="${m.k === metric ? 'on' : ''}">${m.label}</button>`).join('');
  renderBodyChart();
  $('#inbodyList').innerHTML = list.length ? `<div class="card"><h2>전체 기록</h2>${list.slice().reverse().map((r) => `
    <div class="ib-row">${r.photo ? `<button type="button" class="ib-thumb" data-photo="${r.date}" aria-label="결과지 사진 보기">📷</button>` : ''}<div class="grow"><strong>${longDate(r.date)}</strong><br><span class="muted small">
      ${fmt(r.weight)}kg${r.smm != null ? ` · 골격근 ${fmt(r.smm)}kg` : ''}${r.fatPct != null ? ` · 체지방 ${fmt(r.fatPct)}%` : ''}</span></div>
      <button class="icon-del" data-delib="${r.id}" aria-label="삭제">✕</button></div>`).join('')}</div>` : '';
}
function renderBodyChart() {
  const m = METRICS.find((x) => x.k === metric);
  const pts = inbodySorted().filter((r) => r[metric] != null).map((r) => ({ d: r.date, v: r[metric] }));
  $('#bodyStats').innerHTML = pts.length > 1 ? stat('처음 대비', signed(pts[pts.length - 1].v - pts[0].v, m.unit)) + stat('측정', pts.length + '회') : '';
  lineChart($('#bodyChart'), pts, m.unit);
}
$('#metricChips').addEventListener('click', (e) => { const b = e.target.closest('[data-metric]'); if (b) { metric = b.dataset.metric; renderBody(); } });
$('#inbodyList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-delib]');
  if (!b) return;
  const rec = S.inbody.find((r) => r.id === b.dataset.delib);
  if (!confirm(rec && rec.photo ? '이 기록과 결과지 사진을 삭제할까요?' : '이 기록을 삭제할까요?')) return;
  if (rec && rec.photo) PhotoDB.del(rec.date).catch(() => {});
  S.inbody = S.inbody.filter((r) => r.id !== b.dataset.delib); save(); renderBody();
});
function openInbody() {
  $('#inbodyForm').reset();
  $('#ibDate').value = ymd();
  const last = latestInbody();
  $('#ibWeight').placeholder = last ? `지난번 ${fmt(last.weight)}` : '';
  $('#ibMore').open = false;
  pendingPhoto = null; setPhotoPreview(null);
  $('#inbodyDialog').showModal();
}
$('#addInbody').addEventListener('click', () => { openInbody(); $('#ibMore').open = true; });
$('#inbodyDialog').addEventListener('close', async () => {
  if ($('#inbodyDialog').returnValue !== 'ok') { pendingPhoto = null; return; }
  const weight = num($('#ibWeight').value);
  if (!weight) return;
  const fatPct = num($('#ibFatPct').value);
  let fatKg = num($('#ibFatKg').value);
  if (fatKg == null && fatPct != null) fatKg = Math.round(weight * fatPct) / 100;
  const rec = { id: uid(), date: $('#ibDate').value || ymd(), weight, smm: num($('#ibSmm').value), fatPct, fatKg,
    visceral: num($('#ibVisceral').value), bmr: num($('#ibBmr').value), memo: $('#ibMemo').value.trim() };
  Object.keys(rec).forEach((k) => (rec[k] == null || rec[k] === '') && delete rec[k]);
  const same = S.inbody.find((r) => r.date === rec.date);
  const photo = pendingPhoto; pendingPhoto = null;
  if (photo) {
    try { await PhotoDB.set(rec.date, photo); rec.photo = true; }
    catch (err) { alert('사진 저장 공간이 부족해요. 숫자 기록만 저장할게요.'); }
  } else if (same && same.photo) {
    if (photo === '') PhotoDB.del(rec.date).catch(() => {}); else rec.photo = true; // 같은 날 다시 적어도 사진은 유지
  }
  S.inbody = S.inbody.filter((r) => r.date !== rec.date).concat(rec);
  const last = latestInbody();
  S.profile.weight = String(last.weight);
  if (last.fatPct != null) S.profile.fat = String(last.fatPct);
  save(); toast('기록했어요');
  if (currentTab === 'body') renderBody(); else if (currentTab === 'home') renderHome();
});
$('#inbodyGuide').innerHTML = `
  <dl class="glossary">
    <dt>골격근량</dt><dd>몸을 움직이는 근육의 무게예요. 운동하면 늘어나는 숫자라, 체중보다 이게 늘었는지 보는 게 더 중요해요.</dd>
    <dt>체지방률</dt><dd>체중 중 지방의 비율이에요. 표준은 대략 <b>남성 10~20%, 여성 18~28%</b>예요.</dd>
    <dt>BMI</dt><dd>체중 ÷ 키(m)². 국내 기준 <b>18.5~22.9 정상, 23~24.9 과체중, 25 이상 비만</b>. 근육이 많으면 높게 나올 수 있어서 체지방률과 같이 봐야 해요.</dd>
    <dt>내장지방 레벨</dt><dd>배 속 장기 주변 지방이에요. <b>10 미만</b>이 좋아요. 식단과 유산소에 비교적 빨리 줄어요.</dd>
    <dt>기초대사량</dt><dd>가만히 있어도 쓰는 하루 에너지예요. 식단 칼로리를 이보다 크게 낮추면 오래 못 가요.</dd>
  </dl>
  <h3>체형 모양 (C·I·D형)</h3>
  <p class="small">결과지 막대 3개(체중·골격근량·체지방량) 끝을 이어 보세요.</p>
  <ul class="plain">
    <li><b>C형</b> — 체지방이 가장 길어요. 근력운동 + 체지방 감량부터!</li>
    <li><b>I형</b> — 세 막대가 일직선. 균형형이에요.</li>
    <li><b>D형</b> — 골격근이 가장 길어요. 근육형, 운동하는 사람의 목표!</li>
  </ul>
  <h3>정확하게 재는 법</h3>
  <ul class="plain">
    <li><b>같은 시간</b>(아침 공복, 화장실 다녀온 뒤)에 재요.</li>
    <li>운동·샤워 직후, 술 마신 다음 날은 피해요.</li>
    <li>하루 숫자보다 <b>2~4주의 흐름</b>을 보세요.</li>
  </ul>`;

/* ---------------- 식단 ---------------- */
const GOALS = {
  cut: { label: '다이어트', sub: '체지방 빼기', emoji: '🔥', factor: 0.8, protein: 2.0, desc: '평소보다 약 20% 적게 먹어요. 일주일에 체중의 0.5~1%씩 빠지는 속도가 근육을 지켜요. 단백질은 넉넉히!' },
  keep: { label: '유지', sub: '지금 몸 유지', emoji: '⚖️', factor: 1.0, protein: 1.6, desc: '먹는 만큼 쓰는 칼로리예요. 체중이 2주 넘게 한쪽으로 변하면 100~200kcal씩 조절해요.' },
  lean: { label: '린매스업', sub: '군살 없이 근육', emoji: '💪', factor: 1.08, protein: 1.8, desc: '평소보다 5~10% 더 먹어서 근육을 천천히 늘려요. 한 달에 0.5~1kg 늘면 딱 좋아요.' },
  bulk: { label: '벌크업', sub: '확실히 키우기', emoji: '🍚', factor: 1.15, protein: 1.8, desc: '평소보다 약 15% 더 먹어요. 한 달 1~2kg 증가가 목표예요. 너무 빨리 늘면 대부분 지방이에요.' },
};
function calcDiet() {
  const p = S.profile;
  const w = num(p.weight), h = num(p.height), a = num(p.age), fat = num(p.fat), act = num(p.activity) || 1.55;
  if (!w || !h || !a) return null;
  const lbm = fat != null ? w * (1 - fat / 100) : null;
  const bmr = lbm ? 370 + 21.6 * lbm : 10 * w + 6.25 * h - 5 * a + (p.sex === 'f' ? -161 : 5);
  const tdee = bmr * act;
  const g = GOALS[p.goal] || GOALS.cut;
  const kcal = Math.round((tdee * g.factor) / 10) * 10;
  const protein = Math.round(w * g.protein);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carb = Math.max(0, Math.round((kcal - protein * 4 - fatG * 9) / 4));
  return { bmr, tdee, kcal, protein, fatG, carb, g, w, act, lbm, a, h, sex: p.sex, fat };
}
function renderDiet() {
  const last = latestInbody(), p = S.profile;
  if (!p.weight && last) p.weight = String(last.weight);
  if (!p.fat && last?.fatPct != null) p.fat = String(last.fatPct);
  $('#pSex').value = p.sex; $('#pAge').value = p.age; $('#pHeight').value = p.height;
  $('#pWeight').value = p.weight; $('#pFat').value = p.fat; $('#pActivity').value = p.activity;
  $('#goalChips').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button type="button" data-goal="${k}" class="${k === p.goal ? 'on' : ''}"><b>${g.emoji} ${g.label}</b><span>${g.sub}</span></button>`).join('');
  $('#goalDesc').textContent = (GOALS[p.goal] || GOALS.cut).desc;
  renderDietResult();
}
function renderDietResult() {
  const r = calcDiet();
  if (!r) {
    $('#dietResult').innerHTML = '<p class="empty">아래 <b>내 정보</b>에 나이·키·체중을 적으면<br>하루에 먹을 양을 계산해 드려요.</p>';
    $('#dietHow').innerHTML = '<p class="muted">정보를 입력하면 내 숫자로 계산 과정을 보여드려요.</p>';
    return;
  }
  const total = r.protein * 4 + r.fatG * 9 + r.carb * 4;
  const pct = (k) => Math.round((k / total) * 100);
  const floor = r.sex === 'f' ? 1200 : 1500;
  const warn = r.kcal < r.bmr ? '목표가 기초대사량보다 낮아요. 오래 유지하기 어렵고 근육이 빠지기 쉬워요. 활동량을 늘리는 쪽을 먼저 고려하세요.'
    : r.kcal < floor ? `하루 ${floor}kcal 아래로는 영양이 부족해지기 쉬워요.` : '';
  $('#dietResult').innerHTML = `
    <div class="kcal"><span>${r.g.emoji} ${r.g.label} · 하루 목표</span><b>${r.kcal.toLocaleString('ko-KR')}</b><small>kcal</small></div>
    <div class="macro-bar" aria-hidden="true"><i class="p" style="width:${pct(r.protein * 4)}%"></i><i class="c" style="width:${pct(r.carb * 4)}%"></i><i class="f" style="width:${pct(r.fatG * 9)}%"></i></div>
    <div class="macros">
      <div><i class="dot-p"></i><span>단백질</span><b>${r.protein}g</b><small>${pct(r.protein * 4)}%</small></div>
      <div><i class="dot-c"></i><span>탄수화물</span><b>${r.carb}g</b><small>${pct(r.carb * 4)}%</small></div>
      <div><i class="dot-f"></i><span>지방</span><b>${r.fatG}g</b><small>${pct(r.fatG * 9)}%</small></div>
    </div>
    <p class="per-meal">한 끼(하루 3끼)에 약 <b>${Math.round(r.kcal / 3)}kcal</b> · 단백질 <b>${Math.round(r.protein / 3)}g</b><br><span class="muted small">단백질 ${Math.round(r.protein / 3)}g ≈ 닭가슴살 ${Math.round(r.protein / 3 / 0.23 / 10) * 10}g 정도</span></p>
    <div class="row between muted small"><span>기초대사량 ${Math.round(r.bmr).toLocaleString('ko-KR')}kcal</span><span>유지 칼로리 ${Math.round(r.tdee).toLocaleString('ko-KR')}kcal</span></div>
    ${warn ? `<p class="warn">⚠ ${warn}</p>` : ''}`;
  const bmrLine = r.lbm
    ? `체지방률을 알아서 <b>Katch-McArdle 공식</b>을 썼어요.<br>제지방량 = ${fmt(r.w)} × (1 − ${fmt(r.fat)}%) = ${fmt(r.lbm)}kg<br>기초대사량 = 370 + 21.6 × ${fmt(r.lbm)} = <b>${Math.round(r.bmr)}kcal</b>`
    : `<b>Mifflin-St Jeor 공식</b>(가장 많이 쓰는 공식)을 썼어요.<br>10 × ${fmt(r.w)} + 6.25 × ${fmt(r.h)} − 5 × ${r.a} ${r.sex === 'f' ? '− 161' : '+ 5'} = <b>${Math.round(r.bmr)}kcal</b>`;
  $('#dietHow').innerHTML = `
    <ol class="how-steps">
      <li><b>기초대사량</b> — ${bmrLine}</li>
      <li><b>유지 칼로리</b> = 기초대사량 × 활동량 ${r.act} = <b>${Math.round(r.tdee)}kcal</b></li>
      <li><b>목표 칼로리</b> = 유지 칼로리 × ${r.g.factor} = <b>${r.kcal}kcal</b></li>
      <li><b>단백질</b> = 체중 × ${r.g.protein}g = ${r.protein}g</li>
      <li><b>지방</b> = 목표 칼로리의 25% ÷ 9 = ${r.fatG}g</li>
      <li><b>탄수화물</b> = 남은 칼로리 ÷ 4 = ${r.carb}g</li>
    </ol>
    <h3>단백질 감 잡기</h3>
    <ul class="plain"><li>닭가슴살 100g ≈ 23g</li><li>계란 1개 ≈ 6g</li><li>그릭요거트 100g ≈ 9~10g</li><li>소고기(우둔) 100g ≈ 21g</li><li>두부 반 모 ≈ 13g</li><li>프로틴 1스쿱 ≈ 20~25g</li></ul>
    <p class="muted small">공식은 평균값이에요. 2~3주 먹어보고 체중 변화를 보며 100~200kcal씩 조절하는 게 가장 정확해요. 질환이 있거나 임신 중이라면 전문가와 상담하세요.</p>`;
}
$('#goalChips').addEventListener('click', (e) => { const b = e.target.closest('[data-goal]'); if (b) { S.profile.goal = b.dataset.goal; save(); renderDiet(); } });
$('#profileForm').addEventListener('input', () => {
  Object.assign(S.profile, { sex: $('#pSex').value, age: $('#pAge').value, height: $('#pHeight').value, weight: $('#pWeight').value, fat: $('#pFat').value, activity: $('#pActivity').value });
  save(); renderDietResult();
});
$('#profileForm').addEventListener('submit', (e) => e.preventDefault());

/* ---------------- 기타 ---------------- */
function toast(msg) {
  $$('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}
$('#openSettings').addEventListener('click', () => $('#settingsDialog').showModal());
$('#exportBtn').addEventListener('click', async () => {
  const photos = await PhotoDB.all().catch(() => ({}));
  const data = Object.keys(photos).length ? { ...S, photos } : S;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `오운완-백업-${ymd()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.routines) throw new Error('형식 오류');
    if (!confirm('지금 기록을 백업 파일 내용으로 바꿀까요?')) return;
    const photos = data.photos; delete data.photos;
    S = migrate(data); save();
    if (photos) {
      await PhotoDB.clear().catch(() => {});
      for (const [k, v] of Object.entries(photos)) await PhotoDB.set(k, v).catch(() => {});
    }
    $('#settingsDialog').close(); go(currentTab);
  } catch (err) { alert('백업 파일을 읽지 못했어요.'); }
  e.target.value = '';
});
$('#resetAll').addEventListener('click', () => {
  if (!confirm('모든 기록을 지울까요? 되돌릴 수 없어요.')) return;
  S = freshState(); save(); PhotoDB.clear().catch(() => {}); $('#settingsDialog').close(); go('home');
});

let lastDay = ymd();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ymd() !== lastDay) { lastDay = ymd(); viewDate = lastDay; go(currentTab); }
});
window.addEventListener('hashchange', checkIncoming);

save();
drawTimer();
go('home');
checkIncoming();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
