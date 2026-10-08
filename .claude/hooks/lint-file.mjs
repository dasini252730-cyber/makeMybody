// PostToolUse(Write|Edit): 방금 쓴 소스 파일 하나만 eslint로 검사한다. 실패하면 block → 즉시 수정.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readInput, emit, rel, ROOT } from './lib.mjs'

const LINTABLE = /\.(vue|ts|tsx|js|mjs|cjs)$/i

function main() {
  const input = readInput()
  const fp = input.tool_input?.file_path ?? input.tool_response?.filePath
  if (!fp) return
  const abs = path.isAbsolute(fp) ? fp : path.join(ROOT, fp)
  const relPath = rel(abs)
  if (!LINTABLE.test(relPath) || !fs.existsSync(abs)) return
  // `eslint .` 와 같은 범위를 검사한다 (.claude/hooks, tools 포함). 쉘 없이 eslint.js 를 직접 실행.
  const eslintJs = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js')
  if (!fs.existsSync(eslintJs)) return // eslint 미설치(프로젝트 셋업 전) → 건너뜀

  const r = spawnSync(
    process.execPath,
    [eslintJs, '--no-warn-ignored', '--max-warnings', '0', abs],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    },
  )
  if (r.status === 0) return
  if (r.status === null) {
    emit({ systemMessage: `⚠ eslint 실행 실패(${r.error?.code ?? 'timeout'}): ${relPath}` })
    return
  }
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().slice(-3000)
  emit({
    decision: 'block',
    reason: `eslint 실패 — ${relPath}. 아래 문제를 지금 수정하세요 (lint는 hook으로 강제됩니다):\n${out}`,
    systemMessage: `⛔ eslint 실패: ${relPath}`,
  })
}

main()
