<script setup lang="ts">
import { ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTextField from '@/components/ui/BaseTextField.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import { useToast } from '@/composables/useToast'

// 공통 UI 확인용 페이지. 개발 모드(/dev/ui)에서만 라우트가 등록된다.
const toast = useToast()
const weight = ref(40)
const reps = ref(10)
const name = ref('')
</script>

<template>
  <div class="stack">
    <BaseCard title="Button">
      <div class="row">
        <BaseButton>primary</BaseButton>
        <BaseButton variant="secondary">secondary</BaseButton>
        <BaseButton variant="danger">danger</BaseButton>
        <BaseButton variant="ghost">ghost</BaseButton>
        <BaseButton disabled>disabled</BaseButton>
      </div>
    </BaseCard>
    <BaseCard title="Text field">
      <BaseTextField v-model="name" label="운동명" placeholder="Deadlift" />
      <BaseTextField v-model="name" label="오류 예시" error="필수 입력입니다" />
    </BaseCard>
    <BaseCard title="Number stepper">
      <NumberStepper v-model="weight" label="중량" unit="kg" :step="2.5" :decimals="1" :max="300" />
      <NumberStepper v-model="reps" label="반복" :max="100" />
    </BaseCard>
    <BaseCard title="Toast">
      <div class="row">
        <BaseButton @click="toast.success('저장되었습니다')">success</BaseButton>
        <BaseButton variant="danger" @click="toast.error('저장 실패: 네트워크 오류')"
          >error</BaseButton
        >
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.stack {
  display: grid;
  gap: var(--space-4);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
