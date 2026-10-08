// hook 공용 헬퍼. 모든 hook은 stdin JSON을 읽고 stdout JSON으로 응답한다.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const STATE_DIR = path.join(ROOT, '.claude', 'state')

export function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

export function rel(p) {
  if (!p) return ''
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p)
  return path.relative(ROOT, abs).split(path.sep).join('/')
}

export function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}

export function isGitRepo() {
  return git(['rev-parse', '--is-inside-work-tree']).ok
}

export function currentBranch() {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  return r.ok ? r.out : null
}

export function pkgScripts() {
  const p = path.join(ROOT, 'package.json')
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).scripts ?? {}
  } catch {
    return {}
  }
}

// hook 이 실행할 수 있는 npm 스크립트 화이트리스트. 셸 문자열에 보간되므로 여기 없는 이름은 거부한다.
const ALLOWED_SCRIPTS = new Set(['lint', 'test', 'build'])

// npm 스크립트 실행. 스크립트가 없으면 {skipped:true}.
export function runScript(name, timeoutMs = 180_000) {
  if (!ALLOWED_SCRIPTS.has(name)) throw new Error(`허용되지 않은 스크립트: ${name}`)
  const scripts = pkgScripts()
  if (!scripts[name]) return { skipped: true, ok: true, out: '' }
  // 셸에 단일 문자열로 넘긴다 (Windows 의 npm.cmd 실행 + DEP0190 회피).
  const r = spawnSync(`npm run ${name} --silent`, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: true,
  })
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim()
  return { skipped: false, ok: r.status === 0, out: out.slice(-4000) }
}

export function readState(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE_DIR, name), 'utf8'))
  } catch {
    return fallback
  }
}

export function writeState(name, obj) {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(path.join(STATE_DIR, name), JSON.stringify(obj, null, 2), 'utf8')
}

// 소스 트리 변경 지문: 워킹트리 상태 + HEAD. lint/build 재실행 여부 판단에 사용.
export function sourceFingerprint() {
  const status = git([
    'status',
    '--porcelain',
    '--',
    'src',
    'supabase',
    'package.json',
    'vite.config.ts',
    'vitest.config.ts',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'eslint.config.js',
    '.prettierrc.json',
    '.prettierignore',
    'tools',
    '.claude/hooks',
  ]).out
  const head = git(['rev-parse', 'HEAD']).out
  const diff = git([
    'diff',
    '--',
    'src',
    'supabase',
    'tools',
    '.claude/hooks',
    'eslint.config.js',
    'vite.config.ts',
    'vitest.config.ts',
  ]).out
  let h = 0
  for (const ch of status + head + diff) h = (h * 31 + ch.charCodeAt(0)) | 0
  return `${head.slice(0, 8)}:${h}`
}

export const SOURCE_EXT = /\.(vue|ts|tsx|js|mjs|cjs|sql|css|scss)$/i

export function backlogCli(args) {
  try {
    return execFileSync(process.execPath, [path.join(ROOT, 'tools', 'backlog.mjs'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
  } catch (e) {
    return (e.stdout ?? '') + (e.stderr ?? '')
  }
}
