// PostToolUse(Write|Edit): 방금 쓴 소스 파일 하나만 eslint로 검사한다. 실패하면 block → 즉시 수정.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readInput, emit, rel, ROOT } from './lib.mjs';

const LINTABLE = /\.(vue|ts|tsx|js|mjs|cjs)$/i;

function main() {
  const input = readInput();
  const fp = input.tool_input?.file_path ?? input.tool_response?.filePath;
  if (!fp) return;
  const abs = path.isAbsolute(fp) ? fp : path.join(ROOT, fp);
  const relPath = rel(abs);
  if (!LINTABLE.test(relPath) || !fs.existsSync(abs)) return;
  if (relPath.startsWith('.claude/') || relPath.startsWith('tools/')) return;
  const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint');
  if (!fs.existsSync(bin)) return; // eslint 미설치(프로젝트 셋업 전) → 건너뜀

  const r = spawnSync(bin, ['--no-warn-ignored', '--max-warnings', '0', abs], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000, shell: process.platform === 'win32',
  });
  if (r.status === 0) return;
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().slice(-3000);
  emit({
    decision: 'block',
    reason: `eslint 실패 — ${relPath}. 아래 문제를 지금 수정하세요 (lint는 hook으로 강제됩니다):\n${out}`,
    systemMessage: `⛔ eslint 실패: ${relPath}`,
  });
}

main();
