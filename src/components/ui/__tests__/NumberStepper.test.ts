import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'

type Props = Partial<InstanceType<typeof NumberStepper>['$props']>

/** v-model 을 흉내 낸다: update 이벤트가 오면 prop 을 갱신한다. */
function mountStepper(props: Props = {}) {
  const wrapper = mount(NumberStepper, {
    attachTo: document.body,
    props: {
      modelValue: 10,
      label: '중량',
      'onUpdate:modelValue': (v: number) => wrapper.setProps({ modelValue: v }),
      ...props,
    },
  })
  return wrapper
}
type W = ReturnType<typeof mountStepper>
type Btn = ReturnType<W['find']>

const emittedValues = (w: W) =>
  (w.emitted('update:modelValue') ?? []).map((args) => args[0] as number)
const inputEl = (w: W) => w.find('input').element as HTMLInputElement
const nextTask = () => new Promise((r) => setTimeout(r, 0))

/** 브라우저처럼 글자를 넣고 input 이벤트만 보낸다 (change 는 보내지 않음 = 아직 타이핑 중). */
async function type(w: W, text: string) {
  inputEl(w).value = text
  await w.find('input').trigger('input')
}
/** 포인터가 만든 호환 click (detail 1). VTU trigger 는 detail 을 못 바꿔 MouseEvent 를 직접 보낸다. */
async function pointerClick(btn: Btn) {
  btn.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  await nextTick()
}
/** 실제 탭: pointerdown → pointerup → 호환 click. touch=true 면 모바일처럼 click 이 별도 태스크로 온다. */
async function tap(btn: Btn, touch = false) {
  await btn.trigger('pointerdown')
  await btn.trigger('pointerup')
  if (touch) await nextTask()
  await pointerClick(btn)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('NumberStepper', () => {
  it('탭 한 번에 step 만큼 1회 증감한다 (마우스·터치)', async () => {
    const w = mountStepper({ step: 2.5, decimals: 1 })
    const [minus, plus] = w.findAll('button')
    await tap(plus!)
    expect(w.props('modelValue')).toBe(12.5)
    await tap(minus!, true)
    expect(w.props('modelValue')).toBe(10)
  })

  it('키보드·스크린리더처럼 click(detail 0)만 와도 1회 증감한다 (NFR-006)', async () => {
    const w = mountStepper({ modelValue: 10 })
    const plus = w.findAll('button')[1]!
    await plus.trigger('click')
    expect(w.props('modelValue')).toBe(11)
    await tap(plus) // 포인터 탭 직후의 키보드 조작도 삼키지 않는다
    await plus.trigger('click')
    expect(w.props('modelValue')).toBe(13)
  })

  it('스크롤 오터치(pointerdown → pointercancel, click 없음)는 값을 바꾸지 않는다 (NFR-001)', async () => {
    const w = mountStepper({ modelValue: 40 })
    const plus = w.findAll('button')[1]!
    await plus.trigger('pointerdown')
    await plus.trigger('pointercancel')
    await nextTask()
    expect(w.props('modelValue')).toBe(40)
    expect(emittedValues(w).length).toBe(0)
  })

  it('decimals 를 안 주면 step 의 소수 자릿수를 따르고, 작게 줘도 step 자릿수 아래로 반올림하지 않는다', async () => {
    const w = mountStepper({ step: 2.5 })
    await tap(w.findAll('button')[1]!)
    expect(w.props('modelValue')).toBe(12.5)
    const w2 = mountStepper({ modelValue: 41, step: 0.5, decimals: 0 })
    await tap(w2.findAll('button')[0]!)
    expect(w2.props('modelValue')).toBe(40.5)
  })

  it('min/max 를 넘지 않고 경계에서 버튼이 비활성화된다', async () => {
    const w = mountStepper({ modelValue: 99, max: 100 })
    const plus = w.findAll('button')[1]!
    await tap(plus)
    expect(w.props('modelValue')).toBe(100)
    expect(plus.attributes('aria-disabled')).toBe('true')
  })

  it('길게 누르면 400ms 뒤부터 점점 빨라지며 반복하고, 떼면 멈추며 호환 click 이 추가 증감을 만들지 않는다', async () => {
    vi.useFakeTimers()
    const w = mountStepper({ modelValue: 0, max: 1000 })
    const plus = w.findAll('button')[1]!
    await plus.trigger('pointerdown')
    expect(emittedValues(w).length).toBe(0) // 즉시 증감 없음
    await vi.advanceTimersByTimeAsync(400) // 첫 반복
    const first = emittedValues(w).length
    expect(first).toBe(1)
    await vi.advanceTimersByTimeAsync(600) // 150+130+110+90+70+50 = 600 → 6회
    expect(emittedValues(w).length - first).toBeGreaterThanOrEqual(6) // 150ms 고정이면 4회
    await plus.trigger('pointerup')
    const afterUp = emittedValues(w).length
    await vi.advanceTimersByTimeAsync(50)
    await pointerClick(plus) // 길게 누른 뒤 브라우저가 보내는 호환 click
    await vi.advanceTimersByTimeAsync(2000)
    expect(emittedValues(w).length).toBe(afterUp)
  })

  it('누른 채 버튼 밖으로 나가면(pointerleave) 반복이 멈추고, 돌아와 떼도 추가 증감이 없다', async () => {
    vi.useFakeTimers()
    const w = mountStepper({ modelValue: 0, max: 1000 })
    const plus = w.findAll('button')[1]!
    await plus.trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(550) // 2회 반복
    const beforeLeave = emittedValues(w).length
    await plus.trigger('pointerleave')
    await vi.advanceTimersByTimeAsync(1000) // 밖에서 1초 체류
    expect(emittedValues(w).length).toBe(beforeLeave)
    await plus.trigger('pointerup') // 돌아와서 뗌
    await pointerClick(plus)
    expect(emittedValues(w).length).toBe(beforeLeave)
  })

  it('오른쪽 버튼·두 번째 손가락의 pointerdown 은 반복을 시작하지 않는다', async () => {
    vi.useFakeTimers()
    const w = mountStepper({ modelValue: 0, max: 1000 })
    const plus = w.findAll('button')[1]!
    // button/isPrimary 는 읽기 전용이라 VTU trigger 로 못 주므로 PointerEvent 를 직접 보낸다.
    const down = (init: PointerEventInit) =>
      plus.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...init }))
    down({ button: 2, pointerType: 'mouse', isPrimary: true })
    await vi.advanceTimersByTimeAsync(1000)
    down({ button: 0, pointerType: 'touch', isPrimary: false })
    await vi.advanceTimersByTimeAsync(1000)
    expect(emittedValues(w).length).toBe(0)
  })

  it('반복이 도는 중에 pointercancel(스크롤 전환)이 오면 즉시 멈춘다', async () => {
    vi.useFakeTimers()
    const w = mountStepper({ modelValue: 0, max: 1000 })
    const plus = w.findAll('button')[1]!
    await plus.trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(550) // 2회 반복
    const n = emittedValues(w).length
    expect(n).toBeGreaterThan(0)
    window.dispatchEvent(new Event('pointercancel'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(emittedValues(w).length).toBe(n)
  })

  it('길게 누르다 max 에 닿으면(버튼 aria-disabled) 타이머가 스스로 멈춘다', async () => {
    vi.useFakeTimers()
    const w = mountStepper({ modelValue: 98, max: 100 })
    await w.findAll('button')[1]!.trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(3000)
    const settled = emittedValues(w).length
    expect(w.props('modelValue')).toBe(100)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(3000)
    expect(emittedValues(w).length).toBe(settled)
  })

  it('타이핑한 글자가 리렌더로 되돌아가지 않는다 (40 → 전체선택 후 5, 5 → 55)', async () => {
    const w = mountStepper({ modelValue: 40, max: 300 })
    await type(w, '5')
    expect(inputEl(w).value).toBe('5')
    await type(w, '55')
    expect(inputEl(w).value).toBe('55')
    expect(w.props('modelValue')).toBe(55) // 범위 안 유효값은 change 전에도 반영
    await w.find('input').trigger('change')
    expect(inputEl(w).value).toBe('55')
  })

  it('범위 밖 값은 타이핑 중 model 을 바꾸지 않고, change 때 clamp 되어 표시도 되돌아간다', async () => {
    const w = mountStepper({ modelValue: 50, min: 10, max: 50 })
    await type(w, '5') // 55 를 치는 중간 상태: min 미만이지만 되돌리지 않는다
    expect(inputEl(w).value).toBe('5')
    expect(w.props('modelValue')).toBe(50)
    await type(w, '999')
    await w.find('input').trigger('change')
    expect(w.props('modelValue')).toBe(50)
    expect(inputEl(w).value).toBe('50') // model 이 그대로(50)라도 표시가 clamp 값으로 복귀
  })

  it('입력창에 타이핑 중 + 를 누르면 타이핑한 값이 먼저 반영된다', async () => {
    const w = mountStepper({ modelValue: 40, max: 100 })
    await type(w, '45')
    await tap(w.findAll('button')[1]!)
    expect(w.props('modelValue')).toBe(46)
    expect(inputEl(w).value).toBe('46')
  })

  it('model 이 min 이어도 타이핑 중인 값이 크면 − 가 활성화된다 (NFR-001)', async () => {
    const w = mountStepper({ modelValue: 0, min: 0 })
    const minus = w.findAll('button')[0]!
    expect(minus.attributes('aria-disabled')).toBe('true')
    await type(w, '40')
    expect(minus.attributes('aria-disabled')).toBeUndefined()
    await tap(minus)
    expect(w.props('modelValue')).toBe(39)
  })

  it('외부에서 model 이 바뀌면(이전 값 복사) 표시와 다음 증감의 기준이 그 값을 따른다', async () => {
    const w = mountStepper({ modelValue: 40, max: 100 })
    await type(w, '45')
    await w.setProps({ modelValue: 60 })
    expect(inputEl(w).value).toBe('60')
    await tap(w.findAll('button')[1]!)
    expect(w.props('modelValue')).toBe(61)
  })

  it('label 은 input 과 for/id 로 연결되고, 없으면 ariaLabel, 둘 다 없으면 "값" 으로 읽힌다 (NFR-006)', () => {
    const withLabel = mountStepper({ label: '반복' })
    const id = withLabel.find('input').attributes('id')
    expect(id).toBeTruthy()
    expect(withLabel.find('label').attributes('for')).toBe(id)
    expect(withLabel.findAll('button')[1]!.attributes('aria-label')).toBe('반복 증가')

    const noLabel = mountStepper({ label: '', ariaLabel: '중량 (kg)' })
    expect(noLabel.find('label').exists()).toBe(false)
    expect(noLabel.find('input').attributes('aria-label')).toBe('중량 (kg)')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(warn).not.toHaveBeenCalled() // 위의 label/ariaLabel 있는 경우는 경고 없음
    const none = mountStepper({ label: '' })
    expect(none.find('input').attributes('aria-label')).toBe('값')
    expect(none.findAll('button')[0]!.attributes('aria-label')).toBe('값 감소')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('label 또는 ariaLabel')) // DEV 경고 (T-111)
  })

  it('경계의 버튼은 disabled 가 아니라 aria-disabled 라 키보드 포커스를 잃지 않고, 눌러도 값이 안 바뀐다 (NFR-006)', async () => {
    const w = mountStepper({ modelValue: 1, min: 0 })
    const minus = w.findAll('button')[0]!
    ;(minus.element as HTMLButtonElement).focus()
    await minus.trigger('click') // 키보드 Enter → 0
    expect(w.props('modelValue')).toBe(0)
    expect(minus.attributes('aria-disabled')).toBe('true')
    expect(minus.attributes('disabled')).toBeUndefined()
    expect(document.activeElement).toBe(minus.element) // 포커스 유지
    await minus.trigger('click')
    await tap(minus)
    expect(w.props('modelValue')).toBe(0)
  })
})
