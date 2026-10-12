-- T-012 · 운동 사전 (요구사항 v1.2 6.2 exercise_library, FR-003)
-- 기본 제공 운동은 user_id NULL (모든 로그인 사용자가 읽기만), 사용자 정의 운동은 user_id = 본인.
-- 변형은 별도 행 + parent_exercise_id 로 계열만 묶는다(PR 계산에는 쓰지 않음). 자동 병합 금지.
-- 멱등: 재실행 가능하게 if not exists / drop policy if exists 로 쓴다 (db-apply 는 파일 단위 트랜잭션이 아님).

-- 공용 updated_at 트리거 함수 (이후 테이블들도 재사용)
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
revoke execute on function mybody.set_updated_at() from public, anon, authenticated;

create table if not exists mybody.exercise_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- NULL = 기본 제공 운동
  name text not null,
  aliases text[] not null default '{}',
  category text,
  measurement_type text not null,
  weight_basis text,
  parent_exercise_id uuid references mybody.exercise_library (id) on delete set null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_library_name_not_blank check (length(trim(name)) > 0),
  constraint exercise_library_measurement_type_check
    check (measurement_type in ('weight', 'bodyweight', 'time', 'distance', 'complex')),
  constraint exercise_library_weight_basis_check
    check (weight_basis is null or weight_basis in ('barbell_total', 'dumbbell_each', 'added', 'machine_pin', 'assisted_minus')),
  -- weight 타입이면 weight_basis 필수 (몇 달 뒤 비교 불가를 막기 위한 1.2 규칙)
  constraint exercise_library_weight_requires_basis
    check (measurement_type <> 'weight' or weight_basis is not null),
  constraint exercise_library_no_self_parent check (parent_exercise_id is distinct from id)
);

comment on table mybody.exercise_library is '운동 사전. user_id NULL 은 기본 제공, 변형은 별도 행(parent_exercise_id).';
comment on column mybody.exercise_library.weight_basis is 'weight 타입 필수: barbell_total | dumbbell_each | added | machine_pin | assisted_minus';

-- 사용자 안에서 같은 이름의 운동 중복 방지 (기본 운동끼리도). 대소문자·공백 무시.
create unique index if not exists exercise_library_owner_name_uidx
  on mybody.exercise_library (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));
create index if not exists exercise_library_user_id_idx on mybody.exercise_library (user_id);
create index if not exists exercise_library_parent_idx on mybody.exercise_library (parent_exercise_id);

drop trigger if exists exercise_library_set_updated_at on mybody.exercise_library;
create trigger exercise_library_set_updated_at
  before update on mybody.exercise_library
  for each row execute function mybody.set_updated_at();

-- RLS: 읽기는 기본 운동 + 본인 것, 쓰기는 본인 것만. anon 은 아무것도 못 한다 (정책이 authenticated 한정).
alter table mybody.exercise_library enable row level security;
alter table mybody.exercise_library force row level security;

drop policy if exists exercise_library_select on mybody.exercise_library;
create policy exercise_library_select on mybody.exercise_library
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

drop policy if exists exercise_library_insert on mybody.exercise_library;
create policy exercise_library_insert on mybody.exercise_library
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists exercise_library_update on mybody.exercise_library;
create policy exercise_library_update on mybody.exercise_library
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists exercise_library_delete on mybody.exercise_library;
create policy exercise_library_delete on mybody.exercise_library
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- init 의 default privileges 가 authenticated 에 select/insert/update/delete 를 주지만, 명시적으로 고정한다.
grant select, insert, update, delete on mybody.exercise_library to authenticated;
revoke all on mybody.exercise_library from anon;
