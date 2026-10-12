<script setup lang="ts">
// 기본 버튼. 터치 타깃 44px 이상, variant 로 색만 바꾼다.
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    type?: 'button' | 'submit'
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', type: 'button', disabled: false, block: false },
)
</script>

<template>
  <button :type="type" class="btn" :class="[variant, { block }]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.block {
  display: flex;
  width: 100%;
}

.primary {
  color: var(--color-accent-contrast);
  background: var(--color-accent);
}

.secondary {
  color: var(--color-text);
  background: var(--color-surface);
  border-color: var(--color-border);
}

.danger {
  color: var(--color-danger-contrast);
  background: var(--color-danger);
}

.ghost {
  color: var(--color-accent);
  background: transparent;
}

.btn:not(:disabled):active {
  filter: brightness(0.92);
}
</style>
