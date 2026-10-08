// PostToolUse(Write|Edit): 파일 줄 수를 .claude/code-budget.json 예산과 비교한다.
//   85% 이상 → 경고, 100% 초과 → block(다시 작업).
import fs from 'node:fs'
import path from 'node:path'
import { readInput, emit, rel, ROOT } from './lib.mjs'

const CONFIG = path.join(ROOT, '.claude', 'code-budget.json')

function globToRegex(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/'
      re += slash ? '(?:.*/)?' : '.*'
      i += slash ? 2 : 1
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

export function budgetFor(relPath, cfg) {
  if (cfg.exclude?.some((g) => globToRegex(g).test(relPath))) return null
  const rule = cfg.rules?.find((r) => globToRegex(r.glob).test(relPath))
  if (rule) return { max: rule.max_lines, why: rule.why ?? null, glob: rule.glob }
  if (!/\.(vue|ts|tsx|js|mjs|cjs|sql|css|scss|py|sh)$/i.test(relPath)) return null
  return { max: cfg.default_max_lines ?? 300, why: null, glob: '(default)' }
}

export function countLines(file) {
  const text = fs.readFileSync(file, 'utf8')
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').length
}

function main() {
  const input = readInput()
  const fp = input.tool_input?.file_path ?? input.tool_response?.filePath
  if (!fp) return
  const abs = path.isAbsolute(fp) ? fp : path.join(ROOT, fp)
  if (!fs.existsSync(abs) || !fs.existsSync(CONFIG)) return
  const relPath = rel(abs)
  if (relPath.startsWith('..')) return // 프로젝트 밖(스크래치패드 등)은 검사하지 않음
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  const budget = budgetFor(relPath, cfg)
  if (!budget) return

  const lines = countLines(abs)
  const ratio = lines / budget.max
  const pct = Math.round(ratio * 100)
  const warnRatio = cfg.warn_ratio ?? 0.85
  const summary = `${relPath}: ${lines}/${budget.max}줄 (${pct}%, 규칙 ${budget.glob})`

  if (ratio > 1) {
    emit({
      decision: 'block',
      reason:
        `코드 예산 초과 — ${summary}. 이 파일은 허용 줄 수를 넘었습니다. 다시 작업하세요: ` +
        `책임 단위로 파일을 분리(컴포넌트/composable/유틸 추출)하거나 중복을 제거해 ${budget.max}줄 이하로 줄인 뒤 진행합니다.` +
        (budget.why ? ` (규칙 의도: ${budget.why})` : ''),
      systemMessage: `⛔ 코드 예산 초과: ${summary}`,
    })
  } else if (ratio >= warnRatio) {
    emit({
      systemMessage: `⚠ 코드 예산 ${pct}%: ${summary}`,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `경고: ${summary}. 예산의 ${Math.round(warnRatio * 100)}% 이상을 사용했습니다. ` +
          `이 파일에 더 추가하지 말고 분리 지점을 먼저 정하세요. 100%를 넘기면 작업이 차단됩니다.`,
      },
    })
  }
}

main()
