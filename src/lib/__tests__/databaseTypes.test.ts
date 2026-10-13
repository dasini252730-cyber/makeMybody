import { describe, expectTypeOf, it } from 'vitest'
import type { Database } from '@/types/supabase'
import { APP_SCHEMA } from '@/lib/supabase'

// 생성된 Database 타입이 mybody 스키마의 핵심 테이블·컬럼을 담고 있는지 컴파일 시점에 고정한다 (T-022).
// 생성 파일의 손수정·퇴행(컬럼 삭제 등)을 막는다. DB 와 생성 파일의 드리프트(db:types 미실행)는 여기서 잡지 못한다 → db:types 재실행 + git diff 검사는 후속 작업.
type Tables = Database['mybody']['Tables']
type Views = Database['mybody']['Views']

describe('Database 타입 (supabase gen types)', () => {
  it('앱 스키마 이름이 타입과 일치한다', () => {
    expectTypeOf(APP_SCHEMA).toEqualTypeOf<'mybody'>()
    expectTypeOf<keyof Database>().toEqualTypeOf<'mybody' | '__InternalSupabase'>()
  })

  it('P0 테이블과 핵심 컬럼이 있다', () => {
    expectTypeOf<Tables['exercise_library']['Row']['weight_basis']>().toEqualTypeOf<string | null>()
    expectTypeOf<Tables['workout_sessions']['Row']['raw_note']>().toEqualTypeOf<string | null>()
    expectTypeOf<Tables['workout_sessions']['Row']['structured_status']>().toEqualTypeOf<string>()
    expectTypeOf<Tables['workout_sessions']['Row']['deleted_at']>().toEqualTypeOf<string | null>()
    expectTypeOf<Tables['session_items']['Row']['exercise_id']>().toEqualTypeOf<string | null>()
    expectTypeOf<Tables['exercise_sets']['Row']['set_kind']>().toEqualTypeOf<string>()
    expectTypeOf<Tables['exercise_sets']['Row']['success']>().toEqualTypeOf<boolean | null>()
    expectTypeOf<Tables['body_metrics']['Row']['weight_kg']>().toEqualTypeOf<number | null>()
    expectTypeOf<Tables['recovery_logs']['Row']['log_date']>().toEqualTypeOf<string>()
    expectTypeOf<Tables['activity_records']['Row']['activity_type']>().toEqualTypeOf<
      string | null
    >()
  })

  it('클라이언트 UUID 테이블은 Insert 에 id 가 필수다 (default 없음)', () => {
    expectTypeOf<Tables['workout_sessions']['Insert']['id']>().toEqualTypeOf<string>()
    expectTypeOf<Tables['exercise_sets']['Insert']['id']>().toEqualTypeOf<string>()
    // 서버 default 가 있는 컬럼은 선택
    expectTypeOf<Tables['body_metrics']['Insert']['id']>().toEqualTypeOf<string | undefined>()
  })

  it('계산 뷰 v_working_sets 가 노출된다', () => {
    expectTypeOf<Views['v_working_sets']['Row']['volume_kg']>().toEqualTypeOf<number | null>()
    expectTypeOf<Views['v_working_sets']['Row']['unclassified']>().toEqualTypeOf<boolean | null>()
  })
})
