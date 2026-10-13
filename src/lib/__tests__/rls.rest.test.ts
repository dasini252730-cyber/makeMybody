// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// REST 경로 RLS 통합 테스트 (T-021, 요구사항 11장 P0 수용 기준 1·NFR-004).
// 프로브 계정 A(RLS_PROBE_*)와 B(RLS_PROBE_B_*)를 쓴다. B 는 tools/db-probe-user.mjs 가 심어 둔 고정 id 데이터를 소유한다.
// 환경 변수가 없으면 전부 skip. `npm run test:rls` 가 .env 를 주입한다.
const env: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY
const A = { email: env.RLS_PROBE_EMAIL, password: env.RLS_PROBE_PASSWORD }
const B = { email: env.RLS_PROBE_B_EMAIL, password: env.RLS_PROBE_B_PASSWORD }
const enabled = Boolean(url && key && A.email && A.password && B.email && B.password)

// tools/db-probe-user.mjs 와 동일한 고정 id
const B_SESSION = 'b0000000-0000-4000-8000-000000000001'
const B_ITEM = 'b0000000-0000-4000-8000-000000000002'
const B_SET = 'b0000000-0000-4000-8000-000000000003'
const B_EXERCISE = 'b0000000-0000-4000-8000-000000000004'
const DENIED = '42501'

const make = () =>
  createClient<Database>(url!, key!, { db: { schema: 'mybody' }, auth: { persistSession: false } })
async function login(c: ReturnType<typeof make>, who: { email?: string; password?: string }) {
  const { data, error } = await c.auth.signInWithPassword({
    email: who.email!,
    password: who.password!,
  })
  if (error) throw new Error(`프로브 계정 로그인 실패(${who.email}): ${error.message}`)
  return data.user!.id
}

/** 테이블별 anon 쓰기 시도용 최소 payload */
const anonWrites: Array<[string, Record<string, unknown>]> = [
  ['exercise_library', { name: 'anon 운동', measurement_type: 'bodyweight' }],
  ['workout_sessions', { id: crypto.randomUUID(), session_type: 'strength', raw_note: 'anon' }],
  [
    'session_items',
    { id: crypto.randomUUID(), session_id: B_SESSION, display_name_snapshot: 'anon' },
  ],
  ['exercise_sets', { id: crypto.randomUUID(), session_item_id: B_ITEM, set_no: 9, reps: 1 }],
  ['body_metrics', { weight_kg: 70 }],
  ['recovery_logs', { sleep_hours: 6 }],
  [
    'activity_records',
    {
      id: crypto.randomUUID(),
      session_id: B_SESSION,
      activity_type: 'walk',
      distance_meters: 1000,
    },
  ],
]
const readTables = [
  'exercise_library',
  'workout_sessions',
  'session_items',
  'exercise_sets',
  'body_metrics',
  'recovery_logs',
  'activity_records',
  'v_working_sets',
]
const B_BODY = 'b0000000-0000-4000-8000-000000000005'

describe.skipIf(!enabled)('RLS over REST (anon / 사용자 A / 사용자 B)', () => {
  // anon 은 테이블 이름을 동적으로 돌리므로 제네릭 없이 만든다(권한 검증이 목적). A/B 는 타입 검사된 클라이언트.
  const anon = createClient(url!, key!, {
    db: { schema: 'mybody' },
    auth: { persistSession: false },
  })
  const a = make()
  const b = make()
  let aId = ''
  let bId = ''
  const aSession = crypto.randomUUID()

  beforeAll(async () => {
    aId = await login(a, A)
    bId = await login(b, B)
    // 전제: B 의 고정 데이터가 실제로 존재한다 (없으면 격리 단정이 공허해지므로 여기서 멈춘다)
    for (const [table, id] of [
      ['workout_sessions', B_SESSION],
      ['session_items', B_ITEM],
      ['exercise_sets', B_SET],
      ['exercise_library', B_EXERCISE],
      ['body_metrics', B_BODY],
    ] as const) {
      const r = await b.from(table).select('id').eq('id', id)
      if (r.error || r.data?.length !== 1)
        throw new Error(
          `전제 실패: B 의 ${table} 고정 행이 없습니다. npm run db:probe-user 를 먼저 실행하세요.`,
        )
    }
  })

  afterAll(async () => {
    if (!aId) return // 로그인 실패 시 2차 오류로 원인을 가리지 않는다
    const del = await a.from('workout_sessions').delete().eq('id', aSession).select('id')
    expect(del.error).toBeNull()
    const left = await a
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('id', aSession)
    expect(left.count).toBe(0)
    await a.auth.signOut()
    await b.auth.signOut()
  })

  it('anon 은 P0 테이블 4개 + 체중·뷰를 읽지 못한다 (42501)', async () => {
    for (const table of readTables) {
      const r = await anon.from(table).select('id').limit(1)
      expect(r.error?.code, table).toBe(DENIED)
    }
  })

  it('anon 은 P0 테이블 4개 + 체중에 쓰지도 못한다 (insert / update / delete 전부 42501)', async () => {
    for (const [table, payload] of anonWrites) {
      const ins = await anon.from(table).insert(payload)
      expect(ins.error?.code, `${table} insert`).toBe(DENIED)
      const upd = await anon
        .from(table)
        .update({ updated_at: new Date().toISOString() })
        .eq('id', B_SESSION)
      expect(upd.error?.code, `${table} update`).toBe(DENIED)
      const del = await anon.from(table).delete().eq('id', B_SESSION)
      expect(del.error?.code, `${table} delete`).toBe(DENIED)
    }
  })

  it('A 는 기본 운동은 보지만 B 의 운동·세션·동작·세트는 조회 0건', async () => {
    const base = await a
      .from('exercise_library')
      .select('id', { count: 'exact', head: true })
      .is('user_id', null)
    expect(base.error).toBeNull()
    expect(base.count).toBeGreaterThanOrEqual(40)
    for (const [table, id] of [
      ['exercise_library', B_EXERCISE],
      ['workout_sessions', B_SESSION],
      ['session_items', B_ITEM],
      ['exercise_sets', B_SET],
      ['body_metrics', B_BODY],
    ] as const) {
      const r = await a.from(table).select('id').eq('id', id)
      expect(r.error, table).toBeNull()
      expect(r.data?.length, table).toBe(0)
    }
    const v = await a.from('v_working_sets').select('id').eq('id', B_SET) // 뷰는 오버로드가 달라 따로
    expect(v.error).toBeNull()
    expect(v.data?.length).toBe(0)
  })

  it('A 는 B 의 행을 수정·삭제할 수 없고(0행), B 의 세션에 동작을 붙이거나 user_id 를 위조해 쓸 수 없다', async () => {
    const u = await a
      .from('workout_sessions')
      .update({ raw_note: '탈취' })
      .eq('id', B_SESSION)
      .select('id')
    expect(u.error).toBeNull()
    expect(u.data?.length).toBe(0)
    const d = await a.from('exercise_sets').delete().eq('id', B_SET).select('id')
    expect(d.error).toBeNull()
    expect(d.data?.length).toBe(0)
    const item = await a
      .from('session_items')
      .insert({ id: crypto.randomUUID(), session_id: B_SESSION, display_name_snapshot: '침입' })
    expect(item.error?.code).toBe(DENIED)
    const forged = await a
      .from('workout_sessions')
      .insert({ id: crypto.randomUUID(), user_id: bId, session_type: 'strength', raw_note: '위조' })
    expect(forged.error?.code).toBe(DENIED)
    const forgedBody = await a.from('body_metrics').insert({ user_id: bId, weight_kg: 1 })
    expect(forgedBody.error?.code).toBe(DENIED)
    const still = await b.from('workout_sessions').select('raw_note').eq('id', B_SESSION).single()
    expect(still.data?.raw_note).toBe('프로브 B 의 세션')
    const stillSet = await b.from('exercise_sets').select('id').eq('id', B_SET)
    expect(stillSet.data?.length).toBe(1)
  })

  it('A 는 B 의 세션 id 로 upsert(탈취)할 수 없다 — 권한 오류로 중단되고 B 데이터는 그대로', async () => {
    const r = await a
      .from('workout_sessions')
      .upsert({ id: B_SESSION, session_type: 'strength', raw_note: '탈취' })
      .select('id')
    expect([DENIED, '23505']).toContain(r.error?.code)
    const still = await b.from('workout_sessions').select('raw_note').eq('id', B_SESSION).single()
    expect(still.data?.raw_note).toBe('프로브 B 의 세션')
  })

  it('A 는 raw_note 만으로 세션을 upsert 하고(같은 id 두 번 → 1건, 값 갱신, user_id 는 서버가 채움), B 에게는 보이지 않는다', async () => {
    const row = { id: aSession, session_type: 'strength', raw_note: '데드 40x10 x3' }
    const first = await a.from('workout_sessions').upsert(row).select('id')
    expect(first.error, first.error?.message).toBeNull()
    const second = await a
      .from('workout_sessions')
      .upsert({ ...row, raw_note: '수정' })
      .select('id')
    expect(second.error).toBeNull()
    const mine = await a.from('workout_sessions').select('raw_note, user_id').eq('id', aSession)
    expect(mine.data?.length).toBe(1)
    expect(mine.data?.[0]?.raw_note).toBe('수정')
    expect(mine.data?.[0]?.user_id).toBe(aId)
    const fromB = await b.from('workout_sessions').select('id').eq('id', aSession)
    expect(fromB.error).toBeNull()
    expect(fromB.data?.length).toBe(0)
  })
})
