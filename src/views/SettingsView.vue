<script setup lang="ts">
import { shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

// 설정: 지금은 계정(로그아웃)만. 표시 단위·데이터 관리는 T-088, 운동 사전은 E03 에서 채운다.
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const busy = shallowRef(false)

async function logout() {
  busy.value = true
  try {
    const result = await auth.signOut()
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    await router.replace({ name: 'login' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="settings">
    <BaseCard>
      <h2 class="h">계정</h2>
      <p class="email">{{ auth.user?.email ?? '-' }}</p>
      <BaseButton variant="secondary" block :disabled="busy" @click="logout">로그아웃</BaseButton>
    </BaseCard>
  </section>
</template>

<style scoped>
.settings {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
}

.h {
  margin: 0 0 var(--space-2);
  font-size: 1rem;
}

.email {
  margin: 0 0 var(--space-3);
  color: var(--color-muted);
  word-break: break-all;
}
</style>
