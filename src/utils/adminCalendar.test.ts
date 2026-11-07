import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import { eventsBetween, eventsIn, isSchoolEvent, monthRange, nextDays, ordered, postpone, rangeLabel, startInputs, weekRange } from './adminCalendar'

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
const lecture: CalendarEvent = { id: 'l1', title: 'Lecture', kind: 'lecture', startsAt: at(2026, 11, 9, 10), endsAt: at(2026, 11, 9, 12) }
const offsite: CalendarEvent = { id: 'o1', title: 'Off-site', kind: 'off-campus', startsAt: at(2026, 11, 20), endsAt: at(2026, 11, 20, 23, 59), allDay: true }

describe('admin calendar helpers', () => {
  it('only lectures, meetings and off-campus days are the admin’s to manage', () => {
    expect(isSchoolEvent(lecture)).toBe(true)
    expect(isSchoolEvent({ ...lecture, kind: 'deadline' })).toBe(false)
    expect(isSchoolEvent({ ...lecture, kind: 'availability' })).toBe(false)
  })

  it('lists a month or one day, in time order, without deadlines or 1:1 times', () => {
    const early = { ...lecture, id: 'l0', startsAt: at(2026, 11, 2, 9), endsAt: at(2026, 11, 2, 10) }
    const deadline = { ...lecture, id: 'd', kind: 'deadline' as const }
    const december = { ...lecture, id: 'l9', startsAt: at(2026, 12, 1, 10), endsAt: at(2026, 12, 1, 12) }
    const all = [offsite, lecture, deadline, december, early]
    expect(eventsIn(all, new Date(2026, 10, 1)).map((e) => e.id)).toEqual(['l0', 'l1', 'o1'])
    expect(eventsIn(all, new Date(2026, 10, 1), '2026-11-09').map((e) => e.id)).toEqual(['l1'])
    expect(eventsIn(all, new Date(2026, 11, 1)).map((e) => e.id)).toEqual(['l9'])
  })

  it('postponing keeps how long the event lasts', () => {
    const moved = postpone(lecture, '2026-11-16', '14:30')!
    expect(moved.startsAt).toBe(at(2026, 11, 16, 14, 30))
    expect(moved.endsAt).toBe(at(2026, 11, 16, 16, 30))
    expect(moved).toMatchObject({ id: 'l1', title: 'Lecture', kind: 'lecture' })
  })

  it('an all-day event moves as a whole day; bad input gives nothing', () => {
    const moved = postpone(offsite, '2026-11-27', '09:00')!
    expect(moved.startsAt).toBe(at(2026, 11, 27))
    expect(moved.endsAt).toBe(at(2026, 11, 27, 23, 59))
    expect(postpone(lecture, '', '10:00')).toBeNull()
    expect(postpone(lecture, '2026-11-16', '')).toBeNull()
  })

  it('lists the events of any range of days, both ends included', () => {
    const later = { ...lecture, id: 'l2', startsAt: at(2026, 11, 23, 10), endsAt: at(2026, 11, 23, 12) }
    const all = [later, offsite, lecture, { ...lecture, id: 'd', kind: 'deadline' as const }]
    expect(eventsBetween(all, { from: '2026-11-09', to: '2026-11-20' }).map((e) => e.id)).toEqual(['l1', 'o1'])
    expect(eventsBetween(all, { from: '2026-11-20', to: '2026-11-20' }).map((e) => e.id)).toEqual(['o1'])
    expect(eventsBetween(all, { from: '2026-11-24', to: '2026-12-31' })).toEqual([])
  })

  it('makes the quick ranges', () => {
    const thursday = new Date(2026, 10, 12, 15)
    expect(weekRange(thursday)).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(weekRange(new Date(2026, 10, 15))).toEqual({ from: '2026-11-09', to: '2026-11-15' }) // a Sunday
    expect(nextDays(thursday, 7)).toEqual({ from: '2026-11-12', to: '2026-11-18' })
    expect(monthRange(thursday)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange(new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(nextDays(new Date(2026, 11, 28), 7)).toEqual({ from: '2026-12-28', to: '2027-01-03' })
  })

  it('orders the ends of a range and labels it', () => {
    expect(ordered('2026-11-20', '2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-20' })
    expect(rangeLabel({ from: '2026-11-09', to: '2026-11-22' })).toBe('Nov 9 – Nov 22')
    expect(rangeLabel({ from: '2026-12-28', to: '2027-01-03' })).toBe('Dec 28, 2026 – Jan 3, 2027')
  })

  it('gives the inputs for a start moved by some days', () => {
    expect(startInputs(lecture)).toEqual({ date: '2026-11-09', time: '10:00' })
    expect(startInputs(lecture, 7)).toEqual({ date: '2026-11-16', time: '10:00' })
    // across a month end
    expect(startInputs({ ...lecture, startsAt: at(2026, 11, 30, 10) }, 1)).toEqual({ date: '2026-12-01', time: '10:00' })
  })
})
