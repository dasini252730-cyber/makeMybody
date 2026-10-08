# hook 동작 (차단 메시지를 만났을 때 참고)

설정: `.claude/settings.json`, 스크립트: `.claude/hooks/*.mjs` (Node, 의존성 없음). 상태 파일은 `.claude/state/` (git 제외).

| 시점 | 스크립트 | 하는 일 | 차단 시 대응 |
|---|---|---|---|
| SessionStart | session-start.mjs | 현재 브랜치 표시, main 이면 dev 전환 안내, backlog 현황·다음 작업 3개 주입 | main 이면 `git checkout dev` 먼저 |
| PreToolUse (Read/Edit/Write/Grep/Bash…) | guard-backlog.mjs | backlog.json 직접 접근 차단 | `node tools/backlog.mjs ...` 사용 |
| PostToolUse (Write/Edit) | code-budget.mjs | 파일 줄 수 예산 검사. 85% 경고, 100% 초과 차단 | 파일 분리 후 재작성 |
| PostToolUse (Write/Edit) | lint-file.mjs | 해당 파일만 eslint (`node_modules/.bin/eslint` 있을 때) | 출력된 오류를 바로 수정 |
| PostToolUse (Bash) | backlog-sync.mjs | backlog/docs 변경 자동 커밋. done 이벤트가 있으면 lint → build → 전체 커밋 → push | 실패 시 작업이 review 로 복귀. 고치고 다시 done |
| Stop | stop-check.mjs | 소스가 바뀌었으면 `npm run lint` + `npm run build`. 실패하면 종료 차단(최대 3회) | 출력 보고 수정. 3회 넘으면 사람에게 보고 |

## 주의
- hook 은 `package.json` 의 `lint`/`build` 스크립트가 있을 때만 lint/build 를 돈다. 프로젝트 셋업(T-001) 전에는 건너뛴다.
- backlog 커밋은 Bash 도구 호출 직후에 일어난다. CLI 로 상태를 바꾼 뒤 아무 Bash 명령이나 실행되면 커밋된다.
- `.claude/settings.json` 을 바꾼 뒤에는 `/hooks` 를 열거나 세션을 재시작해야 반영된다.
- hook 을 우회하기 위해 소스를 셸로 쓰거나 backlog.json 을 다른 경로로 복사하는 것은 금지.
