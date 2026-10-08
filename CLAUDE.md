# MY BODY OS

개인 운동 성장 분석 앱. "내 몸이 얼마나 강해지고 있는가"를 Fitness Score · 성장 그래프 · Goal Readiness 로 보여준다. V1 은 단일 사용자(개발자 본인). 요구사항 원본: `요구사항.md` (V1.0).

스택: Vue 3 + Vite + TS · Pinia · Vue Router · Supabase(PostgreSQL/Auth/RLS/Edge Functions) · Vercel · Vitest · Playwright.

## 세션 시작 체크리스트
1. SessionStart hook 이 알려준 브랜치 확인. `main` 이면 `git checkout dev`.
2. `node tools/backlog.mjs next` 로 착수 가능한 작업 확인.
3. `node tools/backlog.mjs list --status in_progress` 로 하던 작업이 있으면 그것부터.

## 작업 사이클 (상세: .claude/rules/backlog-workflow.md)
`next` → **backlog-briefer**(haiku) 브리핑 → `set <id> --status in_progress` → 구현(Write/Edit 도구로만) → **adversarial-reviewer**(opus) 검토 → REVIEW_OK 면 `set --status review` → 완료 조건 전부 체크 → `set --status done` → hook 이 lint/build → commit → push.

## 절대 규칙
- `backlog.json` 은 직접 열지 않는다. `node tools/backlog.mjs` 만 (hook 이 차단).
- 작업은 30분 단위. 넘치면 멈추고 `add` 로 후속 작업을 만든다.
- 소스 파일은 Write/Edit 로만 쓴다. hook 이 코드 예산(85% 경고 / 100% 차단)과 eslint 를 검사한다.
- `git commit`/`git push` 는 hook 이 한다. 직접 실행하지 않는다. main 에 커밋하지 않는다.
- 요구사항에 없는 기능은 만들지 않는다. 정답이 없는 값(점수 가중치, 1RM 공식, AI 공급자)은 `needs_decision` 으로 올린다.
- 사람의 판단이 필요한 항목은 작업을 멈추고 묻지 말고, 다른 작업을 계속한 뒤 **보고 맨 끝에 모아서** 묻는다.

## 명령
```
node tools/backlog.mjs --help                 전체 명령
node tools/backlog.mjs next | stats | validate
node tools/backlog.mjs show T-012 | doc T-012
node tools/backlog.mjs set T-012 --status in_progress --note "시작"
node tools/backlog.mjs add --title "..." --desc "..." --epic E04 --priority P0 --deps T-024
npm run lint / build / test                   (T-001 이후)
```

## 규칙 파일 (.claude/rules/)
- backlog-workflow.md — 상태 흐름, 사이클, 분할, needs_decision 처리
- subagents.md — backlog-briefer / adversarial-reviewer 호출 시점과 결과 처리
- code-budget.md — 파일 줄 수 예산과 분리 기준
- git-workflow.md — dev 브랜치, hook 커밋, 금지 사항
- tech-stack.md — 디렉터리, Vue/Supabase 규칙, 계산 규칙, UX
- hooks.md — 각 hook 이 하는 일과 차단 시 대응

## 보고 형식
작업 끝 보고는 (1) 완료한 작업 id 와 커밋 여부, (2) review/REWORK 결과 요약, (3) 다음 착수 예정, (4) **맨 마지막에** `needs_decision` 질문 목록 순서로 쓴다.
