-- T-104 보정 2 (2차 리뷰 반영). 원자적으로 적용.
begin;

-- 1) 폼이 activity_type: null 을 보내도 저장되게 NULL → 'other' 정규화 (default 는 명시적 NULL 에 안 먹는다)
create or replace function mybody.normalize_activity_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.activity_type is null then
    new.activity_type := 'other';
  end if;
  return new;
end;
$$;
revoke execute on function mybody.normalize_activity_type() from public, anon, authenticated;
alter table mybody.activity_records alter column activity_type drop not null; -- 트리거가 채우므로 입력 단계 NULL 허용
drop trigger if exists activity_records_normalize_type on mybody.activity_records;
create trigger activity_records_normalize_type
  before insert or update of activity_type on mybody.activity_records
  for each row execute function mybody.normalize_activity_type();
-- 트리거 뒤에도 NULL 이 남지 않도록 check 로 못 박는다 (not null 대신: 트리거는 before 라 check 전에 돈다)
alter table mybody.activity_records drop constraint if exists activity_records_type_not_null;
alter table mybody.activity_records add constraint activity_records_type_not_null check (activity_type is not null);

-- 2) 0km·0분·0m 만 있는 "빈 활동" 은 거부. 수치 하나라도 > 0 이거나 메모·코스·배낭 무게가 있어야 한다.
alter table mybody.activity_records drop constraint if exists activity_records_not_empty;
alter table mybody.activity_records add constraint activity_records_not_empty
  check (
    coalesce(distance_meters, 0) > 0 or coalesce(duration_minutes, 0) > 0 or coalesce(elevation_gain_meters, 0) > 0
    or coalesce(pack_weight_kg, 0) > 0
    or length(trim(coalesce(route_name, ''))) > 0 or length(trim(coalesce(conditions_note, ''))) > 0
    or length(trim(coalesce(pain_recovery_note, ''))) > 0
  );
commit;
