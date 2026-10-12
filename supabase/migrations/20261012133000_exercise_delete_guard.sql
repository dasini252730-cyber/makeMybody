-- T-013 보정 6 (3차 리뷰 반영). 참고: 125000 §1 의 "restrict deferrable" 설명은 무효이며 126000(no action deferred)이 최종이다.
begin;

-- 1) 기록에 쓰인 운동 삭제를 즉시, 정해진 오류 코드로 막는다 (commit 시점 FK 검사에만 기대지 않음 → 클라이언트에 23503 보장).
--    계정 삭제 cascade(auth.users 가 이미 사라진 경우)는 통과시킨다.
create or replace function mybody.guard_exercise_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 서버 컨텍스트(uid NULL, auth.users 조회 가능)에서 소유자 계정이 이미 없으면 계정 삭제 cascade 중 → 허용.
  -- API 사용자는 auth.users 를 읽을 수 없으므로 이 분기를 타지 않는다(본인 계정은 존재하므로 어차피 해당 없음).
  if (select auth.uid()) is null and old.user_id is not null
     and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  if exists (select 1 from mybody.session_items i where i.exercise_id = old.id) then
    raise exception 'exercise is referenced by workout records; archive it instead'
      using errcode = 'foreign_key_violation';
  end if;
  return old;
end;
$$;
revoke execute on function mybody.guard_exercise_delete() from public, anon, authenticated;

drop trigger if exists exercise_library_guard_delete on mybody.exercise_library;
create trigger exercise_library_guard_delete
  before delete on mybody.exercise_library
  for each row execute function mybody.guard_exercise_delete();

-- 2) 동작의 세션 이동(session_id 변경)에도 소유 검사가 돌도록 발동 컬럼 복원
drop trigger if exists session_items_check_exercise_owner on mybody.session_items;
create trigger session_items_check_exercise_owner
  before insert or update of exercise_id, session_id on mybody.session_items
  for each row execute function mybody.check_session_item_exercise_owner();

commit;
