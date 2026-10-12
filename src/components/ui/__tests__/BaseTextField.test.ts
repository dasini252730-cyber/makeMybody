import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTextField from '@/components/ui/BaseTextField.vue'

describe('BaseTextField', () => {
  it('라벨이 input 과 for/id 로 연결되고 v-model 이 동작한다 (NFR-006)', async () => {
    const w = mount(BaseTextField, {
      props: {
        label: '이메일',
        modelValue: '',
        'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }),
      },
    })
    const input = w.find('input')
    expect(w.find('label').attributes('for')).toBe(input.attributes('id'))
    await input.setValue('me@example.com')
    expect(w.props('modelValue')).toBe('me@example.com')
  })

  it('autocomplete/name/enterkeyhint 같은 속성이 루트가 아니라 input 에 붙는다 (T-112)', () => {
    const w = mount(BaseTextField, {
      props: { label: '비밀번호', type: 'password' },
      attrs: { autocomplete: 'current-password', name: 'password', enterkeyhint: 'go' },
    })
    const input = w.find('input')
    expect(input.attributes('autocomplete')).toBe('current-password')
    expect(input.attributes('name')).toBe('password')
    expect(input.attributes('enterkeyhint')).toBe('go')
    expect(w.element.getAttribute('autocomplete')).toBeNull()
  })

  it('루트 클래스(field/invalid)는 유지되고, 부모가 id 를 줘도 라벨 연결용 내부 id 가 이긴다', () => {
    const w = mount(BaseTextField, {
      props: { label: '중량', error: '오류' },
      attrs: { id: 'outer-id', class: 'mine' },
    })
    expect(w.element.className).toBe('field invalid')
    const input = w.find('input')
    expect(input.classes()).toContain('mine') // class/style 은 input 으로 간다 (주석 참고)
    expect(input.attributes('id')).not.toBe('outer-id')
    expect(w.find('label').attributes('for')).toBe(input.attributes('id'))
  })

  it('오류가 있으면 aria-invalid 와 describedby 로 메시지를 연결한다', () => {
    const w = mount(BaseTextField, { props: { label: '이메일', error: '형식을 확인하세요' } })
    const input = w.find('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(w.find(`#${input.attributes('aria-describedby')}`).text()).toBe('형식을 확인하세요')
  })
})
