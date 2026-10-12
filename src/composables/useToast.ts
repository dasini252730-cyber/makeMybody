import { readonly, ref } from 'vue'

// 앱 전역 토스트. 저장 실패는 반드시 사용자에게 보여야 하므로(NFR-003) error 는 자동으로 사라지지 않고
// 개수 상한에서도 밀려나지 않는다. 입력 UI 를 덮지 않도록 success 는 MAX_TOASTS 안에서만 유지하고,
// 같은 종류·같은 문구는 하나로 합친다(횟수 표시, 타이머 재시작).
export type ToastType = 'success' | 'error'
export interface Toast {
  id: number
  type: ToastType
  message: string
  /** 같은 메시지가 반복된 횟수 (1이면 표시 안 함) */
  count: number
}

export const MAX_TOASTS = 3

const toasts = ref<Toast[]>([])
let seq = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export function useToast() {
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
    clearTimer(id)
  }
  function clearTimer(id: number) {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
  }
  function arm(id: number, durationMs: number) {
    clearTimer(id)
    if (durationMs > 0)
      timers.set(
        id,
        setTimeout(() => dismiss(id), durationMs),
      )
  }

  function show(type: ToastType, message: string, durationMs = type === 'error' ? 0 : 2500) {
    const same = toasts.value.find((t) => t.type === type && t.message === message)
    if (same) {
      toasts.value = toasts.value.map((t) => (t.id === same.id ? { ...t, count: t.count + 1 } : t))
      arm(same.id, durationMs)
      return same.id
    }
    const toast: Toast = { id: ++seq, type, message, count: 1 }
    const next = [...toasts.value, toast]
    // 상한 초과 시 (방금 추가한 것을 제외하고) success 중 가장 오래된 것부터 제거.
    // error 는 사용자가 닫기 전엔 남기고, 새 토스트는 종류와 무관하게 반드시 보인다.
    while (next.length > MAX_TOASTS) {
      const idx = next.findIndex((t) => t.type === 'success' && t.id !== toast.id)
      if (idx < 0) break
      const [evicted] = next.splice(idx, 1)
      if (evicted) clearTimer(evicted.id)
    }
    toasts.value = next
    arm(toast.id, durationMs)
    return toast.id
  }

  return {
    toasts: readonly(toasts),
    success: (message: string, durationMs?: number) => show('success', message, durationMs),
    error: (message: string, durationMs?: number) => show('error', message, durationMs),
    dismiss,
    clear: () => [...toasts.value].forEach((t) => dismiss(t.id)),
  }
}
