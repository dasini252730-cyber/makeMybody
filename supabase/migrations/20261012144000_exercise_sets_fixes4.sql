-- T-014 보정 4 (4차 리뷰 반영). 메모 예외는 수량이 전부 NULL 일 때만 — reps=0 + 메모로 100kg 0회가 PR 후보가 되지 않게.
begin;
alter table mybody.exercise_sets drop constraint if exists exercise_sets_working_success_has_effort;
alter table mybody.exercise_sets add constraint exercise_sets_working_success_has_effort
  check (
    not (set_kind = 'working' and success is true)
    or coalesce(reps, 0) > 0 or coalesce(duration_seconds, 0) > 0
    or coalesce(distance_meters, 0) > 0 or coalesce(rounds, 0) > 0
    or (reps is null and duration_seconds is null and distance_meters is null and rounds is null
        and length(trim(coalesce(raw_value_note, ''))) > 0)
  );
commit;
