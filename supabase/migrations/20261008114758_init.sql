-- 초기 마이그레이션 (T-006): 전용 스키마 생성.
-- 기존 Supabase 프로젝트를 다른 앱과 공유하므로 이 앱의 모든 객체는 `mybody` 스키마에만 둔다 (T-005 결정, 2026-10-12).
-- 실제 테이블은 T-012 부터 테이블 묶음별 파일로 추가한다.

create schema if not exists mybody;

-- PostgREST(anon/authenticated) 가 스키마를 보려면 usage 권한이 필요하다.
-- 대시보드 Settings → API → Exposed schemas 에 `mybody` 를 추가하는 것은 별도 수동 단계(T-006 완료 조건).
grant usage on schema mybody to anon, authenticated;

-- 이후 생성되는 테이블/시퀀스에 대한 기본 권한. 실제 접근 제어는 각 테이블의 RLS 가 담당한다.
alter default privileges in schema mybody grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema mybody grant usage, select on sequences to authenticated;
