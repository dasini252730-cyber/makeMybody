import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Supabase 클라이언트를 통째로 흉내 낸다. 네트워크 없이 스토어와 라우터 가드의 분기만 검증한다.
const fakeAuth = {
  session: null as null | { user: { id: string; email: string } },
  listeners: [] as Array<(event: string, session: unknown) => void>,
  getSession: vi.fn(async () => ({ data: { session: fakeAuth.session }, error: null })),
  onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
    fakeAuth.listeners.push(cb)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}
let clientFactoryThrows: string | null = null
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => {
    if (clientFactoryThrows) throw new Error(clientFactoryThrows)
    return { auth: fakeAuth }
  },
}))

import { describeAuthError, useAuthStore } from '@/stores/auth'
import router from '@/router'

const user = { id: 'u1', email: 'me@example.com' }

beforeEach(() => {
  setActivePinia(createPinia())
  fakeAuth.session = null
  fakeAuth.listeners = []
  clientFactoryThrows = null
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  it('init 은 저장된 세션을 복원하고 변화를 구독한다. 동시에 여러 번 불려도 한 번만 실행된다', async () => {
    fakeAuth.session = { user }
    const auth = useAuthStore()
    expect(auth.ready).toBe(false)
    await Promise.all([auth.init(), auth.init()]) // App.vue 와 라우터 가드가 같은 tick 에 부르는 경우
    await auth.init()
    expect(auth.ready).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user?.email).toBe('me@example.com')
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1)
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledTimes(1)
    fakeAuth.listeners[0]!('SIGNED_OUT', null)
    expect(auth.isAuthenticated).toBe(false)
  })

  it('env 누락 등으로 클라이언트 생성이 실패해도 init 은 reject 하지 않고 사유를 남긴다 (NFR-003)', async () => {
    clientFactoryThrows = 'Supabase 환경변수 누락: VITE_SUPABASE_URL'
    const auth = useAuthStore()
    await expect(auth.init()).resolves.toBeUndefined()
    expect(auth.ready).toBe(true)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.initError).toContain('VITE_SUPABASE_URL')
    // 로그인 시도도 throw 하지 않고 메시지로 돌려준다
    const r = await auth.signInWithPassword('me@example.com', 'pw')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('VITE_SUPABASE_URL')
  })

  it('비밀번호 로그인 실패는 사용자용 메시지로 돌려주고 상태를 바꾸지 않는다 (NFR-003)', async () => {
    fakeAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    })
    const auth = useAuthStore()
    const r = await auth.signInWithPassword('me@example.com', 'bad')
    expect(r).toEqual({ ok: false, message: '이메일 또는 비밀번호가 맞지 않습니다.' })
    expect(auth.isAuthenticated).toBe(false)
  })

  it('네트워크 예외(reject)도 잡아서 메시지로 돌려준다', async () => {
    fakeAuth.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const auth = useAuthStore()
    expect(await auth.signInWithPassword('me@example.com', 'pw')).toEqual({
      ok: false,
      message: '서버에 연결할 수 없습니다. 네트워크를 확인하세요.',
    })
  })

  it('비밀번호 로그인 성공 시 사용자가 설정되고, 로그아웃하면 비워진다', async () => {
    fakeAuth.signInWithPassword.mockResolvedValueOnce({ data: { session: { user } }, error: null })
    const auth = useAuthStore()
    expect(await auth.signInWithPassword('me@example.com', 'pw')).toEqual({ ok: true })
    expect(auth.isAuthenticated).toBe(true)
    expect(await auth.signOut()).toEqual({ ok: true })
    expect(auth.isAuthenticated).toBe(false)
  })

  it('매직링크는 회원가입을 막는다 (shouldCreateUser: false)', async () => {
    fakeAuth.signInWithOtp.mockResolvedValueOnce({ error: null })
    const auth = useAuthStore()
    expect(await auth.signInWithMagicLink('me@example.com')).toEqual({ ok: true })
    expect(fakeAuth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'me@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    )
  })

  it('알 수 없는 오류 문구는 숨기지 않고 그대로 보여준다', () => {
    expect(describeAuthError('Weird thing happened')).toBe('Weird thing happened')
    expect(describeAuthError('Email rate limit exceeded')).toContain('잠시 후')
  })
})

describe('router guard (NFR-004)', () => {
  it('비로그인은 보호 라우트에서 /login 으로 가고 원래 목적지를 redirect 로 넘긴다', async () => {
    await router.push('/workout')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/workout')
  })

  it('로그인 상태에서는 보호 라우트가 열리고 /login 은 홈으로 돌아간다', async () => {
    fakeAuth.session = { user }
    await router.push('/body')
    expect(router.currentRoute.value.name).toBe('body')
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('로그아웃(SIGNED_OUT) 뒤에는 보호 라우트 접근이 다시 막힌다 (완료 조건 3)', async () => {
    fakeAuth.session = { user }
    const auth = useAuthStore()
    await auth.init()
    await router.push('/growth')
    expect(router.currentRoute.value.name).toBe('growth')
    fakeAuth.listeners[0]!('SIGNED_OUT', null)
    await router.push('/workout')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('화면을 열어 둔 채 세션이 끊기면(SIGNED_OUT) 내비게이션 없이도 /login 으로 이동한다 (App.vue watch)', async () => {
    fakeAuth.session = { user }
    const pinia = createPinia()
    setActivePinia(pinia)
    const { mount } = await import('@vue/test-utils')
    const App = (await import('@/App.vue')).default
    const w = mount(App, { global: { plugins: [pinia, router], stubs: { AppShell: true } } })
    await router.push('/growth')
    expect(router.currentRoute.value.name).toBe('growth')
    fakeAuth.listeners[0]!('SIGNED_OUT', null)
    await w.vm.$nextTick()
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.name).toBe('login')
    w.unmount()
  })

  it('init 이 실패하면(오프라인) 다음 호출에서 다시 시도하고, 로그인 성공 시 구독을 건다', async () => {
    fakeAuth.getSession.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const auth = useAuthStore()
    await auth.init()
    expect(auth.initError).toContain('연결할 수 없습니다')
    expect(fakeAuth.onAuthStateChange).not.toHaveBeenCalled()
    await auth.init() // 재시도 → 성공
    expect(auth.initError).toBe('')
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(2)
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('클라이언트 생성 실패 시에도 가드가 터지지 않고 /login 이 열린다', async () => {
    clientFactoryThrows = 'Supabase 환경변수 누락: VITE_SUPABASE_URL'
    await router.push('/workout')
    expect(router.currentRoute.value.name).toBe('login')
    expect(useAuthStore().initError).toContain('VITE_SUPABASE_URL')
  })
})
