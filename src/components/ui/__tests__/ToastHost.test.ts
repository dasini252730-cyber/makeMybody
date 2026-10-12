import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useToast } from '@/composables/useToast'

afterEach(() => useToast().clear())

describe('ToastHost', () => {
  it('성공/오류를 색 외에 아이콘과 접두 텍스트로 구분한다 (NFR-006)', async () => {
    const w = mount(ToastHost)
    const t = useToast()
    t.success('저장되었습니다')
    t.error('저장 실패')
    await w.vm.$nextTick()
    const items = w.findAll('.toast')
    expect(items.length).toBe(2)
    expect(items[0]!.classes()).toContain('success')
    expect(items[0]!.text()).toContain('완료')
    expect(items[0]!.find('.icon').text()).toBe('✓')
    expect(items[1]!.classes()).toContain('error')
    expect(items[1]!.text()).toContain('실패')
    expect(items[1]!.find('.icon').text()).toBe('!')
  })

  it('닫기 버튼이 별도로 있고 누르면 해당 토스트만 닫힌다', async () => {
    const w = mount(ToastHost)
    const t = useToast()
    t.error('a')
    t.error('b')
    await w.vm.$nextTick()
    const close = w.findAll('button[aria-label="알림 닫기"]')
    expect(close.length).toBe(2)
    await close[0]!.trigger('click')
    expect(t.toasts.value.map((x) => x.message)).toEqual(['b'])
  })

  it('라이브 리전은 컨테이너 하나뿐이고 반복 횟수를 표시한다', async () => {
    const w = mount(ToastHost)
    const t = useToast()
    t.error('저장 실패')
    t.error('저장 실패')
    await w.vm.$nextTick()
    expect(w.findAll('[aria-live]').length).toBe(1)
    expect(w.findAll('[role]').length).toBe(1)
    expect(w.find('.count').text()).toBe('×2')
  })
})
