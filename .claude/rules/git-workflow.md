# git 규칙

## 브랜치

- 작업 브랜치는 **dev**. `main` 은 배포 기준이며 직접 커밋하지 않는다.
- 세션 시작 hook 이 현재 브랜치를 알려준다. `main` 이면 먼저 `git checkout dev` (없으면 `git checkout -b dev`).
- 큰 기능(Epic 단위)은 필요하면 `feat/<epic>` 브랜치를 dev 에서 따고, 끝나면 dev 로 머지한다. 기본은 dev 직접 작업.

## 커밋은 hook 이 한다

- backlog.json / docs 변경: `backlog-sync.mjs` 가 Bash 호출 직후 자동으로 `backlog: ...` 커밋.
- 작업이 `done` 으로 바뀌면: lint → build → 전체 변경 `git add -A` → `done: T-xxx 제목` 커밋(본문에 완료 조건·변경 파일) → `git push -u origin HEAD`.
  - lint/build 실패 시 커밋하지 않고 작업을 `review` 로 되돌린다.
  - 원격이 없으면 커밋만 하고 안내 메시지를 낸다.
- 따라서 `git commit`/`git push` 를 직접 실행하지 않는다. 예외: 사용자가 명시적으로 요청한 경우.
- 커밋 메시지 끝에는 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 이 붙는다.

## 커밋 단위

- 작업(T-xxx) 하나 = done 커밋 하나. 작업 중간 WIP 커밋은 만들지 않는다 (backlog 커밋은 예외).
- done 커밋 전에 `git status` 로 의도하지 않은 파일(.env, 빌드 산출물, 임시 파일)이 없는지 확인한다. `.gitignore` 에 없으면 추가한다.

## 금지

- `git push --force`, `git reset --hard`, 히스토리 수정.
- main 에 직접 커밋.
- `.env*`, 서비스 키, Supabase 비밀값 커밋.
