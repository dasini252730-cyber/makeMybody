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

  it('라이브 리전은 종류별 하나씩: 오류는 assertive(alert), 성공은 polite(status). 토스트 자체는 role 이 없다', async () => {
    const w = mount(ToastHost)
    // 토스트가 0개일 때도 두 리전이 DOM 에 있어야 스크린리더가 감시를 시작한다 (display:none 금지)
    expect(w.findAll('[aria-live]').length).toBe(2) // (scoped CSS 는 jsdom 이 적용하지 않으므로 display 는 검사 불가)
    const t = useToast()
    t.error('저장 실패')
    t.error('저장 실패')
    t.success('저장되었습니다')
    await w.vm.$nextTick()
    expect(w.findAll('[aria-live]').length).toBe(2)
    expect(w.find('.toast .body').attributes('aria-atomic')).toBe('true') // 닫기 버튼은 낭독에서 제외
    expect(w.find('[role="alert"]').attributes('aria-live')).toBe('assertive')
    expect(w.find('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(w.find('[role="alert"]').findAll('.toast').length).toBe(1)
    expect(w.find('[role="status"]').findAll('.toast').length).toBe(1)
    expect(w.findAll('.toast[role]').length).toBe(0)
    expect(w.find('.count').text()).toBe('×2')
  })
})
