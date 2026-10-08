# backlog 운영 규칙

backlog.json 이 유일한 작업 원장이다. 모든 작업은 여기 등록된 T-xxx 로 추적한다.

## 접근

- backlog.json 은 **절대 직접 읽거나 수정하지 않는다** (hook 이 차단). `node tools/backlog.mjs` 만 사용한다.
- 자주 쓰는 명령:
  - `node tools/backlog.mjs next` — 착수 가능한 다음 작업
  - `node tools/backlog.mjs show <id>` / `doc <id>` — 상세 + 문서
  - `node tools/backlog.mjs set <id> --status <s> --note "..."` — 상태 변경
  - `node tools/backlog.mjs add --title "..." --desc "..." --epic Exx --priority Px` — 작업 추가
  - `node tools/backlog.mjs stats` / `validate`
- 상세 문서는 `docs/<id>.md`. 작업 단계·완료 조건을 바꿀 때는 이 문서를 Edit 한다 (CLI 는 상태 표와 작업 기록만 동기화).

## 상태 흐름

`todo → in_progress → review → done`. 언제든 `needs_decision`, `on_hold`, `cancelled` 로 보낼 수 있다.

| 상태           | 의미           | 전환 조건                                                                        |
| -------------- | -------------- | -------------------------------------------------------------------------------- |
| todo           | 착수 전        | 선행 작업이 done/cancelled 여야 착수 가능 (`next` 가 걸러줌)                     |
| in_progress    | 작업 중        | **동시에 최대 2개**. 올리기 전에 backlog-briefer 호출                            |
| review         | 구현 완료      | adversarial-reviewer 판정 REVIEW_OK 일 때만. 치명 항목이 있으면 in_progress 유지 |
| done           | 완료           | 완료 조건 전부 체크, lint/build 통과. hook 이 commit + push                      |
| needs_decision | 사람 판단 대기 | `--decision "질문"` 필수. 질문은 선택지 + 추천안 형태                            |
| on_hold        | 보류           | 범위 밖(V1.1)/외부 대기. `--note` 로 사유                                        |
| cancelled      | 취소           | `--note` 로 사유 필수                                                            |

## 작업 한 건의 표준 사이클

1. `next` 로 후보 확인 → id 선택.
2. `backlog-briefer` 서브에이전트에 id 전달 → docs/<id>.md 의 쉬운 설명·관련 파일이 채워짐.
3. `set <id> --status in_progress`.
4. 문서의 작업 단계대로 구현. 소스 파일은 Write/Edit 도구로만 만든다 (hook 이 예산·lint 검사).
5. 파일을 만들거나 바꾼 뒤 `adversarial-reviewer` 호출. REWORK 면 치명·중요 항목을 고치고 다시 호출.
6. REVIEW_OK → `set <id> --status review --note "reviewer OK"`.
7. 완료 조건을 docs/<id>.md 에서 모두 `[x]` 로 바꾸고 `set <id> --status done`. hook 이 lint/build → commit → push.
8. hook 이 done 을 거부하면(lint/build 실패) 상태가 review 로 자동 복귀한다. 고친 뒤 7 을 반복.

## 작업 분할

- 모든 작업은 30분 단위. 하다가 30분을 넘길 것 같으면 멈추고 `add` 로 후속 작업을 만들어 `--deps` 로 연결한다.
- 요구사항에 없는 기능은 만들지 않는다. 필요하면 `add --status needs_decision --decision "..."` 으로 올리고 사람 판단을 기다린다.

## 사람의 판단이 필요한 것

- `needs_decision` 작업은 건드리지 않는다. 다른 착수 가능한 작업을 먼저 한다.
- 세션 마지막 보고에서 `list --status needs_decision` 결과를 **맨 뒤에** 모아서 질문한다. 작업 중간에 묻지 않는다.
