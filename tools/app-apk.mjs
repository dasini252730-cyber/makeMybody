#!/usr/bin/env node
// Android 디버그 APK 한 번에 만들기 (T-113): 웹 빌드 → cap sync → gradlew assembleDebug → release/ 로 복사.
// npm 스크립트의 && 체인은 Windows 에서 gradlew.bat 종료 코드를 놓칠 수 있어 node 로 단계마다 확인한다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APK = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const OUT = path.join(ROOT, 'release', 'MyBodyOS-debug.apk')
const JBR = 'C:/Program Files/Android/Android Studio/jbr'

function run(label, cmd, cwd = ROOT, env = process.env) {
  console.log(`\n▶ ${label}: ${cmd}`)
  const r = spawnSync(cmd, { cwd, shell: true, stdio: 'inherit', env })
  if (r.status !== 0) {
    console.error(`✖ ${label} 실패 (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}

const env = { ...process.env }
if (!env.JAVA_HOME && fs.existsSync(JBR)) env.JAVA_HOME = JBR

run('웹 빌드', 'npm run build')
run('Capacitor 동기화', 'npx cap sync android')
run(
  'Gradle assembleDebug',
  process.platform === 'win32' ? 'gradlew.bat assembleDebug -q' : './gradlew assembleDebug -q',
  path.join(ROOT, 'android'),
  env,
)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.copyFileSync(APK, OUT)
const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1)
console.log(`\n✔ APK: ${path.relative(ROOT, OUT)} (${mb} MB)`)
console.log(
  '  설치: 폰을 USB 디버깅으로 연결한 뒤 `npm run app:install`, 또는 파일을 폰으로 옮겨 설치',
)
