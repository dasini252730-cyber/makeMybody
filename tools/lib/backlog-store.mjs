// backlog.json 저장소 계층. CLI(tools/backlog.mjs)와 hook에서 공용으로 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BACKLOG_PATH = path.join(ROOT, 'backlog.json');
export const DOCS_DIR = path.join(ROOT, 'docs');
export const STATE_DIR = path.join(ROOT, '.claude', 'state');
export const EVENTS_PATH = path.join(STATE_DIR, 'backlog-events.jsonl');

export const STATUSES = ['todo', 'in_progress', 'review', 'needs_decision', 'done', 'cancelled', 'on_hold'];
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4'];
export const PHASES = ['V1', 'V1.1', 'V2'];

export function nowIso() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().replace('Z', '+09:00').replace(/\.\d{3}/, '');
}
export const today = () => nowIso().slice(0, 10);

export function load() {
  if (!fs.existsSync(BACKLOG_PATH)) throw new Error(`backlog.json 없음: ${BACKLOG_PATH}`);
  return JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
}

export function save(data) {
  data.updated_at = nowIso();
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function findTask(data, id) {
  const norm = normalizeId(id);
  const t = data.tasks.find((x) => x.id === norm);
  if (!t) throw new Error(`작업을 찾을 수 없음: ${id}`);
  return t;
}

export function normalizeId(id) {
  const m = String(id).trim().match(/^(?:T-?)?(\d{1,3})$/i);
  return m ? `T-${m[1].padStart(3, '0')}` : String(id).trim();
}

export function nextId(data) {
  const max = data.tasks.reduce((m, t) => Math.max(m, Number(t.id.slice(2))), 0);
  return `T-${String(max + 1).padStart(3, '0')}`;
}

export function epicName(data, epicId) {
  const e = data.epics.find((x) => x.id === epicId);
  return e ? `${e.id} · ${e.name}` : epicId;
}

export function newTask(data, fields) {
  const at = nowIso();
  return {
    id: nextId(data),
    title: fields.title,
    description: fields.description ?? '',
    doc: '',
    status: fields.status ?? 'todo',
    priority: fields.priority ?? 'P2',
    epic: fields.epic ?? data.epics.at(-1)?.id ?? 'E17',
    phase: fields.phase ?? 'V1',
    estimate_minutes: data.unit_minutes ?? 30,
    order: data.tasks.length + 1,
    depends_on: fields.depends_on ?? [],
    requirements: fields.requirements ?? [],
    tags: fields.tags ?? [],
    acceptance_criteria: fields.acceptance_criteria ?? [],
    assignee: null,
    decision_needed: fields.decision_needed ?? null,
    blocked_reason: null,
    created_at: at,
    updated_at: at,
    started_at: null,
    completed_at: null,
    history: [{ at, from: null, to: fields.status ?? 'todo', note: 'CLI로 추가' }],
    notes: [],
  };
}

const PLACEHOLDER = '_backlog-briefer 에이전트가 작성합니다._';

export function renderDoc(task, data) {
  const list = (arr, empty = '없음') => (arr && arr.length ? arr.join(', ') : empty);
  const ac = task.acceptance_criteria.length
    ? task.acceptance_criteria.map((c) => `- [ ] ${c}`).join('\n')
    : '- [ ] (완료 조건을 작성하세요)';
  const decision = task.decision_needed ? `- 판단 필요: ${task.decision_needed}` : '- 없음';
  return `# ${task.id} · ${task.title}

> ${task.description}

| 항목 | 값 |
|---|---|
| 상태 | ${task.status} |
| 우선순위 | ${task.priority} |
| Epic | ${epicName(data, task.epic)} |
| 단계 | ${task.phase} |
| 예상 시간 | ${task.estimate_minutes}분 |
| 선행 작업 | ${list(task.depends_on)} |
| 요구사항 | ${list(task.requirements)} |
| 태그 | ${list(task.tags, '-')} |

## 목표
${task.description}

## 배경 / 요구사항 참조
요구사항.md의 ${list(task.requirements, '관련')} 섹션을 참조한다.

## 작업 단계
1. (작업 단계를 작성하세요)

## 완료 조건
${ac}

## 결정 / 주의 사항
${decision}

## 쉬운 설명
${PLACEHOLDER}

## 관련 파일
${PLACEHOLDER}

## 작업 기록
- ${today()} CLI로 생성
`;
}

export function docPath(task) {
  return path.join(ROOT, task.doc || `docs/${task.id}.md`);
}

export function writeDocIfMissing(task, data) {
  const p = docPath(task);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, renderDoc(task, data), 'utf8');
  }
  return p;
}

// 상태 행 갱신 + 작업 기록 append. 문서가 없으면 새로 만든다.
export function syncDoc(task, data, record) {
  const p = writeDocIfMissing(task, data);
  let md = fs.readFileSync(p, 'utf8');
  md = md.replace(/^\| 상태 \| .* \|$/m, `| 상태 | ${task.status} |`);
  md = md.replace(/^\| 선행 작업 \| .* \|$/m, `| 선행 작업 | ${task.depends_on.length ? task.depends_on.join(', ') : '없음'} |`);
  md = md.replace(/^\| 우선순위 \| .* \|$/m, `| 우선순위 | ${task.priority} |`);
  if (record) {
    if (!/^## 작업 기록/m.test(md)) md += '\n## 작업 기록\n';
    md = md.trimEnd() + `\n- ${today()} ${record}\n`;
  }
  fs.writeFileSync(p, md, 'utf8');
}

export function appendEvent(evt) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.appendFileSync(EVENTS_PATH, JSON.stringify({ at: nowIso(), ...evt }) + '\n', 'utf8');
}

export function readEvents({ clear = false } = {}) {
  if (!fs.existsSync(EVENTS_PATH)) return [];
  const lines = fs.readFileSync(EVENTS_PATH, 'utf8').split('\n').filter(Boolean);
  if (clear) fs.writeFileSync(EVENTS_PATH, '', 'utf8');
  return lines.map((l) => JSON.parse(l));
}

export function validate(data) {
  const errors = [];
  const ids = new Set();
  const epicIds = new Set((data.epics ?? []).map((e) => e.id));
  for (const t of data.tasks) {
    if (ids.has(t.id)) errors.push(`${t.id}: 중복 id`);
    ids.add(t.id);
    if (!STATUSES.includes(t.status)) errors.push(`${t.id}: 잘못된 status '${t.status}'`);
    if (!PRIORITIES.includes(t.priority)) errors.push(`${t.id}: 잘못된 priority '${t.priority}'`);
    if (!PHASES.includes(t.phase)) errors.push(`${t.id}: 잘못된 phase '${t.phase}'`);
    if (!epicIds.has(t.epic)) errors.push(`${t.id}: 없는 epic '${t.epic}'`);
    if (t.doc !== `docs/${t.id}.md`) errors.push(`${t.id}: doc 경로는 docs/${t.id}.md 여야 함`);
    if (!fs.existsSync(docPath(t))) errors.push(`${t.id}: 상세 문서 없음 (${t.doc})`);
    if (t.status === 'needs_decision' && !t.decision_needed) errors.push(`${t.id}: needs_decision 인데 decision_needed 비어 있음`);
    if (t.estimate_minutes !== (data.unit_minutes ?? 30)) errors.push(`${t.id}: estimate_minutes는 ${data.unit_minutes}이어야 함`);
  }
  for (const t of data.tasks) {
    for (const d of t.depends_on) {
      if (!ids.has(d)) errors.push(`${t.id}: 없는 선행 작업 '${d}'`);
      if (d === t.id) errors.push(`${t.id}: 자기 자신에 의존`);
    }
  }
  errors.push(...findCycles(data.tasks));
  return errors;
}

function findCycles(tasks) {
  const map = new Map(tasks.map((t) => [t.id, t.depends_on]));
  const state = new Map();
  const out = [];
  const visit = (id, stack) => {
    if (state.get(id) === 1) { out.push(`순환 의존: ${[...stack, id].join(' -> ')}`); return; }
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const d of map.get(id) ?? []) if (map.has(d)) visit(d, [...stack, id]);
    state.set(id, 2);
  };
  for (const id of map.keys()) visit(id, []);
  return out;
}

export function isReady(task, data) {
  if (task.status !== 'todo') return false;
  return task.depends_on.every((d) => {
    const dep = data.tasks.find((t) => t.id === d);
    return !dep || dep.status === 'done' || dep.status === 'cancelled';
  });
}
