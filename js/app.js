/*
 * 佩剑体能训练 · 主应用逻辑
 * 视图:今日 / 周计划 / 动作库 / 周期 / 记录 + 计时器 + 设置
 */
'use strict';

/* ================= 状态 ================= */
const LS_SETTINGS = 'sabre.settings.v1';
const LS_LOGS = 'sabre.logs.v1';

const defaultSettings = () => ({
  version: 30,
  sound: true,
  voice: false,
  cycleStart: todayKey(),
  cycleOverride: null
});

let settings = loadSettings();
let logs = loadLogs();
let timer = null;
let activeSession = null;   // { module, label, version, startTs }
let finishPending = false;
let cancelArmed = false;

/* ================= 存储 ================= */
function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? Object.assign(defaultSettings(), JSON.parse(raw)) : defaultSettings();
  } catch (e) { return defaultSettings(); }
}
function saveSettings() {
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) {}
}
function loadLogs() {
  try {
    const raw = localStorage.getItem(LS_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveLogs() {
  try { localStorage.setItem(LS_LOGS, JSON.stringify(logs)); } catch (e) {}
}

/* ================= 日期工具 ================= */
function pad2(n) { return String(n).padStart(2, '0'); }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function nowHM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function parseKey(k) {
  const p = k.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function fmtCNDate(key) {
  const d = parseKey(key);
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${w}`;
}
function fmtShort(key) {
  const d = parseKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
function mondayOf(key) {
  const d = parseKey(key);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ================= 周期周计算 ================= */
function currentWeek() {
  if (settings.cycleOverride) return settings.cycleOverride;
  const start = parseKey(settings.cycleStart || todayKey());
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let days = Math.round((now - start) / 86400000);
  if (days < 0) days = 0;
  return (Math.floor(days / 7) % 4) + 1;
}
const weekInfo = () => CYCLE[currentWeek() - 1];

/* ================= 模块样式 ================= */
function moduleChip(mod, label) {
  let color = '#9AA5B5', text = '#EDEFF3';
  if (MODULES[mod]) { color = MODULES[mod].color; text = '#0E1116'; }
  else if (mod === 'R') { color = '#3D5564'; text = '#EDEFF3'; }
  else if (mod === 'AC') { color = 'linear-gradient(135deg,#4C8DFF,#E4572E)'; text = '#fff'; }
  return `<span class="module-chip" style="background:${color};color:${text}">${label}</span>`;
}
function dayModule(day) {
  return WEEK_SCHEDULE.find(s => s.day === day) || WEEK_SCHEDULE[0];
}

/* ================= 导航 ================= */
const views = ['today', 'week', 'ex', 'cycle', 'log'];
function switchView(name) {
  views.forEach(v => {
    document.getElementById('view-' + v).classList.toggle('active', v === name);
  });
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === name);
  });
  if (name === 'log') renderLog();
}
function bindTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchView(t.dataset.view));
  });
}

/* ================= 今日视图 ================= */
function renderToday() {
  const day = new Date().getDay(); // 0=周日
  const sched = dayModule(day);
  const wk = weekInfo();
  const today = todayKey();
  const el = document.getElementById('view-today');

  let body = `
    <div class="card day-hero">
      <div class="day-topline">
        <span class="day-date">${fmtCNDate(today)}</span>
        <span class="week-badge">第 ${currentWeek()} 周 · ${wk.theme}</span>
      </div>`;

  if (sched.module === 'X') {
    body += `
      <span class="day-module" style="background:#3D5564;color:#EDEFF3">休 息 日</span>
      <h3>今天完全休息</h3>
      <p class="desc">不做任何训练。体能增长发生在恢复期,睡够 7–9 小时,为下一循环蓄力。</p>
      <div class="hero-meta"><span class="meta-chip">😴 睡眠 7–9 小时</span><span class="meta-chip">💧 多补水</span></div>`;
  } else if (sched.module === 'R') {
    body += `
      <span class="day-module" style="background:#3D5564;color:#EDEFF3">主 动 恢 复</span>
      <h3>低强度有氧 + 拉伸</h3>
      <p class="desc">${sched.note}</p>
      <div class="hero-meta">
        <span class="meta-chip">🚶 慢走 / 骑行 / 游泳</span>
        <span class="meta-chip">20–30 分钟</span>
        <span class="meta-chip">拉伸放松</span>
      </div>
      <div class="hero-actions">
        <button class="btn primary" data-recover="20">20 分钟</button>
        <button class="btn secondary" data-recover="30">30 分钟</button>
      </div>`;
  } else {
    const mod = sched.module === 'AC' ? null : MODULES[sched.module];
    const label = sched.module === 'AC' ? 'A·C 加强' : mod.name;
    const desc = sched.module === 'AC'
      ? '下肢爆发 + 无氧体能组合强化:冲刺、跳箱、折返、波比跳。'
      : mod.desc;
    const exCount = settings.version === 60 ? 6 : 5;
    const rounds = settings.version === 60 ? wk.rounds : 2;
    body += `
      ${moduleChip(sched.module, label)}
      <h3>${sched.label}</h3>
      <p class="desc">${desc}</p>
      <div class="hero-meta">
        <span class="meta-chip">⏱ 工作 <b>${wk.work}s</b> : 休息 <b>${wk.rest}s</b></span>
        <span class="meta-chip">🔁 <b>${rounds}</b> 轮 × ${exCount} 动作</span>
        <span class="meta-chip">⏳ ${settings.version} 分钟版</span>
      </div>
      <div class="hero-actions">
        <button class="btn primary" data-start="${sched.module}">开始训练</button>
        <button class="btn secondary" data-min="1">保底 20 分钟</button>
      </div>
      <div class="seg" id="hero-version" style="margin-top:14px">
        <button data-v="30" class="${settings.version === 30 ? 'active' : ''}">30 分钟</button>
        <button data-v="60" class="${settings.version === 60 ? 'active' : ''}">60 分钟</button>
      </div>`;
  }
  body += `</div>`;

  // 本周完成概览
  const monday = mondayOf(today);
  const doneSet = new Set(logs.filter(l => l.date >= monday && l.date <= addDays(monday, 6)).map(l => l.date));
  let strip = '<div class="week-strip">';
  for (let i = 0; i < 7; i++) {
    const key = addDays(monday, i);
    const s = dayModule((parseKey(key).getDay() + 6) % 7 + 1 ? parseKey(key).getDay() : 0);
    const d = parseKey(key).getDay();
    const ds = dayModule(d);
    const done = doneSet.has(key);
    const isToday = key === today;
    strip += `
      <div class="ws-item ${done ? 'done' : ''} ${isToday ? 'today' : ''}">
        <div class="ws-d">${WEEK_CN[d]}</div>
        <div class="ws-dot">${done ? '✓' : (isToday ? '今' : '')}</div>
        <div class="ws-mod">${ds.module === 'X' ? '休' : ds.module === 'R' ? '恢' : ds.module}</div>
      </div>`;
  }
  strip += '</div>';

  body += strip;

  // 训练要点速览
  body += `<div class="card note-card"><h4>今日要点</h4><p>${sched.note}</p></div>`;

  el.innerHTML = body;

  // 事件绑定
  el.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => startSession(b.dataset.start, sched.label)));
  const minBtn = el.querySelector('[data-min]');
  if (minBtn) minBtn.addEventListener('click', () => startMinimum());
  el.querySelectorAll('[data-recover]').forEach(b => b.addEventListener('click', () => startRecovery(parseInt(b.dataset.recover, 10))));
  const hv = el.querySelector('#hero-version');
  if (hv) hv.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    settings.version = parseInt(b.dataset.v, 10);
    saveSettings();
    renderToday();
  }));
}

/* ================= 周计划视图 ================= */
function renderWeek() {
  const today = todayKey();
  const todayDow = new Date().getDay();
  const el = document.getElementById('week-list');
  el.innerHTML = WEEK_SCHEDULE.map(s => {
    const mod = MODULES[s.module];
    const isToday = s.day === todayDow;
    const chip = s.module === 'X' ? moduleChip('X', '休') : s.module === 'R' ? moduleChip('R', '恢') : moduleChip(s.module, s.module + ' · ' + (mod ? mod.name : '加强'));
    return `
      <div class="week-item ${isToday ? 'today' : ''}" data-day="${s.day}">
        <div class="w-day"><div class="wd">周${WEEK_CN[s.day]}</div><div class="wdl">${isToday ? '今天' : ''}</div></div>
        <div class="w-info">
          <h4>${chip} <span style="font-size:13px;color:var(--text)">${s.label}</span></h4>
          <p>${s.note}</p>
        </div>
        <div class="w-go">›</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.week-item').forEach(item => {
    item.addEventListener('click', () => {
      const s = dayModule(parseInt(item.dataset.day, 10));
      if (s.module === 'X') return;
      if (s.module === 'R') startRecovery(30);
      else startSession(s.module, s.label);
    });
  });
}

/* ================= 动作库视图 ================= */
let exTab = 'A';
function renderEx() {
  const tabs = document.getElementById('ex-tabs');
  tabs.innerHTML = ['A', 'B', 'C', 'D'].map(m => `
    <button class="ex-tab ${exTab === m ? 'active' : ''}" data-m="${m}" style="${exTab === m ? 'background:linear-gradient(135deg,' + MODULES[m].color + ',' + MODULES[m].color + ')' : ''}">
      <span class="et-letter">${m}</span><span>${MODULES[m].name}</span>
    </button>`).join('');
  tabs.querySelectorAll('.ex-tab').forEach(t => t.addEventListener('click', () => {
    exTab = t.dataset.m;
    renderEx();
  }));

  const mod = MODULES[exTab];
  const el = document.getElementById('ex-list');
  el.innerHTML = EXERCISES[exTab].map((ex, i) => `
    <div class="ex-item">
      <div class="ex-num" style="background:${mod.color}">${i + 1}</div>
      <div><h4>${ex.name}</h4><p>${ex.tip}</p></div>
    </div>`).join('') +
    `<div class="progress-note">📈 ${mod.progression}</div>`;
}

/* ================= 周期视图 ================= */
function renderCycle() {
  const wk = weekInfo();
  const cw = currentWeek();
  const el = document.getElementById('cycle-card');
  el.innerHTML = `
    <div class="cycle-card" style="background:linear-gradient(135deg,#F0C25C,#D9A83B)">
      <h3>第 ${cw} 周 · ${wk.theme}</h3>
      <div class="cc-sub">4 周循环 · 当前所处阶段</div>
      <div class="cc-meta">
        <span>工作 ${wk.work}s</span><span>休息 ${wk.rest}s</span><span>${wk.rounds} 轮</span>
      </div>
    </div>`;
  document.getElementById('cycle-table').innerHTML = CYCLE.map(c => `
    <div class="cycle-row ${c.w === cw ? 'current' : ''}">
      <div class="cr-w">第 ${c.w} 周</div>
      <div class="cr-info"><h4>${c.theme}</h4><p>${c.load}</p></div>
      <div class="cr-ratio">${c.work}s:${c.rest}s</div>
    </div>`).join('');

  document.getElementById('competition-tips').innerHTML = COMPETITION_TIPS.map(t => `<li>${t}</li>`).join('');
  document.getElementById('tips-list').innerHTML = TIPS.map(t => `
    <div class="tip-item"><div class="t-ico">${t.icon}</div>
      <div><h4>${t.title}</h4><p>${t.text}</p></div>
    </div>`).join('');
}

/* ================= 记录视图 ================= */
function renderLog() {
  const now = new Date();
  const wkStart = mondayOf(todayKey());
  const wkEnd = addDays(wkStart, 6);
  const weekCount = logs.filter(l => l.date >= wkStart && l.date <= wkEnd).length;
  const totalCount = logs.length;
  const streak = calcStreak();
  document.getElementById('log-stats').innerHTML = `
    <div class="stat-card"><div class="s-num">${weekCount}</div><div class="s-label">本周训练</div></div>
    <div class="stat-card"><div class="s-num">${totalCount}</div><div class="s-label">累计训练</div></div>
    <div class="stat-card"><div class="s-num">${streak}</div><div class="s-label">连续天数</div></div>`;

  const el = document.getElementById('log-list');
  if (!logs.length) {
    el.innerHTML = `<div class="log-empty">还没有训练记录<br>完成一次循环后会自动记录在这里</div>`;
    return;
  }
  el.innerHTML = [...logs].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')).map((l, i) => {
    const label = l.label || '';
    return `
      <div class="log-item" data-i="${i}">
        <div class="li-top">
          <h4>${moduleChip(l.module || 'X', label)} <span style="font-size:13px;color:var(--text)">${l.version} 分钟版</span></h4>
          <span class="li-date">${fmtShort(l.date)} ${l.time || ''}</span>
        </div>
        <div class="li-meta">
          <span>🔁 ${l.rounds || 0} 轮</span>
          <span>动作 ×${l.exCount || 0}</span>
          <span>⏱ ${l.durationMin || 0} 分钟</span>
          ${l.cutCount ? `<span>⚔ 劈砍 ${l.cutCount} 次/30s</span>` : ''}
        </div>
        ${l.note ? `<div class="li-note">📝 ${l.note}</div>` : ''}
        <button class="li-del" data-del="${i}">删除</button>
      </div>`;
  }).join('');

  el.querySelectorAll('.li-del').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (btn.dataset.confirm) {
      const i = parseInt(btn.dataset.del, 10);
      const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
      const log = sorted[i];
      const realIdx = logs.indexOf(log);
      if (realIdx >= 0) logs.splice(realIdx, 1);
      saveLogs();
      renderLog();
    } else {
      btn.dataset.confirm = '1';
      btn.textContent = '确认删除?';
      setTimeout(() => { if (btn.dataset.confirm) { delete btn.dataset.confirm; btn.textContent = '删除'; } }, 3000);
    }
  }));
}

function calcStreak() {
  if (!logs.length) return 0;
  const done = new Set(logs.map(l => l.date));
  let streak = 0;
  let day = todayKey();
  if (!done.has(day)) day = addDays(day, -1); // 今天还没练,从昨天起算
  while (done.has(day)) { streak++; day = addDays(day, -1); }
  return streak;
}

/* ================= 计时器流程 ================= */
const RING_C = 741.4;
const PHASE_COLOR = {
  prep: '#D9A83B', warmup: '#4C8DFF', work: '#E4572E',
  rest: '#2A9D8F', roundrest: '#2A9D8F', cooldown: '#8E6FC9', done: '#58C47A'
};
const PHASE_TEXT = {
  prep: '准备', warmup: '热身', work: '训练', rest: '休息',
  roundrest: '轮间休息', cooldown: '冷身', done: '完成'
};

function openTimer() {
  document.getElementById('timer-overlay').hidden = false;
  cancelArmed = false;
}
function closeTimer() {
  document.getElementById('timer-overlay').hidden = true;
}

function startSession(module, label) {
  if (timer) { timer.cancel(); timer = null; }
  const wk = weekInfo();
  const session = buildSession({ module, version: settings.version, week: currentWeek() });
  activeSession = { module, label, version: settings.version, startTs: Date.now() };
  openTimer();
  timer = new CircuitTimer({
    onPhase: onTimerPhase,
    onTick: onTimerTick,
    onFinish: onTimerFinish,
    onCancel: () => { closeTimer(); }
  });
  timer.start(session, { sound: settings.sound, voice: settings.voice });
  const cancelBtn = document.getElementById('timer-cancel');
  cancelBtn.dataset.orig = cancelBtn.innerHTML;
  cancelBtn.onclick = () => {
    if (!cancelArmed) {
      cancelArmed = true;
      cancelBtn.style.color = '#E4572E';
      cancelBtn.innerHTML = '再按一次退出';
      cancelBtn.style.fontSize = '12px';
      cancelBtn.style.fontWeight = '700';
      setTimeout(() => {
        cancelArmed = false;
        cancelBtn.style.color = '';
        cancelBtn.innerHTML = cancelBtn.dataset.orig || '';
        cancelBtn.style.fontSize = '';
        cancelBtn.style.fontWeight = '';
      }, 4000);
      return;
    }
    if (timer) timer.cancel();
    closeTimer();
  };
}

function startMinimum() {
  const steps = [
    { index: 0, phase: 'prep', label: '准备', tip: '调整呼吸', dur: 5 },
    ...MINIMUM_SESSION.map((m, i) => ({
      index: i + 1, phase: 'work', label: m.name, tip: m.tip, dur: m.dur, round: 1, totalRounds: 1, exIndex: i
    })),
    { index: MINIMUM_SESSION.length + 1, phase: 'done', label: '训练完成', tip: '宁短勿缺,质量优先!', dur: 0 }
  ];
  activeSession = { module: 'MIN', label: '保底训练', version: 0, startTs: Date.now() };
  openTimer();
  timer = new CircuitTimer({
    onPhase: onTimerPhase, onTick: onTimerTick, onFinish: onTimerFinish,
    onCancel: () => closeTimer()
  });
  timer.start({ steps }, { sound: settings.sound, voice: settings.voice });
}

function startRecovery(minutes) {
  if (timer) { timer.cancel(); timer = null; }
  const session = buildSimpleSession('慢走 / 骑行 / 游泳', minutes * 60, '主动恢复:低强度有氧,心率保持在能聊天的程度');
  activeSession = { module: 'R', label: '主动恢复', version: 0, startTs: Date.now() };
  openTimer();
  timer = new CircuitTimer({
    onPhase: onTimerPhase, onTick: onTimerTick, onFinish: onTimerFinish,
    onCancel: () => closeTimer()
  });
  timer.start(session, { sound: settings.sound, voice: settings.voice });
}

function onTimerPhase(step) {
  const phaseEl = document.getElementById('timer-phase');
  phaseEl.textContent = PHASE_TEXT[step.phase] || '';
  phaseEl.className = 'timer-phase phase-' + step.phase;
  document.getElementById('timer-label').textContent = step.label;
  document.getElementById('timer-tip').textContent = step.tip || '';
  const roundEl = document.getElementById('timer-round');
  roundEl.textContent = step.round ? `第 ${step.round} / ${step.totalRounds} 轮` : '';
  const ring = document.getElementById('ring-progress');
  ring.style.stroke = PHASE_COLOR[step.phase] || '#D9A83B';
  if (navigator.vibrate && step.phase === 'work') { try { navigator.vibrate(90); } catch (e) {} }
  renderDots();
}

function onTimerTick(step, rem) {
  document.getElementById('timer-time').textContent = fmtClock(rem);
  const stepDur = step.dur * 1000;
  const frac = stepDur > 0 ? Math.max(0, Math.min(1, rem / stepDur)) : 0;
  document.getElementById('ring-progress').style.strokeDashoffset = RING_C * (1 - frac);
  document.getElementById('timer-bar-fill').style.width = (timer.progress * 100).toFixed(1) + '%';
}

function renderDots() {
  const dotsEl = document.getElementById('timer-dots');
  if (!timer) return;
  const workSteps = timer.steps.filter(s => s.phase === 'work');
  if (!workSteps.length) { dotsEl.innerHTML = ''; return; }
  const cur = timer.current;
  const curIdx = cur && cur.phase === 'work' ? workSteps.indexOf(cur) : (cur && cur.phase === 'rest' ? workSteps.indexOf(cur) + 1 : workSteps.filter(s => s.index <= timer.idx).length);
  dotsEl.innerHTML = workSteps.map((s, i) =>
    `<span class="t-dot ${i < curIdx ? 'passed' : i === curIdx ? 'current' : ''}"></span>`).join('');
}

function onTimerFinish(summary) {
  const sec = Math.round((Date.now() - activeSession.startTs) / 1000);
  const dur = Math.max(1, Math.round(sec / 60));
  document.getElementById('finish-summary').textContent =
    `${activeSession.label || ''} · ${summary.rounds} 轮 × ${summary.exCount} 动作 · 实际 ${dur} 分钟`;
  document.getElementById('finish-cut').value = '';
  document.getElementById('finish-note').value = '';
  document.getElementById('finish-modal').hidden = false;
  finishPending = {
    module: activeSession.module,
    label: activeSession.label,
    version: activeSession.version,
    rounds: summary.rounds,
    exCount: summary.exCount,
    workSeconds: summary.workSeconds,
    durationMin: dur
  };
}

function saveFinish() {
  const cut = parseInt(document.getElementById('finish-cut').value, 10) || null;
  const note = document.getElementById('finish-note').value.trim();
  logs.push(Object.assign({
    date: todayKey(), time: nowHM(), cutCount: cut, note: note
  }, finishPending));
  saveLogs();
  document.getElementById('finish-modal').hidden = true;
  finishPending = null;
  renderToday();
  switchView('log');
}

/* ================= 设置 ================= */
function openSettings() {
  document.getElementById('settings-modal').hidden = false;
  syncSettingUI();
}
function syncSettingUI() {
  document.querySelectorAll('#set-version button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.v, 10) === settings.version));
  document.querySelectorAll('#set-sound button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.v, 10) === (settings.sound ? 1 : 0)));
  document.querySelectorAll('#set-voice button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.v, 10) === (settings.voice ? 1 : 0)));
  document.getElementById('set-cycle-start').value = settings.cycleStart;
}
function bindSettings() {
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-modal').hidden = true;
    renderToday();
    renderCycle();
  });
  document.querySelectorAll('#set-version button').forEach(b => b.addEventListener('click', () => {
    settings.version = parseInt(b.dataset.v, 10); saveSettings(); syncSettingUI();
  }));
  document.querySelectorAll('#set-sound button').forEach(b => b.addEventListener('click', () => {
    settings.sound = b.dataset.v === '1'; saveSettings(); syncSettingUI();
  }));
  document.querySelectorAll('#set-voice button').forEach(b => b.addEventListener('click', () => {
    settings.voice = b.dataset.v === '1'; saveSettings(); syncSettingUI();
  }));
  document.getElementById('set-cycle-start').addEventListener('change', (e) => {
    settings.cycleStart = e.target.value || todayKey();
    settings.cycleOverride = null;
    saveSettings();
  });
  document.getElementById('set-reset').addEventListener('click', () => {
    if (window.confirm('确定清空全部训练记录?此操作不可恢复。')) {
      logs = [];
      saveLogs();
      renderLog();
      document.getElementById('settings-modal').hidden = true;
    }
  });
}

/* ================= 计时器按钮 ================= */
function bindTimerControls() {
  document.getElementById('timer-skip').addEventListener('click', () => { if (timer) timer.skip(); });
  document.getElementById('timer-pause').addEventListener('click', () => {
    if (!timer) return;
    const btn = document.getElementById('timer-pause');
    if (timer.paused) { timer.resume(); btn.textContent = '暂停'; }
    else { timer.pause(); btn.textContent = '继续'; }
  });
  document.getElementById('finish-save').addEventListener('click', saveFinish);
  document.getElementById('finish-close').addEventListener('click', () => {
    document.getElementById('finish-modal').hidden = true;
    finishPending = null;
    renderToday();
  });
}

/* ================= 启动 ================= */
function init() {
  bindTabs();
  bindSettings();
  bindTimerControls();
  renderToday();
  renderWeek();
  renderEx();
  renderCycle();
  renderLog();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 防止计时器运行时屏幕旋转/锁屏干扰
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer && !timer.paused) {
      // 切后台时暂停,避免计时漂移
      timer.pause();
      const btn = document.getElementById('timer-pause');
      if (btn) btn.textContent = '继续';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
