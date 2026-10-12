import { describe, expect, it } from 'vitest'
import { addDays, diffDays, kstDateKey, todayKst } from '@/lib/date'

describe('date (KST)', () => {
  it('kstDateKey: UTC 15시 이후는 KST 다음 날', () => {
    expect(kstDateKey('2026-10-12T14:59:59Z')).toBe('2026-10-12')
    expect(kstDateKey('2026-10-12T15:00:00Z')).toBe('2026-10-13')
    expect(kstDateKey(Date.UTC(2026, 9, 12, 15))).toBe('2026-10-13')
  })

  it('kstDateKey: 잘못된 입력은 throw', () => {
    expect(() => kstDateKey('not a date')).toThrow()
  })

  it('addDays / diffDays: 월·연 경계', () => {
    expect(addDays('2026-10-12', -11)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-09-13', '2026-10-12')).toBe(29)
  })

  it('오프셋 없는 문자열(datetime-local)은 실행 환경이 아니라 KST 로 해석한다', () => {
    expect(kstDateKey('2026-10-12T23:30')).toBe('2026-10-12')
    expect(kstDateKey('2026-10-12T23:30:00')).toBe('2026-10-12')
    expect(kstDateKey('2026-10-12')).toBe('2026-10-12')
  })

  it('윤년과 존재하지 않는 날짜', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(() => addDays('2026-13-01', 1)).toThrow()
    expect(() => addDays('2026-02-30', 1)).toThrow()
    expect(() => diffDays('oops', '2026-10-12')).toThrow()
  })

  it('todayKst: now 주입', () => {
    expect(todayKst(() => Date.UTC(2026, 9, 12, 20))).toBe('2026-10-13')
  })
})
