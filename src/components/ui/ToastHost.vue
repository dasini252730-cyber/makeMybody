<script setup lang="ts">
import { useToast } from '@/composables/useToast'

// 토스트 표시 영역. AppShell 안에 한 번만 둔다. 하단 탭 위에 뜬다.
// 성공/오류는 색 외에 아이콘 + 접두 텍스트로도 구분한다 (NFR-006). 닫기는 별도 버튼으로 둔다.
const { toasts, dismiss } = useToast()
const PREFIX = { success: '완료', error: '실패' } as const
const ICON = { success: '✓', error: '!' } as const
</script>

<template>
  <div class="host" role="status" aria-live="polite" aria-atomic="false">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
      <span class="icon" aria-hidden="true">{{ ICON[t.type] }}</span>
      <span class="body">
        <span class="prefix">{{ PREFIX[t.type] }}</span>
        {{ t.message }}
        <span v-if="t.count > 1" class="count">×{{ t.count }}</span>
      </span>
      <button type="button" class="close" aria-label="알림 닫기" @click="dismiss(t.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
/* 셸(max-width 1080px)과 같은 폭 안에 머물도록 가운데 정렬한다. */
.host {
  position: fixed;
  bottom: calc(var(--tabbar-h) + var(--space-3) + env(safe-area-inset-bottom, 0px));
  left: 50%;
  width: min(100% - var(--space-4) * 2, 1080px - var(--space-4) * 2);
  transform: translateX(-50%);
  z-index: 100;
  display: grid;
  gap: var(--space-2);
  pointer-events: none;
}

.toast {
  display: grid;
  grid-template-columns: auto 1fr var(--tap-min);
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  padding-left: var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  pointer-events: auto;
}

.icon {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid currentcolor;
  border-radius: 50%;
  font-size: 0.9rem;
  line-height: 1;
}

.prefix::after {
  content: ' · ';
}

.count {
  margin-left: var(--space-1);
  font-weight: 400;
  opacity: 0.85;
}

.close {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  border: 0;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font: inherit;
  font-size: 1.3rem;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.success {
  color: var(--color-success-contrast);
  background: var(--color-success);
}

.error {
  color: var(--color-danger-contrast);
  background: var(--color-danger);
}
</style>
