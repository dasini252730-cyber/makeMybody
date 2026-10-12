-- T-013 · 세션 + 세션 내 동작 (요구사항 v1.2 6.2 workout_sessions / session_items, FR-001/002/005/020)
-- 핵심: raw_note(원문 메모) 만으로 세션 저장 가능, id 는 클라이언트 UUID(upsert 로 재전송 중복 방지), 삭제는 deleted_at.
-- 멱등하게 작성. RLS 는 테이블 생성 직후에 건다(부분 적용 시 노출 방지).

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

-- workout_sessions ------------------------------------------------------------
create table if not exists mybody.workout_sessions (
  id uuid primary key,                                   -- 클라이언트 생성 (crypto.randomUUID)
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  session_type text not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  raw_note text,                                         -- 운동 직후 원문 메모. 구조화 후에도 유지
  structured_status text not null default 'none',        -- none / partial / done
  condition_note text,
  general_note text,
  source_type text not null default 'manual',            -- manual / ai_draft / ai_confirmed / import
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workout_sessions_type_check
    check (session_type in ('PT', 'strength', 'mixed', 'walk', 'hike', 'other')),
  constraint workout_sessions_structured_check check (structured_status in ('none', 'partial', 'done')),
  constraint workout_sessions_source_check check (source_type in ('manual', 'ai_draft', 'ai_confirmed', 'import')),
  constraint workout_sessions_duration_check check (duration_minutes is null or (duration_minutes >= 0 and duration_minutes <= 1440)),
  constraint workout_sessions_time_order check (started_at is null or ended_at is null or ended_at >= started_at),
  constraint workout_sessions_date_not_future check (session_date <= (now() at time zone 'Asia/Seoul')::date + 1)
);
comment on table mybody.workout_sessions is '운동 세션. raw_note 만으로도 저장 가능. soft delete(deleted_at). id 는 클라이언트 UUID.';

alter table mybody.workout_sessions enable row level security;
alter table mybody.workout_sessions force row level security;
drop policy if exists workout_sessions_select on mybody.workout_sessions;
create policy workout_sessions_select on mybody.workout_sessions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists workout_sessions_insert on mybody.workout_sessions;
create policy workout_sessions_insert on mybody.workout_sessions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists workout_sessions_update on mybody.workout_sessions;
create policy workout_sessions_update on mybody.workout_sessions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists workout_sessions_delete on mybody.workout_sessions;
create policy workout_sessions_delete on mybody.workout_sessions for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on mybody.workout_sessions to authenticated, service_role;
revoke all on mybody.workout_sessions from anon;

-- 목록/홈 조회: 삭제 안 된 세션을 날짜 역순으로. 구조화 안 된 세션 수 집계용 부분 인덱스.
create index if not exists workout_sessions_user_date_idx
  on mybody.workout_sessions (user_id, session_date desc) where deleted_at is null;
create index if not exists workout_sessions_unstructured_idx
  on mybody.workout_sessions (user_id) where deleted_at is null and structured_status = 'none';

drop trigger if exists workout_sessions_set_updated_at on mybody.workout_sessions;
create trigger workout_sessions_set_updated_at
  before update on mybody.workout_sessions
  for each row execute function mybody.set_updated_at();

-- session_items ---------------------------------------------------------------
-- exercise_id 는 nullable(미분류 동작 허용). display_name_snapshot 은 입력 당시 이름.
-- variation_note/assistance_note 는 참고 메모일 뿐 비교 조건이 아니다(1.2). 통증은 pain_note(FR-020).
create table if not exists mybody.session_items (
  id uuid primary key,                                   -- 클라이언트 생성
  session_id uuid not null references mybody.workout_sessions (id) on delete cascade,
  exercise_id uuid references mybody.exercise_library (id) on delete set null,
  display_name_snapshot text not null,
  sequence_no integer not null default 1,
  variation_note text,
  assistance_note text,
  difficulty_rpe smallint,
  pain_note text,
  item_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_items_name_not_blank check (length(trim(display_name_snapshot)) > 0),
  constraint session_items_rpe_check check (difficulty_rpe is null or difficulty_rpe between 1 and 10),
  constraint session_items_seq_check check (sequence_no >= 1)
);
comment on table mybody.session_items is '세션 내 동작. 세트는 exercise_sets. success_status 는 세트로 이동해 없음.';

alter table mybody.session_items enable row level security;
alter table mybody.session_items force row level security;

-- 소유 검사는 세션 조인. 정책 안의 서브쿼리는 workout_sessions 의 RLS 를 다시 거친다(본인 세션만 보이므로 안전).
drop policy if exists session_items_select on mybody.session_items;
create policy session_items_select on mybody.session_items for select to authenticated
  using (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists session_items_insert on mybody.session_items;
create policy session_items_insert on mybody.session_items for insert to authenticated
  with check (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists session_items_update on mybody.session_items;
create policy session_items_update on mybody.session_items for update to authenticated
  using (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists session_items_delete on mybody.session_items;
create policy session_items_delete on mybody.session_items for delete to authenticated
  using (exists (select 1 from mybody.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
grant select, insert, update, delete on mybody.session_items to authenticated, service_role;
revoke all on mybody.session_items from anon;

create index if not exists session_items_session_seq_idx on mybody.session_items (session_id, sequence_no);
create index if not exists session_items_exercise_idx on mybody.session_items (exercise_id);

drop trigger if exists session_items_set_updated_at on mybody.session_items;
create trigger session_items_set_updated_at
  before update on mybody.session_items
  for each row execute function mybody.set_updated_at();

-- exercise_id 는 기본 운동 또는 본인 운동만 (FK 는 RLS 를 안 거치므로 트리거). 세션 소유자 기준으로 검사한다.
create or replace function mybody.check_session_item_exercise_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ex_owner uuid;
  ex_found boolean;
  sess_owner uuid;
begin
  if new.exercise_id is null then
    return new;
  end if;
  select user_id into sess_owner from mybody.workout_sessions where id = new.session_id;
  select true, user_id into ex_found, ex_owner from mybody.exercise_library where id = new.exercise_id;
  if ex_found is not true then
    raise exception 'exercise not found' using errcode = 'foreign_key_violation';
  end if;
  if ex_owner is not null and ex_owner is distinct from sess_owner then
    raise exception 'exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function mybody.check_session_item_exercise_owner() from public, anon, authenticated;

drop trigger if exists session_items_check_exercise_owner on mybody.session_items;
create trigger session_items_check_exercise_owner
  before insert or update of exercise_id, session_id on mybody.session_items
  for each row execute function mybody.check_session_item_exercise_owner();
