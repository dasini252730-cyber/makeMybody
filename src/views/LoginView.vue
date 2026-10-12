<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTextField from '@/components/ui/BaseTextField.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

// 로그인 화면 (NFR-004). 계정 1개, 회원가입·비밀번호 재설정 UI 없음.
// 비밀번호 로그인이 기본이고, 비밀번호 없이 매직링크 메일을 받을 수도 있다.
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const email = shallowRef('')
const password = shallowRef('')
const busy = shallowRef(false)
const emailError = shallowRef('')
const passwordError = shallowRef('')

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

function validateEmail(): boolean {
  emailError.value = emailValid.value ? '' : '이메일 형식을 확인하세요.'
  return !emailError.value
}

/** 로그인 뒤 돌아갈 곳: 가드가 ?redirect= 로 넘긴 경로, 없으면 홈. 외부 URL 은 받지 않는다. */
function destination(): string {
  const r = route.query.redirect
  return typeof r === 'string' && /^\/(?![/\\])/.test(r) ? r : '/'
}

async function submitPassword() {
  passwordError.value = password.value ? '' : '비밀번호를 입력하세요.'
  if (!validateEmail() || passwordError.value) return
  busy.value = true
  try {
    const result = await auth.signInWithPassword(email.value.trim(), password.value)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    await router.replace(destination())
  } finally {
    busy.value = false
  }
}

async function sendMagicLink() {
  if (!validateEmail()) return
  busy.value = true
  try {
    const result = await auth.signInWithMagicLink(email.value.trim())
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success('로그인 링크를 메일로 보냈습니다.')
    startCooldown()
  } finally {
    busy.value = false
  }
}

// 메일이 안 오면 다시 보낼 수 있어야 하므로 영구 비활성이 아니라 60초 쿨다운만 둔다.
const RESEND_SECONDS = 60
const cooldown = shallowRef(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null
function startCooldown() {
  cooldown.value = RESEND_SECONDS
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}
onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
const linkLabel = computed(() =>
  cooldown.value > 0
    ? `링크를 보냈습니다. ${cooldown.value}초 뒤 다시 보낼 수 있습니다`
    : '비밀번호 없이 메일로 로그인 링크 받기',
)
</script>

<template>
  <section class="login">
    <BaseCard>
      <form class="form" novalidate @submit.prevent="submitPassword">
        <p class="brand">MY BODY OS</p>
        <BaseTextField
          v-model="email"
          label="이메일"
          type="email"
          inputmode="email"
          placeholder="you@example.com"
          :error="emailError"
          :disabled="busy"
        />
        <BaseTextField
          v-model="password"
          label="비밀번호"
          type="password"
          :error="passwordError"
          :disabled="busy"
        />
        <BaseButton type="submit" block :disabled="busy">로그인</BaseButton>
        <BaseButton variant="ghost" block :disabled="busy || cooldown > 0" @click="sendMagicLink">
          {{ linkLabel }}
        </BaseButton>
        <p v-if="auth.initError" class="init-error" role="alert">
          연결 설정 오류: {{ auth.initError }}
        </p>
        <p class="note">개인용 앱입니다. 계정은 Supabase 대시보드에서만 만듭니다.</p>
      </form>
    </BaseCard>
  </section>
</template>

<style scoped>
.login {
  display: grid;
  align-content: center;
  min-height: 100%;
  padding: var(--space-4);
}

.form {
  display: grid;
  gap: var(--space-3);
}

.brand {
  margin: 0 0 var(--space-2);
  font-size: 1.3rem;
  font-weight: 800;
  text-align: center;
}

.note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
  text-align: center;
}

.init-error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--color-danger);
  word-break: break-word;
}
</style>
