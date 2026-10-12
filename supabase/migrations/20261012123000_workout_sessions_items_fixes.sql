-- T-013 보정 (리뷰 반영). 20261012120000 은 적용 완료라 수정하지 않는다. 원자적으로 적용.
begin;

-- 1) service_role grant 제거 (README 규칙: 필요한 작업에서 테이블 단위로만)
revoke all on mybody.workout_sessions from service_role;
revoke all on mybody.session_items from service_role;

-- 2) 날짜 상한을 recovery_logs 와 동일하게 "KST 오늘까지" 로 통일
alter table mybody.workout_sessions drop constraint if exists workout_sessions_date_not_future;
alter table mybody.workout_sessions add constraint workout_sessions_date_not_future
  check (session_date <= (now() at time zone 'Asia/Seoul')::date);

-- 3) 운동 삭제가 과거 기록의 exercise_id 를 지우지 않게 restrict. 정리는 is_archived 로.
alter table mybody.session_items drop constraint if exists session_items_exercise_id_fkey;
alter table mybody.session_items add constraint session_items_exercise_id_fkey
  foreign key (exercise_id) references mybody.exercise_library (id) on delete restrict;

-- 4) 운동 소유 검사 트리거: 세션 소유자를 조회하지 않고(타인 세션 id 탐색 오라클 방지) 호출자 기준으로만 판단.
--    security invoker 라 exercise_library 의 RLS 가 적용되어 "안 보이는 운동" = 허용되지 않는 운동이다. 오류 코드는 한 가지로 통일.
create or replace function mybody.check_session_item_exercise_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ex_owner uuid;
  ex_found boolean;
begin
  if new.exercise_id is null then
    return new;
  end if;
  select true, user_id into ex_found, ex_owner from mybody.exercise_library where id = new.exercise_id;
  if ex_found is not true or (ex_owner is not null and ex_owner is distinct from (select auth.uid())) then
    raise exception 'exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function mybody.check_session_item_exercise_owner() from public, anon;
grant execute on function mybody.check_session_item_exercise_owner() to authenticated; -- invoker 트리거는 호출자 권한 필요

drop trigger if exists session_items_check_exercise_owner on mybody.session_items;
create trigger session_items_check_exercise_owner
  before insert or update of exercise_id on mybody.session_items
  for each row execute function mybody.check_session_item_exercise_owner();

-- 같은 이유로 T-012 의 부모 소유 트리거도 invoker + 호출자 기준으로 통일한다.
create or replace function mybody.check_exercise_parent_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_owner uuid;
  parent_found boolean;
begin
  if new.parent_exercise_id is null then
    return new;
  end if;
  select true, user_id into parent_found, parent_owner from mybody.exercise_library where id = new.parent_exercise_id;
  if parent_found is not true or (parent_owner is not null and parent_owner is distinct from (select auth.uid())) then
    raise exception 'parent exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function mybody.check_exercise_parent_owner() from public, anon;
grant execute on function mybody.check_exercise_parent_owner() to authenticated;

commit;
