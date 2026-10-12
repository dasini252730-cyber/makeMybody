-- T-104 보정 (리뷰 반영). 원자적으로 적용.
begin;
-- 1) 빠른 메모 저장("오늘 8km 걸음")이 유형 없이도 들어가게 기본값 other. (NOT NULL 은 유지 — 집계가 NULL 그룹을 만들지 않게)
alter table mybody.activity_records alter column activity_type set default 'other';
-- 2) 무박 종주·1박 2일 등산을 허용 (최대 7일 = 10080분). 세션의 duration_minutes(1440) 는 그대로 — 긴 활동은 활동 기록이 담는다.
alter table mybody.activity_records drop constraint if exists activity_records_duration_check;
alter table mybody.activity_records add constraint activity_records_duration_check
  check (duration_minutes is null or (duration_minutes >= 0 and duration_minutes <= 10080));
commit;
