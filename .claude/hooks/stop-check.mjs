// Stop: 턴 종료 전에 lint → test → build 를 강제한다. 소스가 바뀌지 않았으면 건너뛰고, 실패하면 종료를 막아 수정하게 한다.
import {
  readInput,
  emit,
  pkgScripts,
  runScript,
  sourceFingerprint,
  readState,
  writeState,
  isGitRepo,
} from './lib.mjs'

const MAX_STREAK = 3
const STEPS = ['lint', 'test', 'build']
const STEP_TIMEOUT_MS = 240_000 // 3단계 합이 hook timeout(900s) 안에 들어오도록

function main() {
  const input = readInput()
  const scripts = pkgScripts()
  if (!STEPS.some((s) => scripts[s])) return // 프로젝트 셋업 전
  if (!isGitRepo()) return

  const fp = sourceFingerprint()
  const state = readState('lint-build.json', {
    fingerprint: null,
    ok: false,
    streak: 0,
    which: null,
  })
  if (state.fingerprint === fp && state.ok) return // 마지막 통과 이후 변경 없음

  // 앞 단계가 실패하면 뒤는 건너뛴다.
  const results = {}
  let failed = null
  for (const name of STEPS) {
    results[name] = failed ? { skipped: true, ok: true, out: '' } : runScript(name, STEP_TIMEOUT_MS)
    if (!results[name].ok && !failed) failed = name
  }
  const ok = !failed
  // 같은 단계가 연속 실패할 때만 streak 누적. 다른 단계로 넘어갔으면 0 부터.
  const streak = ok ? 0 : state.which === failed ? (state.streak ?? 0) + 1 : 1
  writeState('lint-build.json', {
    fingerprint: fp,
    ok,
    streak,
    which: failed,
    at: new Date().toISOString(),
  })

  if (ok) {
    const ran = STEPS.filter((s) => !results[s].skipped).join(' + ')
    if (ran) emit({ systemMessage: `✓ ${ran} 통과` })
    return
  }
  const out = results[failed].out.slice(-3000)
  if (input.stop_hook_active && streak >= MAX_STREAK) {
    emit({
      systemMessage: `⛔ ${failed} 가 ${streak}회 연속 실패했습니다. 자동 재시도를 멈춥니다. 사람의 확인이 필요합니다.`,
    })
    return
  }
  emit({
    decision: 'block',
    reason: `${failed} 실패 (${streak}/${MAX_STREAK}). 종료 전에 반드시 통과해야 합니다. 아래 출력을 보고 수정한 뒤 다시 시도하세요:\n${out}`,
    systemMessage: `⛔ ${failed} 실패 — 수정 후 재시도 (${streak}/${MAX_STREAK})`,
  })
}

main()
