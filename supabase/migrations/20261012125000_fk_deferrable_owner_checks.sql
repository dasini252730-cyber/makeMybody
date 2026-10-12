-- T-013 보정 4 (2차 리뷰 반영). 원자적으로 적용.
begin;

-- 1) session_items.exercise_id FK: restrict 는 계정 삭제(auth.users cascade) 를 23503 으로 깨뜨린다.
--    deferrable initially deferred 로 바꾸면 같은 트랜잭션 안의 cascade 가 끝난 뒤 검사되어 계정 삭제는 성공하고,
--    기록에 쓰인 운동을 직접 지우는 것은 commit 시점에 여전히 차단된다(정리는 is_archived).
alter table mybody.session_items drop constraint if exists session_items_exercise_id_fkey;
alter table mybody.session_items add constraint session_items_exercise_id_fkey
  foreign key (exercise_id) references mybody.exercise_library (id)
  on delete restrict deferrable initially deferred;

-- 2) 트리거 함수 execute 는 CREATE TRIGGER 시점에만 검사되므로 호출자 권한이 필요 없다 → 최소 권한으로 회수.
revoke execute on function mybody.check_session_item_exercise_owner() from public, anon, authenticated;
revoke execute on function mybody.check_exercise_parent_owner() from public, anon, authenticated;

-- 3) 소유 검사: API 호출자는 auth.uid() 기준, 서버 컨텍스트(uid NULL)는 행의 소유자 기준으로 검사한다.
--    (서버 컨텍스트에서만 세션 소유자를 조회하므로 타인 id 탐색 오라클은 생기지 않는다.)
create or replace function mybody.check_exercise_parent_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  subject uuid := coalesce((select auth.uid()), new.user_id); -- 기본 운동(user_id NULL)을 서버가 넣을 때는 NULL
  parent_owner uuid;
  parent_found boolean;
begin
  if new.parent_exercise_id is null then
    return new;
  end if;
  select true, user_id into parent_found, parent_owner from mybody.exercise_library where id = new.parent_exercise_id;
  if parent_found is not true or (parent_owner is not null and parent_owner is distinct from subject) then
    raise exception 'parent exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function mybody.check_session_item_exercise_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  subject uuid := (select auth.uid());
  ex_owner uuid;
  ex_found boolean;
begin
  if new.exercise_id is null then
    return new;
  end if;
  if subject is null then
    -- 서버 컨텍스트: 세션 소유자 기준 (RLS 없이 조회 가능한 역할만 여기 온다)
    select user_id into subject from mybody.workout_sessions where id = new.session_id;
  end if;
  select true, user_id into ex_found, ex_owner from mybody.exercise_library where id = new.exercise_id;
  if ex_found is not true or (ex_owner is not null and ex_owner is distinct from subject) then
    raise exception 'exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- 4) 체중 측정 시각 상한: 기기 시계 오차를 감안해 1시간. (클라이언트는 가급적 measured_at 을 보내지 않고 서버 now() 를 쓴다)
alter table mybody.body_metrics drop constraint if exists body_metrics_measured_not_future;
alter table mybody.body_metrics add constraint body_metrics_measured_not_future
  check (measured_at <= now() + interval '1 hour');

commit;
