-- T-014 보정 2 (2차 리뷰 반영). 원자적으로 적용.
begin;

-- 1) unique 제약 인덱스와 컬럼·순서가 같은 중복 인덱스 제거
drop index if exists mybody.exercise_sets_item_set_no_idx;

-- 2) "성공한 본세트" 인데 수행량이 전부 0/NULL 인 세트는 막는다 (reps 0 으로 둔 채 저장 → PR 후보 오염 방지).
--    warmup/drop/failed_attempt 나 success 가 false/unknown 인 세트는 제한하지 않는다.
alter table mybody.exercise_sets drop constraint if exists exercise_sets_working_success_has_effort;
alter table mybody.exercise_sets add constraint exercise_sets_working_success_has_effort
  check (
    not (set_kind = 'working' and success is true)
    or coalesce(reps, 0) > 0 or coalesce(duration_seconds, 0) > 0
    or coalesce(distance_meters, 0) > 0 or coalesce(rounds, 0) > 0
  );

commit;
