'use strict';

/* =====================================================================
   1. ROUTINE DATA
   ===================================================================== */

const ROUTINE = {
  name: '전신 순환 트레이닝',
  frequency: '주 3회',
  warmup: [
    { id: 'march', name: '제자리 걷기/스텝터치', type: 'time', durationSec: 120 },
    { id: 'armcircle', name: '팔 돌리기, 골반 돌리기', type: 'time', durationSec: 30 },
    { id: 'squat-warmup', name: '스쿼트 자세', type: 'reps', reps: 10, sets: 1 }
  ],
  main: [
    { id: 'squat', name: '스쿼트', type: 'reps', category: 'bodyweight', sets: 3 },
    { id: 'lunge', name: '런지 (좌우 번갈아)', type: 'reps', category: 'bodyweight', sets: 3 },
    { id: 'pushup', name: '푸시업', type: 'reps', category: 'pushup', sets: 3 },
    { id: 'glutebridge', name: '글루트 브릿지', type: 'reps', category: 'bodyweight', sets: 3 },
    { id: 'plank', name: '플랭크', type: 'time', category: 'time', sets: 3 },
    { id: 'pikepushup', name: '파이크 푸시업', type: 'reps', category: 'pushup', sets: 3 },
    { id: 'superman', name: '슈퍼맨', type: 'reps', category: 'bodyweight', sets: 3 }
  ],
  tabataOptions: [
    { id: 'burpee', name: '버피' },
    { id: 'mountainclimber', name: '마운틴클라이머' },
    { id: 'jumpingjack', name: '점핑잭' }
  ],
  tabata: { workSec: 30, restSec: 15, rounds: 7 },
  cooldown: [
    { id: 'stretch', name: '쿨다운 스트레칭', type: 'time', durationSec: 300 }
  ]
};

const PHASE_LABEL = { warmup: '워밍업', main: '본운동', tabata: '마무리 유산소 (타바타)', cooldown: '쿨다운' };
const WEEKLY_GOAL = 3;

/* =====================================================================
   2. PARAMETRIC SIDE-VIEW SKELETON (spec 3.6)
   One bone-length ratio set + joint angles in, SVG markup out. Side view
   means no left/right mirroring is ever needed for correctness - every
   pose just faces the same direction, eliminating the sign-convention
   bugs a front-facing rig had. Static poses only, no animation/interpolation.
   ===================================================================== */

const BONE = { torso: 54, head: 12, upperArm: 29, forearm: 26, thigh: 42, shin: 39 };
const HIP = { x: 95, y: 130 };

function deg2rad(d) { return (d * Math.PI) / 180; }

// 'up' bones (torso/head) extend upward by default; 'down' bones (limbs) hang down by default.
// angleDeg is measured from that default direction; positive tips toward +x (the facing side).
function extend(base, len, angleDeg, dir) {
  const r = deg2rad(angleDeg);
  const dx = len * Math.sin(r);
  const dy = dir === 'up' ? -len * Math.cos(r) : len * Math.cos(r);
  return { x: base.x + dx, y: base.y + dy };
}

function rotateAround(p, center, deg) {
  if (!deg) return p;
  const r = deg2rad(deg);
  const dx = p.x - center.x, dy = p.y - center.y;
  return {
    x: center.x + dx * Math.cos(r) - dy * Math.sin(r),
    y: center.y + dx * Math.sin(r) + dy * Math.cos(r)
  };
}

function buildLeg(hipPt, hipAngle, kneeAngle) {
  const knee = extend(hipPt, BONE.thigh, hipAngle, 'down');
  const ankle = extend(knee, BONE.shin, hipAngle + kneeAngle, 'down');
  const foot = { x: ankle.x + 16, y: ankle.y };
  return { knee, ankle, foot };
}

function skeletonPoints(pose) {
  const hip = HIP;
  const shoulder = extend(hip, BONE.torso, pose.back || 0, 'up');
  const head = extend(shoulder, BONE.head * 1.7, pose.back || 0, 'up');
  const elbow = extend(shoulder, BONE.upperArm, pose.shoulder || 0, 'down');
  const hand = extend(elbow, BONE.forearm, (pose.shoulder || 0) + (pose.elbow || 0), 'down');
  const front = buildLeg(hip, pose.hip || 0, pose.knee || 0);

  const points = { hip, shoulder, head, elbow, hand, kneeF: front.knee, ankleF: front.ankle, footF: front.foot };
  if (pose.twoLeg) {
    const back = buildLeg(hip, pose.hip2 || 0, pose.knee2 || 0);
    Object.assign(points, { kneeB: back.knee, ankleB: back.ankle, footB: back.foot });
  }

  const orient = pose.orient || 0;
  if (orient) {
    Object.keys(points).forEach(k => { points[k] = rotateAround(points[k], hip, orient); });
  }
  return points;
}

function buildSkeletonSVG(pose) {
  const p = skeletonPoints(pose);
  const hi = pose.highlight; // 'knee' | 'hip' | 'back' | 'shoulder' | null
  const ink = '#2b2d33';
  const accent = '#ff6b4a';
  const danger = '#e5484d';

  const legStroke = (hi === 'knee') ? danger : ink;
  const hipStroke = (hi === 'hip') ? danger : ink;
  const backStroke = (hi === 'back') ? danger : ink;
  const shoulderStroke = (hi === 'shoulder') ? danger : ink;

  let svg = '';
  if (p.kneeB) {
    svg += `<line x1="${p.hip.x}" y1="${p.hip.y}" x2="${p.kneeB.x}" y2="${p.kneeB.y}" stroke="${ink}" stroke-width="6" stroke-linecap="round" opacity="0.55"/>`;
    svg += `<line x1="${p.kneeB.x}" y1="${p.kneeB.y}" x2="${p.ankleB.x}" y2="${p.ankleB.y}" stroke="${ink}" stroke-width="5.5" stroke-linecap="round" opacity="0.55"/>`;
    svg += `<line x1="${p.ankleB.x}" y1="${p.ankleB.y}" x2="${p.footB.x}" y2="${p.footB.y}" stroke="${ink}" stroke-width="5.5" stroke-linecap="round" opacity="0.55"/>`;
  }
  svg += `<line x1="${p.hip.x}" y1="${p.hip.y}" x2="${p.kneeF.x}" y2="${p.kneeF.y}" stroke="${hipStroke}" stroke-width="7" stroke-linecap="round"/>`;
  svg += `<line x1="${p.kneeF.x}" y1="${p.kneeF.y}" x2="${p.ankleF.x}" y2="${p.ankleF.y}" stroke="${legStroke}" stroke-width="6.5" stroke-linecap="round"/>`;
  svg += `<line x1="${p.ankleF.x}" y1="${p.ankleF.y}" x2="${p.footF.x}" y2="${p.footF.y}" stroke="${legStroke}" stroke-width="6.5" stroke-linecap="round"/>`;
  svg += `<line x1="${p.hip.x}" y1="${p.hip.y}" x2="${p.shoulder.x}" y2="${p.shoulder.y}" stroke="${backStroke}" stroke-width="9" stroke-linecap="round"/>`;
  svg += `<circle cx="${p.head.x}" cy="${p.head.y}" r="${BONE.head}" fill="${accent}" stroke="${ink}" stroke-width="3.5"/>`;
  svg += `<circle cx="${p.head.x + 3.5}" cy="${p.head.y - 1.5}" r="1.4" fill="${ink}"/>`;
  svg += `<line x1="${p.shoulder.x}" y1="${p.shoulder.y}" x2="${p.elbow.x}" y2="${p.elbow.y}" stroke="${shoulderStroke}" stroke-width="6" stroke-linecap="round"/>`;
  svg += `<line x1="${p.elbow.x}" y1="${p.elbow.y}" x2="${p.hand.x}" y2="${p.hand.y}" stroke="${ink}" stroke-width="5.5" stroke-linecap="round"/>`;
  if (hi) {
    const map = { knee: p.kneeF, hip: p.hip, shoulder: p.shoulder, back: { x: (p.hip.x + p.shoulder.x) / 2, y: (p.hip.y + p.shoulder.y) / 2 } };
    const hp = map[hi];
    if (hp) svg += `<circle cx="${hp.x}" cy="${hp.y}" r="10" fill="none" stroke="${danger}" stroke-width="3" stroke-dasharray="3 3"/>`;
  }
  return svg;
}

function poseSvgMarkup(pose, dangerVariant) {
  return `<svg viewBox="0 0 210 230" class="pose-svg${dangerVariant ? ' pose-svg--danger' : ''}" xmlns="http://www.w3.org/2000/svg">${buildSkeletonSVG(pose)}</svg>`;
}

/* =====================================================================
   3. EXERCISE INFO: breath + checkpoints + mistakes + reference poses
   (spec 3.2 / 3.6). Only the 6 main exercises have checkpoints/mistakes/
   wrongPose - warmup/tabata/cooldown items only need reference poses.
   ===================================================================== */

const EXERCISE_INFO = {
  march: {
    breath: '편안하게 호흡하며 몸을 가볍게 풀어주세요',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: 15, elbow: -15 },
      { label: '②', hip: -62, knee: 78, back: 0, shoulder: -28, elbow: -10 }
    ]
  },
  armcircle: {
    breath: '편안하게 호흡하며 몸을 가볍게 풀어주세요',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: -10, elbow: 0 },
      { label: '②', hip: 0, knee: 0, back: 0, shoulder: 168, elbow: 0 }
    ]
  },
  'squat-warmup': {
    breath: '편안하게 호흡하며 몸을 가볍게 풀어주세요',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 6, shoulder: -10, elbow: 0 },
      { label: '②', hip: 55, knee: -38, back: 33, shoulder: 88, elbow: 14 }
    ]
  },
  squat: {
    breath: '앉을 때 코로 들이마시고, 일어설 때 입으로 내쉬기',
    checkpoints: ['무릎이 발끝보다 앞으로 나가지 않게', '발뒤꿈치에 체중', '허리 중립', '시선은 정면'],
    mistakes: ['무릎이 발끝 넘음', '허리 말림(굽음)', '발뒤꿈치 들림'],
    midReminder: '무릎, 발끝 넘지 않게!',
    selfCheckQuestion: '무릎이 발끝을 넘었나요?',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 6, shoulder: -10, elbow: 0 },
      { label: '②', hip: 45, knee: -42, back: 20, shoulder: 50, elbow: 8 },
      { label: '③', hip: 90, knee: -85, back: 38, shoulder: 90, elbow: 15 }
    ],
    wrongPose: { hip: 90, knee: -40, back: 38, shoulder: 90, elbow: 15, highlight: 'knee' }
  },
  lunge: {
    breath: '내려갈 때 들이마시고, 올라올 때 내쉬기',
    checkpoints: ['앞무릎이 발끝 넘지 않게', '상체는 세운 상태 유지', '뒷무릎은 바닥 살짝 앞에서 멈춤'],
    mistakes: ['앞무릎이 발끝 넘음', '상체가 앞으로 쏠림', '뒷무릎이 바닥을 쾅 침'],
    midReminder: '앞무릎, 발끝 넘지 않게!',
    selfCheckQuestion: '앞무릎이 발끝을 넘었나요?',
    poses: [
      { label: '①', hip: 0, knee: 0, hip2: 0, knee2: 0, back: 6, shoulder: -10, elbow: 0, twoLeg: true },
      { label: '②', hip: 85, knee: -85, hip2: -35, knee2: -95, back: 12, shoulder: 22, elbow: 10, twoLeg: true }
    ],
    wrongPose: { hip: 100, knee: -55, hip2: -35, knee2: -95, back: 12, shoulder: 22, elbow: 10, twoLeg: true, highlight: 'knee' }
  },
  pushup: {
    breath: '내려갈 때 들이마시고, 밀어 올릴 때 내쉬기',
    checkpoints: ['팔꿈치는 몸통에서 45도', '허리 처지지 않게 코어 긴장 유지'],
    mistakes: ['골반/허리 처짐', '팔꿈치 과도하게 벌어짐(어깨 부담)', '목이 앞으로 빠짐'],
    midReminder: '허리 처지지 않게!',
    selfCheckQuestion: '골반이나 허리가 처졌나요?',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: 95, elbow: 0, orient: 90 },
      { label: '②', hip: 0, knee: 0, back: 0, shoulder: 75, elbow: -85, orient: 90 }
    ],
    wrongPose: { hip: -22, knee: 0, back: 0, shoulder: 75, elbow: -85, orient: 90, highlight: 'hip' }
  },
  glutebridge: {
    breath: '골반 들어올릴 때 내쉬며 둔근에 힘주기, 내려갈 때 들이마시기',
    checkpoints: ['엉덩이 힘으로 밀어올리기', '정점에서 1초 멈춰 둔근 수축'],
    mistakes: ['허리로 밀어올림(과신전)', '무릎이 안쪽으로 모임', '반동 사용'],
    midReminder: '허리 말고 엉덩이 힘으로!',
    selfCheckQuestion: '허리로 밀어올렸나요? (과신전)',
    poses: [
      { label: '①', hip: -75, knee: 95, back: 0, shoulder: -10, elbow: 0, orient: -90 },
      { label: '②', hip: -5, knee: 95, back: 0, shoulder: -10, elbow: 0, orient: -90 }
    ],
    wrongPose: { hip: -5, knee: 95, back: -25, shoulder: -10, elbow: 0, orient: -90, highlight: 'back' }
  },
  plank: {
    breath: '자세 유지 동안 자연스럽게 호흡 지속 (숨 참지 않기)',
    checkpoints: ['몸이 일직선', '어깨는 손목 바로 위', '코어와 둔근 동시 긴장'],
    mistakes: ['엉덩이가 너무 높이 뜸', '허리(골반)가 처짐', '어깨가 손목에서 벗어남'],
    selfCheckQuestion: '엉덩이가 너무 뜨거나 처졌나요?',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: 95, elbow: -90, orient: 90 }
    ],
    wrongPose: { hip: -14, knee: 0, back: 0, shoulder: 95, elbow: -90, orient: 90, highlight: 'hip' }
  },
  pikepushup: {
    breath: '내려갈 때 들이마시고, 밀어 올릴 때 내쉬기',
    checkpoints: ['엉덩이를 높이 들어 몸을 역V자로', '정수리 방향으로 내려가기', '팔꿈치는 살짝 뒤쪽(45도 내외)'],
    mistakes: ['엉덩이가 낮아져 일반 푸시업처럼 됨', '팔꿈치가 옆으로 과도하게 벌어짐', '목으로 바닥 짚으려 함'],
    midReminder: '엉덩이 높이 유지!',
    selfCheckQuestion: '엉덩이가 낮아져 일반 푸시업처럼 됐나요?',
    poses: [
      { label: '①', hip: 95, knee: 0, back: 0, shoulder: 95, elbow: 0, orient: 90 },
      { label: '②', hip: 95, knee: 0, back: 0, shoulder: 75, elbow: -85, orient: 90 }
    ],
    wrongPose: { hip: 20, knee: 0, back: 0, shoulder: 75, elbow: -85, orient: 90, highlight: 'hip' }
  },
  superman: {
    breath: '팔다리 들어올릴 때 내쉬고, 내릴 때 들이마시기',
    checkpoints: ['허리가 아닌 등 전체 힘으로 들어올리기', '시선은 바닥 살짝 앞', '정점에서 1~2초 멈춤'],
    mistakes: ['허리를 과도하게 젖힘(꺾음)', '목을 뒤로 젖혀 위를 봄', '반동으로 튕겨 올림'],
    midReminder: '허리 너무 젖히지 말고!',
    selfCheckQuestion: '허리를 과도하게 젖혔나요?',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: 165, elbow: 0, orient: 90 },
      { label: '②', hip: 18, knee: 0, back: -10, shoulder: 175, elbow: 0, orient: 90 }
    ],
    wrongPose: { hip: 18, knee: 0, back: -38, shoulder: 175, elbow: 0, orient: 90, highlight: 'back' }
  },
  burpee: {
    breath: '숨이 가빠도 괜찮아요, 가능한 범위에서 최선을 다해보세요',
    poses: [
      { label: '①', hip: 55, knee: -30, back: 38, shoulder: 90, elbow: 18 },
      { label: '②', hip: -10, knee: 5, back: -6, shoulder: 172, elbow: 0 }
    ]
  },
  mountainclimber: {
    breath: '숨이 가빠도 괜찮아요, 가능한 범위에서 최선을 다해보세요',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: 70, elbow: -20, orient: 90 },
      { label: '②', hip: -72, knee: 60, back: 0, shoulder: 70, elbow: -20, orient: 90 }
    ]
  },
  jumpingjack: {
    breath: '숨이 가빠도 괜찮아요, 가능한 범위에서 최선을 다해보세요',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: -10, elbow: 0 },
      { label: '②', hip: 0, knee: 0, back: 0, shoulder: 172, elbow: 0 }
    ]
  },
  stretch: {
    breath: '늘리는 동안 천천히 길게 숨을 내쉬세요',
    poses: [
      { label: '①', hip: 0, knee: 0, back: 0, shoulder: -10, elbow: 0 },
      { label: '②', hip: 0, knee: 0, back: 24, shoulder: 168, elbow: 0 }
    ]
  }
};

/* Per-rep base tempo in seconds (spec 3.9). Counting itself is a fixed "하나, 둘"
   repeated every rep (하나=down beat, 둘=up beat) rather than counting up toward
   the target - that's how a real trainer counts a lift, not a running tally. */
const REP_PACING = {
  squat: { baseSec: 4 },
  lunge: { baseSec: 4 },
  pushup: { baseSec: 4 },
  glutebridge: { baseSec: 3 },
  pikepushup: { baseSec: 4 },
  superman: { baseSec: 3 }
};

const QUOTES = [
  '오늘은 완벽하게 하는 것보다 끝까지 하는 게 목표입니다',
  '스쿼트는 깊이보다 허리를 곧게 유지하는 게 먼저입니다',
  '근육은 운동할 때가 아니라 회복할 때 성장합니다',
  '숫자보다 자세가 먼저입니다',
  '오늘 못하면 내일 하면 됩니다. 완벽한 날보다 계속하는 게 중요해요',
  '호흡을 잊지 마세요, 숨을 참으면 힘만 더 들어요',
  '작은 진전도 진전입니다'
];

/* =====================================================================
   4. STORAGE
   ===================================================================== */

const STORAGE_KEYS = {
  sessions: 'htt_sessions',
  settings: 'htt_settings',
  goal: 'htt_goal',
  exerciseState: 'htt_exercise_state',
  draft: 'htt_draft_session',
  level: 'htt_level'
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
  return { restSeconds: 30, soundOn: true, voiceOn: true, tabataEnabled: true, tabataExercise: 'jumpingjack', repTempo: 'normal' };
}
const REP_TEMPO_MULTIPLIER = { slow: 1.3, normal: 1.0, fast: 0.8 };
const REP_TEMPO_LABELS = { slow: '천천히', normal: '보통', fast: '빠르게' };
function getSettings() { return Object.assign(defaultSettings(), readJSON(STORAGE_KEYS.settings, {})); }
function saveSettings(s) { writeJSON(STORAGE_KEYS.settings, s); }

function getGoal() { return readJSON(STORAGE_KEYS.goal, null); }
function saveGoal(g) { writeJSON(STORAGE_KEYS.goal, g); }

function getLevel() { return readJSON(STORAGE_KEYS.level, null); }
function saveLevel(l) { writeJSON(STORAGE_KEYS.level, l); }
const LEVEL_LABELS = { beginner: '완전 초보', some: '조금 해봤어요', familiar: '익숙합니다' };
const LEVEL_STARTING_REPS = { beginner: 8, some: 10, familiar: 12 };
const BODYWEIGHT_LADDER = [8, 10, 12, 15];

function defaultExerciseState() {
  return {
    squat: { repsLow: 12, repsHigh: 12 },
    lunge: { repsLow: 12, repsHigh: 12 },
    pushup: { repsLow: 12, repsHigh: 12, kneeAssist: true },
    glutebridge: { repsLow: 12, repsHigh: 12 },
    plank: { seconds: 30 },
    pikepushup: { repsLow: 12, repsHigh: 12, kneeAssist: true },
    superman: { repsLow: 12, repsHigh: 12 }
  };
}
function getExerciseState() {
  return Object.assign(defaultExerciseState(), readJSON(STORAGE_KEYS.exerciseState, {}));
}
function saveExerciseState(s) { writeJSON(STORAGE_KEYS.exerciseState, s); }

function applyLevelToExerciseState(level) {
  const exState = getExerciseState();
  const startReps = LEVEL_STARTING_REPS[level] || 12;
  ['squat', 'lunge', 'glutebridge', 'pushup', 'pikepushup', 'superman'].forEach(id => {
    exState[id].repsLow = startReps;
    exState[id].repsHigh = startReps;
  });
  saveExerciseState(exState);
}

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
   5. UTILITIES
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
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
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

/* Voice coach via Web Speech API. speak() interrupts (for one-off replaceable
   lines); speakQueue() appends without cancelling (for sequential narration
   like intro -> cue -> cue -> rest -> next-exercise preview). */
function speak(text) {
  const settings = getSettings();
  if (!settings.voiceOn || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable - ignore */ }
}
function speakQueue(text) {
  const settings = getSettings();
  if (!settings.voiceOn || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable - ignore */ }
}
function cancelSpeech() {
  if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
}
// Speaks text and calls callback once it actually finishes (not a guessed delay) -
// used before starting a timed cadence so the visible counter never gets ahead of
// what's actually been heard. fallbackMs is a safety net in case onend never fires
// (voice off, synthesis unavailable, or a browser that drops the event).
function speakThen(text, callback, fallbackMs) {
  const settings = getSettings();
  if (!settings.voiceOn || !('speechSynthesis' in window)) {
    cueTimeouts.push(setTimeout(callback, 0));
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1;
    let done = false;
    const finish = () => { if (done) return; done = true; callback(); };
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    cueTimeouts.push(setTimeout(finish, fallbackMs || 3000));
  } catch (e) {
    callback();
  }
}

let cueTimeouts = [];
function clearCueTimeouts() { cueTimeouts.forEach(clearTimeout); cueTimeouts = []; }

function announceForStep(step) {
  const ex = step.exercise;
  const info = EXERCISE_INFO[ex.id] || {};
  let intro;
  if (step.setTotal > 1) {
    const unit = step.phase === 'tabata' ? '라운드' : '세트';
    intro = step.setIndex === 1 ? `${ex.name} 시작합니다.` : `${ex.name}, ${step.setIndex}번째 ${unit}.`;
  } else {
    intro = `${ex.name} 시작합니다.`;
  }
  return `${intro} ${info.breath || ''}`;
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
   6. PROGRESSIVE OVERLOAD SUGGESTION LOGIC (pure functions, spec 3.5)
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
  if (meta.category === 'pushup') {
    return exState[exerciseId].kneeAssist ? '무릎 떼고 시도해보세요' : '횟수를 15~18회로 늘리거나, 템포를 늦춰보세요';
  }
  if (meta.category === 'bodyweight') return '횟수를 15~18회로 늘리거나, 템포를 늦춰보세요';
  if (meta.category === 'time') return '시간을 35~40초로 늘려보세요';
  return '';
}

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

function advanceBodyweightLadder(state) {
  const idx = BODYWEIGHT_LADDER.indexOf(state.repsLow);
  if (idx >= 0 && idx < BODYWEIGHT_LADDER.length - 1) {
    const next = BODYWEIGHT_LADDER[idx + 1];
    state.repsLow = next; state.repsHigh = next;
  } else {
    state.repsLow = 15; state.repsHigh = 18;
  }
}

function applyProgressiveOverload(exerciseId) {
  const exState = getExerciseState();
  const meta = ROUTINE.main.find(e => e.id === exerciseId);
  if (!meta) return;
  if (meta.category === 'pushup') {
    if (exState[exerciseId].kneeAssist) exState[exerciseId].kneeAssist = false;
    else advanceBodyweightLadder(exState[exerciseId]);
  } else if (meta.category === 'bodyweight') {
    advanceBodyweightLadder(exState[exerciseId]);
  } else if (meta.category === 'time') {
    exState.plank.seconds = Math.min(40, exState.plank.seconds + 5);
  }
  saveExerciseState(exState);
}

/* =====================================================================
   7. DERIVED STATS
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
   8. WORKOUT SESSION STATE MACHINE
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
let selectedBodyPart = null;

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
  selectedBodyPart = null;
  workoutInProgress = true;
  clearDraft();
  requestWakeLock();
  proceedToCurrentStep();
}

function proceedToCurrentStep() {
  forceGoToScreen('workout');
  renderWorkoutStep();
}

function currentStep() { return currentQueue[currentStepIndex]; }

function targetLineText(step) {
  const ex = step.exercise;
  const exState = getExerciseState();
  if (step.phase === 'main') {
    const st = exState[ex.id];
    if (ex.category === 'pushup' || ex.category === 'bodyweight') {
      const reps = st.repsLow === st.repsHigh ? `${st.repsLow}회` : `${st.repsLow}~${st.repsHigh}회`;
      return `목표: ${reps}` + (ex.category === 'pushup' ? (st.kneeAssist ? ' (무릎 대고)' : ' (무릎 떼고)') : '');
    }
    if (ex.category === 'time') return `목표: ${st.seconds}초 유지`;
  }
  if (step.phase === 'tabata') return `운동 ${ROUTINE.tabata.workSec}초 · ${step.setIndex}/${step.setTotal}라운드`;
  if (ex.type === 'time') return `목표 시간: ${formatDuration(ex.durationSec)}`;
  if (ex.type === 'reps') return `목표: ${ex.reps}회`;
  return '';
}

function timerSecondsFor(step) {
  const ex = step.exercise;
  const exState = getExerciseState();
  if (step.phase === 'tabata') return step.timeSec;
  if (step.phase === 'main' && ex.category === 'time') return exState.plank.seconds;
  if (ex.type === 'time') return ex.durationSec;
  return null;
}

function repCountTarget(step) {
  const ex = step.exercise;
  if (step.phase === 'main') {
    const exState = getExerciseState();
    return exState[ex.id].repsLow;
  }
  return ex.reps || 10;
}

function effectiveTempoSec(exId) {
  const base = (REP_PACING[exId] && REP_PACING[exId].baseSec) || 3.5;
  const mult = REP_TEMPO_MULTIPLIER[getSettings().repTempo] || 1;
  return base * mult;
}

// Counts reps out loud on a steady "하나(내려가고) 둘(올라오고)" cadence repeated
// every rep (spec 3.9/4.2) - the same two beats each time, not a running tally -
// instead of leaving the user to self-pace and tap 완료. Rep 1 runs at 1.5x tempo
// as a slow form-check rep; the halfway rep swaps in a short mistake reminder;
// the last 3 reps count down with encouragement instead of "하나".
function runRepCounter(exId, target, tempoSec, { onTick, onDone }) {
  const midReminder = (EXERCISE_INFO[exId] || {}).midReminder;
  const halfPoint = Math.ceil(target / 2);
  onTick(0);

  function step(i) {
    const thisTempo = i === 1 ? tempoSec * 1.5 : tempoSec;
    const halfMs = (thisTempo * 1000) / 2;
    onTick(i);
    beep(700, 90);
    vibrate(30);
    const remainingIncl = target - i + 1;
    let text;
    if (remainingIncl === 1) text = '마지막 하나!';
    else if (remainingIncl === 2) text = '2개 남았어요';
    else if (remainingIncl === 3) text = '3개 남았어요';
    else if (i === halfPoint && midReminder) text = midReminder;
    else text = '하나';
    speakQueue(text);

    if (i >= target) {
      cueTimeouts.push(setTimeout(() => { feedbackSetDone(); onDone(); }, thisTempo * 1000));
      return;
    }
    cueTimeouts.push(setTimeout(() => speakQueue('둘'), halfMs));
    cueTimeouts.push(setTimeout(() => step(i + 1), thisTempo * 1000));
  }

  speakThen('천천히 첫 동작 해볼게요', () => step(1), 2600);
}

function renderPoseRow(exId) {
  const info = EXERCISE_INFO[exId] || {};
  const poses = info.poses || [];
  $('#pose-row').innerHTML = poses.map((pose, i) => `
    <div class="pose-slot">
      ${poseSvgMarkup(pose)}
      <span class="pose-label">${pose.label || (i + 1)}</span>
    </div>`).join('');
}

function renderCheckpointsAndMistakes(exId) {
  const info = EXERCISE_INFO[exId] || {};
  const hasCoreInfo = !!(info.checkpoints && info.checkpoints.length);
  $('#checkpoint-box').hidden = !hasCoreInfo;
  $('#mistake-box').hidden = !hasCoreInfo;
  if (!hasCoreInfo) return;
  $('#checkpoint-list').innerHTML = info.checkpoints.map(c => `<li>✔ ${c}</li>`).join('');
  $('#mistake-list').innerHTML = (info.mistakes || []).map(m => `<li>✘ ${m}</li>`).join('');
  $('#mistake-pose').innerHTML = info.wrongPose ? poseSvgMarkup(info.wrongPose, true) : '';
}

function renderWorkoutStep() {
  uiMode = 'exercise';
  stepResolved = false;
  clearInterval(timerInterval);
  timerInterval = null;
  clearCueTimeouts();
  cancelSpeech();

  const step = currentStep();
  const ex = step.exercise;
  const info = EXERCISE_INFO[ex.id] || {};

  $('#workout-progress-bar').style.width = Math.round((currentStepIndex / currentQueue.length) * 100) + '%';
  $('#workout-phase-label').textContent = PHASE_LABEL[step.phase];
  $('#workout-exercise-name').textContent = ex.name;
  $('#workout-set-label').textContent = step.setTotal > 1
    ? `${step.setIndex} / ${step.setTotal}${step.phase === 'tabata' ? '라운드' : '세트'}`
    : '';
  $('#workout-set-label').hidden = step.setTotal <= 1;

  renderPoseRow(ex.id);
  $('#workout-target').textContent = targetLineText(step);
  $('#tip-breath').innerHTML = `<strong>호흡</strong> ${info.breath || ''}`;
  renderCheckpointsAndMistakes(ex.id);

  $('#btn-skip').hidden = false;
  $('#btn-skip').textContent = '건너뛰기';
  $('#btn-complete-set').textContent = (ex.type === 'reps' && timerSecondsFor(step) == null) ? '먼저 끝내기' : '완료';

  const secs = timerSecondsFor(step);
  const timerWrap = $('#timer-wrap');
  if (secs != null) {
    timerWrap.hidden = false;
    $('#timer-label').textContent = '세트 진행';
    const isPlank = step.phase === 'main' && ex.category === 'time';
    runCountdown(secs, {
      onTick: (remaining) => {
        $('#timer-value').textContent = formatDuration(remaining);
        $('#timer-value').classList.toggle('urgent', remaining <= 5);
        const elapsed = secs - remaining;
        if (isPlank && elapsed > 0 && elapsed % 10 === 0) speakQueue(`${elapsed}초`);
      },
      onDone: () => {
        feedbackSetDone();
        completeCurrentStep();
      }
    });
  } else if (ex.type === 'reps') {
    // Reps have no natural timer, but pacing this manually (self-count, then tap 완료)
    // doesn't feel like the app is working out WITH you - so count reps out loud on a
    // steady cadence instead, and auto-advance when the target is reached (spec 3.9/4.2).
    const target = repCountTarget(step);
    const tempoSec = effectiveTempoSec(ex.id);
    timerWrap.hidden = false;
    $('#timer-label').textContent = '함께 세는 중';
    runRepCounter(ex.id, target, tempoSec, {
      onTick: (count) => { $('#timer-value').textContent = `${count} / ${target}`; },
      onDone: () => completeCurrentStep()
    });
  } else {
    timerWrap.hidden = true;
  }

  renderSuggestionBadge(step);
  speakQueue(announceForStep(step));
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
  clearCueTimeouts();
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
  clearCueTimeouts();
  cancelSpeech();
  while (currentStepIndex < currentQueue.length && currentQueue[currentStepIndex].exercise.id === exId && currentQueue[currentStepIndex].phase === phase) {
    currentStepIndex++;
  }
  proceedToNextStepOrFinish();
}

function advanceAfter(finishedStep) {
  currentStepIndex++;
  const needsRest = (finishedStep.phase === 'main' || finishedStep.phase === 'tabata') && currentStepIndex < currentQueue.length;
  function proceed() {
    if (needsRest) {
      const restSec = finishedStep.phase === 'tabata' ? ROUTINE.tabata.restSec : getSettings().restSeconds;
      startRest(restSec);
    } else {
      proceedToNextStepOrFinish();
    }
  }
  const isLastSetOfExercise = finishedStep.phase === 'main' && finishedStep.setIndex === finishedStep.setTotal;
  if (isLastSetOfExercise) showSelfCheck(finishedStep.exercise.id, proceed);
  else proceed();
}

// Quick 1-tap self-check after an exercise's last set (spec 4.2) - not camera
// verification, just a self-report the user can answer in a couple seconds.
function showSelfCheck(exerciseId, onDone) {
  const question = (EXERCISE_INFO[exerciseId] || {}).selfCheckQuestion;
  if (!question) { onDone(); return; }
  const modal = $('#selfcheck-modal');
  $('#selfcheck-question').textContent = question;
  modal.hidden = false;
  const yesBtn = $('#selfcheck-yes');
  const noBtn = $('#selfcheck-no');
  function cleanup() {
    modal.hidden = true;
    yesBtn.removeEventListener('click', onYes);
    noBtn.removeEventListener('click', onNo);
  }
  function answer(val) {
    const log = sessionExerciseLog[exerciseId];
    if (log) log.mistakeReported = val;
    cleanup();
    onDone();
  }
  function onYes() { answer(true); }
  function onNo() { answer(false); }
  yesBtn.addEventListener('click', onYes);
  noBtn.addEventListener('click', onNo);
}

function proceedToNextStepOrFinish() {
  if (currentStepIndex >= currentQueue.length) {
    finishWorkout();
  } else {
    proceedToCurrentStep();
  }
}

function startRest(seconds) {
  uiMode = 'rest';
  stepResolved = false;
  clearCueTimeouts();
  const next = currentQueue[currentStepIndex];

  $('#suggestion-badge').hidden = true;
  $('#workout-phase-label').textContent = '휴식';
  $('#workout-exercise-name').textContent = '잠시 휴식';
  $('#workout-set-label').hidden = false;
  $('#workout-set-label').textContent = `다음: ${next.exercise.name}`;
  $('#pose-row').innerHTML = '';
  $('#workout-target').textContent = '';
  $('#tip-breath').innerHTML = '<strong>호흡</strong> 편안하게 숨을 고르세요';
  $('#checkpoint-box').hidden = true;
  $('#mistake-box').hidden = true;
  $('#btn-skip').hidden = true;
  $('#btn-complete-set').textContent = '휴식 건너뛰기';

  $('#timer-wrap').hidden = false;
  $('#timer-label').textContent = '휴식';
  runCountdown(seconds, {
    onTick: (remaining) => {
      $('#timer-value').textContent = formatDuration(remaining);
      $('#timer-value').classList.toggle('urgent', remaining <= 5);
      if (remaining === 20) speakQueue('20초 남았습니다');
      if (remaining === 10) speakQueue('10초 남았습니다');
    },
    onDone: () => {
      feedbackRestDone();
      finishRest();
    }
  });
  speakQueue(`좋습니다! ${seconds}초 쉽니다.`);
  saveDraftNow();
}

function finishRest() {
  if (stepResolved) return;
  stepResolved = true;
  clearInterval(timerInterval);
  timerInterval = null;
  const next = currentQueue[currentStepIndex];
  if (next) speakQueue(`다음은 ${next.exercise.name}입니다`);
  proceedToNextStepOrFinish();
}

function finishWorkout() {
  workoutInProgress = false;
  releaseWakeLock();
  pendingCompleteDurationSec = Math.round((Date.now() - sessionStartTime) / 1000);
  selectedRpe = null;
  selectedBodyPart = null;
  $all('.rpe-btn').forEach(b => b.classList.remove('selected'));
  $all('#bodypart-picker .chip-btn').forEach(b => b.classList.remove('selected'));
  $('#complete-notes').value = '';
  $('#complete-duration').textContent = formatDuration(pendingCompleteDurationSec);
  speakQueue('모든 운동을 완료했어요. 수고하셨어요!');
  forceGoToScreen('complete');
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
    hardestBodyPart: selectedBodyPart,
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
   9. RENDERERS - HOME / PREVIEW / HISTORY / SETTINGS
   ===================================================================== */

function renderHome() {
  const sessions = getSessions();
  const weekCount = computeWeekCount(sessions);
  $('#home-week-progress').textContent = `${weekCount} / ${WEEKLY_GOAL}회`;

  const dotsEl = $('#home-week-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < WEEKLY_GOAL; i++) {
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

function renderPreviewScreen() {
  const settings = getSettings();
  const queue = buildQueue(settings);

  const seen = [];
  queue.forEach(step => {
    const last = seen[seen.length - 1];
    if (!last || last.id !== step.exercise.id) seen.push({ id: step.exercise.id, name: step.exercise.name });
  });
  $('#preview-exercise-list').innerHTML = seen.map(s => `<li>${s.name}</li>`).join('');

  let totalSec = 0;
  queue.forEach((step, i) => {
    const t = timerSecondsFor(step);
    totalSec += t != null ? t : 25;
    const isLast = i === queue.length - 1;
    if (!isLast && (step.phase === 'main' || step.phase === 'tabata')) {
      totalSec += step.phase === 'tabata' ? ROUTINE.tabata.restSec : settings.restSeconds;
    }
  });
  const totalMin = Math.max(1, Math.round(totalSec / 60));
  $('#preview-duration').textContent = `약 ${totalMin}분`;
  $('#preview-calories').textContent = `약 ${Math.round(totalMin * 5.2)}~${Math.round(totalMin * 7.2)}kcal`;
  $('#preview-quote').textContent = '"' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '"';
}

function renderHistory() {
  const sessions = getSessions();

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
    else if (typeof ex.repsLow === 'number') valueText = (ex.repsLow === ex.repsHigh ? `${ex.repsLow}회` : `${ex.repsLow}~${ex.repsHigh}회`) + (ex.kneeAssist === false ? ' (무릎 떼고)' : ex.kneeAssist === true ? ' (무릎 대고)' : '');
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

function renderLevelChoice() {
  const level = getLevel() || 'familiar';
  const container = $('#level-choice');
  container.innerHTML = '';
  Object.keys(LEVEL_LABELS).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn' + (level === key ? ' chip-btn--accent' : '');
    btn.textContent = LEVEL_LABELS[key];
    btn.onclick = () => {
      saveLevel(key);
      applyLevelToExerciseState(key);
      showToast('레벨이 변경되어 목표 횟수가 재설정됐어요');
      renderLevelChoice();
    };
    container.appendChild(btn);
  });
}

function renderTempoChoice() {
  const settings = getSettings();
  const container = $('#tempo-choice');
  container.innerHTML = '';
  Object.keys(REP_TEMPO_LABELS).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn' + (settings.repTempo === key ? ' chip-btn--accent' : '');
    btn.textContent = REP_TEMPO_LABELS[key];
    btn.onclick = () => {
      const s = getSettings();
      s.repTempo = key;
      saveSettings(s);
      renderTempoChoice();
    };
    container.appendChild(btn);
  });
}

function renderSettings() {
  const settings = getSettings();
  $('#setting-rest').value = settings.restSeconds;
  $('#setting-rest-value').textContent = settings.restSeconds + '초';
  $('#setting-sound').checked = settings.soundOn;
  $('#setting-voice').checked = settings.voiceOn;
  $('#setting-tabata-enabled').checked = settings.tabataEnabled;

  renderLevelChoice();
  renderTempoChoice();

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
   10. NAVIGATION
   ===================================================================== */

let currentScreen = 'home';

function goToScreen(name) {
  if (currentScreen === 'workout' && name !== 'workout' && workoutInProgress) {
    showConfirm('진행 중인 운동 기록이 사라져요. 정말 나가시겠어요?', () => {
      workoutInProgress = false;
      clearInterval(timerInterval);
      timerInterval = null;
      clearCueTimeouts();
      cancelSpeech();
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

  const titles = { home: '홈트레이닝 코치', preview: '오늘의 루틴', workout: '운동 진행', complete: '운동 완료', history: '기록 / 통계', settings: '설정' };
  $('#header-title').textContent = titles[name] || '홈트레이닝 코치';
  $('#btn-back').hidden = (name === 'home' || name === 'complete');
  $('#btn-settings').hidden = (name !== 'home');

  if (name === 'home') renderHome();
  if (name === 'preview') renderPreviewScreen();
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
}

/* =====================================================================
   11. EVENT WIRING
   ===================================================================== */

function init() {
  $('#btn-start-workout').addEventListener('click', () => goToScreen('preview'));
  $('#btn-preview-go').addEventListener('click', () => startWorkout());

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
  $all('#bodypart-picker .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const already = btn.classList.contains('selected');
      $all('#bodypart-picker .chip-btn').forEach(b => b.classList.remove('selected'));
      if (!already) { btn.classList.add('selected'); selectedBodyPart = btn.dataset.part; }
      else selectedBodyPart = null;
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
  $('#setting-voice').addEventListener('change', () => {
    const s = getSettings();
    s.voiceOn = $('#setting-voice').checked;
    saveSettings(s);
    if (s.voiceOn) speak('음성 코치를 켰어요');
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

  $all('.onboarding-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      saveLevel(level);
      applyLevelToExerciseState(level);
      $('#onboarding-modal').hidden = true;
      showToast('레벨이 설정됐어요. 몸에 맞춰 천천히 늘려갈게요!');
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

  if (!getLevel()) $('#onboarding-modal').hidden = false;

  forceGoToScreen('home');
}

function resumeDraft(draft) {
  const settings = getSettings();
  currentQueue = buildQueue(settings);
  currentStepIndex = Math.min(draft.currentStepIndex, currentQueue.length - 1);
  sessionStartTime = draft.sessionStartTime || Date.now();
  sessionExerciseLog = draft.sessionExerciseLog || {};
  selectedRpe = null;
  selectedBodyPart = null;
  workoutInProgress = true;
  forceGoToScreen('workout');
  renderWorkoutStep();
  requestWakeLock();
}

document.addEventListener('DOMContentLoaded', init);
