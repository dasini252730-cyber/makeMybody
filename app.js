'use strict';

/* =====================================================================
   1. DATA MODEL
   ===================================================================== */

const ROUTINE = {
  name: '전신 순환 트레이닝',
  frequency: '주 3~4회',
  warmup: [
    { id: 'march', name: '제자리 걷기/스텝터치', animClass: 'ex-march', type: 'time', durationSec: 120 },
    { id: 'armcircle', name: '팔 돌리기, 골반 돌리기', animClass: 'ex-armcircle', type: 'time', durationSec: 30 },
    { id: 'squat-warmup', name: '스쿼트 자세', animClass: 'ex-squat', type: 'reps', reps: 10, sets: 1 }
  ],
  main: [
    { id: 'squat', name: '스쿼트', animClass: 'ex-squat', type: 'reps', category: 'bodyweight', sets: 3 },
    { id: 'lunge', name: '런지 (좌우 번갈아)', animClass: 'ex-lunge', type: 'reps', category: 'bodyweight', sets: 3 },
    { id: 'pushup', name: '푸시업', animClass: 'ex-pushup', type: 'reps', category: 'pushup', sets: 3 },
    { id: 'glutebridge', name: '글루트 브릿지', animClass: 'ex-glutebridge', type: 'reps', category: 'bodyweight', sets: 3 },
    { id: 'plank', name: '플랭크', animClass: 'ex-plank', type: 'time', category: 'time', sets: 3 },
    { id: 'shoulder', name: '숄더프레스 / 로우', animClass: 'ex-shoulder', type: 'reps', category: 'weighted', sets: 3 }
  ],
  tabataOptions: [
    { id: 'burpee', name: '버피', animClass: 'ex-burpee' },
    { id: 'mountainclimber', name: '마운틴클라이머', animClass: 'ex-mountainclimber' },
    { id: 'jumpingjack', name: '점핑잭', animClass: 'ex-jumpingjack' }
  ],
  tabata: { workSec: 30, restSec: 15, rounds: 7 },
  cooldown: [
    { id: 'stretch', name: '쿨다운 스트레칭', animClass: 'ex-stretch', type: 'time', durationSec: 300 }
  ]
};

const TIPS = {
  squat: { breath: '앉을 때 코로 들이마시고, 일어설 때 입으로 내쉬기', form: '무릎이 발끝보다 앞으로 나가지 않게, 시선은 정면, 무게중심은 발뒤꿈치' },
  lunge: { breath: '내려갈 때 들이마시고, 올라올 때 내쉬기', form: '앞무릎이 발끝 넘지 않게, 상체는 세운 상태 유지, 뒷무릎은 바닥 살짝 앞에서 멈춤' },
  pushup: { breath: '내려갈 때 들이마시고, 밀어 올릴 때 내쉬기', form: '팔꿈치는 몸통에서 45도, 허리 처지지 않게 코어 긴장 유지' },
  glutebridge: { breath: '골반 들어올릴 때 내쉬며 둔근에 힘주기, 내려갈 때 들이마시기', form: '허리로 밀어올리지 말고 엉덩이 힘으로, 정점에서 1초 멈춰서 둔근 수축 느끼기' },
  plank: { breath: '자세 유지하는 동안 자연스럽게 호흡 지속 (숨 참지 않기)', form: '엉덩이 너무 높거나 처지지 않게 일직선 유지, 어깨는 손목 바로 위' },
  shoulder: { breath: '밀어 올리거나 당길 때 내쉬고, 제자리로 돌아올 때 들이마시기', form: '어깨 으쓱 올라가지 않게, 허리 과도하게 젖히지 않기' }
};

const PHASE_LABEL = { warmup: '워밍업', main: '본운동', tabata: '마무리 유산소 (타바타)', cooldown: '쿨다운' };

/* =====================================================================
   2. STORAGE
   ===================================================================== */

const STORAGE_KEYS = {
  sessions: 'htt_sessions',
  settings: 'htt_settings',
  goal: 'htt_goal',
  exerciseState: 'htt_exercise_state',
  draft: 'htt_draft_session'
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* storage full or unavailable - ignore */ }
}

function getSessions() { return readJSON(STORAGE_KEYS.sessions, []); }
function saveSessions(list) { writeJSON(STORAGE_KEYS.sessions, list); }

function defaultSettings() {
  return { restSeconds: 30, soundOn: true, tabataEnabled: true, tabataExercise: 'jumpingjack' };
}
function getSettings() { return Object.assign(defaultSettings(), readJSON(STORAGE_KEYS.settings, {})); }
function saveSettings(s) { writeJSON(STORAGE_KEYS.settings, s); }

function getGoal() { return readJSON(STORAGE_KEYS.goal, null); }
function saveGoal(g) { writeJSON(STORAGE_KEYS.goal, g); }

function defaultExerciseState() {
  return {
    squat: { repsLow: 12, repsHigh: 15 },
    lunge: { repsLow: 12, repsHigh: 15 },
    pushup: { repsLow: 12, repsHigh: 15, kneeAssist: true },
    glutebridge: { repsLow: 12, repsHigh: 15 },
    plank: { seconds: 30 },
    shoulder: { repsLow: 12, repsHigh: 15, weightKg: 2 }
  };
}
function getExerciseState() {
  return Object.assign(defaultExerciseState(), readJSON(STORAGE_KEYS.exerciseState, {}));
}
function saveExerciseState(s) { writeJSON(STORAGE_KEYS.exerciseState, s); }

function getDraft() { return readJSON(STORAGE_KEYS.draft, null); }
function saveDraftNow() {
  writeJSON(STORAGE_KEYS.draft, {
    savedAt: Date.now(),
    sessionStartTime,
    currentStepIndex,
    sessionExerciseLog
  });
}
function clearDraft() { localStorage.removeItem(STORAGE_KEYS.draft); }

/* =====================================================================
   3. UTILITIES
   ===================================================================== */

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function formatDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function dateKeyLocal(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // move to Monday
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatDateHuman(iso) {
  const d = new Date(iso);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + weekday + ')';
}

let toastTimer = null;
function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function showConfirm(text, onConfirm) {
  const modal = $('#confirm-modal');
  $('#confirm-modal-text').textContent = text;
  modal.hidden = false;
  const okBtn = $('#confirm-modal-ok');
  const cancelBtn = $('#confirm-modal-cancel');
  function cleanup() {
    modal.hidden = true;
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
  }
  function onOk() { cleanup(); onConfirm(); }
  function onCancel() { cleanup(); }
  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
}

/* Sound feedback via WebAudio (no external files needed) */
let audioCtx = null;
function beep(freq, durationMs) {
  const settings = getSettings();
  if (!settings.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch (e) { /* audio unavailable - ignore */ }
}
function feedbackSetDone() { beep(880, 220); vibrate(80); }
function feedbackRestDone() { beep(660, 300); vibrate([60, 60, 60]); }
function vibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

/* Wake Lock API - best effort, ignore if unsupported */
let wakeLockSentinel = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
  } catch (e) { /* ignore - not supported or denied */ }
}
function releaseWakeLock() {
  if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentScreen === 'workout') requestWakeLock();
});

/* =====================================================================
   4. PROGRESSIVE OVERLOAD SUGGESTION LOGIC (pure functions, spec 3.5)
   ===================================================================== */

function getRecentTwo(exerciseId, sessions) {
  const sorted = sessions.slice().sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
  const matches = [];
  for (const s of sorted) {
    const ex = (s.exercises || []).find(e => e.id === exerciseId && !e.skipped);
    if (ex) matches.push({ rpe: s.rpe, ex });
    if (matches.length === 2) break;
  }
  return matches;
}

function suggestionMessageFor(exerciseId, exState) {
  const meta = ROUTINE.main.find(e => e.id === exerciseId);
  if (!meta) return '';
  if (meta.category === 'weighted') return '무게를 1~2kg 올려보세요';
  if (meta.category === 'pushup') {
    return exState.pushup.kneeAssist ? '무릎 떼고 시도해보세요' : '횟수를 15~18회로 늘리거나, 템포를 늦춰보세요';
  }
  if (meta.category === 'bodyweight') return '횟수를 15~18회로 늘리거나, 템포를 늦춰보세요';
  if (meta.category === 'time') return '시간을 35~40초로 늘려보세요';
  return '';
}

// Returns { message } or null. Pure rule-based, no external calls.
function checkProgressiveOverloadSuggestion(exerciseId, sessions, exState) {
  const recent = getRecentTwo(exerciseId, sessions);
  if (recent.length < 2) return null;
  const bothFull = recent.every(r => r.ex.fullyCompleted);
  const rpeOk = recent.every(r => typeof r.rpe === 'number' && r.rpe >= 1 && r.rpe <= 3);
  if (bothFull && rpeOk) {
    return { message: suggestionMessageFor(exerciseId, exState) };
  }
  return null;
}

function applyProgressiveOverload(exerciseId) {
  const exState = getExerciseState();
  const meta = ROUTINE.main.find(e => e.id === exerciseId);
  if (!meta) return;
  if (meta.category === 'weighted') {
    exState[exerciseId].weightKg = Math.round((exState[exerciseId].weightKg + 1.5) * 10) / 10;
  } else if (meta.category === 'pushup') {
    if (exState.pushup.kneeAssist) {
      exState.pushup.kneeAssist = false;
    } else {
      exState.pushup.repsLow = 15; exState.pushup.repsHigh = 18;
    }
  } else if (meta.category === 'bodyweight') {
    exState[exerciseId].repsLow = 15; exState[exerciseId].repsHigh = 18;
  } else if (meta.category === 'time') {
    exState.plank.seconds = Math.min(40, exState.plank.seconds + 5);
  }
  saveExerciseState(exState);
}

/* =====================================================================
   5. DERIVED STATS
   ===================================================================== */

function computeWeekCount(sessions) {
  const start = startOfWeek(new Date());
  return sessions.filter(s => new Date(s.dateISO) >= start).length;
}

function computeStreak(sessions) {
  const days = new Set(sessions.map(s => dateKeyLocal(s.dateISO)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dateKeyLocal(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dateKeyLocal(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* =====================================================================
   6. WORKOUT SESSION STATE MACHINE
   ===================================================================== */

let currentQueue = [];
let currentStepIndex = 0;
let sessionStartTime = null;
let sessionExerciseLog = {};
let timerInterval = null;
let stepResolved = false;
let uiMode = 'exercise'; // 'exercise' | 'rest'
let workoutInProgress = false;
let pendingCompleteDurationSec = 0;
let selectedRpe = null;

function buildQueue(settings) {
  const steps = [];
  ROUTINE.warmup.forEach(w => steps.push({ phase: 'warmup', exercise: w, setIndex: 1, setTotal: 1 }));
  ROUTINE.main.forEach(ex => {
    for (let s = 1; s <= ex.sets; s++) steps.push({ phase: 'main', exercise: ex, setIndex: s, setTotal: ex.sets });
  });
  if (settings.tabataEnabled) {
    const chosen = ROUTINE.tabataOptions.find(t => t.id === settings.tabataExercise) || ROUTINE.tabataOptions[2];
    for (let r = 1; r <= ROUTINE.tabata.rounds; r++) {
      steps.push({ phase: 'tabata', exercise: chosen, setIndex: r, setTotal: ROUTINE.tabata.rounds, timeSec: ROUTINE.tabata.workSec });
    }
  }
  ROUTINE.cooldown.forEach(c => steps.push({ phase: 'cooldown', exercise: c, setIndex: 1, setTotal: 1 }));
  return steps;
}

function initLogFor(step) {
  const ex = step.exercise;
  const exState = getExerciseState();
  const log = { id: ex.id, name: ex.name, setsCompleted: 0, setsTarget: step.setTotal, skipped: false };
  if (step.phase === 'main') {
    const st = exState[ex.id];
    if (ex.category === 'weighted') log.weightKg = st.weightKg;
    if (ex.category === 'pushup') { log.repsLow = st.repsLow; log.repsHigh = st.repsHigh; log.kneeAssist = st.kneeAssist; }
    if (ex.category === 'bodyweight') { log.repsLow = st.repsLow; log.repsHigh = st.repsHigh; }
    if (ex.category === 'time') { log.seconds = st.seconds; }
  }
  return log;
}

function startWorkout() {
  const settings = getSettings();
  currentQueue = buildQueue(settings);
  currentStepIndex = 0;
  sessionStartTime = Date.now();
  sessionExerciseLog = {};
  selectedRpe = null;
  workoutInProgress = true;
  clearDraft();
  goToScreen('workout');
  renderWorkoutStep();
  requestWakeLock();
}

function currentStep() { return currentQueue[currentStepIndex]; }

function targetLineText(step) {
  const ex = step.exercise;
  const exState = getExerciseState();
  if (step.phase === 'main') {
    const st = exState[ex.id];
    if (ex.category === 'weighted') return `목표: ${st.repsLow}~${st.repsHigh}회 · ${st.weightKg}kg`;
    if (ex.category === 'pushup') return `목표: ${st.repsLow}~${st.repsHigh}회` + (st.kneeAssist ? ' (무릎 대고)' : ' (무릎 떼고)');
    if (ex.category === 'bodyweight') return `목표: ${st.repsLow}~${st.repsHigh}회`;
    if (ex.category === 'time') return `목표: ${st.seconds}초 유지`;
  }
  if (step.phase === 'tabata') return `운동 ${ROUTINE.tabata.workSec}초 · ${step.setIndex}/${step.setTotal}라운드`;
  if (ex.type === 'time') return `목표 시간: ${formatDuration(ex.durationSec)}`;
  if (ex.type === 'reps') return `목표: ${ex.reps}회`;
  return '';
}

function tipTextFor(step) {
  if (step.phase === 'main' && TIPS[step.exercise.id]) {
    return TIPS[step.exercise.id];
  }
  const generic = {
    warmup: { breath: '편안하게 호흡하며 몸을 가볍게 풀어주세요', form: '무리하지 않는 범위에서 관절을 부드럽게 움직여요' },
    tabata: { breath: '숨이 가빠도 괜찮아요, 가능한 범위에서 최선을 다해보세요', form: '착지할 때 무릎에 힘이 너무 들어가지 않게 주의하세요' },
    cooldown: { breath: '늘리는 동안 천천히 길게 숨을 내쉬세요', form: '통증이 느껴질 만큼 무리해서 당기지 마세요' }
  };
  return generic[step.phase] || { breath: '-', form: '-' };
}

function timerSecondsFor(step) {
  const ex = step.exercise;
  const exState = getExerciseState();
  if (step.phase === 'tabata') return step.timeSec;
  if (step.phase === 'main' && ex.category === 'time') return exState.plank.seconds;
  if (ex.type === 'time') return ex.durationSec;
  return null;
}

function renderWorkoutStep() {
  uiMode = 'exercise';
  stepResolved = false;
  clearInterval(timerInterval);
  timerInterval = null;

  const step = currentStep();
  const ex = step.exercise;

  $('#workout-progress-bar').style.width = Math.round((currentStepIndex / currentQueue.length) * 100) + '%';
  $('#workout-phase-label').textContent = PHASE_LABEL[step.phase];
  $('#workout-exercise-name').textContent = ex.name;
  $('#workout-set-label').textContent = step.setTotal > 1
    ? `${step.setIndex} / ${step.setTotal}${step.phase === 'tabata' ? '라운드' : '세트'}`
    : '';
  $('#workout-set-label').hidden = step.setTotal <= 1;

  const stickman = $('#stickman');
  stickman.setAttribute('class', 'stickman ' + ex.animClass);

  $('#workout-target').textContent = targetLineText(step);

  const tip = tipTextFor(step);
  $('#tip-breath').innerHTML = `<strong>호흡:</strong> ${tip.breath}`;
  $('#tip-form').innerHTML = `<strong>신경 쓸 부위:</strong> ${tip.form}`;

  $('#btn-skip').hidden = false;
  $('#btn-skip').textContent = '건너뛰기';
  $('#btn-complete-set').textContent = '완료';

  const secs = timerSecondsFor(step);
  const timerWrap = $('#timer-wrap');
  if (secs != null) {
    timerWrap.hidden = false;
    $('#timer-label').textContent = '세트 진행';
    runCountdown(secs, {
      onTick: (remaining) => {
        $('#timer-value').textContent = formatDuration(remaining);
        $('#timer-value').classList.toggle('urgent', remaining <= 5);
      },
      onDone: () => {
        feedbackSetDone();
        completeCurrentStep();
      }
    });
  } else {
    timerWrap.hidden = true;
  }

  renderSuggestionBadge(step);
  saveDraftNow();
}

function renderSuggestionBadge(step) {
  const badge = $('#suggestion-badge');
  if (step.phase !== 'main' || step.setIndex !== 1) { badge.hidden = true; return; }
  const exState = getExerciseState();
  const suggestion = checkProgressiveOverloadSuggestion(step.exercise.id, getSessions(), exState);
  if (!suggestion) { badge.hidden = true; return; }
  badge.hidden = false;
  $('#suggestion-text').textContent = `지난 2회 연속 목표를 다 채우셨네요! ${suggestion.message}`;
  $('#btn-suggestion-accept').onclick = () => {
    applyProgressiveOverload(step.exercise.id);
    badge.hidden = true;
    $('#workout-target').textContent = targetLineText(step);
    showToast('새 목표가 적용됐어요. 오늘부터 도전해보세요!');
  };
  $('#btn-suggestion-decline').onclick = () => { badge.hidden = true; };
}

function runCountdown(totalSeconds, { onTick, onDone }) {
  let remaining = totalSeconds;
  onTick(remaining);
  timerInterval = setInterval(() => {
    remaining--;
    if (remaining < 0) return;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      onDone();
    }
  }, 1000);
}

function recordSetCompletion(step) {
  const log = sessionExerciseLog[step.exercise.id] || (sessionExerciseLog[step.exercise.id] = initLogFor(step));
  log.setsCompleted++;
}

function completeCurrentStep() {
  if (stepResolved) return;
  stepResolved = true;
  clearInterval(timerInterval);
  timerInterval = null;
  const step = currentStep();
  recordSetCompletion(step);
  advanceAfter(step);
}

function skipCurrentExercise() {
  const step = currentStep();
  const exId = step.exercise.id;
  const phase = step.phase;
  const log = sessionExerciseLog[exId] || (sessionExerciseLog[exId] = initLogFor(step));
  log.skipped = true;
  clearInterval(timerInterval);
  timerInterval = null;
  while (currentStepIndex < currentQueue.length && currentQueue[currentStepIndex].exercise.id === exId && currentQueue[currentStepIndex].phase === phase) {
    currentStepIndex++;
  }
  proceedToNextStepOrFinish();
}

function advanceAfter(finishedStep) {
  currentStepIndex++;
  const needsRest = (finishedStep.phase === 'main' || finishedStep.phase === 'tabata') && currentStepIndex < currentQueue.length;
  if (needsRest) {
    const restSec = finishedStep.phase === 'tabata' ? ROUTINE.tabata.restSec : getSettings().restSeconds;
    startRest(restSec);
  } else {
    proceedToNextStepOrFinish();
  }
}

function proceedToNextStepOrFinish() {
  if (currentStepIndex >= currentQueue.length) {
    finishWorkout();
  } else {
    renderWorkoutStep();
  }
}

function startRest(seconds) {
  uiMode = 'rest';
  stepResolved = false;
  const next = currentQueue[currentStepIndex];

  $('#suggestion-badge').hidden = true;
  $('#workout-phase-label').textContent = '휴식';
  $('#workout-exercise-name').textContent = '잠시 휴식';
  $('#workout-set-label').hidden = false;
  $('#workout-set-label').textContent = `다음: ${next.exercise.name}`;
  $('#stickman').setAttribute('class', 'stickman');
  $('#workout-target').textContent = '';
  $('#tip-breath').innerHTML = '<strong>호흡:</strong> 편안하게 숨을 고르세요';
  $('#tip-form').innerHTML = '<strong>신경 쓸 부위:</strong> 물 한 모금 마셔도 좋아요';
  $('#btn-skip').hidden = true;
  $('#btn-complete-set').textContent = '휴식 건너뛰기';

  $('#timer-wrap').hidden = false;
  $('#timer-label').textContent = '휴식';
  runCountdown(seconds, {
    onTick: (remaining) => {
      $('#timer-value').textContent = formatDuration(remaining);
      $('#timer-value').classList.toggle('urgent', remaining <= 5);
    },
    onDone: () => {
      feedbackRestDone();
      finishRest();
    }
  });
  saveDraftNow();
}

function finishRest() {
  if (stepResolved) return;
  stepResolved = true;
  clearInterval(timerInterval);
  timerInterval = null;
  proceedToNextStepOrFinish();
}

function finishWorkout() {
  workoutInProgress = false;
  releaseWakeLock();
  pendingCompleteDurationSec = Math.round((Date.now() - sessionStartTime) / 1000);
  selectedRpe = null;
  $all('.rpe-btn').forEach(b => b.classList.remove('selected'));
  $('#complete-notes').value = '';
  $('#complete-duration').textContent = formatDuration(pendingCompleteDurationSec);
  goToScreen('complete');
}

function saveSessionAndReturnHome() {
  const exercises = Object.values(sessionExerciseLog).map(log => {
    return Object.assign({}, log, { fullyCompleted: !log.skipped && log.setsCompleted >= log.setsTarget });
  });
  const session = {
    id: 's' + Date.now(),
    dateISO: new Date().toISOString(),
    durationSec: pendingCompleteDurationSec,
    rpe: selectedRpe,
    notes: $('#complete-notes').value.trim(),
    exercises
  };
  const sessions = getSessions();
  sessions.push(session);
  saveSessions(sessions);
  clearDraft();
  showToast('운동 기록이 저장됐어요. 오늘도 수고하셨어요!');
  goToScreen('home');
}

/* =====================================================================
   7. RENDERERS - HOME / HISTORY / SETTINGS
   ===================================================================== */

function renderHome() {
  const sessions = getSessions();
  const weekCount = computeWeekCount(sessions);
  $('#home-week-progress').textContent = `${weekCount} / 4회`;

  const dotsEl = $('#home-week-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i < weekCount ? ' done' : '');
    dotsEl.appendChild(dot);
  }

  const streak = computeStreak(sessions);
  $('#home-streak').textContent = `🔥 연속 ${streak}일`;

  const goal = getGoal();
  let goalLine = '체중 숫자보다 <strong>운동별 중량·난이도 진행</strong>이 더 중요한 지표예요. 근육을 지키면서 체지방을 줄이는 게 목표니까요.';
  if (goal && typeof goal.startWeight === 'number' && typeof goal.currentWeight === 'number') {
    const lost = Math.round((goal.startWeight - goal.currentWeight) * 10) / 10;
    goalLine = `목표 대비 <strong>${lost >= 0 ? '-' : '+'}${Math.abs(lost)}kg</strong> / 목표 -${goal.targetLossKg}kg &middot; ` + goalLine;
  }
  $('#home-goal-line').innerHTML = goalLine;

  const recentList = $('#home-recent-list');
  renderSessionList(recentList, sessions.slice().sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO)).slice(0, 3));
}

function renderSessionList(ulEl, sessions) {
  ulEl.innerHTML = '';
  if (sessions.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.style.border = 'none';
    li.textContent = '아직 기록이 없어요. 첫 운동을 시작해보세요!';
    ulEl.appendChild(li);
    return;
  }
  sessions.forEach(s => {
    const li = document.createElement('li');
    const doneCount = (s.exercises || []).filter(e => !e.skipped).length;
    li.innerHTML = `<span><span class="recent-date">${formatDateHuman(s.dateISO)}</span><br><span class="recent-meta">${doneCount}개 운동 완료 &middot; ${formatDuration(s.durationSec)}</span></span><span class="recent-meta">${s.rpe ? 'RPE ' + s.rpe : ''}</span>`;
    ulEl.appendChild(li);
  });
}

function renderHistory() {
  const sessions = getSessions();

  // weekly bar chart - last 6 weeks
  const chart = $('#history-chart');
  chart.innerHTML = '';
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const ws = startOfWeek(new Date());
    ws.setDate(ws.getDate() - 7 * i);
    const we = new Date(ws); we.setDate(we.getDate() + 7);
    const count = sessions.filter(s => { const d = new Date(s.dateISO); return d >= ws && d < we; }).length;
    weeks.push({ label: `${ws.getMonth() + 1}/${ws.getDate()}`, count });
  }
  const maxCount = Math.max(4, ...weeks.map(w => w.count));
  weeks.forEach(w => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = Math.max(4, (w.count / maxCount) * 100) + '%';
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = w.label;
    col.appendChild(bar); col.appendChild(label);
    chart.appendChild(col);
  });

  // exercise select
  const select = $('#history-exercise-select');
  if (!select.dataset.populated) {
    select.innerHTML = ROUTINE.main.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    select.dataset.populated = '1';
    select.addEventListener('change', renderHistoryTrend);
  }
  renderHistoryTrend();

  renderSessionList($('#history-full-list'), sessions.slice().sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO)));
}

function renderHistoryTrend() {
  const exId = $('#history-exercise-select').value;
  const sessions = getSessions().slice().sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
  const trendEl = $('#history-trend');
  trendEl.innerHTML = '';
  const rows = [];
  sessions.forEach(s => {
    const ex = (s.exercises || []).find(e => e.id === exId && !e.skipped);
    if (!ex) return;
    let valueText;
    if (typeof ex.weightKg === 'number') valueText = `${ex.weightKg}kg · ${ex.repsLow}~${ex.repsHigh}회`;
    else if (typeof ex.seconds === 'number') valueText = `${ex.seconds}초`;
    else if (typeof ex.repsLow === 'number') valueText = `${ex.repsLow}~${ex.repsHigh}회` + (ex.kneeAssist === false ? ' (무릎 떼고)' : ex.kneeAssist === true ? ' (무릎 대고)' : '');
    else valueText = `${ex.setsCompleted}/${ex.setsTarget}세트`;
    rows.push({ date: formatDateHuman(s.dateISO), value: valueText });
  });
  if (rows.length === 0) {
    trendEl.innerHTML = '<p class="empty-hint">아직 이 운동 기록이 없어요.</p>';
    return;
  }
  rows.slice(0, 10).forEach(r => {
    const row = document.createElement('div');
    row.className = 'trend-row';
    row.innerHTML = `<span class="trend-date">${r.date}</span><span class="trend-value">${r.value}</span>`;
    trendEl.appendChild(row);
  });
}

function renderSettings() {
  const settings = getSettings();
  $('#setting-rest').value = settings.restSeconds;
  $('#setting-rest-value').textContent = settings.restSeconds + '초';
  $('#setting-sound').checked = settings.soundOn;
  $('#setting-tabata-enabled').checked = settings.tabataEnabled;

  const choiceEl = $('#tabata-choice');
  choiceEl.innerHTML = '';
  ROUTINE.tabataOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn' + (settings.tabataExercise === opt.id ? ' chip-btn--accent' : '');
    btn.textContent = opt.name;
    btn.onclick = () => {
      const s = getSettings();
      s.tabataExercise = opt.id;
      saveSettings(s);
      renderSettings();
    };
    choiceEl.appendChild(btn);
  });

  const goal = getGoal();
  $('#setting-current-weight').value = goal && typeof goal.currentWeight === 'number' ? goal.currentWeight : '';
  $('#setting-target-loss').value = goal && typeof goal.targetLossKg === 'number' ? goal.targetLossKg : '';
}

/* =====================================================================
   8. NAVIGATION
   ===================================================================== */

let currentScreen = 'home';

function goToScreen(name) {
  if (currentScreen === 'workout' && name !== 'workout' && workoutInProgress) {
    showConfirm('진행 중인 운동 기록이 사라져요. 정말 나가시겠어요?', () => {
      workoutInProgress = false;
      clearInterval(timerInterval);
      timerInterval = null;
      releaseWakeLock();
      clearDraft();
      forceGoToScreen(name);
    });
    return;
  }
  forceGoToScreen(name);
}

function forceGoToScreen(name) {
  currentScreen = name;
  $all('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');

  const titles = { home: '홈트레이닝 트래커', workout: '운동 진행', complete: '운동 완료', history: '기록 / 통계', settings: '설정' };
  $('#header-title').textContent = titles[name] || '홈트레이닝 트래커';
  $('#btn-back').hidden = (name === 'home' || name === 'complete');
  $('#btn-settings').hidden = (name !== 'home');

  if (name === 'home') renderHome();
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
}

/* =====================================================================
   9. EVENT WIRING
   ===================================================================== */

function init() {
  $('#btn-start-workout').addEventListener('click', () => {
    const draft = getDraft();
    if (draft && Array.isArray(currentQueue) === false) { /* no-op placeholder */ }
    startWorkout();
  });

  $('#btn-goal').addEventListener('click', () => goToScreen('settings'));
  $('#btn-view-history').addEventListener('click', () => goToScreen('history'));
  $('#btn-settings').addEventListener('click', () => goToScreen('settings'));
  $('#btn-back').addEventListener('click', () => goToScreen('home'));

  $('#btn-complete-set').addEventListener('click', () => {
    if (uiMode === 'rest') finishRest();
    else completeCurrentStep();
  });
  $('#btn-skip').addEventListener('click', () => {
    if (uiMode === 'exercise') skipCurrentExercise();
  });

  $all('.rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $all('.rpe-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRpe = Number(btn.dataset.rpe);
    });
  });
  $('#btn-save-session').addEventListener('click', saveSessionAndReturnHome);

  $('#setting-rest').addEventListener('input', () => {
    $('#setting-rest-value').textContent = $('#setting-rest').value + '초';
  });
  $('#setting-rest').addEventListener('change', () => {
    const s = getSettings();
    s.restSeconds = Number($('#setting-rest').value);
    saveSettings(s);
  });
  $('#setting-sound').addEventListener('change', () => {
    const s = getSettings();
    s.soundOn = $('#setting-sound').checked;
    saveSettings(s);
  });
  $('#setting-tabata-enabled').addEventListener('change', () => {
    const s = getSettings();
    s.tabataEnabled = $('#setting-tabata-enabled').checked;
    saveSettings(s);
  });
  $('#btn-save-goal').addEventListener('click', () => {
    const currentWeight = parseFloat($('#setting-current-weight').value);
    const targetLoss = parseFloat($('#setting-target-loss').value);
    if (isNaN(currentWeight)) { showToast('현재 체중을 입력해주세요'); return; }
    const goal = getGoal() || {};
    if (typeof goal.startWeight !== 'number') goal.startWeight = currentWeight;
    goal.currentWeight = currentWeight;
    goal.targetLossKg = isNaN(targetLoss) ? (goal.targetLossKg || 4) : targetLoss;
    saveGoal(goal);
    showToast('목표가 저장됐어요');
  });
  $('#btn-reset-data').addEventListener('click', () => {
    showConfirm('모든 운동 기록과 설정이 삭제됩니다. 계속할까요?', () => {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      showToast('데이터가 초기화됐어요');
      forceGoToScreen('home');
    });
  });

  window.addEventListener('beforeunload', (e) => {
    if (workoutInProgress) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const draft = getDraft();
  if (draft && draft.currentStepIndex != null) {
    showConfirm('이전에 중단된 운동 기록이 있어요. 이어서 진행할까요?', () => {
      resumeDraft(draft);
    });
  }

  forceGoToScreen('home');
}

function resumeDraft(draft) {
  const settings = getSettings();
  currentQueue = buildQueue(settings);
  currentStepIndex = Math.min(draft.currentStepIndex, currentQueue.length - 1);
  sessionStartTime = draft.sessionStartTime || Date.now();
  sessionExerciseLog = draft.sessionExerciseLog || {};
  selectedRpe = null;
  workoutInProgress = true;
  goToScreen('workout');
  renderWorkoutStep();
  requestWakeLock();
}

document.addEventListener('DOMContentLoaded', init);
