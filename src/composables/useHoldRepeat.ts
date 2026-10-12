import { onBeforeUnmount } from 'vue'

export interface HoldRepeatOptions {
  /** 반복이 시작되기까지 대기 (ms) */
  delayMs?: number
  /** 첫 반복 간격 (ms) */
  startMs?: number
  /** 최소 간격 (ms) */
  minMs?: number
  /** 매 반복마다 줄어드는 간격 (ms) */
  accelMs?: number
}

/** 포인터 시퀀스가 끝난 뒤 이 시간 안에 오는 포인터 유래 click 은 같은 조작으로 본다. */
const POINTER_CLICK_WINDOW_MS = 700

/**
 * 버튼 길게 누르기 반복기. pointerdown 에서 `start(fire)` 를 부르면 delayMs 뒤부터 가속 반복한다.
 * 단발 조작은 여기서 하지 않고 click 에 맡긴다 — 그래서 스크롤하려고 버튼 위에서 손가락을 뗀 경우
 * (pointercancel, click 없음)에는 값이 바뀌지 않는다. `fire()` 가 false 면(경계 도달) 스스로 멈춘다.
 *
 * 반복이 한 번이라도 돌았으면 그 시퀀스가 만든 호환 click(detail > 0, 직후)은 `shouldIgnoreClick` 으로 걸러
 * 추가 증감을 막는다. 키보드 Enter/Space·보조기기 활성화(detail 0)는 항상 통과한다.
 * pointerleave 는 반복만 멈추고(`pause`) 시퀀스는 window pointerup 까지 유지해 종료 시각을 정확히 잡는다.
 */
export function useHoldRepeat(opts: HoldRepeatOptions = {}) {
  const { delayMs = 400, startMs = 150, minMs = 50, accelMs = 20 } = opts
  let timer: ReturnType<typeof setTimeout> | null = null
  let repeated = false
  let endedAt = Number.NEGATIVE_INFINITY

  function pause() {
    if (timer) clearTimeout(timer)
    timer = null
  }
  function end() {
    pause()
    endedAt = Date.now()
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
  }

  function start(fire: () => boolean) {
    end()
    repeated = false
    let interval = startMs
    const tick = () => {
      if (!fire()) return pause()
      repeated = true
      interval = Math.max(minMs, interval - accelMs)
      timer = setTimeout(tick, interval)
    }
    timer = setTimeout(tick, delayMs)
    window.addEventListener('pointerup', end, { once: true })
    window.addEventListener('pointercancel', end, { once: true })
  }

  /** 길게 누르기가 이미 값을 바꿨고, 그 포인터 시퀀스가 만든 click 이면 true. */
  function shouldIgnoreClick(e: MouseEvent): boolean {
    return repeated && e.detail > 0 && Date.now() - endedAt < POINTER_CLICK_WINDOW_MS
  }

  onBeforeUnmount(end)
  return { start, pause, end, shouldIgnoreClick }
}
