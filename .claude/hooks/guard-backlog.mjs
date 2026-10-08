// PreToolUse: backlog.json 직접 접근 차단. CLI(tools/backlog.mjs)로만 조회/수정하도록 안내한다.
import { readInput, emit, rel } from './lib.mjs';

const CLI_HINT = `backlog.json은 직접 읽거나 수정할 수 없습니다. 반드시 CLI를 사용하세요.
  조회: node tools/backlog.mjs list [--status s --epic E01 --q 검색어]
        node tools/backlog.mjs show <id> | doc <id> | next | stats
  수정: node tools/backlog.mjs set <id> --status in_progress|review|done ... [--note "메모"]
  추가: node tools/backlog.mjs add --title "제목" --desc "설명" --epic E04 --priority P0
  도움: node tools/backlog.mjs --help`;

const input = readInput();
const tool = input.tool_name ?? '';
const ti = input.tool_input ?? {};
const mentions = (s) => /backlog\.json/i.test(String(s ?? ''));
const usesCli = (s) => /tools[\\/]backlog\.mjs|npm\s+run\s+backlog/i.test(String(s ?? ''));

let blocked = false;
if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  blocked = rel(ti.file_path ?? ti.notebook_path) === 'backlog.json';
} else if (tool === 'Grep') {
  blocked = mentions(ti.path) || mentions(ti.glob);
} else if (tool === 'Bash' || tool === 'PowerShell') {
  const cmd = ti.command ?? '';
  blocked = mentions(cmd) && !usesCli(cmd);
}

if (blocked) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: CLI_HINT,
    },
    systemMessage: 'backlog.json 직접 접근이 차단되었습니다. node tools/backlog.mjs 를 사용하세요.',
  });
}
