# Supabase 스키마 워크플로우

이 폴더는 Supabase CLI 가 관리한다. 스키마 변경은 **마이그레이션 파일로만** 한다. 대시보드 SQL 편집기로 바꾸지 않는다.

## 전제

- Supabase CLI ≥ 2.117 (`supabase --version`), CLI 로그인 완료 (`supabase login`).
- Docker 가 없으므로 로컬 스택(`supabase start`)은 쓰지 않는다. 모든 마이그레이션은 **원격 프로젝트에 직접 push** 한다.
- 원격 프로젝트는 `supabase link --project-ref <ref>` 로 한 번 연결한다 (`supabase/.temp/` 에 기록, git 제외).

## 일상 절차

```bash
npm run db:new <이름>        # supabase/migrations/<timestamp>_<이름>.sql 생성 → SQL 작성
npm run db:push              # 미적용 마이그레이션을 버전 순으로 원격에 적용 (tools/db-apply.mjs, 아래 참고)
npm run db:migrations        # 로컬 파일 vs 적용 이력(mybody_meta.schema_migrations) 비교
npm run db:types             # 원격 스키마에서 src/types/supabase.ts 재생성 (스키마 바꿀 때마다)
```

## 규칙 (.claude/rules/tech-stack.md 요약)

- 모든 테이블: `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`,
  `alter table ... enable row level security`, select/insert/update/delete 정책 4개를 `to authenticated` 와
  `(select auth.uid()) = user_id` 로 작성. update 는 `using` + `with check` 둘 다.
- 공용 데이터(`exercise_library` 의 기본 운동 등)는 `user_id is null` 행을 모두가 읽을 수 있게 별도 정책.
- PK 는 `bigint generated always as identity`, 시각은 `timestamptz`, 수치는 `numeric`, 문자열은 `text`.
- FK 컬럼과 RLS 에 쓰는 `user_id` 에는 반드시 인덱스.
- 마이그레이션 파일 하나 = 테이블 묶음 하나(예: `workout_sessions` + `workout_exercises`). 400줄 이하.

## 롤백 주의

- `db push` 는 되돌리기 명령이 없다. 잘못 적용했으면 **되돌리는 새 마이그레이션**을 만들어 push 한다
  (`drop table`, `alter table ... drop column` 등). 이미 적용된 파일을 수정하면 원격과 어긋나므로 금지.
- 이 저장소의 적용 기록은 `mybody_meta.schema_migrations` 에 있다 (공용 `supabase_migrations.schema_migrations` 는 다른 앱 것이라 건드리지 않는다). 파일만 지우면 `db:migrations` 가 불일치를 보고한다.
- 파괴적 변경(drop, 타입 변경) 전에는 대시보드에서 백업(Database → Backups)이 있는지 확인한다.

## 시드

- 시드도 **마이그레이션 파일**로 넣는다(예: `20261012130000_seed_exercise_library.sql`). `seed.sql` 은 쓰지 않는다(db-apply 가 추적하지 못함).
- 멱등하게(`on conflict ... do nothing`) 쓰고, 이미 적용된 시드의 수정은 새 파일에서 `update` 로 한다.

## 전용 스키마 `mybody` (2026-10-12 결정)

- 이 프로젝트는 **기존 Supabase 프로젝트를 다른 앱과 공유**한다. 그래서 모든 테이블·함수·시퀀스는 `mybody` 스키마에만 만든다. `public` 에는 아무것도 만들지 않는다.
- 마이그레이션의 모든 객체는 `mybody.` 접두사를 붙여 쓴다 (`create table mybody.workout_sessions ...`).
- init 마이그레이션이 `create schema mybody` 와 `grant usage ... to anon, authenticated` 를 수행한다. 추가로 **대시보드 Settings → API → Exposed schemas 에 `mybody` 를 넣어야** PostgREST 가 스키마를 노출한다 (한 번만, 수동).
- 클라이언트는 `createClient(url, key, { db: { schema: 'mybody' } })`. 타입 생성은 `npm run db:types` (`--schema mybody`).
- `supabase link` 직후 `npm run db:migrations` 로 원격에 **다른 저장소의 마이그레이션 이력**이 있는지 확인한다. 있으면 push 하지 말고 보고한다.

## 왜 `supabase db push` 를 쓰지 않나

공유 프로젝트의 공용 이력 테이블에는 다른 앱(learnEnglishWithStory)의 마이그레이션 13건이 있다. `db push` 는 그 버전들이 로컬에 없다며
`migration repair` 를 요구하는데, repair 는 그 앱의 이력을 망친다. 그래서 `tools/db-apply.mjs` 가 `supabase db query -f` 로 파일을 적용하고
적용 이력을 `mybody_meta.schema_migrations` 에 기록한다. `mybody_meta` 는 anon/authenticated 에 usage 를 주지 않으므로 API 로 노출되지 않는다.

- `node tools/db-apply.mjs list | apply [--dry-run] | mark <version>`
- 한 파일은 한 트랜잭션이 아니다(`db query` 특성). 파일 중간에 실패하면 앞부분은 적용된 채 이력에는 안 남으므로, 고친 뒤 재실행이 가능하게
  `if not exists` / 멱등하게 쓴다.

## 마이그레이션 작성 규칙 추가 (2026-10-12 리뷰 반영)

- 테이블을 만들면 **같은 파일에서 즉시** `enable/force row level security` + 정책 4개를 건다. 트리거·인덱스는 그 뒤에. 부분 적용되어도 노출이 없게.
- 이미 적용된 파일은 수정하지 않는다. 제약 변경은 새 파일에서 `begin; … commit;` 으로 묶는다(drop→add 사이 실패 방지).
- 공용 함수(`mybody.set_updated_at`)는 한 곳(20261012110000)에만 정의한다. 다른 파일에서 재정의하지 않는다.
- `service_role` 에는 권한을 주지 않는다. 서버 측 접근이 필요한 작업에서 테이블 단위로 grant 한다. 시드는 postgres(db-apply)로 넣는다.
- 새 테이블은 `supabase/tests/rls_probe.sql` 에 anon 거부·타 사용자 격리·핵심 제약 케이스를 추가하고 `npm run db:rls` 로 확인한다.
