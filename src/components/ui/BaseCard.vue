<script setup lang="ts">
// 콘텐츠 묶음 카드. title 이 있으면 헤더를 그린다.
defineProps<{ title?: string }>()
</script>

<template>
  <section class="card">
    <header v-if="title || $slots.header" class="card-header">
      <slot name="header">
        <h3 class="card-title">{{ title }}</h3>
      </slot>
    </header>
    <div class="card-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card-header {
  padding: var(--space-3) var(--space-4) 0;
}

.card-title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.card-body {
  padding: var(--space-3) var(--space-4) var(--space-4);
}
</style>
