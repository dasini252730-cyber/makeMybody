-- T-016 2차 보정 (리뷰 반영). 한 트랜잭션으로 묶어 중간 실패 시 제약이 사라진 채 남지 않게 한다.
begin;

-- 1) 20261012113000 이 준 service_role 스키마 전체 권한을 되돌린다 (init 의 권한 설계 유지).
--    서버 측(Edge Function, T-091)이 필요해지면 그 작업에서 테이블 단위로 grant 한다. 시드(T-023)는 postgres(db-apply)로 넣는다.
alter default privileges in schema mybody revoke select, insert, update, delete on tables from service_role;
revoke select, insert, update, delete on all tables in schema mybody from service_role;
revoke usage on schema mybody from service_role;

-- 2) recovery_logs: 전부 비어 있는 행은 거부 (결측일은 "행이 없음" 이어야 집계가 안 섞인다).
--    sleep_hours 0 은 철야(실제 값)로 허용하고 미입력은 NULL 이다 — 폼은 기본값을 비워 둔다(docs/T-016.md).
alter table mybody.recovery_logs drop constraint if exists recovery_logs_not_empty;
alter table mybody.recovery_logs add constraint recovery_logs_not_empty
  check (
    sleep_hours is not null or sleep_quality is not null
    or length(trim(coalesce(alcohol_type, ''))) > 0
    or length(trim(coalesce(alcohol_amount_note, ''))) > 0
    or length(trim(coalesce(condition_note, ''))) > 0
    or length(trim(coalesce(pain_note, ''))) > 0
  );

-- 3) 미래 날짜 금지: 서버 KST 기준 오늘까지만 (+1 여유 제거).
alter table mybody.recovery_logs drop constraint if exists recovery_logs_date_not_future;
alter table mybody.recovery_logs add constraint recovery_logs_date_not_future
  check (log_date <= (now() at time zone 'Asia/Seoul')::date);

commit;
