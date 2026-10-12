-- T-023 보정 (리뷰 반영). 20261012130000 은 적용 완료라 수정하지 않는다.
-- 중량 의미를 하나로 고정한다 (추천안, T-120 needs_decision 으로 확인 대기):
--   added          = 추가 중량만 저장. 맨몸 수행은 0 을 저장한다(NULL 은 "미입력"). 비교는 같은 운동 안에서 추가 중량 기준.
--   assisted_minus = 보조 감량(kg)을 저장. 7.1 볼륨·7.2 PR 계산에서는 제외하고 이력에만 남긴다(보조가 줄수록 좋아진 것이므로 최고 중량 의미가 반대).
--   dumbbell_each  = 기구 한 개(또는 한쪽) 무게. 고블릿/케틀벨처럼 한 개를 쓰면 그 한 개 무게.
-- category 어휘: 하체 / 가슴 / 등 / 어깨 / 팔 / 코어 / 복합 / 점프 / 유산소 (사용자 정의 운동 폼은 이 목록에서 고른다).
begin;

update mybody.exercise_library set description = '체중 + 추가 중량. 중량 칸에는 추가 중량만 적고, 맨몸이면 0 을 적는다(비우면 미입력).'
  where user_id is null and name in ('턱걸이', '딥스');
update mybody.exercise_library set description = '보조 머신 감량(kg)을 중량에 적는다. 볼륨·PR 계산에서는 제외되고 이력으로만 남는다. 턱걸이와 섞이지 않음.'
  where user_id is null and name = '어시스트 풀업';
update mybody.exercise_library set description = '덤벨/케틀벨 하나를 가슴 앞에 들고. 중량은 그 한 개 무게(편측 표기지만 기구 하나).'
  where user_id is null and name = '고블릿 스쿼트';
update mybody.exercise_library set description = '케틀벨 한 개 무게.' where user_id is null and name = '케틀벨 스윙';
update mybody.exercise_library set description = '덤벨 양손. 중량은 한쪽 덤벨 무게. 맨몸은 "맨몸 런지" 로 기록.'
  where user_id is null and name = '런지';
update mybody.exercise_library set description = '머신 핀/플레이트 표시 중량. 맨몸은 "맨몸 카프 레이즈" 로 기록.'
  where user_id is null and name = '카프 레이즈';
update mybody.exercise_library set description = '반복 수·라운드. 중량을 쓰면 별도 운동(예: 웨이티드 버피, weight/added)으로 등록.'
  where user_id is null and name = '버피';
update mybody.exercise_library set description = '반복 수. 박스 높이는 메모. 중량을 쓰면 별도 운동으로 등록.'
  where user_id is null and name = '박스 점프';

-- 맨몸 변형을 별도 행으로 (weight 타입에 "중량 비움" 안내를 없애기 위해)
insert into mybody.exercise_library (user_id, name, aliases, category, measurement_type, description, parent_exercise_id)
select null, v.name, v.aliases, v.category, 'bodyweight', v.description, p.id
from (values
  ('맨몸 런지',       '{Bodyweight Lunge}'::text[],     '하체', '무게 없이. 좌우 반복 수.',   '런지'),
  ('맨몸 카프 레이즈', '{Bodyweight Calf Raise}'::text[], '하체', '무게 없이. 반복 수.',       '카프 레이즈')
) as v(name, aliases, category, description, parent_name)
join mybody.exercise_library p on p.user_id is null and lower(trim(p.name)) = lower(trim(v.parent_name))
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name))) do nothing;

comment on column mybody.exercise_library.category is '하체 / 가슴 / 등 / 어깨 / 팔 / 코어 / 복합 / 점프 / 유산소 중 하나(어휘 고정, 제약은 사용자 정의 운동 폼에서).';
comment on column mybody.exercise_library.weight_basis is 'weight 타입 필수. barbell_total 총중량 | dumbbell_each 기구 한 개/한쪽 | added 추가 중량만(맨몸 0) | machine_pin 머신 표시 | assisted_minus 보조 감량(볼륨·PR 제외)';

commit;
