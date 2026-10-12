-- T-123 · working 세트 전용 뷰. PR(T-049)·추세(T-065)·볼륨(T-108) 계산은 이 뷰만 읽어
-- "세션 soft delete 필터 누락" 을 구조적으로 막는다. security_invoker 라 기반 테이블의 RLS 가 그대로 적용된다(타 사용자 0건).
-- 노출 컬럼: 세트 전체 + 동작(exercise_id, display_name_snapshot, is_assisted 그룹 키) + 세션(user_id, session_date, session_type) + 운동(weight_basis, measurement_type).
-- 계산 규칙(7장): set_kind = working 만. success 는 그대로 노출(PR 후보는 success is true, 볼륨은 success 무관). assisted_minus 는 호출자가 제외(T-120).
begin;

create or replace view mybody.v_working_sets
with (security_invoker = true)
as
select
  e.id,
  e.session_item_id,
  e.set_no,
  e.success,
  e.weight_kg,
  e.reps,
  e.duration_seconds,
  e.distance_meters,
  e.rounds,
  e.side,
  (e.is_assisted is true) as assisted,          -- NULL = 보조 없음 그룹 (T-014 결정)
  e.raw_value_note,
  i.exercise_id,
  i.display_name_snapshot,
  i.sequence_no,
  s.id as session_id,
  s.user_id,
  s.session_date,
  s.session_type,
  x.weight_basis,
  x.measurement_type,
  -- 7.1 세트 볼륨: 중량·반복 둘 다 있고 weight 타입이며 assisted_minus 가 아닐 때만. 아니면 NULL (호출자가 "일부 세트 제외" 표시)
  case
    when x.measurement_type = 'weight' and x.weight_basis <> 'assisted_minus'
         and e.weight_kg is not null and e.reps is not null
      then e.weight_kg * e.reps
    else null
  end as volume_kg
from mybody.exercise_sets e
join mybody.session_items i on i.id = e.session_item_id
join mybody.workout_sessions s on s.id = i.session_id and s.deleted_at is null
left join mybody.exercise_library x on x.id = i.exercise_id
where e.set_kind = 'working';

comment on view mybody.v_working_sets is 'working 세트 + 동작/세션/운동 메타. 세션 deleted_at 필터 내장. 계산 계층은 이 뷰만 읽는다. invoker RLS.';
grant select on mybody.v_working_sets to authenticated;
revoke all on mybody.v_working_sets from anon;

commit;
