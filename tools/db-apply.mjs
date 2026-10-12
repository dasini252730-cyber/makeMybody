#!/usr/bin/env node
// 마이그레이션 적용기 — `supabase db push` 대용.
//
// 이 앱은 다른 앱이 CLI 로 관리하는 Supabase 프로젝트를 공유한다(T-005 결정). 공용 이력 테이블
// supabase_migrations.schema_migrations 에는 그 앱의 버전이 들어 있어 `db push` 가 거부/repair 를 요구하는데,
// repair 는 그 앱의 이력을 망친다. 그래서 이 저장소의 마이그레이션은 `supabase db query -f` 로 적용하고
// 적용 이력은 노출되지 않는 별도 스키마 mybody_meta.schema_migrations 에 기록한다.
//
//   node tools/db-apply.mjs list             로컬 파일 vs 적용 이력
//   node tools/db-apply.mjs apply [--dry-run]  미적용 파일을 버전 순으로 적용
//   node tools/db-apply.mjs mark <version>   이미 손으로 적용한 버전을 이력에만 기록
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations')
const META_SQL = `
create schema if not exists mybody_meta;
create table if not exists mybody_meta.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);`

function fail(msg) {
  console.error(`오류: ${msg}`)
  process.exit(1)
}

/** supabase db query 를 실행하고 JSON rows 를 돌려준다. */
function query({ sql, file }) {
  // 여러 줄 SQL 은 인자로 주면 셸 인용 문제가 생기므로 stdin 으로 넘긴다.
  // Windows 에서 supabase 가 .cmd/.exe 어느 쪽이든 찾도록 셸로 실행한다. 인자는 파일 경로뿐이라 따옴표로 감싼다.
  const cmd = `supabase db query --linked --output-format json${file ? ` -f "${file}"` : ''}`
  const r = spawnSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    input: file ? undefined : sql,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0) fail(`db query 실패 (${file ?? sql.slice(0, 60)})\n${out.trim()}`)
  const start = out.indexOf('{')
  if (start < 0) return []
  try {
    const parsed = JSON.parse(out.slice(start, out.lastIndexOf('}') + 1))
    return parsed.rows ?? []
  } catch {
    return []
  }
}

function localMigrations() {
  if (!fs.existsSync(MIG_DIR)) return []
  return fs
    .readdirSync(MIG_DIR)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: f.slice(0, 14), name: f.slice(15, -4), file: path.join(MIG_DIR, f) }))
}

function appliedVersions() {
  query({ sql: META_SQL })
  const rows = query({ sql: 'select version from mybody_meta.schema_migrations order by version' })
  return new Set(rows.map((r) => r.version))
}

function record(m) {
  query({
    sql: `insert into mybody_meta.schema_migrations(version, name) values ('${m.version}', '${m.name.replace(/'/g, "''")}') on conflict (version) do nothing`,
  })
}

function cmdList() {
  const applied = appliedVersions()
  const local = localMigrations()
  for (const m of local) console.log(`${applied.has(m.version) ? '✔' : '·'} ${m.version}_${m.name}`)
  const pending = local.filter((m) => !applied.has(m.version))
  console.log(`\n${local.length}개 파일, 미적용 ${pending.length}개`)
}

function cmdApply(dryRun) {
  const applied = appliedVersions()
  const pending = localMigrations().filter((m) => !applied.has(m.version))
  if (!pending.length) return console.log('적용할 마이그레이션이 없습니다.')
  for (const m of pending) {
    if (dryRun) {
      console.log(`(dry-run) ${m.version}_${m.name}`)
      continue
    }
    console.log(`적용 중: ${m.version}_${m.name}`)
    query({ file: m.file })
    record(m)
    console.log(`  완료`)
  }
}

function cmdMark(version) {
  if (!version) fail('mark <version> 형식으로 버전을 주세요')
  const m = localMigrations().find((x) => x.version === version)
  if (!m) fail(`로컬에 ${version} 마이그레이션이 없습니다`)
  appliedVersions()
  record(m)
  console.log(`기록됨: ${m.version}_${m.name}`)
}

const [cmd = 'list', arg] = process.argv.slice(2)
switch (cmd) {
  case 'list':
    cmdList()
    break
  case 'apply':
    cmdApply(process.argv.includes('--dry-run'))
    break
  case 'mark':
    cmdMark(arg)
    break
  default:
    fail(`알 수 없는 명령: ${cmd} (list | apply [--dry-run] | mark <version>)`)
}
