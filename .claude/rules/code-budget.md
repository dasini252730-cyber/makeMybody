# 코드 예산 규칙

파일 길이는 `.claude/code-budget.json` 으로 관리한다. hook(`code-budget.mjs`) 이 Write/Edit 직후 자동 검사한다.

- **85% 이상**: 경고. 그 파일에 더 추가하지 말고 분리 지점을 정한다.
- **100% 초과**: 차단. 분리/중복 제거로 예산 안에 넣은 뒤에만 진행한다. 예산을 올리는 것은 사용자 결정이다 (`needs_decision`).

| 대상 | 최대 줄 수 (공백 제외) |
|---|---|
| src/components/**/*.vue | 180 |
| src/views/**/*.vue | 250 |
| src/composables/**/*.ts | 150 |
| src/stores/**/*.ts | 200 |
| src/lib/**/*.ts (계산 유틸) | 200 |
| src/**/*.test.ts | 300 |
| supabase/functions/**/*.ts | 200 |
| supabase/migrations/*.sql | 400 |
| tools/**/*.mjs | 400 |
| .claude/hooks/*.mjs | 200 |
| 기타 소스 | 300 |

## 분리 기준
- 컴포넌트: 템플릿이 두 화면 역할을 하면 쪼갠다. 입력 폼과 목록은 항상 별도 컴포넌트.
- composable: 데이터 접근(`useXxxRepo`)과 화면 상태(`useXxxForm`)를 분리한다.
- 계산 로직(1RM, 평균, Fitness Score, Readiness)은 `src/lib/` 의 순수 함수로 두고 Vitest 로 테스트한다. 컴포넌트 안에 계산을 넣지 않는다.
- 마이그레이션은 테이블 묶음 하나당 파일 하나.

## 작성 방식
- 소스 파일은 **Write/Edit 도구로만** 만들고 고친다. 셸 heredoc/`sed` 로 소스를 쓰면 예산·lint hook 이 돌지 않으므로 금지한다. (json/md 설정 파일은 예외)
- 새 파일을 만들기 전에 예산을 보고 책임을 하나로 정한다. "나중에 쪼개자"는 없다.
