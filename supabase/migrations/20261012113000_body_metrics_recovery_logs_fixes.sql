-- T-016 보정 (리뷰 반영). 20261012110100 은 이미 원격에 적용되었으므로 수정하지 않고 여기서 제약을 바꾼다.
-- 6.3 "미입력은 NULL, 0 과 혼동 금지" / 7.4 결측 0 금지 / 하루 1행(KST) / 빈 행 차단.
-- 멱등: 제약은 drop if exists 후 add.

-- updated_at 트리거 함수를 여기서도 보장해 파일 간 순서 의존을 없앤다 (create or replace 는 멱등).
create or replace function mybody.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- body_metrics ---------------------------------------------------------------
alter table mybody.body_metrics drop constraint if exists body_metrics_fat_range;
alter table mybody.body_metrics add constraint body_metrics_fat_range
  check (body_fat_percent is null or (body_fat_percent > 0 and body_fat_percent < 100));

alter table mybody.body_metrics drop constraint if exists body_metrics_not_empty;
alter table mybody.body_metrics add constraint body_metrics_not_empty
  check (
    weight_kg is not null or body_fat_percent is not null or skeletal_muscle_kg is not null
    or length(trim(coalesce(note, ''))) > 0
  );

-- 연도 오타 등으로 미래 시각이 들어와 "최근 측정" 이 고정되는 것을 막는다 (시계 오차 1일 허용).
alter table mybody.body_metrics drop constraint if exists body_metrics_measured_not_future;
alter table mybody.body_metrics add constraint body_metrics_measured_not_future
  check (measured_at <= now() + interval '1 day');

-- recovery_logs --------------------------------------------------------------
-- 날짜 기본값은 KST. 클라이언트가 날짜를 보내면 그 값이 우선이며, 저장은 (user_id, log_date) upsert 로 한다.
alter table mybody.recovery_logs
  alter column log_date set default ((now() at time zone 'Asia/Seoul')::date);

alter table mybody.recovery_logs drop constraint if exists recovery_logs_date_not_future;
alter table mybody.recovery_logs add constraint recovery_logs_date_not_future
  check (log_date <= (now() at time zone 'Asia/Seoul')::date + 1);

-- unique (user_id, log_date) 가 만든 인덱스와 중복
drop index if exists mybody.recovery_logs_user_date_idx;

-- 서버 측(Edge Function, 시드 스크립트)이 service_role 로 접근할 수 있게 한다. RLS 는 service_role 을 우회한다.
grant usage on schema mybody to service_role;
grant select, insert, update, delete on all tables in schema mybody to service_role;
alter default privileges in schema mybody grant select, insert, update, delete on tables to service_role;

comment on column mybody.recovery_logs.sleep_quality is '주관적 수면 만족도 1(나쁨)~5(좋음). 요구사항은 "만족도" 만 명시, 5점 척도는 구현 선택.';
comment on column mybody.body_metrics.measurement_method is '측정 방식 자유 텍스트(예: 인바디, 체중계). 값 집합은 데이터가 쌓인 뒤 결정.';
