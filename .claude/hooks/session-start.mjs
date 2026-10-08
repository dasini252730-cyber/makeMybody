// SessionStart: 현재 브랜치를 알리고(main 이면 dev 전환 안내), backlog 현황을 컨텍스트로 넣는다.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, emit, git, isGitRepo, currentBranch, backlogCli, ROOT } from './lib.mjs';

function main() {
  readInput();
  const lines = [];
  let warn = '';

  if (!isGitRepo()) {
    lines.push('git 저장소가 아닙니다. git init 후 dev 브랜치를 만드세요.');
  } else {
    const branch = currentBranch();
    const dirty = git(['status', '--porcelain']).out.split('\n').filter(Boolean).length;
    lines.push(`현재 브랜치: ${branch}${dirty ? ` (커밋되지 않은 변경 ${dirty}개)` : ''}`);
    if (branch === 'main' || branch === 'master') {
      const hasDev = git(['rev-parse', '--verify', '--quiet', 'dev']).ok;
      warn = `⚠ ${branch} 브랜치입니다. 작업은 dev 에서 합니다: ${hasDev ? 'git checkout dev' : 'git checkout -b dev'}`;
      lines.push(warn);
    }
  }

  if (fs.existsSync(path.join(ROOT, 'backlog.json'))) {
    lines.push('', 'backlog 현황 (node tools/backlog.mjs stats):', backlogCli(['stats']));
    lines.push('', backlogCli(['next', '--count', '3']));
    lines.push('', 'backlog.json 은 직접 열지 말고 CLI(node tools/backlog.mjs)로만 조회/수정합니다.');
  }

  const text = lines.join('\n');
  emit({
    systemMessage: warn || lines[0],
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
  });
}

main();
