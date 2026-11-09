import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import { weekSummary } from './adminWeek'

// Wed 4 Nov 2026, 12:00 (local)
const NOW = new Date(2026, 10, 4, 12, 0)
const at = (day: number, h = 0, m = 0) => new Date(2026, 10, day, h, m).toISOString()

const week = (n: number, from: number, extra: Partial<CourseModule> = {}): CourseModule => ({
  id: `m${n}`,
  position: n,
  title: `Week ${n} topic`,
  opensAt: at(from),
  closesAt: at(from + 6, 23, 59),
  items: [],
  ...extra,
})

const event = (id: string, day: number, over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: 'Lecture',
  kind: 'lecture',
  startsAt: at(day, 10),
  endsAt: at(day, 12),
  ...over,
})

describe('the week on the admin overview', () => {
  it('is the module whose window holds today, with its lecturer, day count, events and tasks', () => {
    const m = week(6, 2, {
      createdBy: 902,
      items: [
        { id: 't2', moduleId: 'm6', type: 'assignment', title: 'HTTP server', dueAt: at(8, 18) },
        { id: 't1', moduleId: 'm6', type: 'assignment', title: 'CLI tool', dueAt: at(5, 18) },
        { id: 'r1', moduleId: 'm6', type: 'resource', title: 'Slides', kind: 'pdf' },
        { id: 'q1', moduleId: 'm6', type: 'quiz', title: 'Quiz' },
      ],
    })
    const s = weekSummary([week(5, -5), m, week(7, 9)], [event('l2', 9), event('l1', 2), event('far', 20)], NOW)
    expect(s.state).toBe('current')
    expect(s.module?.id).toBe('m6')
    expect(s.lecturerId).toBe(902)
    expect(s.day).toEqual({ number: 3, of: 7 })
    expect(s.events.map((e) => e.id)).toEqual(['l1']) // Nov 2, inside the week; Nov 9 and 20 are outside
    expect(s.tasks.map((t) => t.title)).toEqual(['CLI tool', 'HTTP server']) // by deadline
    expect([s.resources, s.quizzes]).toEqual([1, 1])
  })

  it('only counts school events, and an event of the module counts even outside its dates', () => {
    const s = weekSummary(
      [week(6, 2)],
      [
        event('meet', 3, { kind: 'meeting', title: 'Team sync' }),
        event('deadline', 3, { kind: 'deadline' }),
        event('slot', 3, { kind: 'availability' }),
        event('late', 12, { moduleId: 'm6', title: 'Extra lecture' }),
      ],
      NOW,
    )
    expect(s.events.map((e) => e.id)).toEqual(['meet', 'late'])
  })

  it('has no lecturer when none is set', () => {
    expect(weekSummary([week(6, 2)], [], NOW).lecturerId).toBeUndefined()
  })

  it('between weeks it is the one that opens next; after the program, the last one', () => {
    expect(weekSummary([week(5, -20), week(6, 10), week(7, 17)], [], NOW)).toMatchObject({ state: 'next', module: { id: 'm6' } })
    const done = weekSummary([week(5, -20), week(6, -13)], [], NOW)
    expect(done).toMatchObject({ state: 'last', module: { id: 'm6' } })
    expect(done.day).toBeUndefined()
  })

  it('without week dates (the server sends none yet) the week cannot be told', () => {
    const undated = { id: 'm1', position: 1, title: 'Intro', items: [] }
    expect(weekSummary([undated], [event('l', 3)], NOW)).toMatchObject({ state: 'undated', events: [] })
    expect(weekSummary([], [], NOW).state).toBe('none')
  })

  it('the last day of the week is day 7 of 7', () => {
    expect(weekSummary([week(6, -2)], [], new Date(2026, 10, 4, 23, 0)).day).toEqual({ number: 7, of: 7 })
  })
})
