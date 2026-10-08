# 기술 스택 / 코드 규칙

스택: Vue 3 + Vite + TypeScript, Pinia, Vue Router, Supabase(PostgreSQL · Auth · RLS · Storage · Edge Functions), Vercel 호스팅, Vitest, Playwright(E2E).

## 디렉터리
```
src/
  views/        라우트 단위 화면 (HOME, WORKOUT, BODY, GROWTH, GOALS, SETTINGS)
  components/   재사용 UI. 도메인별 하위 폴더 (workout/, body/, growth/, goal/, ui/)
  composables/  useXxx. 데이터 접근(useXxxRepo)과 화면 상태(useXxxForm) 분리
  stores/       Pinia. 세션 범위 상태만 (현재 사용자, 진행 중 운동 세션)
  lib/          순수 함수: 1RM, 이동평균, Fitness Score, Readiness, 날짜(KST)
  types/        supabase.ts(자동 생성) + 도메인 타입
supabase/
  migrations/   테이블 묶음당 1파일, 모든 테이블에 RLS
  functions/    Edge Functions (점수 계산, AI 프록시)
  seed.sql      exercise_library, goal 프리셋, achievement 정의
e2e/            Playwright 스모크
tools/          backlog CLI
docs/           T-xxx.md 작업 문서
```

## Vue
- 항상 `<script setup lang="ts">` + Composition API. Options API 금지.
- `any` 금지. Supabase 타입은 `supabase gen types` 산출물(`src/types/supabase.ts`)을 쓴다.
- 컴포넌트는 props/emits 를 `defineProps<...>()` / `defineEmits<...>()` 로 타입 선언.
- 화면(view)은 조립만 한다. 데이터 호출은 composable, 계산은 lib.

## Supabase
- 모든 테이블: `user_id uuid references auth.users not null default auth.uid()` + RLS `user_id = auth.uid()` 정책 (select/insert/update/delete 각각).
- 스키마 변경은 마이그레이션 파일로만. 대시보드에서 손으로 바꾸지 않는다.
- 저장 실패는 반드시 사용자에게 보인다 (NFR-002). 낙관적 UI 로 숨기지 않는다.
- 비밀값은 `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). service_role 키는 클라이언트에 절대 두지 않는다.
- DB 작업 전에는 `supabase-postgres-best-practices` 스킬을 로드한다.

## 계산 규칙 (요구사항 3장, FR-005/007/016)
- 영역 점수 0~100. 최근 데이터 가중 + 스무딩(급변 방지). 산식은 `src/lib/fitness/` 에 두고 가중치는 상수 파일로 분리.
- 1RM 추정 공식, 점수 가중치 등 "정답이 없는" 값은 `needs_decision` 으로 사용자에게 확인한 뒤 고정한다.
- 모든 `src/lib` 함수는 Vitest 테스트와 함께 커밋한다.

## UX
- 모바일 우선, 한 손 조작 (NFR-004). 터치 타깃 44px 이상, 숫자 입력은 스텝퍼 + 이전 값 복사.
- 이력/그래프 화면은 PC 2열 레이아웃 지원 (NFR-005).
- 의학적 진단 문구 금지 (FR-010). "가능성이 높은 요인" 수준으로만 표현.

## 관련 스킬
Vue 작업 시 `vue-best-practices`, 라우터는 `vue-router-best-practices`, 테스트는 `vue-testing-best-practices`/`vitest`, Supabase 는 `supabase` 스킬을 먼저 로드한다.
