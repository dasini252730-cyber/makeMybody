-- T-013/T-016 보정 3. 원자적으로 적용.
begin;

-- 1) 소유 검사 트리거는 API 사용자(JWT 있음)에게만 적용한다. postgres/시드처럼 auth.uid() 가 NULL 인 서버 컨텍스트는 통과.
--    (anon 은 insert 권한 자체가 없고, authenticated 는 항상 uid 가 있으므로 구멍이 아니다.)
create or replace function mybody.check_session_item_exercise_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  ex_owner uuid;
  ex_found boolean;
begin
  if new.exercise_id is null or caller is null then
    return new;
  end if;
  select true, user_id into ex_found, ex_owner from mybody.exercise_library where id = new.exercise_id;
  if ex_found is not true or (ex_owner is not null and ex_owner is distinct from caller) then
    raise exception 'exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function mybody.check_exercise_parent_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  parent_owner uuid;
  parent_found boolean;
begin
  if new.parent_exercise_id is null or caller is null then
    return new;
  end if;
  select true, user_id into parent_found, parent_owner from mybody.exercise_library where id = new.parent_exercise_id;
  if parent_found is not true or (parent_owner is not null and parent_owner is distinct from caller) then
    raise exception 'parent exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- 2) body_metrics 측정 시각 상한을 recovery/세션과 같은 기준(사실상 "지금까지")으로. 시계 오차 5분만 허용.
alter table mybody.body_metrics drop constraint if exists body_metrics_measured_not_future;
alter table mybody.body_metrics add constraint body_metrics_measured_not_future
  check (measured_at <= now() + interval '5 minutes');

commit;
