-- 역할 시뮬레이션으로 RLS 검증 (API 노출 전). 전부 롤백. 기대와 다르면 raise exception 으로 실패한다.
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-a@example.com','x',now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-b@example.com','x',now(),now());
insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values (null, 'Back Squat', 'weight', 'barbell_total');
insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values ('11111111-1111-1111-1111-111111111111', 'A 전용 운동', 'weight', 'dumbbell_each');
insert into mybody.body_metrics (user_id, weight_kg) values ('11111111-1111-1111-1111-111111111111', 70.5);
insert into mybody.recovery_logs (user_id, log_date, sleep_hours) values ('11111111-1111-1111-1111-111111111111', current_date, 6.5);

-- 1) anon: 아무것도 못 읽는다
set local role anon;
do $$ begin
  begin perform count(*) from mybody.exercise_library; raise exception 'FAIL anon select exercise_library allowed';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from mybody.body_metrics; raise exception 'FAIL anon select body_metrics allowed';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from mybody.recovery_logs; raise exception 'FAIL anon select recovery_logs allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 2) 사용자 B: 기본 운동만 보이고 A 의 데이터는 전혀 안 보인다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from mybody.exercise_library; if n <> 1 then raise exception 'FAIL B should see only base exercise, saw %', n; end if;
  select count(*) into n from mybody.body_metrics; if n <> 0 then raise exception 'FAIL B sees A body_metrics'; end if;
  select count(*) into n from mybody.recovery_logs; if n <> 0 then raise exception 'FAIL B sees A recovery_logs'; end if;
end $$;
-- 3) 기본 운동은 수정·삭제 불가 (0 rows)
update mybody.exercise_library set name = 'hacked' where name = 'Back Squat';
delete from mybody.exercise_library where name = 'Back Squat';
do $$ declare n int; begin
  select count(*) into n from mybody.exercise_library where name = 'hacked'; if n > 0 then raise exception 'FAIL B modified base row'; end if;
  select count(*) into n from mybody.exercise_library where name = 'Back Squat'; if n <> 1 then raise exception 'FAIL B deleted base row'; end if;
end $$;
-- 4) 남의 user_id 로 insert 불가, weight 타입은 weight_basis 필수
do $$ begin
  begin insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values ('11111111-1111-1111-1111-111111111111','B 가 A 로 위장','weight','added');
    raise exception 'FAIL B inserted as A';
  exception when insufficient_privilege or check_violation then null; end;
  begin insert into mybody.body_metrics (user_id, weight_kg) values ('11111111-1111-1111-1111-111111111111', 80);
    raise exception 'FAIL B inserted body_metrics as A';
  exception when insufficient_privilege or check_violation then null; end;
  begin insert into mybody.exercise_library (user_id, name, measurement_type) values ('22222222-2222-2222-2222-222222222222','weight 인데 basis 없음','weight');
    raise exception 'FAIL weight without basis inserted';
  exception when check_violation then null; end;
end $$;
-- 5) 본인 데이터는 쓰기·읽기 가능 (user_id 기본값 auth.uid() 도 동작)
insert into mybody.exercise_library (user_id, name, measurement_type) values ('22222222-2222-2222-2222-222222222222','B 맨몸 운동','bodyweight');
insert into mybody.body_metrics (weight_kg) values (65.0);
insert into mybody.recovery_logs (log_date, sleep_hours, sleep_quality) values (current_date, 7, 4);
do $$ declare n int; begin
  select count(*) into n from mybody.exercise_library; if n <> 2 then raise exception 'FAIL B should see own+base, saw %', n; end if;
  select count(*) into n from mybody.body_metrics; if n <> 1 then raise exception 'FAIL B should see own body_metrics'; end if;
  select count(*) into n from mybody.recovery_logs where user_id = '22222222-2222-2222-2222-222222222222'; if n <> 1 then raise exception 'FAIL B recovery_logs default user_id'; end if;
end $$;
-- 6) 변형의 부모는 기본 운동 또는 본인 운동만 (T-012 보정 트리거). user_id 기본값 auth.uid() 도 확인.
do $$ declare base_id uuid; a_id uuid; begin
  select id into base_id from mybody.exercise_library where name = 'Back Squat';
  select '11111111-1111-1111-1111-111111111111'::uuid into a_id;
  insert into mybody.exercise_library (name, measurement_type, weight_basis, parent_exercise_id)
    values ('B 의 프론트 스쿼트', 'weight', 'barbell_total', base_id);
  if not exists (select 1 from mybody.exercise_library where name = 'B 의 프론트 스쿼트' and user_id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'FAIL default user_id not applied';
  end if;
  begin
    update mybody.exercise_library set parent_exercise_id = (
      select id from mybody.exercise_library where name = 'B 의 프론트 스쿼트')
      where name = 'B 맨몸 운동'; -- 본인 운동을 부모로: 허용
  exception when others then raise exception 'FAIL own parent rejected (%)', sqlerrm; end;
  begin
    -- A 의 운동 id 는 B 에게 보이지 않지만 알고 있다고 가정: 거부되어야 한다
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    select id into a_id from mybody.exercise_library where name = 'A 전용 운동';
    perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
    update mybody.exercise_library set parent_exercise_id = a_id where name = 'B 맨몸 운동';
    raise exception 'FAIL B set parent to A exercise';
  exception when check_violation then null; end;
end $$;
reset role;
select 'ALL RLS PROBES PASSED' as result;
rollback;
