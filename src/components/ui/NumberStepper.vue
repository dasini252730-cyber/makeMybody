<script setup lang="ts">
import { computed, useId } from 'vue'
import { useHoldRepeat } from '@/composables/useHoldRepeat'
import { useStepperValue } from '@/composables/useStepperValue'

// 한 손 엄지 조작용 숫자 스텝퍼 (NFR-001). −/+ 는 44px 이상이고 오른쪽에 나란히 두어 엄지 반경 안에 있다.
// 라벨은 필수(NFR-006): `label` 이 없으면 `ariaLabel` 로 input 에 직접 붙인다.
// 포인터는 길게 누르기 가속, 키보드/보조기기(click)는 단발 증감. 값 동기화 규칙은 useStepperValue 참고.
const props = withDefaults(
  defineProps<{
    label?: string
    ariaLabel?: string
    min?: number
    max?: number
    step?: number
    unit?: string
    decimals?: number
  }>(),
  {
    label: '',
    ariaLabel: '',
    min: 0,
    max: Number.POSITIVE_INFINITY,
    step: 1,
    unit: '',
    decimals: undefined,
  },
)
const model = defineModel<number>({ default: 0 })
const inputId = useId()
const hold = useHoldRepeat()
const { display, shown, onInput, commit, bumpFrom, baseValue } = useStepperValue(model, () => ({
  min: props.min,
  max: props.max,
  step: props.step,
  decimals: props.decimals,
}))

/** pointerdown 은 길게 누르기 반복만 예약한다. 단발 증감은 click 이 담당해 스크롤 오터치(pointercancel)에 값이 안 바뀐다. */
function onPointerDown(e: PointerEvent, dir: 1 | -1) {
  // 오른쪽/가운데 버튼, 멀티터치의 두 번째 손가락은 무시한다.
  if ((e.button ?? 0) !== 0 || (e.pointerType === 'touch' && !e.isPrimary)) return
  let cur: number | null = null // 기준값은 첫 반복 때 계산 (pointerdown 에서 commit 해 버튼이 disabled 되는 것 방지)
  hold.start(() => {
    const before = cur ?? baseValue()
    cur = bumpFrom(before, dir)
    return cur !== before
  })
}
/** 탭·키보드 Enter/Space·보조기기 활성화 모두 click 으로 온다. 길게 누르기가 이미 바꾼 뒤의 호환 click 만 건너뛴다. */
function onClick(e: MouseEvent, dir: 1 | -1) {
  if (hold.shouldIgnoreClick(e)) return
  bumpFrom(baseValue(), dir)
}
/** 버튼 접근성 이름. label·ariaLabel 둘 다 비면 최소한 "값" 으로 읽힌다 (NFR-006). */
const name = computed(() => props.label || props.ariaLabel || '값')
// max 기본값(Infinity)은 DOM 속성으로 무효라 유한수일 때만 바인딩한다. step 은 제약 검증(:invalid)을 피해 any.
const domMax = computed(() => (Number.isFinite(props.max) ? props.max : undefined))
</script>

<template>
  <div class="stepper">
    <label v-if="label" :for="inputId" class="label">{{ label }}</label>
    <div class="controls">
      <input
        :id="inputId"
        class="value"
        type="number"
        inputmode="decimal"
        :value="display"
        :min="min"
        :max="domMax"
        step="any"
        :aria-label="label ? undefined : name"
        @input="onInput(($event.target as HTMLInputElement).value)"
        @change="commit"
      />
      <span v-if="unit" class="unit">{{ unit }}</span>
      <button
        type="button"
        class="btn"
        :disabled="shown <= min"
        :aria-label="`${name} 감소`"
        @pointerdown="onPointerDown($event, -1)"
        @pointerleave="hold.pause"
        @click="onClick($event, -1)"
      >
        −
      </button>
      <button
        type="button"
        class="btn"
        :disabled="shown >= max"
        :aria-label="`${name} 증가`"
        @pointerdown="onPointerDown($event, 1)"
        @pointerleave="hold.pause"
        @click="onClick($event, 1)"
      >
        +
      </button>
    </div>
  </div>
</template>

<style scoped>
.stepper {
  display: grid;
  gap: var(--space-1);
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-muted);
}

/* 값 | 단위 | − | + : 버튼 두 개를 오른쪽에 붙여 한 손 엄지로 닿게 한다. */
.controls {
  display: grid;
  grid-template-columns: 1fr auto var(--tap-min) var(--tap-min);
  align-items: center;
  gap: var(--space-2);
}

.btn {
  min-height: var(--tap-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 1.4rem;
  line-height: 1;
  color: var(--color-text);
  background: var(--color-surface);
  touch-action: manipulation;
  user-select: none;
}

.btn:disabled {
  opacity: 0.4;
}

.value {
  min-height: var(--tap-min);
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 1.2rem;
  font-weight: 700;
  text-align: center;
  color: var(--color-text);
  background: var(--color-bg);
}

.unit {
  font-size: 0.85rem;
  color: var(--color-muted);
}
</style>
