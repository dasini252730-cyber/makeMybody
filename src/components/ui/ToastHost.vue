<script setup lang="ts">
import { computed } from 'vue'
import { useToast, type Toast } from '@/composables/useToast'

// 토스트 표시 영역. AppShell 안에 한 번만 둔다. 하단 탭 위에 뜬다.
// 성공/오류는 색 외에 아이콘 + 접두 텍스트로도 구분한다 (NFR-006). 닫기는 별도 버튼으로 둔다.
// 라이브 리전은 종류별로 하나씩: 저장 실패(error)는 즉시 읽히도록 assertive(role=alert), 성공은 polite (NFR-003, T-111).
const { toasts, dismiss } = useToast()
const PREFIX = { success: '완료', error: '실패' } as const
const ICON = { success: '✓', error: '!' } as const
const groups = computed<Array<{ type: Toast['type']; role: 'status' | 'alert'; items: Toast[] }>>(
  () => [
    { type: 'success', role: 'status', items: toasts.value.filter((t) => t.type === 'success') },
    { type: 'error', role: 'alert', items: toasts.value.filter((t) => t.type === 'error') },
  ],
)
</script>

<template>
  <div class="host">
    <div
      v-for="g in groups"
      :key="g.type"
      class="group"
      :role="g.role"
      :aria-live="g.role === 'alert' ? 'assertive' : 'polite'"
      aria-atomic="false"
    >
      <div v-for="t in g.items" :key="t.id" class="toast" :class="t.type">
        <span class="icon" aria-hidden="true">{{ ICON[t.type] }}</span>
        <span class="body" aria-atomic="true">
          <span class="prefix">{{ PREFIX[t.type] }}</span>
          {{ t.message }}
          <span v-if="t.count > 1" class="count">×{{ t.count }}</span>
        </span>
        <button type="button" class="close" aria-label="알림 닫기" @click="dismiss(t.id)">×</button>
      </div>
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

/* 빈 그룹도 DOM 에 남겨 둔다(display:none 금지): 스크린리더는 미리 렌더된 라이브 리전만 감시한다. 빈 그룹은 높이 0 이다. */
.group {
  display: grid;
  gap: var(--space-2);
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

/* 색 배경 위에서는 accent 링이 안 보이므로 글자색 링을 안쪽에 그린다. */
.close:focus-visible {
  outline: 2px solid currentcolor;
  outline-offset: -4px;
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
