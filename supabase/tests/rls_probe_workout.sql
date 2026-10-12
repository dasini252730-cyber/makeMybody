-- RLS 프로브 (운동 기록: 세션·동작·세트·서버 컨텍스트). 전부 롤백. 공통 픽스처는 rls_probe.sql 과 동일.
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-a@example.com','x',now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe-b@example.com','x',now(),now());
insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values (null, 'Back Squat', 'weight', 'barbell_total');
insert into mybody.exercise_library (user_id, name, measurement_type, weight_basis) values ('11111111-1111-1111-1111-111111111111', 'A 전용 운동', 'weight', 'dumbbell_each');

-- 픽스처: B 의 운동 1개 (세트 블록이 참조)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into mybody.exercise_library (name, measurement_type) values ('B 맨몸 운동', 'bodyweight');
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
-- 7b) 세트 (T-014): B 는 자기 동작에만 세트 추가, A 동작에는 불가, 같은 id upsert 1건, 빈 세트 거부, set_kind 검증
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare b_item uuid; a_item uuid; set_id uuid := 'bbbbbbbb-0000-0000-0000-000000000001'; n int; begin
  select id into b_item from mybody.session_items where session_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1;
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values (set_id, b_item, 1, 60, 5)
    on conflict (id) do update set reps = excluded.reps;
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values (set_id, b_item, 1, 60, 6)
    on conflict (id) do update set reps = excluded.reps;
  select count(*) into n from mybody.exercise_sets where session_item_id = b_item; if n <> 1 then raise exception 'FAIL set upsert produced % rows', n; end if;
  select reps into n from mybody.exercise_sets where id = set_id; if n <> 6 then raise exception 'FAIL set upsert did not update'; end if;
  -- A 의 동작 id 를 알아도 세트를 붙일 수 없다
  reset role; perform set_config('request.jwt.claims', '', true);
  select id into a_item from mybody.session_items where session_id = 'aaaaaaaa-0000-0000-0000-00000000000a' limit 1;
  set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  begin
    insert into mybody.exercise_sets (id, session_item_id, set_no, reps) values (gen_random_uuid(), a_item, 1, 10);
    raise exception 'FAIL B added set to A item';
  exception when insufficient_privilege then null; end;
  -- 빈 세트·잘못된 종류 거부, 메모만 있는 세트는 허용
  begin insert into mybody.exercise_sets (id, session_item_id, set_no) values (gen_random_uuid(), b_item, 2); raise exception 'FAIL empty set accepted';
  exception when check_violation then null; end;
  begin insert into mybody.exercise_sets (id, session_item_id, set_no, reps, set_kind) values (gen_random_uuid(), b_item, 2, 5, 'maxout'); raise exception 'FAIL bad set_kind accepted';
  exception when check_violation then null; end;
  insert into mybody.exercise_sets (id, session_item_id, set_no, raw_value_note) values (gen_random_uuid(), b_item, 2, '무게 기억 안 남');
  -- A 의 세트를 서버 컨텍스트로 넣은 뒤, B 는 보지도 고치지도 지우지도 못한다 (완료 조건 1)
  reset role; perform set_config('request.jwt.claims', '', true);
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps) values ('bbbbbbbb-0000-0000-0000-00000000000a', a_item, 1, 100, 1);
  set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  select count(*) into n from mybody.exercise_sets; if n <> 2 then raise exception 'FAIL B sees A sets (%)', n; end if;
  update mybody.exercise_sets set reps = 99 where id = 'bbbbbbbb-0000-0000-0000-00000000000a';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL B updated A set'; end if;
  delete from mybody.exercise_sets where id = 'bbbbbbbb-0000-0000-0000-00000000000a';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL B deleted A set'; end if;
  -- 재번호: 한 문장 bulk upsert 로 (1,2)→(2,1) 스왑. non-deferrable unique 면 중간 상태에서 23505 가 난다.
  insert into mybody.exercise_sets (id, session_item_id, set_no, reps) values
    (set_id, b_item, 2, 6),
    ((select id from mybody.exercise_sets where session_item_id = b_item and set_no = 2), b_item, 1, 0)
    on conflict (id) do update set set_no = excluded.set_no;
  select set_no into n from mybody.exercise_sets where id = set_id; if n <> 2 then raise exception 'FAIL swap did not apply (%)', n; end if;
  update mybody.exercise_sets set set_no = set_no + 1 where session_item_id = b_item; -- 한 문장 시프트도 통과
  select count(*) into n from mybody.exercise_sets where session_item_id = b_item; if n <> 2 then raise exception 'FAIL renumber (%)', n; end if;
  -- 긍정 검증: 재번호 결과에 중복이 없어야 즉시 검사도 통과한다 (성공 기대)
  set constraints mybody.exercise_sets_item_set_no_uniq immediate;
  set constraints mybody.exercise_sets_item_set_no_uniq deferred;
  -- 부분 payload(id, session_item_id, set_no 만) 로 재번호 upsert 하면 CHECK 가 충돌 판정보다 먼저 평가되어 23514 — 클라이언트는 행 전체를 재전송해야 한다
  begin
    insert into mybody.exercise_sets (id, session_item_id, set_no) values (set_id, b_item, 7)
      on conflict (id) do update set set_no = excluded.set_no;
    raise exception 'FAIL partial-payload upsert accepted';
  exception when check_violation then null; end;
  -- 메모만 있는 성공 본세트는 허용 (143000: 기록 유실 방지) — 단 reps=0 + 메모는 거부 (144000: 0회 100kg 가 PR 후보가 되지 않게)
  insert into mybody.exercise_sets (id, session_item_id, set_no, set_kind, success, raw_value_note) values (gen_random_uuid(), b_item, 8, 'working', true, '횟수 기억 안 남');
  begin
    insert into mybody.exercise_sets (id, session_item_id, set_no, set_kind, success, weight_kg, reps, raw_value_note) values (gen_random_uuid(), b_item, 10, 'working', true, 100, 0, '바가 안 올라감');
    raise exception 'FAIL reps 0 with note accepted as successful working set';
  exception when check_violation then if sqlerrm not like '%has_effort%' then raise exception 'FAIL wrong constraint: %', sqlerrm; end if; end;
  -- 진짜 중복은 commit(=제약 즉시화) 시점에 거부된다
  begin
    insert into mybody.exercise_sets (id, session_item_id, set_no, reps) values (gen_random_uuid(), b_item, 2, 5);
    set constraints mybody.exercise_sets_item_set_no_uniq immediate;
    raise exception 'FAIL duplicate set_no accepted at commit';
  exception when unique_violation then null; end;
  -- 성공한 본세트인데 수행량이 0 이면 거부 (142000)
  begin
    insert into mybody.exercise_sets (id, session_item_id, set_no, set_kind, success, weight_kg, reps) values (gen_random_uuid(), b_item, 9, 'working', true, 100, 0);
    raise exception 'FAIL working+success with zero effort accepted';
  exception when check_violation then null; end;
  -- soft delete 된 세션의 세트는 세션 조인 필터로 제외된다 (계산 계층 규칙)
  update mybody.workout_sessions set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select count(*) into n from mybody.exercise_sets e join mybody.session_items i on i.id = e.session_item_id
    join mybody.workout_sessions s on s.id = i.session_id and s.deleted_at is null where i.id = b_item;
  if n <> 0 then raise exception 'FAIL sets of soft-deleted session not excluded'; end if;
  update mybody.workout_sessions set deleted_at = null where id = 'aaaaaaaa-0000-0000-0000-000000000001';
end $$;
reset role;

-- 7c) 활동 기록 (T-104): B 는 자기 세션에만 추가, A 세션엔 불가(42501), 빈 행 거부, 메모만 허용, 잘못된 유형 거부, upsert 1건
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare act_id uuid := 'cccccccc-0000-0000-0000-000000000001'; hike_sid uuid := 'bbbbbbbb-0000-0000-0000-000000000002'; n int; begin
  insert into mybody.workout_sessions (id, session_type, raw_note) values (hike_sid, 'hike', '북한산 8km');
  insert into mybody.activity_records (id, session_id, activity_type, distance_meters, duration_minutes) values (act_id, hike_sid, 'hike', 8000, 150)
    on conflict (id) do update set distance_meters = excluded.distance_meters;
  insert into mybody.activity_records (id, session_id, activity_type, distance_meters, duration_minutes) values (act_id, hike_sid, 'hike', 8200, 150)
    on conflict (id) do update set distance_meters = excluded.distance_meters;
  select count(*) into n from mybody.activity_records; if n <> 1 then raise exception 'FAIL activity upsert (%)', n; end if;
  begin insert into mybody.activity_records (id, session_id, activity_type, distance_meters) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-00000000000a', 'walk', 1000); raise exception 'FAIL B added activity to A session';
  exception when insufficient_privilege then null; end;
  begin insert into mybody.activity_records (id, session_id, activity_type) values (gen_random_uuid(), hike_sid, 'walk'); raise exception 'FAIL empty activity accepted';
  exception when check_violation then if sqlerrm not like '%not_empty%' then raise exception 'FAIL wrong constraint: %', sqlerrm; end if; end;
  begin insert into mybody.activity_records (id, session_id, activity_type, distance_meters) values (gen_random_uuid(), hike_sid, 'swim', 1000); raise exception 'FAIL bad activity_type accepted';
  exception when check_violation then if sqlerrm not like '%type_check%' then raise exception 'FAIL wrong constraint: %', sqlerrm; end if; end;
  insert into mybody.activity_records (id, session_id, activity_type, pain_recovery_note) values (gen_random_uuid(), hike_sid, 'walk', '하산 후 무릎 뻐근'); -- 메모만: 허용
  insert into mybody.activity_records (id, session_id, distance_meters) values (gen_random_uuid(), hike_sid, 8000); -- 유형 생략 → other (151000)
  insert into mybody.activity_records (id, session_id, activity_type, duration_minutes) values (gen_random_uuid(), hike_sid, null, 10080); -- 명시적 NULL → other (153000), 7일 상한 허용
  select count(*) into n from mybody.activity_records where session_id = hike_sid and activity_type = 'other'; if n <> 2 then raise exception 'FAIL activity_type normalization (%)', n; end if;
  begin insert into mybody.activity_records (id, session_id, activity_type, duration_minutes) values (gen_random_uuid(), hike_sid, 'hike', 10081); raise exception 'FAIL duration over 7 days accepted';
  exception when check_violation then if sqlerrm not like '%duration_check%' then raise exception 'FAIL wrong constraint: %', sqlerrm; end if; end;
  begin insert into mybody.activity_records (id, session_id, activity_type, distance_meters, duration_minutes) values (gen_random_uuid(), hike_sid, 'walk', 0, 0); raise exception 'FAIL zero-only activity accepted';
  exception when check_violation then if sqlerrm not like '%not_empty%' then raise exception 'FAIL wrong constraint: %', sqlerrm; end if; end;
  insert into mybody.activity_records (id, session_id, activity_type, pack_weight_kg) values (gen_random_uuid(), hike_sid, 'hike', 6.5); -- 배낭 무게만: 허용
  -- B 가 자기 활동을 A 세션으로 옮기는 update 는 with check 로 거부
  begin update mybody.activity_records set session_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where id = act_id; raise exception 'FAIL moved activity into A session';
  exception when insufficient_privilege then null; end;
  -- 세션 soft delete 시 활동도 조인 필터로 제외된다 (완료 조건 2)
  update mybody.workout_sessions set deleted_at = now() where id = hike_sid;
  select count(*) into n from mybody.activity_records a join mybody.workout_sessions s on s.id = a.session_id and s.deleted_at is null where a.session_id = hike_sid;
  if n <> 0 then raise exception 'FAIL activities of soft-deleted session not excluded'; end if;
  update mybody.workout_sessions set deleted_at = null where id = hike_sid;
  -- A 의 활동을 서버 컨텍스트로 만든 뒤 B 는 보지도 고치지도 지우지도 못한다
  reset role; perform set_config('request.jwt.claims', '', true);
  insert into mybody.activity_records (id, session_id, activity_type, distance_meters) values ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-00000000000a', 'hike', 12000);
  set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  select count(*) into n from mybody.activity_records; if n <> 5 then raise exception 'FAIL B sees A activity (%)', n; end if;
  update mybody.activity_records set distance_meters = 1 where id = 'cccccccc-0000-0000-0000-00000000000a';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL B updated A activity'; end if;
  delete from mybody.activity_records where id = 'cccccccc-0000-0000-0000-00000000000a';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL B deleted A activity'; end if;
end $$;
reset role;

-- 7d) v_working_sets (T-123): working 만, 세션 soft delete 제외, 타 사용자 0건, 볼륨 계산, assisted_minus 볼륨 NULL
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare b_item uuid; sid uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; n int; v numeric; begin
  select id into b_item from mybody.session_items where session_id = sid limit 1;
  insert into mybody.exercise_sets (id, session_item_id, set_no, set_kind, weight_kg, reps) values (gen_random_uuid(), b_item, 20, 'warmup', 40, 10);
  select count(*) into n from mybody.v_working_sets where session_id = sid and set_no = 20; if n <> 0 then raise exception 'FAIL warmup leaked into v_working_sets'; end if;
  select count(*) into n from mybody.v_working_sets where user_id <> '22222222-2222-2222-2222-222222222222'; if n <> 0 then raise exception 'FAIL view shows other users (%)', n; end if;
  select volume_kg into v from mybody.v_working_sets where id = 'bbbbbbbb-0000-0000-0000-000000000001'; if v <> 360 then raise exception 'FAIL volume (%)', v; end if; -- 60kg × 6
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
  if exists (select 1 from mybody.exercise_sets where id = 'bbbbbbbb-0000-0000-0000-00000000000a') then raise exception 'FAIL cascade left A sets'; end if;
  if exists (select 1 from mybody.activity_records where id = 'cccccccc-0000-0000-0000-00000000000a') then raise exception 'FAIL cascade left A activities'; end if;
exception when foreign_key_violation then raise exception 'FAIL account delete blocked by FK (%)', sqlerrm;
end $$;
select 'ALL WORKOUT PROBES PASSED' as result;
rollback;
