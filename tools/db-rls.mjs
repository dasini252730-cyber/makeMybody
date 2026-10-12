#!/usr/bin/env node
// RLS 프로브 실행기 (T-021·T-123). supabase/tests/*.sql 을 linked 프로젝트에서 순서대로 실행하고,
// 각 파일이 마지막에 돌려주는 'ALL ... PASSED' 행이 없으면 실패(종료 코드 1).
//   node tools/db-rls.mjs            전체
//   node tools/db-rls.mjs workout    이름에 'workout' 이 포함된 파일만
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'supabase', 'tests')
const filter = process.argv[2] ?? ''

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.sql') && f.includes(filter))
  .sort()
if (!files.length) {
  console.error(`프로브 파일 없음 (${DIR}, filter='${filter}')`)
  process.exit(1)
}

let failed = 0
for (const f of files) {
  const file = path.join(DIR, f)
  const r = spawnSync(`supabase db query --linked --output-format json -f "${file}"`, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const passed = r.status === 0 && /"result":\s*"ALL [A-Z ]*PROBES PASSED"/.test(out)
  if (passed) {
    console.log(`✔ ${f}`)
  } else {
    failed++
    const m = out.match(/ERROR:[^\\"]*/) ?? out.match(/FAIL[^\\"]*/)
    console.error(`✖ ${f}\n  ${m ? m[0] : out.slice(0, 400)}`)
  }
}
console.log(`\n${files.length - failed}/${files.length} 통과`)
process.exit(failed ? 1 : 0)
