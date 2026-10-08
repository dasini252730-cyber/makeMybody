import { describe, expect, it } from 'vitest'
import { readSupabaseEnv, secretRole } from '@/lib/supabase'

const good = {
  VITE_SUPABASE_URL: 'https://abcd1234.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxx',
}

/** 테스트용 가짜 JWT (서명 없음). role 클레임만 의미 있다. */
function fakeJwt(role: string): string {
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ iss: 'supabase', ref: 'abcd1234', role })}.sig`
}

describe('readSupabaseEnv', () => {
  it('정상 env 를 url/key 로 돌려준다', () => {
    expect(readSupabaseEnv(good)).toEqual({
      url: good.VITE_SUPABASE_URL,
      key: 'sb_publishable_xxx',
    })
  })

  it('publishable key 가 없으면 레거시 anon key 를 쓴다', () => {
    const env = {
      VITE_SUPABASE_URL: good.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: fakeJwt('anon'),
    }
    expect(readSupabaseEnv(env).key).toBe(env.VITE_SUPABASE_ANON_KEY)
  })

  it('둘 다 없으면 누락 항목 이름을 모두 담은 에러를 낸다', () => {
    expect(() => readSupabaseEnv({})).toThrow(/VITE_SUPABASE_URL/)
    expect(() => readSupabaseEnv({})).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/)
    expect(() => readSupabaseEnv({})).toThrow(/\.env\.example/)
  })

  it('빈 문자열/공백도 누락으로 본다', () => {
    expect(() => readSupabaseEnv({ ...good, VITE_SUPABASE_URL: '   ' })).toThrow(/누락/)
  })

  it('URL: 스킴 없는 값과 비 http 스킴은 거부한다', () => {
    expect(() => readSupabaseEnv({ ...good, VITE_SUPABASE_URL: 'abcd.supabase.co' })).toThrow(
      /형식/,
    )
    expect(() => readSupabaseEnv({ ...good, VITE_SUPABASE_URL: 'ftp://x.supabase.co' })).toThrow(
      /http/,
    )
  })

  it('URL: 트레일링 슬래시 제거, 커스텀 도메인·로컬 허용', () => {
    const url = (v: string) => readSupabaseEnv({ ...good, VITE_SUPABASE_URL: v }).url
    expect(url('https://abcd1234.supabase.co/')).toBe('https://abcd1234.supabase.co')
    expect(url('https://db.mybody.app')).toBe('https://db.mybody.app')
    expect(url('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321')
  })

  it('secret / service_role 키를 넣으면 거부한다', () => {
    expect(() =>
      readSupabaseEnv({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_zzz' }),
    ).toThrow(/secret/)
    expect(() =>
      readSupabaseEnv({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt('service_role') }),
    ).toThrow(/service_role/)
  })
})

describe('secretRole', () => {
  it('publishable 와 anon JWT 는 안전(null)', () => {
    expect(secretRole('sb_publishable_xxx')).toBeNull()
    expect(secretRole(fakeJwt('anon'))).toBeNull()
  })

  it('service_role JWT 와 sb_secret_ 는 종류를 돌려준다', () => {
    expect(secretRole(fakeJwt('service_role'))).toBe('service_role')
    expect(secretRole('sb_secret_abc')).toBe('secret')
  })

  it('JWT 가 아니거나 payload 가 깨져도 예외 없이 null', () => {
    expect(secretRole('not.a.jwt!!')).toBeNull()
    expect(secretRole('a.b')).toBeNull()
  })
})
