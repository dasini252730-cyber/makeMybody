-- T-014 보정 (리뷰 반영). 20261012140000 은 적용 완료라 수정하지 않는다. 원자적으로 적용.
begin;

-- 1) (session_item_id, set_no) unique 를 지연 검사로: 세트 삭제 후 재번호를 한 문장/한 트랜잭션 upsert 로 보낼 때
--    중간 상태의 23505 를 피한다. PK(id) 는 on conflict 아비터라 그대로 non-deferrable.
alter table mybody.exercise_sets drop constraint if exists exercise_sets_item_set_no_uniq;
alter table mybody.exercise_sets add constraint exercise_sets_item_set_no_uniq
  unique (session_item_id, set_no) deferrable initially deferred;

-- 2) 실제 쿼리가 없는 부분 인덱스 제거 (동작당 세트 10행 수준, 선행 컬럼 중복)
drop index if exists mybody.exercise_sets_working_idx;

-- 3) is_assisted NULL 의미 고정: NULL = 미기록. 비교·그룹은 `is_assisted is true` / `is not true` 두 그룹으로만.
comment on column mybody.exercise_sets.is_assisted is 'NULL = 미기록(= 보조 없음으로 취급). PR 그룹은 is_assisted is true / is not true 두 가지만(7.2). 보조 머신은 별도 운동(assisted_minus)으로 기록하고 이 플래그는 밴드 등 임시 보조용(T-120).';
comment on column mybody.exercise_sets.set_no is '동작 안 순번(1부터). 재번호는 한 트랜잭션에서 upsert(unique 는 deferred).';

commit;
