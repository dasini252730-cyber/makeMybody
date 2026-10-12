<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

// 세션 복원(T-007)이 끝나야 앱이 준비된 것이다. init() 은 메모이즈되어 라우터 가드와 중복 실행되지 않는다.
const app = useAppStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
void auth.init().then(() => app.markReady())

// 화면을 열어 둔 채 세션이 끊기면(토큰 갱신 실패, 다른 탭 로그아웃) 가드는 돌지 않으므로 여기서 로그인으로 보낸다 (NFR-004).
watch(
  () => auth.isAuthenticated,
  (loggedIn) => {
    if (!loggedIn && auth.ready && !route.meta.public) void router.replace({ name: 'login' })
  },
)
onBeforeUnmount(() => auth.dispose())
</script>

<template>
  <AppShell />
</template>
