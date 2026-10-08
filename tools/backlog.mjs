#!/usr/bin/env node
// MY BODY OS backlog CLI. backlog.json은 이 도구로만 조회/수정한다.
//   node tools/backlog.mjs <command> [args] [--options]
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import {
  load, save, findTask, newTask, nowIso, STATUSES,
  epicName, writeDocIfMissing, syncDoc, docPath, appendEvent, validate, isReady, normalizeId,
} from './lib/backlog-store.mjs';

const HELP = `backlog CLI — backlog.json 조회/수정/추가

조회
  list [--status s] [--epic E01] [--priority P0] [--phase V1] [--tag t] [--q 검색어] [--all] [--json]
        기본은 done/cancelled 제외. --all 로 전체.
  show <id> [--json]            작업 상세 (문서 경로 포함)
  doc <id>                      상세 문서(docs/<id>.md) 내용 출력
  next [--count 5]              선행 작업이 끝난 todo 작업을 우선순위 순으로
  stats                         상태/Epic별 집계
  epics                         Epic 목록
  validate                      스키마/의존성/문서 존재 검사

수정
  add --title "제목" [--desc "설명"] [--epic E04] [--priority P0] [--phase V1]
      [--deps T-001,T-002] [--req FR-002] [--tags ui,mobile] [--ac "조건1" --ac "조건2"]
      [--status todo|on_hold|needs_decision] [--decision "질문"]
  set <id> [--status s] [--title] [--desc] [--priority] [--epic] [--phase] [--deps] [--tags]
      [--assignee] [--decision "질문"] [--blocked "사유"] [--note "메모"] [--force]
  status <id> <status> [--note "메모"]      set --status 축약형
  note <id> "메모"                          notes에 추가 + 문서 작업 기록에 append

상태값: ${STATUSES.join(' | ')}
`;

const OPTS = {
  status: { type: 'string' }, epic: { type: 'string' }, priority: { type: 'string' },
  phase: { type: 'string' }, tag: { type: 'string' }, q: { type: 'string' }, all: { type: 'boolean' },
  json: { type: 'boolean' }, count: { type: 'string' }, title: { type: 'string' }, desc: { type: 'string' },
  deps: { type: 'string' }, req: { type: 'string' }, tags: { type: 'string' }, ac: { type: 'string', multiple: true },
  decision: { type: 'string' }, blocked: { type: 'string' }, note: { type: 'string' }, assignee: { type: 'string' },
  force: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
};

const csv = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
const fail = (msg) => { console.error(`오류: ${msg}`); process.exit(1); };
const mark = { todo: '·', in_progress: '▶', review: '◆', needs_decision: '?', done: '✓', cancelled: '✗', on_hold: '‖' };

function line(t) {
  const deps = t.depends_on.length ? ` ← ${t.depends_on.join(',')}` : '';
  return `${mark[t.status] ?? ' '} ${t.id}  [${t.priority}/${t.epic}/${t.status}]  ${t.title}${deps}`;
}

function cmdList(data, o) {
  let ts = data.tasks.filter((t) => o.all || o.status || !['done', 'cancelled'].includes(t.status));
  if (o.status) ts = ts.filter((t) => t.status === o.status);
  if (o.epic) ts = ts.filter((t) => t.epic === o.epic.toUpperCase());
  if (o.priority) ts = ts.filter((t) => t.priority === o.priority.toUpperCase());
  if (o.phase) ts = ts.filter((t) => t.phase === o.phase);
  if (o.tag) ts = ts.filter((t) => t.tags.includes(o.tag));
  if (o.q) { const q = o.q.toLowerCase(); ts = ts.filter((t) => (t.title + t.description).toLowerCase().includes(q)); }
  if (o.json) return console.log(JSON.stringify(ts, null, 2));
  ts.forEach((t) => console.log(line(t)));
  console.log(`\n${ts.length}개 (조회/수정: node tools/backlog.mjs show|set <id>)`);
}

function cmdShow(data, id, o) {
  const t = findTask(data, id);
  if (o.json) return console.log(JSON.stringify(t, null, 2));
  console.log(`${t.id} · ${t.title}\n${t.description}\n`);
  console.log(`상태: ${t.status}   우선순위: ${t.priority}   Epic: ${epicName(data, t.epic)}   단계: ${t.phase}`);
  console.log(`예상: ${t.estimate_minutes}분   선행: ${t.depends_on.join(', ') || '없음'}   요구사항: ${t.requirements.join(', ') || '없음'}`);
  console.log(`태그: ${t.tags.join(', ') || '-'}   담당: ${t.assignee ?? '-'}   문서: ${t.doc}`);
  if (t.decision_needed) console.log(`판단 필요: ${t.decision_needed}`);
  if (t.blocked_reason) console.log(`차단 사유: ${t.blocked_reason}`);
  if (t.acceptance_criteria.length) console.log(`\n완료 조건:\n${t.acceptance_criteria.map((c) => `  - ${c}`).join('\n')}`);
  if (t.notes.length) console.log(`\n메모:\n${t.notes.map((n) => `  - ${n.at.slice(0, 10)} ${n.text}`).join('\n')}`);
  console.log(`\n이력:\n${t.history.map((h) => `  ${h.at.slice(0, 16)} ${h.from ?? '-'} → ${h.to}${h.note ? ` (${h.note})` : ''}`).join('\n')}`);
}

function cmdNext(data, o) {
  const n = Number(o.count ?? 5);
  const ready = data.tasks.filter((t) => isReady(t, data))
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.order - b.order).slice(0, n);
  const active = data.tasks.filter((t) => t.status === 'in_progress');
  if (active.length) console.log(`작업중:\n${active.map(line).join('\n')}\n`);
  console.log(ready.length ? `다음 작업 후보:\n${ready.map(line).join('\n')}` : '착수 가능한 todo 작업이 없습니다.');
}

function cmdStats(data) {
  const by = (key) => data.tasks.reduce((m, t) => ((m[t[key]] = (m[t[key]] ?? 0) + 1), m), {});
  const st = by('status');
  console.log('상태별:');
  for (const s of STATUSES) console.log(`  ${s.padEnd(15)} ${st[s] ?? 0}`);
  console.log('\nEpic별 (done/전체):');
  for (const e of data.epics) {
    const ts = data.tasks.filter((t) => t.epic === e.id);
    console.log(`  ${e.id} ${e.name.padEnd(12)} ${ts.filter((t) => t.status === 'done').length}/${ts.length}`);
  }
  const remain = data.tasks.filter((t) => !['done', 'cancelled', 'on_hold'].includes(t.status)).length;
  console.log(`\n총 ${data.tasks.length}개 · 남은 작업 ${remain}개 ≈ ${(remain * data.unit_minutes / 60).toFixed(1)}시간`);
}

function cmdAdd(data, o) {
  if (!o.title) fail('--title 필수');
  const fields = {
    title: o.title, description: o.desc ?? '', epic: o.epic?.toUpperCase(), priority: o.priority?.toUpperCase(),
    phase: o.phase, depends_on: csv(o.deps)?.map(normalizeId), requirements: csv(o.req), tags: csv(o.tags),
    acceptance_criteria: o.ac, status: o.status, decision_needed: o.decision,
  };
  if (fields.status && !STATUSES.includes(fields.status)) fail(`잘못된 status: ${fields.status}`);
  const t = newTask(data, fields);
  t.doc = `docs/${t.id}.md`;
  data.tasks.push(t);
  const errs = validate(data).filter((e) => e.startsWith(t.id) && !e.includes('상세 문서 없음'));
  if (errs.length) fail(errs.join('\n'));
  writeDocIfMissing(t, data);
  save(data);
  appendEvent({ type: 'add', id: t.id, title: t.title });
  console.log(`추가됨: ${line(t)}\n문서: ${t.doc} (작업 단계/완료 조건을 채우세요)`);
}

function applyStatus(t, next, note, force) {
  if (!STATUSES.includes(next)) fail(`잘못된 status: ${next} (${STATUSES.join('|')})`);
  if (t.status === next) return false;
  if (t.status === 'done' && !force) fail(`${t.id}는 이미 done 입니다. 되돌리려면 --force`);
  if (next === 'needs_decision' && !t.decision_needed) fail('needs_decision 으로 바꾸려면 --decision "질문" 필요');
  const at = nowIso();
  t.history.push({ at, from: t.status, to: next, note: note ?? null });
  if (next === 'in_progress' && !t.started_at) t.started_at = at;
  if (next === 'done') t.completed_at = at;
  appendEvent({ type: 'status', id: t.id, title: t.title, from: t.status, to: next, note: note ?? null });
  t.status = next;
  return true;
}

function cmdSet(data, id, o) {
  const t = findTask(data, id);
  const changes = [];
  if (o.title) { t.title = o.title; changes.push('title'); }
  if (o.desc) { t.description = o.desc; changes.push('description'); }
  if (o.priority) { t.priority = o.priority.toUpperCase(); changes.push('priority'); }
  if (o.epic) { t.epic = o.epic.toUpperCase(); changes.push('epic'); }
  if (o.phase) { t.phase = o.phase; changes.push('phase'); }
  if (o.deps !== undefined) { t.depends_on = csv(o.deps)?.map(normalizeId) ?? []; changes.push('depends_on'); }
  if (o.tags !== undefined) { t.tags = csv(o.tags) ?? []; changes.push('tags'); }
  if (o.assignee !== undefined) { t.assignee = o.assignee || null; changes.push('assignee'); }
  if (o.decision !== undefined) { t.decision_needed = o.decision || null; changes.push('decision_needed'); }
  if (o.blocked !== undefined) { t.blocked_reason = o.blocked || null; changes.push('blocked_reason'); }
  if (o.note) { t.notes.push({ at: nowIso(), text: o.note }); changes.push('note'); }
  let statusChanged = false;
  if (o.status) statusChanged = applyStatus(t, o.status, o.note, o.force);
  if (!changes.length && !statusChanged) fail('변경할 항목이 없습니다 (--status, --title, --note ...)');
  t.updated_at = nowIso();
  const errs = validate(data).filter((e) => e.startsWith(t.id));
  if (errs.length) fail(errs.join('\n'));
  save(data);
  const record = statusChanged ? `상태 ${t.history.at(-1).from} → ${t.status}${o.note ? `: ${o.note}` : ''}`
    : (o.note ? `메모: ${o.note}` : `수정: ${changes.join(', ')}`);
  syncDoc(t, data, record);
  console.log(`수정됨: ${line(t)}${changes.length ? `  (${changes.join(', ')})` : ''}`);
  if (t.status === 'done') console.log('→ done 전환: hook이 lint/build 후 commit + push 합니다.');
}

function cmdValidate(data) {
  const errs = validate(data);
  if (!errs.length) return console.log(`OK: ${data.tasks.length}개 작업, 오류 없음`);
  errs.forEach((e) => console.log(`- ${e}`));
  process.exit(1);
}

function main() {
  const { values: o, positionals } = parseArgs({ options: OPTS, allowPositionals: true, strict: false });
  const [cmd, a1, a2] = positionals;
  if (!cmd || o.help) return console.log(HELP);
  const data = load();
  switch (cmd) {
    case 'list': case 'ls': return cmdList(data, o);
    case 'show': return a1 ? cmdShow(data, a1, o) : fail('id 필요');
    case 'doc': return a1 ? console.log(fs.readFileSync(docPath(findTask(data, a1)), 'utf8')) : fail('id 필요');
    case 'next': return cmdNext(data, o);
    case 'stats': return cmdStats(data);
    case 'epics': return data.epics.forEach((e) => console.log(`${e.id} [${e.priority}] ${e.name} — ${e.description ?? ''}`));
    case 'validate': return cmdValidate(data);
    case 'add': return cmdAdd(data, o);
    case 'set': return a1 ? cmdSet(data, a1, o) : fail('id 필요');
    case 'status': return a1 && a2 ? cmdSet(data, a1, { ...o, status: a2 }) : fail('사용법: status <id> <status>');
    case 'note': return a1 && a2 ? cmdSet(data, a1, { ...o, note: a2 }) : fail('사용법: note <id> "메모"');
    default: fail(`알 수 없는 명령: ${cmd}\n${HELP}`);
  }
}

try { main(); } catch (e) { fail(e.message); }
