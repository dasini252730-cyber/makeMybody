-- T-016 · 체중·체성분(body_metrics, FR-013 P0.5) + 수면·음주·컨디션(recovery_logs, FR-014 P1)
-- 미입력은 NULL(0 과 혼동 금지, 6.3). 결측일은 행이 없을 뿐이며 평균 계산에서 0 으로 채우지 않는다(7.4).
-- 멱등하게 작성 (db-apply 는 파일 단위 트랜잭션이 아님).

create table if not exists mybody.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2),
  body_fat_percent numeric(4, 1),
  skeletal_muscle_kg numeric(5, 2),
  measurement_method text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_metrics_weight_range check (weight_kg is null or (weight_kg > 0 and weight_kg < 400)),
  constraint body_metrics_fat_range check (body_fat_percent is null or (body_fat_percent >= 0 and body_fat_percent <= 100)),
  constraint body_metrics_muscle_range check (skeletal_muscle_kg is null or (skeletal_muscle_kg > 0 and skeletal_muscle_kg < 200)),
  -- 측정값이 하나도 없고 메모도 없는 빈 행은 막는다
  constraint body_metrics_not_empty check (
    weight_kg is not null or body_fat_percent is not null or skeletal_muscle_kg is not null or note is not null
  )
);
comment on table mybody.body_metrics is '체중·체성분 측정. 내부 단위 kg. 결측일은 행 없음.';

create index if not exists body_metrics_user_measured_idx on mybody.body_metrics (user_id, measured_at desc);

drop trigger if exists body_metrics_set_updated_at on mybody.body_metrics;
create trigger body_metrics_set_updated_at
  before update on mybody.body_metrics
  for each row execute function mybody.set_updated_at();

alter table mybody.body_metrics enable row level security;
alter table mybody.body_metrics force row level security;
drop policy if exists body_metrics_select on mybody.body_metrics;
create policy body_metrics_select on mybody.body_metrics for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists body_metrics_insert on mybody.body_metrics;
create policy body_metrics_insert on mybody.body_metrics for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists body_metrics_update on mybody.body_metrics;
create policy body_metrics_update on mybody.body_metrics for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists body_metrics_delete on mybody.body_metrics;
create policy body_metrics_delete on mybody.body_metrics for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on mybody.body_metrics to authenticated;
revoke all on mybody.body_metrics from anon;

-- 수면·음주·컨디션: 하루 한 행 (log_date 기준). 교란 요인은 "함께 나타난 패턴" 으로만 표현한다(FR-014).
create table if not exists mybody.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  sleep_hours numeric(3, 1),
  sleep_quality smallint,
  alcohol_type text,
  alcohol_amount_note text,
  condition_note text,
  pain_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recovery_logs_sleep_range check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  constraint recovery_logs_quality_range check (sleep_quality is null or (sleep_quality between 1 and 5)),
  constraint recovery_logs_user_date_uniq unique (user_id, log_date)
);
comment on table mybody.recovery_logs is '수면·음주·컨디션·통증 일지. 하루 한 행. sleep_quality 1~5.';

create index if not exists recovery_logs_user_date_idx on mybody.recovery_logs (user_id, log_date desc);

drop trigger if exists recovery_logs_set_updated_at on mybody.recovery_logs;
create trigger recovery_logs_set_updated_at
  before update on mybody.recovery_logs
  for each row execute function mybody.set_updated_at();

alter table mybody.recovery_logs enable row level security;
alter table mybody.recovery_logs force row level security;
drop policy if exists recovery_logs_select on mybody.recovery_logs;
create policy recovery_logs_select on mybody.recovery_logs for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists recovery_logs_insert on mybody.recovery_logs;
create policy recovery_logs_insert on mybody.recovery_logs for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists recovery_logs_update on mybody.recovery_logs;
create policy recovery_logs_update on mybody.recovery_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists recovery_logs_delete on mybody.recovery_logs;
create policy recovery_logs_delete on mybody.recovery_logs for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on mybody.recovery_logs to authenticated;
revoke all on mybody.recovery_logs from anon;
