<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useAppStore } from '@/stores/app'
// 레이아웃 셸(하단 탭 네비게이션)은 T-008 에서 추가한다.

const app = useAppStore()
app.markReady()
</script>

<template>
  <RouterView />
</template>
