# src/types

- `supabase.ts` — `npm run db:types` 산출물(`supabase gen types typescript --linked --schema mybody`). **손으로 고치지 않는다.** eslint/prettier/예산 검사 제외.
- `index.ts` — Row/Insert/Update/ViewRow 헬퍼와 도메인 별칭. 앱 코드는 이쪽을 import 한다.
- 마이그레이션을 적용한 작업은 `npm run db:types` 를 다시 돌리고 바뀐 `supabase.ts` 를 **같은 커밋**에 넣는다. 드리프트 자동 감지는 후속 작업.
