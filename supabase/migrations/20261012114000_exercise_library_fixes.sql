-- T-012 보정 (리뷰 반영). 20261012110000 은 이미 적용되어 수정하지 않는다.
-- 1) user_id 기본값 auth.uid(): 클라이언트가 user_id 를 실어 보내지 않아도 본인 행이 된다.
--    postgres/service_role 로 넣는 기본 운동은 JWT 가 없어 NULL 이 되므로 그대로 "기본 제공" 이 된다.
alter table mybody.exercise_library alter column user_id set default auth.uid();

-- 2) parent_exercise_id 는 기본 운동(user_id NULL) 또는 본인 운동만 가리킬 수 있다.
--    FK 검사는 RLS 를 거치지 않으므로 트리거로 막는다 (타인 운동 id 존재 여부 탐색 방지, 계열 조회에서 부모 누락 방지).
create or replace function mybody.check_exercise_parent_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_owner uuid;
  parent_exists boolean;
begin
  if new.parent_exercise_id is null then
    return new;
  end if;
  select true, user_id into parent_exists, parent_owner
    from mybody.exercise_library where id = new.parent_exercise_id;
  if parent_exists is not true then
    raise exception 'parent exercise not found' using errcode = 'foreign_key_violation';
  end if;
  if parent_owner is not null and parent_owner is distinct from new.user_id then
    raise exception 'parent exercise must be a base exercise or your own' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function mybody.check_exercise_parent_owner() from public, anon, authenticated;

drop trigger if exists exercise_library_check_parent_owner on mybody.exercise_library;
create trigger exercise_library_check_parent_owner
  before insert or update of parent_exercise_id, user_id on mybody.exercise_library
  for each row execute function mybody.check_exercise_parent_owner();

comment on column mybody.exercise_library.parent_exercise_id is '변형의 상위 운동(계열 보기용, PR 계산 제외). 기본 운동 또는 본인 운동만 허용(트리거).';
