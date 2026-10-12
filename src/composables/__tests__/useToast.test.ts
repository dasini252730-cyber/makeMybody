import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_TOASTS, useToast } from '@/composables/useToast'

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    useToast().clear()
    vi.useRealTimers()
  })

  it('success 는 2.5초 뒤 자동으로 사라진다', () => {
    const t = useToast()
    t.success('저장됨')
    expect(t.toasts.value.length).toBe(1)
    vi.advanceTimersByTime(2500)
    expect(t.toasts.value.length).toBe(0)
  })

  it('error 는 자동으로 사라지지 않고 dismiss 로만 닫힌다 (NFR-003)', () => {
    const t = useToast()
    const id = t.error('저장 실패')
    vi.advanceTimersByTime(60_000)
    expect(t.toasts.value.length).toBe(1)
    expect(t.toasts.value[0]?.type).toBe('error')
    t.dismiss(id)
    expect(t.toasts.value.length).toBe(0)
  })

  it('여러 composable 인스턴스가 같은 목록을 공유한다', () => {
    useToast().success('a')
    useToast().error('b')
    expect(useToast().toasts.value.map((x) => x.message)).toEqual(['a', 'b'])
  })

  it('같은 종류·같은 문구는 하나로 합치고 횟수를 세며 타이머를 다시 시작한다', () => {
    const t = useToast()
    const first = t.success('저장되었습니다')
    vi.advanceTimersByTime(2400)
    const second = t.success('저장되었습니다')
    expect(second).toBe(first)
    expect(t.toasts.value.length).toBe(1)
    expect(t.toasts.value[0]?.count).toBe(2)
    vi.advanceTimersByTime(200) // 병합 시점부터 2.5초가 다시 시작되므로 아직 남아 있어야 한다
    expect(t.toasts.value.length).toBe(1)
    vi.advanceTimersByTime(2300)
    expect(t.toasts.value.length).toBe(0)
    // 종류가 다르면 별개
    t.error('x')
    t.success('x')
    expect(t.toasts.value.length).toBe(2)
  })

  it(`상한(${MAX_TOASTS}) 초과 시 success 중 가장 오래된 것부터 지운다`, () => {
    const t = useToast()
    t.success('성공 1')
    t.error('오류 1')
    t.success('성공 2')
    t.success('성공 3') // 4개째 → 성공 1 축출
    expect(t.toasts.value.map((x) => x.message)).toEqual(['오류 1', '성공 2', '성공 3'])
    vi.advanceTimersByTime(5000) // 축출된 토스트의 타이머가 남아 있어도 다른 것을 지우지 않아야 한다
    expect(t.toasts.value.map((x) => x.message)).toEqual(['오류 1'])
  })

  it('error 는 상한에 걸려도 사용자가 닫기 전까지 밀려나지 않는다 (NFR-003)', () => {
    const t = useToast()
    for (let i = 1; i <= MAX_TOASTS; i++) t.error(`오류 ${i}`)
    t.error('오류 추가')
    const msgs = t.toasts.value.map((x) => x.message)
    expect(msgs).toContain('오류 1')
    expect(msgs).toContain('오류 추가')
    expect(t.toasts.value.length).toBe(MAX_TOASTS + 1)
  })

  it('error 가 가득 차 있어도 방금 추가한 success 는 보이고 제 시간에 사라진다', () => {
    const t = useToast()
    for (let i = 1; i <= MAX_TOASTS; i++) t.error(`오류 ${i}`)
    const id = t.success('저장되었습니다')
    expect(t.toasts.value.map((x) => x.id)).toContain(id)
    expect(t.toasts.value.length).toBe(MAX_TOASTS + 1)
    vi.advanceTimersByTime(2500)
    expect(t.toasts.value.map((x) => x.id)).not.toContain(id)
    expect(t.toasts.value.length).toBe(MAX_TOASTS)
  })
})
