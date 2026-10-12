<script setup lang="ts">
import { useId } from 'vue'

// 라벨 + 입력 + 오류 메시지. v-model 로 문자열을 주고받는다.
withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'time'
    placeholder?: string
    error?: string
    inputmode?: 'text' | 'decimal' | 'numeric' | 'email'
    disabled?: boolean
  }>(),
  { type: 'text', placeholder: '', error: '', inputmode: undefined, disabled: false },
)
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="field" :class="{ invalid: !!error }">
    <label :for="id" class="label">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      class="input"
      :type="type"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :disabled="disabled"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
    />
    <p v-if="error" :id="`${id}-error`" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--space-1);
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-muted);
}

.input {
  min-height: var(--tap-min);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  color: var(--color-text);
  background: var(--color-bg);
}

.invalid .input {
  border-color: var(--color-danger);
}

.error {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-danger);
}
</style>
