-- T-023 · 기본 운동 시드 (FR-003). user_id NULL = 기본 제공. postgres(db-apply)로만 넣는다.
-- 멱등: 사용자별 이름 유일 인덱스(coalesce(user_id, 0-uuid), lower(trim(name))) 와 같은 식으로 on conflict do nothing.
-- 변형은 별도 행이며 parent_exercise_id 로 계열만 묶는다(PR 계산에는 쓰지 않음, 7.2). 점수 관련 컬럼은 없다(7.5).
-- weight_basis 의미: barbell_total 바벨/기구 총중량 · dumbbell_each 덤벨 한쪽 무게 · added 체중 + 추가 중량 · machine_pin 머신 핀 · assisted_minus 보조 머신 감량.
begin;

create temp table seed_ex (
  name text, aliases text[], category text, measurement_type text, weight_basis text, parent_name text, description text
) on commit drop;

insert into seed_ex values
  -- 하체
  ('스쿼트',            '{Squat,백스쿼트,Back Squat}',          '하체', 'weight',     'barbell_total', null,      '바벨 백스쿼트. 계열 대표.'),
  ('프론트 스쿼트',     '{Front Squat}',                        '하체', 'weight',     'barbell_total', '스쿼트',  '바벨을 앞에 랙. 스쿼트 계열 변형.'),
  ('고블릿 스쿼트',     '{Goblet Squat}',                       '하체', 'weight',     'dumbbell_each', '스쿼트',  '덤벨/케틀벨 하나를 가슴 앞에 들고. 중량은 그 한 개 무게.'),
  ('맨몸 스쿼트',       '{Air Squat,Bodyweight Squat}',         '하체', 'bodyweight', null,            '스쿼트',  '무게 없이. 반복 수만 기록.'),
  ('데드리프트',        '{Deadlift,컨벤셔널 데드리프트}',       '하체', 'weight',     'barbell_total', null,      '바벨 컨벤셔널. 계열 대표.'),
  ('루마니안 데드리프트', '{RDL,Romanian Deadlift}',           '하체', 'weight',     'barbell_total', '데드리프트', '무릎을 덜 굽히고 햄스트링 중심.'),
  ('트랩바 데드리프트', '{Trap Bar Deadlift,Hex Bar Deadlift}', '하체', 'weight',     'barbell_total', '데드리프트', '헥스바 사용.'),
  ('런지',              '{Lunge}',                              '하체', 'weight',     'dumbbell_each', null,      '덤벨 양손. 중량은 한쪽 덤벨 무게. 맨몸이면 중량 비움.'),
  ('불가리안 스플릿 스쿼트', '{Bulgarian Split Squat}',         '하체', 'weight',     'dumbbell_each', '런지',    '뒷발을 벤치에. 좌우 따로 기록.'),
  ('힙 쓰러스트',       '{Hip Thrust}',                         '하체', 'weight',     'barbell_total', null,      '바벨을 골반 위에.'),
  ('레그 프레스',       '{Leg Press}',                          '하체', 'weight',     'machine_pin',   null,      '머신 핀/플레이트 표시 중량.'),
  ('레그 컬',           '{Leg Curl}',                           '하체', 'weight',     'machine_pin',   null,      null),
  ('레그 익스텐션',     '{Leg Extension}',                      '하체', 'weight',     'machine_pin',   null,      null),
  ('카프 레이즈',       '{Calf Raise}',                         '하체', 'weight',     'machine_pin',   null,      '맨몸이면 중량 비움.'),
  -- 가슴·어깨·팔 (밀기)
  ('벤치 프레스',       '{Bench Press}',                        '가슴', 'weight',     'barbell_total', null,      '바벨 플랫 벤치. 계열 대표.'),
  ('인클라인 벤치 프레스', '{Incline Bench Press}',             '가슴', 'weight',     'barbell_total', '벤치 프레스', null),
  ('덤벨 벤치 프레스',  '{Dumbbell Bench Press}',               '가슴', 'weight',     'dumbbell_each', '벤치 프레스', '중량은 한쪽 덤벨 무게.'),
  ('푸시업',            '{Push-up,Push Up,팔굽혀펴기}',         '가슴', 'bodyweight', null,            null,      '반복 수. 무릎 푸시업은 보조 메모로.'),
  ('오버헤드 프레스',   '{OHP,Overhead Press,밀리터리 프레스}', '어깨', 'weight',     'barbell_total', null,      '바벨 서서. 계열 대표.'),
  ('덤벨 숄더 프레스',  '{Dumbbell Shoulder Press}',            '어깨', 'weight',     'dumbbell_each', '오버헤드 프레스', '중량은 한쪽 덤벨 무게.'),
  ('사이드 레터럴 레이즈', '{Lateral Raise}',                   '어깨', 'weight',     'dumbbell_each', null,      null),
  ('딥스',              '{Dips}',                               '가슴', 'weight',     'added',         null,      '체중 + 추가 중량. 보조 머신이면 assisted 운동으로 따로 등록.'),
  ('트라이셉스 푸시다운', '{Triceps Pushdown}',                 '팔',   'weight',     'machine_pin',   null,      null),
  ('바이셉스 컬',       '{Biceps Curl}',                        '팔',   'weight',     'dumbbell_each', null,      '덤벨 기준. 바벨 컬은 별도 등록.'),
  -- 등 (당기기)
  ('턱걸이',            '{Pull-up,Pull Up,풀업}',               '등',   'weight',     'added',         null,      '체중 + 추가 중량. 맨몸이면 중량 비움.'),
  ('어시스트 풀업',     '{Assisted Pull-up}',                   '등',   'weight',     'assisted_minus', '턱걸이', '보조 머신 감량을 중량에 적는다. 턱걸이와 PR 은 섞이지 않음.'),
  ('바벨 로우',         '{Barbell Row,Bent-over Row}',          '등',   'weight',     'barbell_total', null,      null),
  ('덤벨 로우',         '{Dumbbell Row,원암 로우}',             '등',   'weight',     'dumbbell_each', '바벨 로우', '한쪽씩. 좌우 따로 기록.'),
  ('랫 풀다운',         '{Lat Pulldown}',                       '등',   'weight',     'machine_pin',   null,      null),
  ('시티드 로우',       '{Seated Row,Cable Row}',               '등',   'weight',     'machine_pin',   null,      null),
  ('매달리기',          '{Dead Hang,데드행}',                   '등',   'time',       null,            null,      '바에 매달린 시간(초).'),
  -- 코어·복합·점프
  ('플랭크',            '{Plank}',                              '코어', 'time',       null,            null,      '지속 시간(초).'),
  ('케틀벨 스윙',       '{Kettlebell Swing}',                   '복합', 'weight',     'dumbbell_each', null,      '케틀벨 한 개 무게.'),
  ('버피',              '{Burpee}',                             '복합', 'complex',    null,            null,      '반복 수·라운드.'),
  ('박스 점프',         '{Box Jump}',                           '점프', 'complex',    null,            null,      '반복 수. 박스 높이는 메모.'),
  ('줄넘기',            '{Jump Rope}',                          '유산소', 'time',     null,            null,      '지속 시간 또는 횟수(메모).'),
  -- 유산소·활동 (세션 안 세트로 기록할 때. 걷기·등산의 코스/고도는 activity_records 가 담당)
  ('걷기',              '{Walking,산책}',                       '유산소', 'distance', null,            null,      '거리·시간. 상세는 활동 기록.'),
  ('러닝',              '{Running,달리기}',                     '유산소', 'distance', null,            null,      '거리·시간.'),
  ('하이킹',            '{Hiking,등산,트레킹}',                 '유산소', 'distance', null,            null,      '거리·시간. 고도·배낭은 활동 기록.'),
  ('실내 자전거',       '{Stationary Bike,사이클}',             '유산소', 'time',     null,            null,      '시간. 거리는 메모.'),
  ('로잉 머신',         '{Rowing Machine,로워}',                '유산소', 'distance', null,            null,      '거리·시간.');

-- 1) 부모가 없는 운동부터
insert into mybody.exercise_library (user_id, name, aliases, category, measurement_type, weight_basis, description)
select null, name, aliases, category, measurement_type, weight_basis, description
from seed_ex where parent_name is null
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name))) do nothing;

-- 2) 변형 (부모 id 조회)
insert into mybody.exercise_library (user_id, name, aliases, category, measurement_type, weight_basis, description, parent_exercise_id)
select null, s.name, s.aliases, s.category, s.measurement_type, s.weight_basis, s.description, p.id
from seed_ex s
join mybody.exercise_library p on p.user_id is null and lower(trim(p.name)) = lower(trim(s.parent_name))
where s.parent_name is not null
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name))) do nothing;

commit;
