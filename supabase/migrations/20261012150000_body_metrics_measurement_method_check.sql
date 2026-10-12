-- T-119 · 체중 측정 방식 고정 목록 (사용자 확정 2026-10-12). 저장은 코드, 표시는 폼 라벨.
--   scale = 체중계 · inbody = 인바디 · watch = 스마트워치 · other = 기타
begin;
-- 기존 자유 텍스트 값이 있으면 매핑 (데이터 없음 상태지만 멱등성을 위해)
update mybody.body_metrics set measurement_method = case
  when measurement_method is null then null
  when lower(measurement_method) in ('scale', '체중계') then 'scale'
  when lower(measurement_method) in ('inbody', '인바디') then 'inbody'
  when lower(measurement_method) in ('watch', 'smartwatch', '스마트워치') then 'watch'
  else 'other' end
where measurement_method is not null and measurement_method not in ('scale', 'inbody', 'watch', 'other');

alter table mybody.body_metrics drop constraint if exists body_metrics_method_check;
alter table mybody.body_metrics add constraint body_metrics_method_check
  check (measurement_method is null or measurement_method in ('scale', 'inbody', 'watch', 'other'));
comment on column mybody.body_metrics.measurement_method is 'scale 체중계 | inbody 인바디 | watch 스마트워치 | other 기타 (NULL = 미입력). T-119 확정.';
commit;
