import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase 클라이언트 싱글톤. 타입 파라미터(Database)는 T-022(supabase gen types) 에서 붙인다.
// 키는 publishable key(sb_publishable_...)를 권장하며, 레거시 anon key(JWT)도 허용한다.
// service_role/secret 키는 절대 클라이언트에 두지 않는다 (.claude/rules/tech-stack.md, NFR-003).

export interface SupabaseEnv {
  url: string
  key: string
}

type EnvLike = Record<string, string | boolean | undefined>

const URL_KEY = 'VITE_SUPABASE_URL'
const PUBLISHABLE_KEY = 'VITE_SUPABASE_PUBLISHABLE_KEY'
const ANON_KEY = 'VITE_SUPABASE_ANON_KEY'

/** 환경변수를 읽고 누락/오류를 사람이 읽을 수 있는 메시지로 알린다. 순수 함수라 테스트가 쉽다. */
export function readSupabaseEnv(env: EnvLike = import.meta.env): SupabaseEnv {
  const rawUrl = asString(env[URL_KEY])
  const keyVar = asString(env[PUBLISHABLE_KEY]) ? PUBLISHABLE_KEY : ANON_KEY
  const key = asString(env[keyVar])
  const missing = [!rawUrl && URL_KEY, !key && `${PUBLISHABLE_KEY} (또는 ${ANON_KEY})`].filter(
    Boolean,
  )
  if (missing.length) {
    throw new Error(
      `Supabase 환경변수 누락: ${missing.join(', ')}. ` +
        `.env.example 을 복사해 .env 를 만들고 Supabase 대시보드(Project Settings → API)의 값을 넣으세요.`,
    )
  }
  const url = normalizeUrl(rawUrl)
  const role = secretRole(key)
  if (role) {
    throw new Error(
      `${keyVar} 에 ${role} 키가 들어 있습니다. 클라이언트에는 publishable/anon 키만 쓰세요.`,
    )
  }
  return { url, key }
}

/** http(s) URL 만 허용하고 끝의 슬래시를 제거한다. 커스텀 도메인·셀프호스팅·로컬(127.0.0.1:54321)도 허용. */
function normalizeUrl(raw: string): string {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`${URL_KEY} 형식이 올바르지 않습니다: "${raw}" (예: https://xxxx.supabase.co)`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${URL_KEY} 는 http(s) 주소여야 합니다: "${raw}"`)
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '')
}

/** secret/service_role 키면 그 종류를 돌려주고, 안전한 키면 null. */
export function secretRole(rawKey: string): string | null {
  const key = rawKey.trim()
  if (key.toLowerCase().startsWith('sb_secret_')) return 'secret'
  const role = jwtRole(key)
  return role && role !== 'anon' ? role : null
}

function jwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    const payload = JSON.parse(json) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function asString(v: string | boolean | undefined): string {
  return typeof v === 'string' ? v.trim() : ''
}

let client: SupabaseClient | null = null

/** 앱 전역에서 공유하는 클라이언트. 처음 호출될 때 env 를 검증하고 생성한다. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = readSupabaseEnv()
    client = createClient(url, key)
  }
  return client
}
