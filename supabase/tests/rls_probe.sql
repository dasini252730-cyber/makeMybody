-- 역할 시뮬레이션으로 RLS 검증 (API 노출 전). 전부 롤백. 기대와 다르면 raise exception 으로 실패한다.
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-a@example.com','x',now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-b@example.com','x',now(),now());
insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values (null, 'Back Squat', 'weight', 'barbell_total');
insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values ('11111111-1111-1111-1111-111111111111', 'A 전용 운동', 'weight', 'dumbbell_each');
insert into mybody.body_metrics (user_id, weight_kg) values ('11111111-1111-1111-1111-111111111111', 70.5);
insert into mybody.recovery_logs (user_id, log_date, sleep_hours) values ('11111111-1111-1111-1111-111111111111', (now() at time zone 'Asia/Seoul')::date, 6.5);

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
  select count(*) into n from mybody.exercise_library where user_id is not null; if n <> 0 then raise exception 'FAIL B sees user-owned exercises of others (%)', n; end if;
  select count(*) into n from mybody.exercise_library where name = 'Back Squat'; if n <> 1 then raise exception 'FAIL B cannot see base exercise'; end if;
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
insert into mybody.recovery_logs (log_date, sleep_hours, sleep_quality) values ((now() at time zone 'Asia/Seoul')::date, 7, 4);
do $$ declare n int; begin
  select count(*) into n from mybody.exercise_library where user_id = '22222222-2222-2222-2222-222222222222'; if n <> 1 then raise exception 'FAIL B should see own exercise, saw %', n; end if;
  select count(*) into n from mybody.exercise_library where user_id is not null and user_id <> '22222222-2222-2222-2222-222222222222'; if n <> 0 then raise exception 'FAIL B sees others exercises'; end if;
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
-- 6b) 제약 (T-016 보정): 체지방 0 거부, 빈 행 거부, 메모만 있는 행 허용, recovery 빈 행·중복 날짜·미래 날짜 거부, log_date KST 기본값
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare d date; begin
  begin insert into mybody.body_metrics (body_fat_percent) values (0); raise exception 'FAIL fat 0 accepted';
  exception when check_violation then null; end;
  begin insert into mybody.body_metrics (note) values ('   '); raise exception 'FAIL empty body row accepted';
  exception when check_violation then null; end;
  insert into mybody.body_metrics (note) values ('인바디 예약만 함'); -- 메모만: 허용
  begin insert into mybody.body_metrics (weight_kg, measured_at) values (70, now() + interval '3 days'); raise exception 'FAIL future measured_at accepted';
  exception when check_violation then null; end;
  begin insert into mybody.recovery_logs (log_date) values ((now() at time zone 'Asia/Seoul')::date - 3); raise exception 'FAIL empty recovery row accepted';
  exception when check_violation then null; end;
  begin insert into mybody.recovery_logs (log_date, sleep_hours) values ((now() at time zone 'Asia/Seoul')::date, 5); raise exception 'FAIL duplicate log_date accepted';
  exception when unique_violation then null; end;
  begin insert into mybody.recovery_logs (log_date, sleep_hours) values ((now() at time zone 'Asia/Seoul')::date + 2, 5); raise exception 'FAIL future log_date accepted';
  exception when check_violation then null; end;
  -- 기본값 검증을 위해 B 의 행을 비운다. RLS 에만 기대지 않고 user_id 를 명시한다(블록 단독 실행 시 전체 삭제 방지).
  delete from mybody.recovery_logs where user_id = '22222222-2222-2222-2222-222222222222';
  insert into mybody.recovery_logs (sleep_hours) values (0) returning log_date into d; -- 기본값 KST 오늘, 철야 0 허용
  if d <> (now() at time zone 'Asia/Seoul')::date then
    raise exception 'FAIL log_date default is not KST today (%)', d;
  end if;
end $$;
reset role;

-- 7) 세션/동작 (T-013): raw_note 만으로 저장, 같은 id upsert 1건, B 는 A 세션·동작 못 봄, 동작은 본인 세션에만, 운동은 기본/본인 것만
do $$ declare sid uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; n int; base_id uuid; a_ex uuid; a_sid uuid := 'aaaaaaaa-0000-0000-0000-00000000000a'; begin
  -- A 의 세션 + 동작 1건 (postgres 권한으로 넣기 위해 잠시 역할 복귀. JWT 클레임도 비워 서버 컨텍스트로 만든다)
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into mybody.workout_sessions (id, user_id, session_type, raw_note) values (a_sid, '11111111-1111-1111-1111-111111111111', 'PT', 'A 의 메모');
  select id into a_ex from mybody.exercise_library where name = 'A 전용 운동';
  select id into base_id from mybody.exercise_library where name = 'Back Squat';
  insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot) values (gen_random_uuid(), a_sid, a_ex, 'A 의 동작');
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  -- B 는 A 세션의 동작을 한 건도 못 본다 (완료 조건 3)
  select count(*) into n from mybody.session_items where session_id = a_sid; if n <> 0 then raise exception 'FAIL B sees A items (%)', n; end if;
  -- 타인 세션 id 로 upsert 시도 → 오류로 중단되어야 한다(조용히 0건이 아님)
  begin
    insert into mybody.workout_sessions (id, session_type, raw_note) values (a_sid, 'strength', '탈취')
      on conflict (id) do update set raw_note = excluded.raw_note;
    raise exception 'FAIL B upserted onto A session id';
  exception when insufficient_privilege or unique_violation then null; end;
  -- raw_note 만 있는 세션 + 같은 id 재전송(upsert) → 1건
  insert into mybody.workout_sessions (id, session_type, raw_note) values (sid, 'strength', '데드 40x10 x3')
    on conflict (id) do update set raw_note = excluded.raw_note;
  insert into mybody.workout_sessions (id, session_type, raw_note) values (sid, 'strength', '데드 40x10 x3 (수정)')
    on conflict (id) do update set raw_note = excluded.raw_note;
  select count(*) into n from mybody.workout_sessions where id = sid; if n <> 1 then raise exception 'FAIL upsert produced % rows', n; end if;
  select count(*) into n from mybody.workout_sessions; if n <> 1 then raise exception 'FAIL B sees A sessions (%)', n; end if;
  -- 동작: 본인 세션엔 가능, A 세션엔 불가, A 운동 참조 불가, 기본 운동 참조 가능
  insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot) values (gen_random_uuid(), sid, base_id, 'Back Squat');
  begin
    insert into mybody.session_items (id, session_id, display_name_snapshot) values (gen_random_uuid(), a_sid, '침입');
    raise exception 'FAIL B inserted item into A session';
  exception when insufficient_privilege then null; end;
  begin
    insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot) values (gen_random_uuid(), sid, a_ex, 'A 운동 참조');
    raise exception 'FAIL B referenced A exercise';
  exception when check_violation then null; end;
  select count(*) into n from mybody.session_items; if n <> 1 then raise exception 'FAIL B item visibility (%)', n; end if;
  -- B 는 A 세션을 soft delete 할 수 없다 (0건)
  update mybody.workout_sessions set deleted_at = now() where id = a_sid;
  select count(*) into n from mybody.workout_sessions where id = a_sid and deleted_at is not null; if n <> 0 then raise exception 'FAIL B soft-deleted A session'; end if;
  -- 완료 조건 4: 소유자 A 가 자기 세션을 soft delete 하면 items 는 남고, 세션 조인 필터(deleted_at is null)에서 제외된다
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  select count(*) into n from mybody.workout_sessions where id = a_sid and deleted_at is null; if n <> 1 then raise exception 'FAIL precondition: A session should be visible and not deleted'; end if;
  -- 세션 날짜 상한: KST 내일은 거부
  begin update mybody.workout_sessions set session_date = (now() at time zone 'Asia/Seoul')::date + 1 where id = a_sid; raise exception 'FAIL future session_date accepted';
  exception when check_violation then null; end;
  update mybody.workout_sessions set deleted_at = now() where id = a_sid;
  select count(*) into n from mybody.session_items where session_id = a_sid; if n <> 1 then raise exception 'FAIL items vanished after soft delete (%)', n; end if;
  select count(*) into n from mybody.session_items i join mybody.workout_sessions s on s.id = i.session_id and s.deleted_at is null where i.session_id = a_sid;
  if n <> 0 then raise exception 'FAIL soft-deleted session items not excluded by filter'; end if;
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
end $$;
-- 8) 서버 컨텍스트 소유 검사 + FK deferrable (T-013 보정 125000)
reset role;
do $$ declare a_ex uuid; b_ex uuid; begin
  perform set_config('request.jwt.claims', '', true);
  select id into a_ex from mybody.exercise_library where name = 'A 전용 운동';
  select id into b_ex from mybody.exercise_library where name = 'B 맨몸 운동';
  -- 서버가 A 의 운동을 넣으며 B 의 비공개 운동을 부모로 지정 → 거부
  begin
    insert into mybody.exercise_library (user_id, name, measurement_type, parent_exercise_id) values ('11111111-1111-1111-1111-111111111111', 'A 변형', 'bodyweight', b_ex);
    raise exception 'FAIL server context allowed foreign parent';
  exception when check_violation then null; end;
  -- 서버가 A 세션에 B 의 운동을 참조하는 동작을 넣음 → 거부 (세션 소유자 기준)
  begin
    insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-00000000000a', b_ex, 'B 운동 참조');
    raise exception 'FAIL server context allowed foreign exercise in item';
  exception when check_violation then null; end;
  -- 서버가 A 의 동작(A 운동 참조)을 B 세션으로 옮김 → 거부 (update of session_id 도 트리거)
  begin
    update mybody.session_items set session_id = 'aaaaaaaa-0000-0000-0000-000000000001' where exercise_id = a_ex;
    raise exception 'FAIL server context moved A item (A exercise) into B session';
  exception when check_violation then null; end;
  -- 기록에 쓰인 운동 직접 삭제는 즉시 23503 (삭제 가드 트리거). set constraints 없이도 바로 난다
  begin
    delete from mybody.exercise_library where id = a_ex;
    raise exception 'FAIL exercise used by items was deleted';
  exception when foreign_key_violation then null; end;
end $$;
-- 계정 삭제는 cascade 가 끝난 뒤 FK 가 검사되어 성공해야 하고, 세션·동작·운동이 남지 않아야 한다
do $$ begin
  delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
  set constraints all immediate;
  if exists (select 1 from mybody.workout_sessions where user_id = '11111111-1111-1111-1111-111111111111') then raise exception 'FAIL cascade left sessions'; end if;
  if exists (select 1 from mybody.session_items where session_id = 'aaaaaaaa-0000-0000-0000-00000000000a') then raise exception 'FAIL cascade left items'; end if;
  if exists (select 1 from mybody.exercise_library where user_id = '11111111-1111-1111-1111-111111111111') then raise exception 'FAIL cascade left exercises'; end if;
exception when foreign_key_violation then raise exception 'FAIL account delete blocked by FK (%)', sqlerrm;
end $$;
select 'ALL RLS PROBES PASSED' as result;
rollback;
