<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { sections } from '@/router'

// 6개 섹션 탭. 한 손 조작(NFR-004): 터치 타깃 44px 이상, 화면 하단 고정.
const route = useRoute()
const isActive = (name: string) => route.name === name
</script>

<template>
  <nav class="tabs" aria-label="주요 메뉴">
    <RouterLink
      v-for="s in sections"
      :key="s.name"
      :to="{ name: s.name }"
      class="tab"
      :class="{ active: isActive(s.name) }"
      :aria-current="isActive(s.name) ? 'page' : undefined"
    >
      <span class="label">{{ s.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border-top: 1px solid var(--color-border, GrayText);
  background: var(--color-bg, Canvas);
  padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);
}

.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  min-width: 0;
  padding: 0 2px;
  text-decoration: none;
  color: var(--color-muted, GrayText);
}

.label {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.6875rem; /* 11px: 375px 에서 6개 라벨이 클립 없이 들어가는 최대치 */
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tab.active {
  color: var(--color-accent, LinkText);
}

@media (min-width: 768px) {
  .label {
    font-size: 0.8rem;
    letter-spacing: 0.04em;
  }
}
</style>
