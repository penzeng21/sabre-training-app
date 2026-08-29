/*
 * 循环训练计时器引擎
 * 根据当前周期周自动生成流程:准备 → 热身 → 循环动作 × 轮数(组间休息) → 冷身 → 完成
 * 特性:倒计时防漂移(performance.now)、Web Audio 提示音、可选语音播报、屏幕常亮
 */
'use strict';

/* ---------- 音频:提示音 ---------- */
let _audioCtx = null;
function ensureAudio() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _audioCtx = null; }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}
function beep(freq, dur, delay = 0, type = 'sine', vol = 0.32) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function playPhaseSound(phase) {
  switch (phase) {
    case 'prep':      beep(660, 0.12); break;
    case 'warmup':    beep(520, 0.15); break;
    case 'work':      beep(880, 0.15); beep(880, 0.15, 0.22); break;
    case 'rest':
    case 'roundrest': beep(440, 0.22); break;
    case 'cooldown':  beep(660, 0.15); beep(520, 0.15, 0.25); break;
    case 'done':      beep(880, 0.15); beep(660, 0.15, 0.2); beep(880, 0.25, 0.4); break;
  }
}
function playWarning() { beep(1200, 0.08); }

/* ---------- 语音播报 ---------- */
let _voiceQueue = '';
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 1.05; u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { /* 忽略语音失败 */ }
}

/* ---------- 训练计划生成 ---------- */
function buildSession(conf) {
  const week = CYCLE[conf.week - 1];
  const steps = [];
  const push = (s) => steps.push(Object.assign({ index: steps.length }, s));

  push({ phase: 'prep', label: '准备', tip: '调整呼吸,准备开始', dur: 5 });

  // 热身
  const warmup = conf.version === 60 ? WARMUP_60 : WARMUP_30;
  warmup.forEach(w => push({ phase: 'warmup', label: w.name, tip: '热身 · 动态活动', dur: w.dur }));

  // 循环主训练
  let exercises;
  if (conf.module === 'AC') exercises = AC_COMBINED;
  else exercises = EXERCISES[conf.module].slice(0, conf.version === 60 ? 6 : 5);

  const rounds = conf.version === 60 ? week.rounds : 2;
  let workTotal = 0;
  for (let r = 1; r <= rounds; r++) {
    exercises.forEach((ex, i) => {
      const isLastStep = r === rounds && i === exercises.length - 1;
      workTotal += week.work;
      push({
        phase: 'work', label: ex.name, tip: ex.tip, dur: week.work,
        round: r, totalRounds: rounds, exIndex: i
      });
      if (!isLastStep) {
        const next = exercises[i + 1];
        const tip = next ? `下一项:${next.name}` : `第 ${r + 1} 轮即将开始`;
        push({ phase: 'rest', label: '休息', tip, dur: week.rest, round: r, totalRounds: rounds });
      }
    });
    if (r < rounds) push({ phase: 'roundrest', label: '轮间休息', tip: `第 ${r + 1} 轮即将开始`, dur: ROUND_REST });
  }

  // 冷身
  const cool = conf.version === 60 ? COOLDOWN_60 : COOLDOWN_30;
  cool.forEach(c => push({ phase: 'cooldown', label: c.name, tip: '冷身 · 静态拉伸', dur: c.dur }));

  push({ phase: 'done', label: '训练完成', tip: '干得漂亮!记得补充蛋白质 + 碳水', dur: 0 });
  return { steps, rounds, exCount: exercises.length, workTotal };
}

/* 简单倒计时(主动恢复日使用) */
function buildSimpleSession(label, dur, tip) {
  const steps = [
    { index: 0, phase: 'prep', label: '准备', tip: '调整呼吸', dur: 3 },
    { index: 1, phase: 'warmup', label, tip: tip || '', dur },
    { index: 2, phase: 'done', label: '完成', tip: '恢复日结束,注意补水拉伸', dur: 0 }
  ];
  return { steps, rounds: 1, exCount: 1, workTotal: dur };
}

/* ---------- 计时器 ---------- */
class CircuitTimer {
  constructor(callbacks) {
    this.cb = callbacks || {};
    this.steps = [];
    this.idx = -1;
    this.remaining = 0;
    this.endAt = 0;
    this.paused = false;
    this._timer = null;
    this._warned = false;
    this._wakeLock = null;
  }

  start(session, settings) {
    this.settings = settings || {};
    this.steps = session.steps;
    this.idx = -1;
    this._requestWakeLock();
    this._advance();
    this._timer = setInterval(() => this._tick(), 200);
  }

  _tick() {
    if (this.paused) return;
    const rem = Math.max(0, this.endAt - performance.now());
    this.remaining = rem;
    const step = this.steps[this.idx];
    if (this.cb.onTick) this.cb.onTick(step, rem);
    // 最后 3 秒警告
    if (rem <= 3000 && !this._warned && step.dur > 5) {
      this._warned = true;
      playWarning();
    }
    if (rem <= 0) this._advance();
  }

  _advance() {
    this.idx++;
    if (this.idx >= this.steps.length) { this._finish(); return; }
    const step = this.steps[this.idx];
    this._warned = false;
    if (step.phase === 'done') {
      // done 步骤短暂展示后自动结束
      this.endAt = performance.now() + 1500;
      if (this.cb.onPhase) this.cb.onPhase(step);
      this._announce(step);
      return;
    }
    this.endAt = performance.now() + step.dur * 1000;
    this.remaining = step.dur * 1000;
    if (this.cb.onPhase) this.cb.onPhase(step);
    this._announce(step);
  }

  _announce(step) {
    playPhaseSound(step.phase);
    if (!this.settings.sound && step.phase === 'work') return; // 静音时仅保留基本提示
    if (this.settings.voice) {
      if (step.phase === 'work') {
        const roundTxt = step.totalRounds > 1 ? `第 ${step.round} 轮 ` : '';
        speak(`${roundTxt}开始:${step.label}`);
      } else if (step.phase === 'rest') speak('休息');
      else if (step.phase === 'roundrest') speak('轮间休息');
      else if (step.phase === 'done') speak('训练完成');
      else if (step.phase === 'warmup') speak(step.label);
      else if (step.phase === 'cooldown') speak(step.label);
    }
  }

  _finish() {
    clearInterval(this._timer);
    this._timer = null;
    this._releaseWakeLock();
    if (this.cb.onFinish) this.cb.onFinish(this._summary());
  }

  skip() {
    if (this.idx < 0 || this.paused) return;
    clearInterval(this._timer);
    this._advance();
    this._timer = setInterval(() => this._tick(), 200);
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    clearInterval(this._timer);
    this._timer = null;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.endAt = performance.now() + this.remaining;
    this._timer = setInterval(() => this._tick(), 200);
  }

  cancel() {
    clearInterval(this._timer);
    this._timer = null;
    this._releaseWakeLock();
    if (this.cb.onCancel) this.cb.onCancel();
  }

  _summary() {
    const workSteps = this.steps.filter(s => s.phase === 'work');
    const doneIdx = Math.min(this.idx, this.steps.length - 1);
    return {
      module: this.steps[1] && this.steps[1].phase === 'warmup' ? null : null,
      rounds: workSteps.length ? workSteps[workSteps.length - 1].round : 0,
      exCount: workSteps.length,
      workSeconds: workSteps.length * (this.settings.work || 30),
      totalSteps: this.steps.length,
      reached: doneIdx
    };
  }

  async _requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* 不支持则忽略 */ }
  }
  _releaseWakeLock() {
    if (this._wakeLock) { try { this._wakeLock.release(); } catch (e) {} this._wakeLock = null; }
  }

  get current() { return this.steps[this.idx] || null; }
  get progress() { return this.steps.length ? (this.idx + 1) / this.steps.length : 0; }
}

/* ---------- 工具 ---------- */
function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}`;
}
function fmtClock(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
