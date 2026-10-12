import { describe, expect, it } from 'vitest'
import {
  FLAT_BAND_KG,
  ROLLING_MIN_COUNT,
  rollingAverage,
  toDailyLatest,
  weightTrend,
  type WeightMeasurement,
} from '@/lib/body/weightTrend'

/** KST 날짜·시각으로 측정을 만든다. 10-12 09:00 KST = 10-12T00:00Z */
const m = (kstDate: string, kstHour: number, weightKg: number): WeightMeasurement => ({
  measuredAt: new Date(`${kstDate}T${String(kstHour).padStart(2, '0')}:00:00+09:00`).toISOString(),
  weightKg,
})

describe('toDailyLatest', () => {
  it('같은 날 여러 측정은 가장 늦은 것만 남기고, 결과는 날짜 오름차순이다 (T-016: 하루 N행, 집계는 최신 1건)', () => {
    const daily = toDailyLatest([
      m('2026-10-13', 7, 70.2), // desc 순서로 들어와도
      m('2026-10-12', 21, 70.8),
      m('2026-10-12', 7, 70.5),
    ])
    expect([...daily.entries()]).toEqual([
      ['2026-10-12', 70.8],
      ['2026-10-13', 70.2],
    ])
  })

  it('같은 시각 두 건이면 나중에 들어온 값이 이긴다 (결정적)', () => {
    const daily = toDailyLatest([m('2026-10-12', 7, 70.1), m('2026-10-12', 7, 70.9)])
    expect(daily.get('2026-10-12')).toBe(70.9)
  })

  it('KST 자정 경계: 00:30 KST 측정은 그 날짜로, 전날 UTC 로 밀리지 않는다', () => {
    const daily = toDailyLatest([m('2026-10-13', 0, 69.9)])
    expect([...daily.keys()]).toEqual(['2026-10-13'])
  })

  it('0·음수·NaN 은 결측으로 버린다 (7.4 결측 0 금지)', () => {
    const daily = toDailyLatest([
      { measuredAt: '2026-10-12T00:00:00Z', weightKg: Number.NaN },
      m('2026-10-11', 7, 0),
      m('2026-10-10', 7, -5),
      m('2026-10-09', 7, 70),
    ])
    expect([...daily.entries()]).toEqual([['2026-10-09', 70]])
  })

  it('빈 입력이면 빈 Map', () => {
    expect(toDailyLatest([]).size).toBe(0)
  })
})

describe('rollingAverage (7일 평균)', () => {
  it(`측정이 ${ROLLING_MIN_COUNT}개 미만이면 평균을 숨긴다(null) — 결측일을 0 으로 채우지 않는다`, () => {
    const daily = toDailyLatest([m('2026-10-10', 7, 70), m('2026-10-12', 7, 71)])
    const r = rollingAverage(daily, '2026-10-12')
    expect(r).toEqual({ value: null, count: 2, start: '2026-10-06', end: '2026-10-12' })
  })

  it('3개 이상이면 실제 입력값만으로 평균 (분모는 측정 일수). 0 측정이 섞여도 평균을 끌어내리지 않는다', () => {
    const daily = toDailyLatest([
      m('2026-10-08', 7, 70),
      m('2026-10-10', 7, 71),
      m('2026-10-11', 7, 0),
      m('2026-10-12', 7, 72),
    ])
    const r = rollingAverage(daily, '2026-10-12')
    expect(r.value).toBe(71)
    expect(r.count).toBe(3)
  })

  it('기간 밖(8일 전) 측정은 들어가지 않고, 빈 Map 은 null', () => {
    const daily = toDailyLatest([
      m('2026-10-05', 7, 60),
      m('2026-10-06', 7, 70),
      m('2026-10-09', 7, 71),
      m('2026-10-12', 7, 72),
    ])
    expect(rollingAverage(daily, '2026-10-12').value).toBe(71)
    expect(rollingAverage(new Map(), '2026-10-12').value).toBeNull()
  })
})

describe('weightTrend (30일 추세)', () => {
  const insufficientShape = {
    startValue: null,
    endValue: null,
    deltaKg: null,
    direction: null,
    insufficient: true,
  }

  it('측정 3개 미만이면 insufficient 이고 값이 전부 null 로 통일된다', () => {
    const daily = toDailyLatest([m('2026-10-01', 7, 70), m('2026-10-12', 7, 69)])
    expect(weightTrend(daily, '2026-10-12')).toMatchObject({
      ...insufficientShape,
      count: 2,
      days: 30,
    })
  })

  it('측정이 기간 한쪽에만 몰려 있으면(간격 < 기간의 1/3) insufficient, 값도 null', () => {
    const daily = toDailyLatest([
      m('2026-10-10', 7, 70),
      m('2026-10-11', 7, 70.5),
      m('2026-10-12', 7, 70.2),
    ])
    expect(weightTrend(daily, '2026-10-12')).toMatchObject({ ...insufficientShape, count: 3 })
  })

  it('양쪽 창에 평균이 있으면 평균끼리 비교하고 방향을 준다', () => {
    const items: WeightMeasurement[] = []
    for (const d of ['2026-09-13', '2026-09-15', '2026-09-17']) items.push(m(d, 7, 72))
    for (const d of ['2026-10-08', '2026-10-10', '2026-10-12']) items.push(m(d, 7, 70.5))
    const t = weightTrend(toDailyLatest(items), '2026-10-12')
    expect(t).toMatchObject({
      startValue: 72,
      endValue: 70.5,
      deltaKg: -1.5,
      direction: 'down',
      insufficient: false,
      days: 30,
    })
  })

  it('평균을 낼 수 없는 쪽은 첫/마지막 측정값으로 대신한다', () => {
    const daily = toDailyLatest([
      m('2026-09-14', 7, 73),
      m('2026-09-28', 7, 72),
      m('2026-10-12', 7, 71),
    ])
    expect(weightTrend(daily, '2026-10-12')).toMatchObject({
      startValue: 73,
      endValue: 71,
      deltaKg: -2,
      direction: 'down',
    })
  })

  it(`변화가 ${FLAT_BAND_KG}kg 미만이면 flat, 이상이면 up`, () => {
    const flat = toDailyLatest([
      m('2026-09-14', 7, 70.0),
      m('2026-09-28', 7, 70.1),
      m('2026-10-12', 7, 70.2),
    ])
    expect(weightTrend(flat, '2026-10-12').direction).toBe('flat')
    const up = toDailyLatest([
      m('2026-09-14', 7, 70.0),
      m('2026-09-28', 7, 70.5),
      m('2026-10-12', 7, 71.0),
    ])
    expect(weightTrend(up, '2026-10-12')).toMatchObject({ deltaKg: 1, direction: 'up' })
  })

  it('짧은 기간(7일)에서도 양 끝 창이 겹치지 않아 변화가 0 으로 뭉개지지 않는다', () => {
    const daily = toDailyLatest([
      m('2026-10-06', 7, 70.5),
      m('2026-10-09', 7, 69.8),
      m('2026-10-12', 7, 69.0),
    ])
    const t = weightTrend(daily, '2026-10-12', 7)
    expect(t.insufficient).toBe(false)
    expect(t.deltaKg).toBe(-1.5) // 창 3일: 첫 측정값 70.5 vs 마지막 69.0
    expect(t.direction).toBe('down')
  })

  it('반올림은 출력에서 한 번만: 평균 71.33 vs 70.5 → delta -0.8 (이중 반올림이면 -0.8/-0.9 흔들림 없음)', () => {
    const items: WeightMeasurement[] = []
    for (const [d, w] of [
      ['2026-09-13', 71],
      ['2026-09-15', 71.5],
      ['2026-09-17', 71.5],
    ] as const)
      items.push(m(d, 7, w))
    for (const d of ['2026-10-08', '2026-10-10', '2026-10-12']) items.push(m(d, 7, 70.5))
    const t = weightTrend(toDailyLatest(items), '2026-10-12')
    expect(t.startValue).toBe(71.3)
    expect(t.deltaKg).toBe(-0.8)
  })

  it('기준 측정일을 돌려준다: 끝 창이 비면 endKey 는 마지막 측정일(화면이 "N일 기준" 으로 표시)', () => {
    const items: WeightMeasurement[] = []
    for (const d of ['2026-09-13', '2026-09-14', '2026-09-15']) items.push(m(d, 7, 72))
    items.push(m('2026-09-25', 7, 70))
    const t = weightTrend(toDailyLatest(items), '2026-10-12')
    expect(t).toMatchObject({
      startKey: '2026-09-19',
      endKey: '2026-09-25',
      endValue: 70,
      deltaKg: -2,
    })
  })

  it('Map 이 날짜 역순으로 들어와도(repo 가 desc 로 준 경우) 같은 결과', () => {
    const asc = toDailyLatest([
      m('2026-09-14', 7, 73),
      m('2026-09-28', 7, 72),
      m('2026-10-12', 7, 71),
    ])
    const desc = new Map([...asc.entries()].reverse())
    expect(weightTrend(desc, '2026-10-12')).toEqual(weightTrend(asc, '2026-10-12'))
  })

  it('rollingAverage 는 minCount=0 이어도 측정이 없으면 NaN 이 아니라 null', () => {
    expect(rollingAverage(new Map(), '2026-10-12', 7, 0).value).toBeNull()
  })

  it('days 가 2 미만이면 throw', () => {
    expect(() => weightTrend(new Map(), '2026-10-12', 1)).toThrow()
  })
})
