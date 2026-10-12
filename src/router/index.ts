import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// meta 오타가 타입 검사에 걸리게 한다. public 이 아닌 라우트는 전부 로그인 필요(default-deny).
declare module 'vue-router' {
  interface RouteMeta {
    label?: string
    public?: boolean
  }
}

// 요구사항 4장 메뉴 구조의 6개 섹션. 하위 메뉴는 각 섹션 작업에서 children 으로 추가한다.
export const sections = [
  { name: 'home', path: '/', label: 'HOME' },
  { name: 'workout', path: '/workout', label: 'WORKOUT' },
  { name: 'body', path: '/body', label: 'BODY' },
  { name: 'growth', path: '/growth', label: 'GROWTH' },
  { name: 'goals', path: '/goals', label: 'GOALS' },
  { name: 'settings', path: '/settings', label: 'SETTINGS' },
] as const

export type SectionName = (typeof sections)[number]['name']

const views = {
  home: () => import('@/views/HomeView.vue'),
  workout: () => import('@/views/WorkoutView.vue'),
  body: () => import('@/views/BodyView.vue'),
  growth: () => import('@/views/GrowthView.vue'),
  goals: () => import('@/views/GoalsView.vue'),
  settings: () => import('@/views/SettingsView.vue'),
} satisfies Record<SectionName, () => Promise<unknown>>

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...sections.map((s) => ({
      name: s.name,
      path: s.path,
      component: views[s.name],
      meta: { label: s.label },
    })),
    // 공통 UI 확인 페이지. 개발 모드에서만 등록한다.
    ...(import.meta.env.DEV
      ? [
          {
            name: 'dev-ui',
            path: '/dev/ui',
            component: () => import('@/views/DevUiView.vue'),
            meta: { label: 'UI KIT' },
          },
        ]
      : []),
    {
      name: 'login',
      path: '/login',
      component: () => import('@/views/LoginView.vue'),
      meta: { label: '로그인', public: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 접근 제한(NFR-004): 로그인 없이는 어떤 화면도 열 수 없다. 세션 복원이 끝날 때까지 기다린 뒤 판단한다.
// 같은 목적지로 다시 보내지 않도록 public 여부를 먼저 본다 (무한 리다이렉트 방지).
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.init()
  if (to.meta.public) return auth.isAuthenticated ? { name: 'home' } : true
  if (auth.isAuthenticated) return true
  return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
})

export default router
