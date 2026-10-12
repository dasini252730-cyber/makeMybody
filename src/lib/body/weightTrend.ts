import { addDays, diffDays, kstDateKey, toEpochMs } from '@/lib/date'

// 체중 추세 계산 (요구사항 FR-013, 7.4). 순수 함수.
// 규칙: 실제 입력값만 쓴다. 측정 없는 날을 0 으로 채우지 않는다(0 이하 값은 결측으로 버림). 7일 평균은 기간 안에 측정 3개 이상일 때만.
// 하루 여러 번 측정하면 날짜별 최신 1건만 쓴다 (T-016 결정). 해석(지방 증감 등)은 하지 않고 숫자와 방향만 돌려준다.

export interface WeightMeasurement {
  /** ISO 시각 (timestamptz). KST 로 날짜 키를 만든다. 오프셋 없는 문자열은 KST 로 해석. */
  measuredAt: string
  weightKg: number
}

/** 날짜 키별 최신 측정값. 키 오름차순(날짜순)으로 정렬되어 있다. */
export type DailyWeights = Map<string, number>

export interface RollingAverage {
  /** 평균 (kg, 소수 1자리). 측정이 minCount 미만이면 null (화면은 "평균 숨김"). */
  value: number | null
  count: number
  start: string
  end: string
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface WeightTrend {
  /** 기간 시작 쪽 기준값(가능하면 시작 창 평균, 아니면 첫 측정값). insufficient 면 null */
  startValue: number | null
  /** 기간 끝 쪽 기준값. insufficient 면 null */
  endValue: number | null
  /** endValue - startValue (kg). insufficient 면 null */
  deltaKg: number | null
  /** |delta| < FLAT_BAND_KG 면 flat. insufficient 면 null */
  direction: TrendDirection | null
  /** startValue/endValue 의 기준 측정일(창 평균이면 창의 끝/시작 날짜, 단일값이면 그 측정일). 화면은 "N일 기준" 으로 보여준다 */
  startKey: string | null
  endKey: string | null
  count: number
  days: number
  /** 측정이 적거나(count < ROLLING_MIN_COUNT) 한쪽에 몰려(spread < days*MIN_SPREAD_RATIO) 추세를 말할 수 없음 */
  insufficient: boolean
}

// 구현 상수 (요구사항에 수치가 없는 것들. docs/T-042.md 결정 참조. 데이터가 쌓인 뒤 조정)
export const ROLLING_MIN_COUNT = 3
/** 추세 기간 안에서 첫 측정~마지막 측정 간격이 기간의 이 비율 미만이면 insufficient */
export const MIN_SPREAD_RATIO = 1 / 3
/** 변화량이 이보다 작으면 flat (체중계 오차 수준) */
export const FLAT_BAND_KG = 0.3
/** 추세 양 끝 평균 창(일). 기간이 짧으면 겹치지 않게 줄인다. */
export const TREND_WINDOW_DAYS = 7

/** 측정 목록을 KST 날짜별 최신값으로 접는다. 같은 날 여러 건이면 measuredAt 이 가장 늦은 것(같은 시각이면 나중 입력). 0 이하는 결측으로 버린다. */
export function toDailyLatest(measurements: readonly WeightMeasurement[]): DailyWeights {
  const latestAt = new Map<string, number>()
  const picked = new Map<string, number>()
  for (const m of measurements) {
    if (!Number.isFinite(m.weightKg) || m.weightKg <= 0) continue
    const key = kstDateKey(m.measuredAt)
    const at = toEpochMs(m.measuredAt) // kstDateKey 와 같은 규칙(오프셋 없으면 KST)으로 "최신" 을 고른다
    const prev = latestAt.get(key)
    if (prev === undefined || at >= prev) {
      latestAt.set(key, at)
      picked.set(key, m.weightKg)
    }
  }
  return new Map([...picked.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

function valuesInRange(daily: DailyWeights, start: string, end: string): number[] {
  const out: number[] = []
  for (const [key, v] of daily) if (key >= start && key <= end) out.push(v)
  return out
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * end 로 끝나는 `days` 일 구간의 평균. 측정 일수가 minCount 미만이면 value=null.
 * 결측일은 분모에 넣지 않는다(실제 입력값만 평균).
 */
export function rollingAverage(
  daily: DailyWeights,
  end: string,
  days = 7,
  minCount = ROLLING_MIN_COUNT,
): RollingAverage {
  if (days < 1) throw new Error('days 는 1 이상')
  const start = addDays(end, -(days - 1))
  const values = valuesInRange(daily, start, end)
  const value = values.length > 0 && values.length >= minCount ? round1(mean(values)) : null
  return { value, count: values.length, start, end }
}

/**
 * end 로 끝나는 `days`(기본 30)일 추세. 양 끝의 기준값은 각각 그 쪽 창(최대 7일, 기간이 짧으면 겹치지 않게 축소)의
 * 평균을 우선 쓰고, 평균을 낼 수 없으면 구간 안 첫/마지막 측정값을 쓴다. 반올림은 출력에서만 한다.
 */
export function weightTrend(daily: DailyWeights, end: string, days = 30): WeightTrend {
  if (days < 2) throw new Error('days 는 2 이상')
  const start = addDays(end, -(days - 1))
  // Map 삽입 순서(repo 가 desc 로 줄 수도 있음)에 기대지 않고 정렬한다
  const keys = [...daily.keys()].filter((k) => k >= start && k <= end).sort()
  const count = keys.length
  const none: WeightTrend = {
    startValue: null,
    endValue: null,
    deltaKg: null,
    direction: null,
    startKey: null,
    endKey: null,
    count,
    days,
    insufficient: true,
  }
  if (count < ROLLING_MIN_COUNT) return none
  const firstKey = keys[0]!
  const lastKey = keys[count - 1]!
  if (diffDays(firstKey, lastKey) < Math.ceil(days * MIN_SPREAD_RATIO)) return none

  const win = Math.min(TREND_WINDOW_DAYS, Math.floor(days / 2)) // 두 창이 절대 겹치지 않게
  const startWinEnd = addDays(start, win - 1)
  const endWinStart = addDays(end, -(win - 1))
  const startVals = valuesInRange(daily, start, startWinEnd)
  const endVals = valuesInRange(daily, endWinStart, end)
  const startByAvg = startVals.length >= ROLLING_MIN_COUNT
  const endByAvg = endVals.length >= ROLLING_MIN_COUNT
  const startRaw = startByAvg ? mean(startVals) : daily.get(firstKey)!
  const endRaw = endByAvg ? mean(endVals) : daily.get(lastKey)!
  const delta = endRaw - startRaw
  const direction: TrendDirection =
    Math.abs(delta) < FLAT_BAND_KG ? 'flat' : delta > 0 ? 'up' : 'down'
  return {
    startValue: round1(startRaw),
    endValue: round1(endRaw),
    deltaKg: round1(delta),
    direction,
    startKey: startByAvg ? startWinEnd : firstKey,
    endKey: endByAvg ? end : lastKey,
    count,
    days,
    insufficient: false,
  }
}
