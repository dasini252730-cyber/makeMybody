-- T-023 보정 2. 보조 딥스 경로 복원 + dumbbell_each 설명 누락 보완. 멱등: 바뀔 때만 update, 삽입 건수 검증.
begin;

do $$
declare parent_id uuid; inserted int;
begin
  select id into parent_id from mybody.exercise_library where user_id is null and lower(trim(name)) = '딥스';
  if parent_id is null then raise exception 'seed parent "딥스" not found'; end if;
  insert into mybody.exercise_library (user_id, name, aliases, category, measurement_type, weight_basis, description, parent_exercise_id)
  values (null, '어시스트 딥스', '{Assisted Dips}', '가슴', 'weight', 'assisted_minus',
          '보조 머신 감량(kg)을 중량에 적는다. 볼륨·PR 계산에서는 제외되고 이력으로만 남는다. 딥스와 섞이지 않음.', parent_id)
  on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name))) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 and not exists (select 1 from mybody.exercise_library where user_id is null and lower(trim(name)) = '어시스트 딥스') then
    raise exception 'assisted dips row missing after insert';
  end if;
end $$;

update mybody.exercise_library set description = '체중 + 추가 중량. 추가 중량만 적고 맨몸이면 0. 보조 머신은 "어시스트 딥스" 로 기록.'
  where user_id is null and name = '딥스'
    and description is distinct from '체중 + 추가 중량. 추가 중량만 적고 맨몸이면 0. 보조 머신은 "어시스트 딥스" 로 기록.';
update mybody.exercise_library set description = '체중 + 추가 중량. 추가 중량만 적고 맨몸이면 0. 보조 머신은 "어시스트 풀업" 으로 기록.'
  where user_id is null and name = '턱걸이'
    and description is distinct from '체중 + 추가 중량. 추가 중량만 적고 맨몸이면 0. 보조 머신은 "어시스트 풀업" 으로 기록.';
update mybody.exercise_library set description = '뒷발을 벤치에. 덤벨 양손이면 한쪽 덤벨 무게. 좌우 따로 기록.'
  where user_id is null and name = '불가리안 스플릿 스쿼트'
    and description is distinct from '뒷발을 벤치에. 덤벨 양손이면 한쪽 덤벨 무게. 좌우 따로 기록.';
update mybody.exercise_library set description = '덤벨 양손. 중량은 한쪽 덤벨 무게.'
  where user_id is null and name = '사이드 레터럴 레이즈'
    and description is distinct from '덤벨 양손. 중량은 한쪽 덤벨 무게.';
update mybody.exercise_library set description = '덤벨 기준, 중량은 한쪽 덤벨 무게. 바벨 컬은 별도 등록.'
  where user_id is null and name = '바이셉스 컬'
    and description is distinct from '덤벨 기준, 중량은 한쪽 덤벨 무게. 바벨 컬은 별도 등록.';

commit;
