-- T-014 보정 3 (3차 리뷰 반영). 원자적으로 적용.
-- "성공한 본세트는 수행량 >0" 규칙이 "횟수 기억 안 남(메모만)" 세트를 유실시키지 않도록, raw_value_note 가 있으면 허용한다.
-- 클라이언트 규칙(docs/T-014.md): 수량이 전혀 없고 메모도 없으면 success 를 NULL(unknown)로 보낸다.
begin;
alter table mybody.exercise_sets drop constraint if exists exercise_sets_working_success_has_effort;
alter table mybody.exercise_sets add constraint exercise_sets_working_success_has_effort
  check (
    not (set_kind = 'working' and success is true)
    or coalesce(reps, 0) > 0 or coalesce(duration_seconds, 0) > 0
    or coalesce(distance_meters, 0) > 0 or coalesce(rounds, 0) > 0
    or length(trim(coalesce(raw_value_note, ''))) > 0
  );
commit;
