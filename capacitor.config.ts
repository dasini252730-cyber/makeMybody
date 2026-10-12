import type { CapacitorConfig } from '@capacitor/cli'

// Android 앱 설정 (v1.3, T-113). 웹 빌드(dist/)를 그대로 감싼다. 서버 URL 없음 — 번들된 파일만 사용.
const config: CapacitorConfig = {
  appId: 'kr.mybody.os',
  appName: 'MY BODY OS',
  webDir: 'dist',
  // WebView origin 을 https://localhost 로 고정한다. 이 값이 바뀌면 localStorage(로그인 세션)가 통째로 사라진다.
  server: { androidScheme: 'https' },
  android: {
    // 혼합 콘텐츠·디버깅은 기본값(차단/비활성). 릴리스 빌드에서 웹뷰 디버깅 금지.
    allowMixedContent: false,
  },
}

export default config
