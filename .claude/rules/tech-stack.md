# 기술 스택 / 코드 규칙

스택: Vue 3 + Vite + TypeScript, Pinia, Vue Router, Supabase(PostgreSQL · Auth · RLS, 기존 프로젝트의 `mybody` 스키마), **Capacitor Android 앱(APK)** — 서버 호스팅 없음(v1.3, 2026-10-12), Vitest, Playwright(E2E).

## Android 앱 (Capacitor)

- 웹 빌드(`npm run build` → `dist/`)를 `npx cap sync android` 로 `android/` 프로젝트에 복사하고 Gradle 로 APK 를 만든다. 갤럭시에 설치해 쓴다.
- 이 PC: Android Studio + SDK(platforms 34/36, build-tools 34~36.1), JDK 21(Android Studio JBR). `ANDROID_HOME` 미설정이면 `%LOCALAPPDATA%\Android\Sdk` 를 쓴다.
- 라우터는 `createWebHistory` 대신 앱에서는 `createWebHashHistory` 또는 Capacitor 의 `https://localhost` 기준 history 가 동작하는지 T-113 에서 확인한다.
- 매직링크는 앱 딥링크가 필요하므로 **비밀번호 로그인이 기본**. 로그인은 기기당 1회, 세션은 기기에 저장(persistSession).
- `.env` 값은 빌드 시 번들에 들어간다. anon key 만 허용(service_role 금지)은 그대로.

## 디렉터리

```
src/
  views/        라우트 단위 화면 (홈, 운동 기록, 성장 분석, 활동, 신체·회복, 목표, 설정 — 요구사항 3장)
  components/   재사용 UI. 도메인별 하위 폴더 (workout/, activity/, body/, growth/, goal/, ui/)
  composables/  useXxx. 데이터 접근(useXxxRepo)과 화면 상태(useXxxForm) 분리
  stores/       Pinia. 세션 범위 상태만 (현재 사용자, 편집 중 세션 draft)
  lib/          순수 함수: 세트 볼륨, PR, 추세, 7일 평균, 날짜(KST)
  types/        supabase.ts(자동 생성) + 도메인 타입
supabase/
  migrations/   테이블 묶음당 1파일, 모든 테이블에 RLS (요구사항 6장)
  functions/    Edge Functions (AI 구조화 프록시, P1)
  tests/        rls_probe.sql — anon·타 사용자·제약 검증 (npm run db:rls). 시드는 seed.sql 이 아니라 마이그레이션 파일로 넣는다
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

- **기존 Supabase 프로젝트를 공유**한다 (2026-10-12 결정). 이 앱의 모든 객체는 전용 스키마 **`mybody`** 에 둔다. `public` 에는 아무것도 만들지 않는다. 클라이언트는 `db.schema = 'mybody'`, 타입 생성은 `--schema mybody`, 대시보드 API 설정의 Exposed schemas 에 `mybody` 추가 + `grant usage on schema mybody to anon, authenticated`.
- 모든 테이블: `user_id uuid references auth.users not null default auth.uid()` + RLS `user_id = auth.uid()` 정책 (select/insert/update/delete 각각).
- 스키마 변경은 마이그레이션 파일로만. 대시보드에서 손으로 바꾸지 않는다.
- 저장 실패는 반드시 사용자에게 보인다 (NFR-003). 낙관적 UI 로 숨기지 않는다. 실패한 입력 원문은 localStorage 에 남겨 재시도한다.
- 세션·세트 id 는 클라이언트에서 `crypto.randomUUID()` 로 만들고 upsert 로 저장한다 (재전송 중복 방지, 6.3).
- 삭제는 `deleted_at` soft delete. 조회·계산은 항상 `deleted_at IS NULL` 만 본다 (FR-005).
- 미입력 값은 0 이 아니라 NULL (6.3). 내부 단위는 kg · m · 초 (FR-019).
- 비밀값은 `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). service_role 키는 클라이언트에 절대 두지 않는다.
- DB 작업 전에는 `supabase-postgres-best-practices` 스킬을 로드한다.

## 계산 규칙 (요구사항 7장, FR-008/009/010/013)

- **점수 없음.** 종합 체력 점수, 영역 점수, 준비도 점수를 만들지 않는다 (1.3, 7.5). 보여주는 것은 원시 기록과 요약값뿐.
- 모든 계산은 `set_kind = working` 세트만 대상. warmup / drop / failed_attempt 는 이력에만 남긴다.
- 세트 볼륨 = 중량 × 반복 (둘 다 있을 때만). `dumbbell_each` 는 편측 값 그대로(×2 금지). 누락 세트가 있으면 "일부 세트 제외" 플래그.
- PR 비교 단위 = 운동 ID (+ 같은 중량 최고 반복은 weight_kg). `success = true` 만 후보. `is_assisted` 는 별도 그룹. 변형은 별도 운동 ID 라 자동 분리되고 `variation_note` 는 비교 조건에 쓰지 않는다.
- weight_basis 나 보조 여부가 바뀌면 향상률을 내지 않고 주의 문구만 붙인다 (7.3).
- 평균은 실제 입력값만. 결측일 0 금지. 7일 평균은 측정 3개 이상일 때만 표시 (7.4).
- 1RM 은 선택 기능, 추정치 표시, 반복 10회 초과 세트엔 적용 안 함. 공식 같은 "정답이 없는" 값은 `needs_decision` 으로 확인 뒤 고정.
- 모든 `src/lib` 함수는 Vitest 테스트와 함께 커밋한다.

## UX

- 모바일 우선, 한 손 조작 (NFR-001). 홈 진입 후 **두 번 탭 안에 원문 메모 저장**. 터치 타깃 44px 이상, 숫자 입력은 스텝퍼 + 이전 값 복사.
- 구조화·분석 화면은 PC 2열 레이아웃 (5장). 세션 편집은 원문 메모를 상단에 고정.
- 중량은 항상 운동의 `weight_basis` 라벨과 함께 표시 (FR-019).
- 의학적 진단·"안전하게 갈 수 있다" 판정 문구 금지 (FR-014/016/020). "함께 나타난 패턴" 수준으로만 표현. 색상만으로 성공·실패·통증을 구분하지 않는다 (NFR-006).
- 사실(사용자 입력) / 시스템 계산값 / AI 추정은 화면에서 구분한다 (원칙 2).

## 관련 스킬

Vue 작업 시 `vue-best-practices`, 라우터는 `vue-router-best-practices`, 테스트는 `vue-testing-best-practices`/`vitest`, Supabase 는 `supabase` 스킬을 먼저 로드한다.
