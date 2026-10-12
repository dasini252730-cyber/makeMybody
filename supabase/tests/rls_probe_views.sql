-- RLS 프로브 (뷰: v_working_sets). 전부 롤백. 자체 픽스처: 사용자 A/B, 기본 운동, B 세션·동작·세트 1건(60kg×6).
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-a@example.com','x',now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-b@example.com','x',now(),now());
insert into mybody.exercise_library (id, user_id, name, measurement_type, weight_basis) values ('ffffffff-0000-0000-0000-000000000001', null, 'Back Squat', 'weight', 'barbell_total');
insert into mybody.workout_sessions (id, user_id, session_type, raw_note) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'strength', 'B');
insert into mybody.workout_sessions (id, user_id, session_type, raw_note) values ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'PT', 'A');
insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot) values ('dddddddd-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Back Squat');
insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot) values ('dddddddd-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'ffffffff-0000-0000-0000-000000000001', 'Back Squat');
insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000b1', 1, 60, 6);
insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-0000000000a1', 1, 100, 1);

-- v_working_sets (T-123): working 만, 세션 soft delete 제외, 타 사용자 0건, 볼륨 계산, assisted_minus 볼륨 NULL
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare b_item uuid; sid uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; n int; v numeric; begin
  select id into b_item from mybody.session_items where session_id = sid limit 1;
  insert into mybody.exercise_sets (id, session_item_id, set_no, set_kind, weight_kg, reps) values (gen_random_uuid(), b_item, 20, 'warmup', 40, 10);
  select count(*) into n from mybody.v_working_sets where session_id = sid and set_no = 20; if n <> 0 then raise exception 'FAIL warmup leaked into v_working_sets'; end if;
  select count(*) into n from mybody.v_working_sets where user_id <> '22222222-2222-2222-2222-222222222222'; if n <> 0 then raise exception 'FAIL view shows other users (%)', n; end if;
  -- 기본 운동(Back Squat, user_id NULL) 메타가 뷰에서 보이고 볼륨이 계산된다 (NULL 비교로 조용히 통과하지 않게 is distinct from)
  select volume_kg into v from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001'; if v is distinct from 360 then raise exception 'FAIL volume (%)', v; end if; -- 60kg × 6
  if (select weight_basis from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001') is distinct from 'barbell_total' then raise exception 'FAIL base exercise meta not visible'; end if;
  if (select measurement_type from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001') is distinct from 'weight' then raise exception 'FAIL measurement_type missing'; end if;
  if (select unclassified from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001') is distinct from false then raise exception 'FAIL unclassified flag'; end if;
  -- 메모만 있는 세트(reps NULL) 와 중량 0 세트는 볼륨 NULL (id 를 지정해 단정 — exists 로 공허하게 통과하지 않게)
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, raw_value_note) values ('bbbbbbbb-0000-0000-0000-000000000024', b_item, 22, 50, '반복 기억 안 남');
  if (select count(*) from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000024') <> 1 then raise exception 'FAIL memo-only set missing from view'; end if;
  if (select volume_kg from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000024') is not null then raise exception 'FAIL memo-only set has volume'; end if;
  -- assisted 그룹 키(NULL → false)와 created_at 노출
  if (select assisted from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001') is distinct from false then raise exception 'FAIL assisted default false'; end if;
  if (select created_at from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001') is null then raise exception 'FAIL created_at missing'; end if;
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-000000000021', b_item, 21, 0, 10);
  if (select volume_kg from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000021') is not null then raise exception 'FAIL zero-weight set has volume'; end if;
  -- 미분류 동작(exercise_id NULL)도 중량·반복이 있으면 볼륨 계산, unclassified=true
  insert into mybody.session_items (id, session_id, display_name_snapshot, sequence_no) values ('dddddddd-0000-0000-0000-000000000001', sid, '이름 모를 머신', 9);
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-000000000022', 'dddddddd-0000-0000-0000-000000000001', 1, 30, 12);
  if (select volume_kg from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000022') is distinct from 360 then raise exception 'FAIL unclassified volume'; end if;
  if (select unclassified from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000022') is distinct from true then raise exception 'FAIL unclassified flag true'; end if;
  -- bodyweight 타입 운동에 중량이 적혀도 볼륨 NULL (measurement_type 조건)
  insert into mybody.exercise_library (id, name, measurement_type) values ('eeeeeeee-0000-0000-0000-000000000002', 'B 푸시업', 'bodyweight');
  insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot, sequence_no) values ('dddddddd-0000-0000-0000-000000000003', sid, 'eeeeeeee-0000-0000-0000-000000000002', 'B 푸시업', 11);
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-000000000025', 'dddddddd-0000-0000-0000-000000000003', 1, 10, 15);
  if (select volume_kg from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000025') is not null then raise exception 'FAIL bodyweight set has volume'; end if;
  -- assisted_minus 운동의 세트는 볼륨 NULL
  insert into mybody.exercise_library (id, name, measurement_type, weight_basis) values ('eeeeeeee-0000-0000-0000-000000000001', 'B 어시스트 풀업', 'weight', 'assisted_minus');
  insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot, sequence_no) values ('dddddddd-0000-0000-0000-000000000002', sid, 'eeeeeeee-0000-0000-0000-000000000001', 'B 어시스트 풀업', 10);
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-000000000023', 'dddddddd-0000-0000-0000-000000000002', 1, 20, 8);
  if (select volume_kg from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000023') is not null then raise exception 'FAIL assisted_minus set has volume'; end if;
  update mybody.workout_sessions set deleted_at = now() where id = sid;
  select count(*) into n from mybody.v_working_sets where session_id = sid; if n <> 0 then raise exception 'FAIL soft-deleted session sets visible in view'; end if;
  update mybody.workout_sessions set deleted_at = null where id = sid;
  select count(*) into n from mybody.v_working_sets where session_id = sid; if n < 1 then raise exception 'FAIL view empty after restore'; end if;
end $$;
reset role;
-- anon 은 뷰도 못 읽는다
set local role anon;
do $$ begin
  begin perform count(*) from mybody.v_working_sets; raise exception 'FAIL anon select v_working_sets allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'ALL VIEW PROBES PASSED' as result;
rollback;
