import { defineStore } from 'pinia'
import { ref } from 'vue'

// 앱 전역 세션 상태의 출발점. 사용자/진행 중 운동 세션은 각 작업(T-007, E04)에서 별도 store 로 추가한다.
// ready 는 지금은 앱 마운트 시 true 가 되며, T-007 에서 Supabase 세션 복원 완료 시점으로 옮긴다.
export const useAppStore = defineStore('app', () => {
  const ready = ref(false)

  function markReady() {
    ready.value = true
  }

  return { ready, markReady }
})
