import { describe, expect, it } from 'vitest'
import { formatClockTime } from './date'
import { availabilityInstants } from './slots'
import { fromInputs, toDateInput, toTimeInput } from './authoring'
import { schoolClock, schoolDate, schoolDateKey } from './schoolTime'

// Every time in the app is school time (Baku, UTC+4): "14:00" means 14:00 in Baku on any computer, like the emails say.
describe('school time', () => {
  it('a mentor who picks 14:00-16:00 sends 10:00Z-12:00Z, and it is shown as 14:00 again', () => {
    const { startsAt, endsAt } = availabilityInstants({ date: '2026-11-20', start: '14:00', end: '16:00' })
    expect(startsAt).toBe('2026-11-20T10:00:00.000Z')
    expect(endsAt).toBe('2026-11-20T12:00:00.000Z')
    expect(formatClockTime(startsAt)).toBe('14:00')
    expect(schoolClock(new Date(startsAt))).toBe('14:00')
  })

  it('reads and writes date and time inputs the same way', () => {
    const iso = fromInputs('2026-11-20', '01:30')
    expect(iso).toBe('2026-11-19T21:30:00.000Z') // 01:30 on the 20th in Baku is still the 19th in UTC
    expect(toDateInput(iso!)).toBe('2026-11-20')
    expect(toTimeInput(iso!)).toBe('01:30')
    expect(fromInputs('2026-02-31', '10:00')).toBeNull()
  })

  it('knows the school day of a moment, and days overflow into the next month', () => {
    expect(schoolDateKey(new Date('2026-11-19T21:30:00Z'))).toBe('2026-11-20')
    expect(schoolDate(2026, 10, 31, 10, 0).toISOString()).toBe('2026-12-01T06:00:00.000Z')
  })
})
