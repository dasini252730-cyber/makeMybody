-- T-014 · 세트 (요구사항 v1.2 6.2 exercise_sets, FR-002 세트 단위 플래그, FR-009/7장 계산 대상)
-- id 는 클라이언트 UUID(upsert). set_kind/success 는 세트 단위. 미기록은 NULL. weight_kg 의 의미는 운동의 weight_basis 를 따른다.
-- RLS 는 테이블 생성 직후. 소유 검사는 session_items → workout_sessions 조인.
begin;

create table if not exists mybody.exercise_sets (
  id uuid primary key,                                   -- 클라이언트 생성
  session_item_id uuid not null references mybody.session_items (id) on delete cascade,
  set_no integer not null default 1,
  set_kind text not null default 'working',              -- working / warmup / drop / failed_attempt
  success boolean,                                       -- NULL = unknown
  weight_kg numeric(6, 2),
  reps integer,
  duration_seconds integer,
  distance_meters integer,
  rounds integer,
  side text not null default 'both',                     -- both / left / right / alternating / unknown
  is_assisted boolean,
  raw_value_note text,                                   -- 원문에서 애매했던 값
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_sets_set_no_check check (set_no >= 1),
  constraint exercise_sets_kind_check check (set_kind in ('working', 'warmup', 'drop', 'failed_attempt')),
  constraint exercise_sets_side_check check (side in ('both', 'left', 'right', 'alternating', 'unknown')),
  constraint exercise_sets_weight_check check (weight_kg is null or (weight_kg >= 0 and weight_kg < 1000)),
  constraint exercise_sets_reps_check check (reps is null or (reps >= 0 and reps <= 10000)),
  constraint exercise_sets_duration_check check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 86400)),
  constraint exercise_sets_distance_check check (distance_meters is null or (distance_meters >= 0 and distance_meters <= 1000000)),
  constraint exercise_sets_rounds_check check (rounds is null or (rounds >= 0 and rounds <= 1000)),
  -- 값이 하나도 없는 빈 세트는 막는다 (메모만 있는 "애매한 값" 세트는 허용)
  constraint exercise_sets_not_empty check (
    weight_kg is not null or reps is not null or duration_seconds is not null or distance_meters is not null
    or rounds is not null or length(trim(coalesce(raw_value_note, ''))) > 0
  ),
  constraint exercise_sets_item_set_no_uniq unique (session_item_id, set_no)
);
comment on table mybody.exercise_sets is '세트. 계산(볼륨·PR)은 set_kind=working 만. weight_kg 의미는 운동의 weight_basis(added=추가 중량, assisted_minus=보조 감량·계산 제외).';
comment on column mybody.exercise_sets.success is 'NULL = unknown. PR 후보는 success=true 인 working 세트만.';

alter table mybody.exercise_sets enable row level security;
alter table mybody.exercise_sets force row level security;

-- 소유: 세트 → 동작 → 세션(user_id). 서브쿼리는 상위 테이블의 RLS 를 거친다(본인 것만 보임).
drop policy if exists exercise_sets_select on mybody.exercise_sets;
create policy exercise_sets_select on mybody.exercise_sets for select to authenticated
  using (exists (select 1 from mybody.session_items i join mybody.workout_sessions s on s.id = i.session_id
                 where i.id = session_item_id and s.user_id = (select auth.uid())));
drop policy if exists exercise_sets_insert on mybody.exercise_sets;
create policy exercise_sets_insert on mybody.exercise_sets for insert to authenticated
  with check (exists (select 1 from mybody.session_items i join mybody.workout_sessions s on s.id = i.session_id
                      where i.id = session_item_id and s.user_id = (select auth.uid())));
drop policy if exists exercise_sets_update on mybody.exercise_sets;
create policy exercise_sets_update on mybody.exercise_sets for update to authenticated
  using (exists (select 1 from mybody.session_items i join mybody.workout_sessions s on s.id = i.session_id
                 where i.id = session_item_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from mybody.session_items i join mybody.workout_sessions s on s.id = i.session_id
                      where i.id = session_item_id and s.user_id = (select auth.uid())));
drop policy if exists exercise_sets_delete on mybody.exercise_sets;
create policy exercise_sets_delete on mybody.exercise_sets for delete to authenticated
  using (exists (select 1 from mybody.session_items i join mybody.workout_sessions s on s.id = i.session_id
                 where i.id = session_item_id and s.user_id = (select auth.uid())));
grant select, insert, update, delete on mybody.exercise_sets to authenticated;
revoke all on mybody.exercise_sets from anon;

-- 조회: 동작별 세트 순서. PR/추세 계산은 운동별 working 세트를 자주 훑으므로 (session_item_id, set_kind) 부분 인덱스.
create index if not exists exercise_sets_item_set_no_idx on mybody.exercise_sets (session_item_id, set_no);
create index if not exists exercise_sets_working_idx on mybody.exercise_sets (session_item_id)
  where set_kind = 'working' and success is true;

drop trigger if exists exercise_sets_set_updated_at on mybody.exercise_sets;
create trigger exercise_sets_set_updated_at
  before update on mybody.exercise_sets
  for each row execute function mybody.set_updated_at();

commit;
