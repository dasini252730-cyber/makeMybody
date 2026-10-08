<script setup lang="ts">
// 라우터/레이아웃 셸은 T-002, T-008에서 붙인다. 지금은 빌드 가능한 최소 화면.
const appName = 'MY BODY OS'
</script>

<template>
  <main class="app">
    <h1>{{ appName }}</h1>
    <p>프로젝트 셋업 완료. 다음 작업: 라우터와 레이아웃 셸.</p>
  </main>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  text-align: center;
  padding: 16px;
}
</style>
