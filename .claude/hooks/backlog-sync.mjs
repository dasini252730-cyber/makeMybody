// PostToolUse(Bash|PowerShell): backlog.json/docs 변경을 자동 commit 한다.
// 상태가 done 으로 바뀐 이벤트가 있으면 lint/build 검증 후 작업 내역 전체를 정리해 commit + push 한다.
import { readInput, emit, git, isGitRepo, currentBranch, runScript, backlogCli } from './lib.mjs';
import { readEvents } from '../../tools/lib/backlog-store.mjs';

const TRAILER = '\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>';

function describeEvents(events) {
  return events.map((e) => (e.type === 'status' ? `${e.id} ${e.from}→${e.to}` : `${e.id} 추가`)).join(', ');
}

function taskSummary(id) {
  try {
    const t = JSON.parse(backlogCli(['show', id, '--json']));
    const ac = t.acceptance_criteria.map((c) => `  - [x] ${c}`).join('\n');
    const notes = t.notes.map((n) => `  - ${n.text}`).join('\n');
    return `## ${t.id} ${t.title}\n${t.description}\n완료 조건:\n${ac || '  - (없음)'}${notes ? `\n메모:\n${notes}` : ''}`;
  } catch { return `## ${id}`; }
}

function commitBacklogOnly(events) {
  git(['add', '--', 'backlog.json', 'docs']);
  if (!git(['diff', '--cached', '--quiet']).ok) {
    const msg = `backlog: ${events.length ? describeEvents(events) : '작업 목록 갱신'}${TRAILER}`;
    const r = git(['commit', '-q', '-m', msg]);
    return r.ok ? `backlog 커밋: ${describeEvents(events) || '갱신'}` : `backlog 커밋 실패: ${r.err}`;
  }
  return null;
}

function revertToReview(doneEvents, why) {
  for (const e of doneEvents) backlogCli(['set', e.id, '--status', 'review', '--force', '--note', `자동 되돌림: ${why}`]);
}

function commitAndPush(doneEvents, allEvents) {
  const ids = doneEvents.map((e) => e.id);
  git(['add', '-A']);
  const stat = git(['diff', '--cached', '--stat']).out;
  if (!stat) return { ok: true, msg: `done 이벤트(${ids.join(', ')})가 있지만 커밋할 변경이 없습니다.` };
  const title = `done: ${doneEvents.map((e) => `${e.id} ${e.title}`).join(', ')}`;
  const body = [
    ids.map(taskSummary).join('\n\n'),
    allEvents.length ? `backlog 이벤트: ${describeEvents(allEvents)}` : '',
    `변경 파일:\n${stat}`,
  ].filter(Boolean).join('\n\n');
  const c = git(['commit', '-q', '-m', `${title}\n\n${body}${TRAILER}`]);
  if (!c.ok) return { ok: false, msg: `커밋 실패: ${c.err}` };

  const branch = currentBranch();
  if (!git(['remote']).out) {
    return { ok: true, msg: `커밋 완료(${branch}). 원격 저장소가 없어 push 생략 — git remote add origin <url> 후 git push -u origin ${branch}` };
  }
  const p = git(['push', '-u', 'origin', 'HEAD'], { timeout: 60_000 });
  return p.ok ? { ok: true, msg: `커밋 + push 완료 (${branch}): ${title}` } : { ok: true, msg: `커밋은 됐지만 push 실패: ${p.err.slice(-500)}` };
}

function main() {
  readInput();
  if (!isGitRepo()) return;
  const events = readEvents({ clear: true });
  const doneEvents = events.filter((e) => e.type === 'status' && e.to === 'done');
  const messages = [];

  if (doneEvents.length) {
    const lint = runScript('lint');
    const build = lint.ok ? runScript('build') : { skipped: true, ok: true, out: '' };
    if (!lint.ok || !build.ok) {
      const which = !lint.ok ? 'lint' : 'build';
      revertToReview(doneEvents, `${which} 실패`);
      commitBacklogOnly(events);
      emit({
        decision: 'block',
        reason: `done 처리 거부 — ${which} 실패. ${doneEvents.map((e) => e.id).join(', ')} 를 review 로 되돌렸습니다. ` +
          `문제를 고친 뒤 다시 done 으로 바꾸세요.\n${(!lint.ok ? lint.out : build.out)}`,
        systemMessage: `⛔ ${which} 실패로 done 취소 (${doneEvents.map((e) => e.id).join(', ')})`,
      });
      return;
    }
    const r = commitAndPush(doneEvents, events);
    messages.push(r.msg);
  } else {
    const m = commitBacklogOnly(events);
    if (m) messages.push(m);
  }

  if (currentBranch() === 'main' && messages.length) messages.push('⚠ main 브랜치에서 커밋했습니다. dev 로 전환하세요.');
  if (messages.length) emit({ systemMessage: messages.join(' | ') });
}

main();
