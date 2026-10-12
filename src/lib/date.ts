// KST(Asia/Seoul, UTC+9) 날짜 유틸. 이 앱의 "하루" 는 항상 KST 기준이다(요구사항 7.4, DB 의 log_date 기본값과 동일).
// 순수 함수만. Date 객체 대신 'YYYY-MM-DD' 문자열(날짜 키)을 주고받는다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const HAS_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i

/**
 * ISO 시각(또는 epoch ms/Date)을 KST 날짜 키 'YYYY-MM-DD' 로 바꾼다.
 * 오프셋 없는 문자열('2026-10-12T23:30', datetime-local 출력)은 실행 환경 시간대가 아니라 **KST 로 해석**한다.
 */
export function kstDateKey(at: string | number | Date): string {
  return new Date(toEpochMs(at) + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 시각을 epoch ms 로. 오프셋 없는 문자열은 KST 로 해석한다(kstDateKey 와 같은 규칙 — 정렬·비교에도 이것만 쓴다). */
export function toEpochMs(at: string | number | Date): number {
  let ms: number
  if (typeof at === 'string') {
    const s = at.trim()
    ms = new Date(HAS_OFFSET_RE.test(s) || DATE_KEY_RE.test(s) ? s : `${s}+09:00`).getTime()
  } else {
    ms = typeof at === 'number' ? at : at.getTime()
  }
  if (Number.isNaN(ms)) throw new Error(`유효하지 않은 시각: ${String(at)}`)
  return ms
}

function keyToUtcMs(key: string): number {
  if (!DATE_KEY_RE.test(key)) throw new Error(`유효하지 않은 날짜 키: ${key}`)
  const ms = Date.UTC(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
  )
  // 2026-02-30 같은 롤오버 방지
  if (new Date(ms).toISOString().slice(0, 10) !== key) throw new Error(`존재하지 않는 날짜: ${key}`)
  return ms
}

/** 날짜 키에 일수를 더한다 (음수 가능). */
export function addDays(dateKey: string, days: number): string {
  return new Date(keyToUtcMs(dateKey) + days * DAY_MS).toISOString().slice(0, 10)
}

/** 두 날짜 키의 차이(일). b - a. */
export function diffDays(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / DAY_MS)
}

/** 오늘의 KST 날짜 키. 테스트에서는 now 를 주입한다. */
export function todayKst(now: () => number = Date.now): string {
  return kstDateKey(now())
}
