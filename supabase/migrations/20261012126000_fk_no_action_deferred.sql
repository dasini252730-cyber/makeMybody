-- T-013 보정 5. RESTRICT 는 DEFERRABLE 이어도 즉시 검사된다(Postgres 규칙). 지연 검사를 따르는 것은 NO ACTION 뿐이다.
-- 계정 삭제(auth.users → exercise_library / workout_sessions → session_items cascade)가 끝난 뒤 검사되도록 바꾼다.
-- 기록에 쓰인 운동을 직접 지우는 것은 commit(또는 set constraints immediate) 시 여전히 23503 으로 차단된다.
begin;
alter table mybody.session_items drop constraint if exists session_items_exercise_id_fkey;
alter table mybody.session_items add constraint session_items_exercise_id_fkey
  foreign key (exercise_id) references mybody.exercise_library (id)
  on delete no action deferrable initially deferred;
commit;
