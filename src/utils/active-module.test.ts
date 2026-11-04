import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import { formatDuration } from './calendar'
import { formatClockTime } from './date'
import { isActiveModule } from './progress'

const d = (day: number, h = 0, m = 0) => new Date(2026, 10, day, h, m)
const mod = (opensAt?: Date, closesAt?: Date): CourseModule => ({
  id: 'm',
  position: 1,
  title: 'T',
  opensAt: opensAt?.toISOString(),
  closesAt: closesAt?.toISOString(),
  items: [],
})

describe('isActiveModule', () => {
  const m = mod(d(4), d(10, 23, 59))

  it('is true while now is inside the opening..closing window (inclusive)', () => {
    expect(isActiveModule(m, d(4))).toBe(true)
    expect(isActiveModule(m, d(7, 12))).toBe(true)
    expect(isActiveModule(m, d(10, 23, 59))).toBe(true)
  })

  it('is false before it opens and after it closes', () => {
    expect(isActiveModule(m, d(3, 23, 59))).toBe(false)
    expect(isActiveModule(m, d(11, 0, 1))).toBe(false)
  })

  it('is false when the window is unknown', () => {
    expect(isActiveModule(mod(d(4), undefined), d(5))).toBe(false)
    expect(isActiveModule(mod(undefined, d(10)), d(5))).toBe(false)
    expect(isActiveModule(mod(), d(5))).toBe(false)
  })
})

describe('formatClockTime', () => {
  it('formats a 24-hour clock time', () => {
    expect(formatClockTime(d(8, 18, 0).toISOString())).toBe('18:00')
    expect(formatClockTime(d(8, 9, 5).toISOString())).toBe('09:05')
  })
})

describe('formatDuration', () => {
  const ev = (start: Date, end: Date, allDay = false): CalendarEvent => ({
    id: 'e',
    title: 'E',
    kind: 'meeting',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    allDay,
  })

  it.each([
    [d(5, 15), d(5, 15, 30), '30 min'],
    [d(5, 10), d(5, 12), '2 h'],
    [d(5, 10), d(5, 11, 30), '1 h 30 min'],
    [d(5, 10), d(5, 10, 5), '5 min'],
  ])('%s -> %s', (start, end, expected) => {
    expect(formatDuration(ev(start, end))).toBe(expected)
  })

  it('is empty for all-day and zero-length events', () => {
    expect(formatDuration(ev(d(5), d(5, 23, 59), true))).toBe('')
    expect(formatDuration(ev(d(5, 18), d(5, 18)))).toBe('')
  })
})
