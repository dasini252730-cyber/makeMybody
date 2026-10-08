import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// 셋업 검증용 예제. 실제 계산 유틸 테스트는 각 lib 작업(1RM, 이동평균, Fitness Score)에서 추가한다.
describe('vitest 셋업', () => {
  it('src/lib 하위 테스트가 수집되고 실행된다', () => {
    expect(1 + 1).toBe(2)
  })

  it('jsdom 환경에서 Vue 컴포넌트를 mount 할 수 있다', () => {
    const Hello = defineComponent({
      props: { name: { type: String, required: true } },
      setup: (props) => () => h('p', `안녕, ${props.name}`),
    })
    const wrapper = mount(Hello, { props: { name: 'MY BODY OS' } })
    expect(wrapper.text()).toBe('안녕, MY BODY OS')
  })
})
