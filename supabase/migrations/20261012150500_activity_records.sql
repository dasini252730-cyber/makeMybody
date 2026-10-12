-- T-104 · 걷기·등산 활동 기록 (요구사항 v1.2 6.2 activity_records, FR-012 P0.5)
-- 세션(session_type walk/hike/other)에 1:1 또는 1:N 으로 붙는 활동 상세. 모든 수치 nullable(미입력 NULL). GPS 없음.
-- 소유는 세션 조인. RLS 는 테이블 생성 직후. 원자적으로 적용.
begin;

create table if not exists mybody.activity_records (
  id uuid primary key,                                   -- 클라이언트 UUID (upsert)
  session_id uuid not null references mybody.workout_sessions (id) on delete cascade,
  activity_type text not null,                           -- walk / hike / run / cycle / other
  distance_meters integer,
  duration_minutes integer,
  elevation_gain_meters integer,
  route_name text,
  pack_weight_kg numeric(4, 1),
  conditions_note text,                                  -- 지형·날씨
  pain_recovery_note text,                               -- 통증·피로·하산 후 상태 (FR-020 와 같은 원칙: 진단 금지)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_records_type_check check (activity_type in ('walk', 'hike', 'run', 'cycle', 'other')),
  constraint activity_records_distance_check check (distance_meters is null or (distance_meters >= 0 and distance_meters <= 1000000)),
  constraint activity_records_duration_check check (duration_minutes is null or (duration_minutes >= 0 and duration_minutes <= 1440)),
  constraint activity_records_elevation_check check (elevation_gain_meters is null or (elevation_gain_meters >= 0 and elevation_gain_meters <= 20000)),
  constraint activity_records_pack_check check (pack_weight_kg is null or (pack_weight_kg >= 0 and pack_weight_kg < 100)),
  -- 전부 빈 행은 거부 (메모만 있는 행은 허용)
  constraint activity_records_not_empty check (
    distance_meters is not null or duration_minutes is not null or elevation_gain_meters is not null
    or length(trim(coalesce(route_name, ''))) > 0 or length(trim(coalesce(conditions_note, ''))) > 0
    or length(trim(coalesce(pain_recovery_note, ''))) > 0
  )
);
comment on table mybody.activity_records is '걷기·등산 활동 상세. 세션에 종속. 내부 단위 m·분·kg. 미입력 NULL.';

alter table mybody.activity_records enable row level security;
alter table mybody.activity_records force row level security;
drop policy if exists activity_records_select on mybody.activity_records;
create policy activity_records_select on mybody.activity_records for select to authenticated
  using (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists activity_records_insert on mybody.activity_records;
create policy activity_records_insert on mybody.activity_records for insert to authenticated
  with check (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists activity_records_update on mybody.activity_records;
create policy activity_records_update on mybody.activity_records for update to authenticated
  using (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists activity_records_delete on mybody.activity_records;
create policy activity_records_delete on mybody.activity_records for delete to authenticated
  using (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
grant select, insert, update, delete on mybody.activity_records to authenticated;
revoke all on mybody.activity_records from anon;

create index if not exists activity_records_session_idx on mybody.activity_records (session_id);

drop trigger if exists activity_records_set_updated_at on mybody.activity_records;
create trigger activity_records_set_updated_at
  before update on mybody.activity_records
  for each row execute function mybody.set_updated_at();

commit;
