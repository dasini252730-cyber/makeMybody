import { defineStore } from 'pinia'
import { computed, readonly, shallowRef } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, type AppSupabaseClient } from '@/lib/supabase'

// 로그인 상태(NFR-004). 계정은 1개뿐이고 회원가입 UI 는 없다 — 계정은 Supabase 대시보드에서 만든다.
// 어떤 함수도 throw 하지 않는다: 실패는 전부 { ok:false, message } 또는 initError 로 돌려 화면이 보여준다 (NFR-003).
export type AuthResult = { ok: true } | { ok: false; message: string }

/** Supabase 오류 메시지를 사용자용 한국어로 바꾼다. 알 수 없는 것은 원문을 그대로 보여 숨기지 않는다 (NFR-003). */
export function describeAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않습니다.'
  if (m.includes('email not confirmed')) return '이메일 확인이 끝나지 않은 계정입니다.'
  if (m.includes('rate limit')) return '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.'
  if (m.includes('fetch')) return '서버에 연결할 수 없습니다. 네트워크를 확인하세요.'
  return message
}
const toMessage = (e: unknown) => describeAuthError(e instanceof Error ? e.message : String(e))

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<User | null>(null)
  const ready = shallowRef(false)
  /** 클라이언트 생성/세션 복원 실패 사유. 로그인 화면이 보여준다. */
  const initError = shallowRef('')
  const isAuthenticated = computed(() => user.value !== null)
  let unsubscribe: (() => void) | null = null
  let client: AppSupabaseClient | null = null
  let initPromise: Promise<void> | null = null

  function sb(): AppSupabaseClient {
    client ??= getSupabase() // env 누락·secret 키 오입력은 여기서 throw → 호출자가 잡는다
    return client
  }
  function apply(session: Session | null) {
    user.value = session?.user ?? null
  }

  /** 세션 변화 구독. 한 번만 건다. 로그인 성공 시에도 불러 init 이 실패했던 경우를 메운다. */
  function ensureSubscribed() {
    if (unsubscribe) return
    const { data } = sb().auth.onAuthStateChange((_event, session) => apply(session))
    unsubscribe = () => data.subscription.unsubscribe()
  }

  /** 세션 복원 + 변화 구독. 동시에 여러 번 불려도 한 번만 실행하고 절대 reject 하지 않는다.
   *  실패하면(오프라인 등) initPromise 를 비워 다음 호출에서 다시 시도할 수 있게 한다. */
  function init(): Promise<void> {
    initPromise ??= (async () => {
      try {
        const { data, error } = await sb().auth.getSession()
        if (error) throw error
        apply(data.session)
        ensureSubscribed()
        initError.value = ''
      } catch (e) {
        initError.value = toMessage(e)
        apply(null)
        initPromise = null
      } finally {
        ready.value = true
      }
    })()
    return initPromise
  }

  async function run(fn: (c: AppSupabaseClient) => Promise<AuthResult>): Promise<AuthResult> {
    try {
      return await fn(sb())
    } catch (e) {
      return { ok: false, message: toMessage(e) }
    }
  }

  const signInWithPassword = (email: string, password: string) =>
    run(async (c) => {
      const { data, error } = await c.auth.signInWithPassword({ email, password })
      if (error) return { ok: false, message: describeAuthError(error.message) }
      apply(data.session)
      ensureSubscribed() // init 이 오프라인으로 실패했던 경우 여기서 구독을 메운다
      return { ok: true }
    })

  /** 매직링크: 메일의 링크를 열면 onAuthStateChange 로 로그인된다. 회원가입은 막는다. */
  const signInWithMagicLink = (email: string) =>
    run(async (c) => {
      const { error } = await c.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      })
      return error ? { ok: false, message: describeAuthError(error.message) } : { ok: true }
    })

  const signOut = () =>
    run(async (c) => {
      const { error } = await c.auth.signOut()
      if (error) return { ok: false, message: describeAuthError(error.message) }
      apply(null)
      return { ok: true }
    })

  function dispose() {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    user: readonly(user),
    ready: readonly(ready),
    initError: readonly(initError),
    isAuthenticated,
    init,
    signInWithPassword,
    signInWithMagicLink,
    signOut,
    dispose,
  }
})
