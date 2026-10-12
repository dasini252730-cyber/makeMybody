#!/usr/bin/env node
// RLS REST 테스트용 프로브 계정 2개(A/B) 생성·갱신 + B 소유 고정 데이터 시드 (T-021).
// 실사용 계정의 비밀번호를 테스트에 쓰지 않기 위한 전용 계정. B 의 데이터는 "A 가 보지 못해야 하는 타인 데이터" 역할.
//   node tools/db-probe-user.mjs     .env 의 RLS_PROBE_* 로 생성(없으면 랜덤 비밀번호를 .env 에 추가)
// auth.users 에 직접 insert 한다(테스트 계정 한정). 비밀번호는 bcrypt(crypt) 해시. GoTrue 가 요구하는 토큰 컬럼은 빈 문자열.
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV = path.join(ROOT, '.env')
// REST 테스트가 참조하는 고정 id — src/lib/__tests__/rls.rest.test.ts 의 상수와 반드시 같아야 한다 (이 파일은 톱레벨 스크립트라 import 불가).
const PROBE_B_SESSION_ID = 'b0000000-0000-4000-8000-000000000001'
const PROBE_B_ITEM_ID = 'b0000000-0000-4000-8000-000000000002'
const PROBE_B_SET_ID = 'b0000000-0000-4000-8000-000000000003'
const PROBE_B_EXERCISE_ID = 'b0000000-0000-4000-8000-000000000004'
const PROBE_B_BODY_ID = 'b0000000-0000-4000-8000-000000000005'

function readEnv() {
  const text = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : ''
  const map = Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const [k, v = ''] = l.split(/=(.*)/s)
        return [k.trim(), v.trim().replace(/^(["'])(.*)\1$/, '$2')] // node --env-file 과 같이 따옴표 제거
      }),
  )
  return { text, map }
}

function query(sql) {
  const r = spawnSync('supabase db query --linked --output-format json', {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    input: sql,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0) {
    console.error(out.trim())
    process.exit(1)
  }
  return out
}

const esc = (s) => s.replace(/'/g, "''")

/** 계정 1개를 만들거나 비밀번호를 갱신하는 SQL. */
function upsertUserSql(email, password) {
  return `
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = '${esc(email)}';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                            raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change,
                            email_change_token_new, email_change_token_current, phone_change, phone_change_token,
                            reauthentication_token, is_sso_user, is_anonymous)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${esc(email)}',
            extensions.crypt('${esc(password)}', extensions.gen_salt('bf')), now(), now(), now(),
            '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '', false, false);
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, 'email', jsonb_build_object('sub', uid::text, 'email', '${esc(email)}', 'email_verified', true), now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt('${esc(password)}', extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now(),
      confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''), email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''), email_change_token_current = coalesce(email_change_token_current, ''),
      phone_change = coalesce(phone_change, ''), phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')
      where id = uid;
  end if;
end $$;`
}

/** B 소유 고정 데이터: 사용자 운동 1, 세션 1(raw_note), 동작 1, 세트 1. 멱등. */
function seedBSql(emailB) {
  return `
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = '${esc(emailB)}';
  if uid is null then raise exception 'probe B user not found'; end if;
  insert into mybody.exercise_library (id, user_id, name, measurement_type, weight_basis)
    values ('${PROBE_B_EXERCISE_ID}', uid, '프로브 B 전용 운동', 'weight', 'barbell_total') on conflict (id) do nothing;
  insert into mybody.workout_sessions (id, user_id, session_type, raw_note)
    values ('${PROBE_B_SESSION_ID}', uid, 'strength', '프로브 B 의 세션')
    on conflict (id) do update set raw_note = excluded.raw_note, deleted_at = null; -- 값 복원(이전 실행이 바꿨어도)
  insert into mybody.session_items (id, session_id, exercise_id, display_name_snapshot)
    values ('${PROBE_B_ITEM_ID}', '${PROBE_B_SESSION_ID}', '${PROBE_B_EXERCISE_ID}', '프로브 B 전용 운동') on conflict (id) do nothing;
  insert into mybody.exercise_sets (id, session_item_id, set_no, weight_kg, reps)
    values ('${PROBE_B_SET_ID}', '${PROBE_B_ITEM_ID}', 1, 100, 1) on conflict (id) do nothing;
  insert into mybody.body_metrics (id, user_id, weight_kg, measurement_method)
    values ('${PROBE_B_BODY_ID}', uid, 70.5, 'scale') on conflict (id) do nothing;
end $$;
select (select count(*) from mybody.workout_sessions where id = '${PROBE_B_SESSION_ID}') as b_sessions;`
}

const { text, map } = readEnv()
const accounts = [
  {
    key: 'RLS_PROBE',
    email: map.RLS_PROBE_EMAIL || 'rls-probe@mybody.local',
    password: map.RLS_PROBE_PASSWORD,
  },
  {
    key: 'RLS_PROBE_B',
    email: map.RLS_PROBE_B_EMAIL || 'rls-probe-b@mybody.local',
    password: map.RLS_PROBE_B_PASSWORD,
  },
]
// 안전장치: 프로브 계정은 반드시 @mybody.local 이어야 한다. 실사용 계정(예: naver.com)의 비밀번호를 덮어쓰는 사고 방지.
for (const a of accounts) {
  if (!/@mybody\.local$/i.test(a.email)) {
    console.error(
      `거부: 프로브 계정 이메일은 @mybody.local 이어야 합니다 (${a.key}_EMAIL=${a.email})`,
    )
    process.exit(1)
  }
}
let appended = ''
for (const a of accounts) {
  if (!map[`${a.key}_EMAIL`]) appended += `${a.key}_EMAIL=${a.email}\n`
  if (!a.password) {
    a.password = crypto.randomBytes(18).toString('base64url')
    appended += `${a.key}_PASSWORD=${a.password}\n`
  }
}
if (appended) {
  fs.writeFileSync(
    ENV,
    `${text.replace(/\s*$/, '')}\n# RLS REST 테스트 전용 계정 (tools/db-probe-user.mjs 가 생성, git 제외)\n${appended}`,
  )
  console.log('.env 에 프로브 계정 정보를 추가했습니다.')
}

for (const a of accounts) query(upsertUserSql(a.email, a.password))
const out = query(seedBSql(accounts[1].email))
const ok = /"b_sessions":\s*1/.test(out)
console.log(
  `프로브 계정 준비됨: ${accounts.map((a) => a.email).join(', ')}${ok ? ' · B 고정 데이터 OK' : ' · B 고정 데이터 확인 실패'}`,
)
if (!ok) process.exit(1)
