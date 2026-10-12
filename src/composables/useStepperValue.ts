import { computed, ref, watch, type Ref } from 'vue'

export interface StepperBounds {
  min: number
  max: number
  step: number
  /** 생략 시 step 의 소수 자릿수를 따른다 */
  decimals?: number
}

/**
 * 숫자 스텝퍼의 값 상태. 입력창에는 `display`(문자열)만 바인딩하고 model 과는 아래 규칙으로 동기화한다.
 * - 타이핑 중(`onInput`): display 는 그대로 두고, 범위 안의 유효 숫자면 model 에도 즉시 반영한다
 *   (부모가 change 전에 읽어도 유실되지 않게). 범위 밖이면 model 은 두고 change 때 clamp 한다.
 * - 확정(`commit`): clamp 한 값으로 model·display 를 맞춘다.
 * - 외부에서 model 이 바뀌면(이전 값 복사 등) display 를 따라간다. 타이핑으로 model 이 바뀐 경우는
 *   display 가 이미 같은 숫자라 건드리지 않는다 (type=number 는 불완전한 입력을 "" 로 주므로 "4." 같은 중간값은 없다).
 * - 범위 안이지만 소수 자릿수가 step 과 안 맞는 입력("40.5", step 1)은 change 때 반올림되므로 그때까지
 *   display 와 model 이 잠시 다를 수 있다 (blur 로 change 가 와서 보정됨).
 */
export function useStepperValue(model: Ref<number>, bounds: () => StepperBounds) {
  const display = ref(String(model.value))

  // 반올림 자릿수는 최소한 step 의 소수 자릿수 이상이어야 한다 (decimals 0 + step 0.5 면 증감이 반올림에 삼켜짐).
  const decimals = computed(() => {
    const b = bounds()
    const stepDigits = String(b.step).split('.')[1]?.length ?? 0
    return Math.max(b.decimals ?? 0, stepDigits)
  })
  function clamp(v: number): number {
    const b = bounds()
    const rounded = Number(v.toFixed(decimals.value))
    return Math.min(b.max, Math.max(b.min, rounded))
  }
  function parse(raw: string): number | null {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }

  /** 화면에 보이는 숫자 (버튼 활성 판단용). 유효하지 않으면 model. */
  const shown = computed(() => parse(display.value) ?? model.value)

  watch(model, (v) => {
    if (parse(display.value) !== v) display.value = String(v)
  })

  function set(v: number) {
    model.value = v
    display.value = String(v)
  }
  function onInput(raw: string) {
    display.value = raw
    const n = parse(raw)
    const b = bounds()
    if (n !== null && n >= b.min && n <= b.max && n === Number(n.toFixed(decimals.value)))
      model.value = n
  }
  /** 타이핑 값을 clamp 해 확정하고 돌려준다. */
  function commit(): number {
    const n = parse(display.value)
    const v = n === null ? model.value : clamp(n)
    set(v)
    return v
  }
  /** base 에서 step 만큼 증감해 확정한다. base 를 받는 이유: v-model 반영이 비동기일 수 있어서. */
  function bumpFrom(base: number, dir: 1 | -1): number {
    const next = clamp(base + dir * bounds().step)
    set(next)
    return next
  }
  /** 증감의 기준값: 타이핑 중이면 먼저 확정한 값, 아니면 model. */
  function baseValue(): number {
    return parse(display.value) !== model.value ? commit() : model.value
  }

  return { display, shown, onInput, commit, bumpFrom, baseValue }
}
