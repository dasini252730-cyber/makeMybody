import { createRouter, createWebHistory } from 'vue-router'

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
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
