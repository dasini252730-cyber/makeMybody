-- T-123 보정 (리뷰 반영). create or replace view 는 끝에 컬럼 추가만 가능(제거·타입 변경은 drop view 필요).
-- 볼륨 포함 범위 결정:
--   · 운동 사전 미분류(exercise_id NULL) 동작도 중량·반복이 있으면 계산한다(7.1 은 사전 등록을 요구하지 않음). unclassified 로 구분 노출.
--   · weight_kg 가 0 이면 계산 불가(NULL): added 의 맨몸 0, machine_pin 0 등 — "추가 중량 0 × 반복 = 0" 이 최고 세트 볼륨 후보가 되지 않게.
--   · assisted_minus 는 제외(T-120). time/distance/complex/bodyweight 타입은 NULL.
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
  (e.is_assisted is true) as assisted,
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
  case
    when (x.measurement_type is null or x.measurement_type = 'weight')
         and x.weight_basis is distinct from 'assisted_minus'
         and e.weight_kg is not null and e.weight_kg > 0 and e.reps is not null
      then e.weight_kg * e.reps
    else null
  end as volume_kg,
  (i.exercise_id is null) as unclassified,   -- 신규(끝에 추가): 호출자가 "미분류라 제외" 를 구분
  e.created_at                                -- 신규(끝에 추가): 같은 날 PR 선후 판단용
from mybody.exercise_sets e
join mybody.session_items i on i.id = e.session_item_id
join mybody.workout_sessions s on s.id = i.session_id and s.deleted_at is null
left join mybody.exercise_library x on x.id = i.exercise_id
where e.set_kind = 'working';

comment on view mybody.v_working_sets is 'working 세트 + 동작/세션/운동 메타. 세션 deleted_at 필터 내장. volume_kg: (미분류 또는 weight 타입) & basis≠assisted_minus & weight>0 & reps 있음 일 때만. invoker RLS.';
commit;
