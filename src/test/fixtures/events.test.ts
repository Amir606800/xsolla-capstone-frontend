import { describe, expect, it } from 'vitest'
import { groupByDay } from '../utils/calendar'
import { buildMockEvents } from './events'

const NOW = new Date(2026, 10, 4, 12) // Wed 4 Nov 2026

describe('buildMockEvents', () => {
  const events = buildMockEvents(NOW)

  it('is sparse: a handful of events, never more than one per day', () => {
    expect(events.length).toBeLessThanOrEqual(16)
    const perDay = Object.values(groupByDay(events)).map((l) => l.length)
    expect(Math.max(...perDay)).toBeLessThanOrEqual(1)
  })

  it('has one lecture per week on Monday 10:00-12:00', () => {
    const lectures = events.filter((e) => e.kind === 'lecture')
    expect(lectures).toHaveLength(7)
    for (const l of lectures) {
      const start = new Date(l.startsAt)
      expect(start.getDay()).toBe(1)
      expect(start.getHours()).toBe(10)
      expect(new Date(l.endsAt).getHours()).toBe(12)
    }
  })

  it('has no mentor 1:1s: those come from the bookable slots', () => {
    expect(events.some((e) => e.title.includes('1:1'))).toBe(false)
  })

  it('has exactly one all-day off-campus day and one team sync', () => {
    expect(events.filter((e) => e.kind === 'off-campus')).toHaveLength(1)
    expect(events.find((e) => e.kind === 'off-campus')?.allDay).toBe(true)
    expect(events.filter((e) => e.title === 'Team sync')).toHaveLength(1)
  })

  it('ends are never before starts and ids are unique', () => {
    for (const e of events) expect(e.endsAt >= e.startsAt).toBe(true)
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length)
  })
})
