<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
app.markReady()
</script>

<template>
  <AppShell />
</template>
