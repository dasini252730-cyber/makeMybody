// Stop: 턴 종료 전에 lint + build 를 강제한다. 소스가 바뀌지 않았으면 건너뛰고, 실패하면 종료를 막아 수정하게 한다.
import { readInput, emit, pkgScripts, runScript, sourceFingerprint, readState, writeState, isGitRepo } from './lib.mjs';

const MAX_STREAK = 3;

function main() {
  const input = readInput();
  const scripts = pkgScripts();
  if (!scripts.lint && !scripts.build) return; // 프로젝트 셋업 전
  if (!isGitRepo()) return;

  const fp = sourceFingerprint();
  const state = readState('lint-build.json', { fingerprint: null, ok: false, streak: 0 });
  if (state.fingerprint === fp && state.ok) return; // 마지막 통과 이후 변경 없음

  const lint = runScript('lint');
  const build = lint.ok ? runScript('build', 300_000) : { skipped: true, ok: true, out: '' };
  const ok = lint.ok && build.ok;
  const streak = ok ? 0 : (state.streak ?? 0) + 1;
  writeState('lint-build.json', { fingerprint: fp, ok, streak, at: new Date().toISOString() });

  if (ok) {
    const ran = [lint.skipped ? null : 'lint', build.skipped ? null : 'build'].filter(Boolean).join(' + ');
    if (ran) emit({ systemMessage: `✓ ${ran} 통과` });
    return;
  }
  const which = !lint.ok ? 'lint' : 'build';
  const out = (!lint.ok ? lint.out : build.out).slice(-3000);
  if (input.stop_hook_active && streak >= MAX_STREAK) {
    emit({ systemMessage: `⛔ ${which} 가 ${streak}회 연속 실패했습니다. 자동 재시도를 멈춥니다. 사람의 확인이 필요합니다.` });
    return;
  }
  emit({
    decision: 'block',
    reason: `${which} 실패 (${streak}/${MAX_STREAK}). 종료 전에 반드시 통과해야 합니다. 아래 출력을 보고 수정한 뒤 다시 시도하세요:\n${out}`,
    systemMessage: `⛔ ${which} 실패 — 수정 후 재시도 (${streak}/${MAX_STREAK})`,
  });
}

main();
