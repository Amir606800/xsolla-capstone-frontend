import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import {
  GRID_DAYS,
  addMonths,
  dateKey,
  deadlineEvents,
  formatClock,
  formatEventTime,
  fullDateLabel,
  groupByDay,
  monthGrid,
  monthLabel,
  startOfMonth,
} from './calendar'

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

const ev = (over: Partial<CalendarEvent> & { id: string }): CalendarEvent => ({
  title: 'Event',
  kind: 'meeting',
  startsAt: at(2026, 11, 12, 15),
  endsAt: at(2026, 11, 12, 16),
  ...over,
})

describe('dateKey / month helpers', () => {
  it('uses the LOCAL day, so late-evening events stay on their day', () => {
    expect(dateKey(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05')
    expect(dateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })

  it('startOfMonth and addMonths move by whole months, across years', () => {
    expect(dateKey(startOfMonth(new Date(2026, 10, 19)))).toBe('2026-11-01')
    expect(dateKey(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-01')
    expect(dateKey(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-01')
    // 31st + 1 month must not overflow into the month after
    expect(dateKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
  })

  it('formats labels', () => {
    expect(monthLabel(new Date(2026, 10, 1))).toBe('November 2026')
    expect(fullDateLabel(new Date(2026, 10, 12))).toBe('Thursday, November 12')
  })
})

describe('monthGrid', () => {
  it('always has 42 consecutive days', () => {
    for (const m of [new Date(2026, 1, 1), new Date(2026, 10, 1), new Date(2028, 1, 1)]) {
      const days = monthGrid(m)
      expect(days).toHaveLength(GRID_DAYS)
      for (let i = 1; i < days.length; i++) {
        const diff = Math.round((days[i].getTime() - days[i - 1].getTime()) / 86_400_000)
        expect(diff).toBe(1) // no gaps / duplicates, DST-safe
      }
    }
  })

  it('starts on the Monday on or before the 1st (Nov 2026 starts on a Sunday)', () => {
    const days = monthGrid(new Date(2026, 10, 1))
    expect(dateKey(days[0])).toBe('2026-10-26')
    expect(days[0].getDay()).toBe(1)
    expect(dateKey(days[41])).toBe('2026-12-06')
  })

  it('starts on the 1st itself when it is a Monday (Jun 2026)', () => {
    expect(dateKey(monthGrid(new Date(2026, 5, 1))[0])).toBe('2026-06-01')
  })

  it('contains every day of the month', () => {
    const keys = new Set(monthGrid(new Date(2026, 10, 1)).map(dateKey))
    for (let d = 1; d <= 30; d++) expect(keys.has(`2026-11-${String(d).padStart(2, '0')}`)).toBe(true)
  })
})

describe('time formatting', () => {
  it('formats 24-hour clock times', () => {
    expect(formatClock(at(2026, 11, 12, 9, 5))).toBe('09:05')
    expect(formatClock(at(2026, 11, 12, 23, 30))).toBe('23:30')
  })

  it('describes all-day, point-in-time and ranged events', () => {
    expect(formatEventTime(ev({ id: 'a', allDay: true }))).toBe('All day')
    expect(
      formatEventTime(ev({ id: 'b', startsAt: at(2026, 11, 12, 15), endsAt: at(2026, 11, 12, 15) })),
    ).toBe('15:00')
    expect(
      formatEventTime(ev({ id: 'c', startsAt: at(2026, 11, 12, 15), endsAt: at(2026, 11, 12, 15, 30) })),
    ).toBe('15:00 - 15:30')
  })
})

describe('groupByDay', () => {
  it('groups by local day and sorts all-day first, then by time, then title', () => {
    const grouped = groupByDay([
      ev({ id: 'late', title: 'B', startsAt: at(2026, 11, 12, 18), endsAt: at(2026, 11, 12, 19) }),
      ev({ id: 'early', title: 'A', startsAt: at(2026, 11, 12, 9), endsAt: at(2026, 11, 12, 10) }),
      ev({ id: 'allday', title: 'Z', allDay: true, startsAt: at(2026, 11, 12, 0), endsAt: at(2026, 11, 12, 23, 59) }),
      ev({ id: 'tie-b', title: 'Beta', startsAt: at(2026, 11, 12, 12), endsAt: at(2026, 11, 12, 13) }),
      ev({ id: 'tie-a', title: 'Alpha', startsAt: at(2026, 11, 12, 12), endsAt: at(2026, 11, 12, 13) }),
      ev({ id: 'other', startsAt: at(2026, 11, 13, 9), endsAt: at(2026, 11, 13, 10) }),
    ])
    expect(Object.keys(grouped).sort()).toEqual(['2026-11-12', '2026-11-13'])
    expect(grouped['2026-11-12'].map((e) => e.id)).toEqual(['allday', 'early', 'tie-a', 'tie-b', 'late'])
    expect(grouped['2026-11-13']).toHaveLength(1)
  })

  it('puts a 23:30 event on its own day, not the next', () => {
    const grouped = groupByDay([ev({ id: 'x', startsAt: at(2026, 11, 12, 23, 30), endsAt: at(2026, 11, 12, 23, 45) })])
    expect(Object.keys(grouped)).toEqual(['2026-11-12'])
  })

  it('returns an empty object for no events', () => {
    expect(groupByDay([])).toEqual({})
  })
})

describe('deadlineEvents', () => {
  const modules: CourseModule[] = [
    {
      id: 'm1',
      position: 1,
      title: 'One',
      items: [
        { id: 'r', moduleId: 'm1', type: 'resource', title: 'slides', kind: 'pdf' },
        {
          id: 'a1',
          moduleId: 'm1',
          type: 'assignment',
          title: 'Git',
          dueAt: at(2026, 11, 20, 18),
          maxPoints: 100,
          submission: { submittedAt: at(2026, 11, 19) },
        },
        { id: 'a2', moduleId: 'm1', type: 'assignment', title: 'Repo', dueAt: at(2026, 11, 22, 18), maxPoints: 50 },
      ],
    },
    { id: 'm2', position: 2, title: 'Two', items: [] },
  ]

  it('turns each assignment (and only assignments) into a deadline event', () => {
    const events = deadlineEvents(modules)
    expect(events.map((e) => e.id)).toEqual(['deadline-a1', 'deadline-a2'])
    expect(events[0]).toMatchObject({
      title: 'Due: Git',
      kind: 'deadline',
      moduleId: 'm1',
      startsAt: at(2026, 11, 20, 18),
      endsAt: at(2026, 11, 20, 18),
    })
  })

  it('marks submitted work as done', () => {
    const [done, open] = deadlineEvents(modules)
    expect(done.done).toBe(true)
    expect(open.done).toBe(false)
  })
})
