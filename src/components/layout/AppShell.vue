<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import BottomTabs from '@/components/layout/BottomTabs.vue'

// 모바일 우선 앱 셸: 헤더(현재 섹션) + 스크롤 콘텐츠 + 하단 탭.
// 셸이 뷰포트 높이를 차지하고 .content 만 스크롤되므로 헤더/탭은 항상 보인다(NFR-004).
// PC(≥1024px)에서는 셸 전체 폭을 제한해 이력/그래프 화면이 읽기 좋게 한다(NFR-005).
// 색 토큰(--color-*)은 T-009 에서 정의한다. 그 전까지는 시스템 색(Canvas/CanvasText)으로 다크모드를 따른다.
const route = useRoute()
const content = ref<HTMLElement | null>(null)
const title = computed(() => (route.meta.label as string | undefined) ?? 'MY BODY OS')

// window 가 아니라 .content 가 스크롤러라 vue-router scrollBehavior 가 닿지 않는다. 섹션이 바뀌면 맨 위로.
watch(
  () => route.name,
  () => {
    if (content.value) content.value.scrollTop = 0
    document.title = `${title.value} · MY BODY OS`
  },
  { immediate: true },
)
</script>

<template>
  <div class="shell">
    <header class="header">
      <p class="title" role="heading" aria-level="1">{{ title }}</p>
    </header>
    <main ref="content" class="content">
      <RouterView />
    </main>
    <BottomTabs />
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100vh; /* dvh 미지원 브라우저 폴백 */
  height: 100dvh;
  color: var(--color-text, CanvasText);
  background: var(--color-bg, Canvas);
}

.header {
  padding: calc(12px + env(safe-area-inset-top, 0px)) calc(16px + env(safe-area-inset-right, 0px))
    12px calc(16px + env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--color-border, GrayText);
}

.title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.content {
  min-height: 0;
  padding: 16px calc(16px + env(safe-area-inset-right, 0px)) 24px
    calc(16px + env(safe-area-inset-left, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

@media (min-width: 1024px) {
  .shell {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
  }

  .content {
    padding: 24px;
  }
}
</style>
