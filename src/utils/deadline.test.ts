import { describe, expect, it } from 'vitest'
import type { AssignmentItem, CourseModule } from '../types/course'
import { dueLookup, oneOnOneWeek, studentDeadline, weekDeadlineText, withoutTaskDeadlines } from './deadline'
// the server's side of it (the app only shows what the server sends): kept as the fake backend of the tests
import { isLateHandIn, withStudentDeadlines } from '../test/fixtures/studentDeadlines'

// the week opens Monday 16 Nov 2026 (school time, UTC+4): its 1:1s are Friday 20 and Monday 23 Nov
const OPENS = '2026-11-15T20:00:00Z'
const FRI_8 = '2026-11-20T04:00:00.000Z'
const MON_8 = '2026-11-23T04:00:00.000Z'

describe('the 1:1 weekend of a week', () => {
  it('runs from the first Friday on or after the week opens to the Tuesday after; work is due at 08:00', () => {
    expect(oneOnOneWeek(OPENS)).toEqual({
      from: '2026-11-19T20:00:00.000Z',
      to: '2026-11-23T20:00:00.000Z',
      friday: FRI_8,
      monday: MON_8,
    })
    // a week that opens on the Friday itself
    expect(oneOnOneWeek('2026-11-19T20:00:00Z').friday).toBe(FRI_8)
    expect(weekDeadlineText({ opensAt: OPENS })).toBe('Fri 20 Nov or Mon 23 Nov, 08:00')
  })
})

describe("a student's deadline follows their 1:1", () => {
  it('a Friday 1:1: Friday 08:00; a Monday 1:1: Monday 08:00', () => {
    expect(studentDeadline(OPENS, ['2026-11-20T11:00:00Z'])).toEqual({ dueAt: FRI_8, dueFrom: 'one_on_one' })
    expect(studentDeadline(OPENS, ['2026-11-23T10:30:00Z'])).toEqual({ dueAt: MON_8, dueFrom: 'one_on_one' })
  })

  it('no 1:1 booked (or one in another week): Monday 08:00, so nobody is late only because they did not book', () => {
    expect(studentDeadline(OPENS, [])).toEqual({ dueAt: MON_8, dueFrom: 'no_one_on_one' })
    expect(studentDeadline(OPENS, ['2026-11-27T11:00:00Z'])).toEqual({ dueAt: MON_8, dueFrom: 'no_one_on_one' })
  })

  it('several in the weekend: the earliest counts', () => {
    expect(studentDeadline(OPENS, ['2026-11-23T10:30:00Z', '2026-11-20T11:00:00Z']).dueAt).toBe(FRI_8)
  })

  it('late = handed in after the deadline', () => {
    expect(isLateHandIn({ submittedAt: '2026-11-20T03:59:00Z' }, FRI_8)).toBe(false)
    expect(isLateHandIn({ submittedAt: '2026-11-20T04:01:00Z' }, FRI_8)).toBe(true)
    expect(isLateHandIn(undefined, FRI_8)).toBe(false)
  })
})

describe('the course as each person sees it', () => {
  const week: CourseModule = {
    id: 'm6',
    position: 6,
    title: 'Go',
    opensAt: OPENS,
    // the closing date plays no part in the deadline
    closesAt: '2026-11-22T19:59:00Z',
    items: [
      {
        id: 't1',
        moduleId: 'm6',
        type: 'assignment',
        title: 'CLI',
        dueAt: '2026-11-18T14:00:00Z',
        submission: { submittedAt: '2026-11-21T09:00:00Z' },
      },
      { id: 't2', moduleId: 'm6', type: 'assignment', title: 'API' },
    ],
  }
  const tasks = (m: CourseModule) => m.items as AssignmentItem[]

  it('a student: their own deadline on every task (not the stored date), and whether each hand-in was late', () => {
    const [m] = withStudentDeadlines([week], ['2026-11-20T11:00:00Z'])
    expect(tasks(m).map((t) => [t.dueAt, t.dueFrom, t.submission?.late])).toEqual([
      [FRI_8, 'one_on_one', true],
      [FRI_8, 'one_on_one', undefined],
    ])
    // without a 1:1 the same hand-in is in time (Monday 08:00)
    const [none] = withStudentDeadlines([week], [])
    expect(tasks(none)[0].submission?.late).toBe(false)
  })

  it("keeps the server's own deadline and late flag when it sent them", () => {
    const fromServer: CourseModule = {
      ...week,
      items: [
        {
          id: 't1',
          moduleId: 'm6',
          type: 'assignment',
          title: 'CLI',
          dueAt: MON_8,
          dueFrom: 'no_one_on_one',
          submission: { submittedAt: '2026-11-24T09:00:00Z', late: false },
        },
      ],
    }
    const [m] = withStudentDeadlines([fromServer], ['2026-11-20T11:00:00Z'])
    expect(m.items[0]).toMatchObject({ dueAt: MON_8, dueFrom: 'no_one_on_one', submission: { late: false } })
  })

  it("staff: tasks have no deadline of their own; a mentor sees each student's by the 1:1 they booked", () => {
    const [m] = withoutTaskDeadlines([week])
    expect(m.items.every((i) => !('dueAt' in i))).toBe(true)
    const task = tasks(m)[0]
    expect(dueLookup([week], [{ startsAt: '2026-11-23T10:30:00Z', bookedBy: { id: 7 } }])(task, 7)).toBe(MON_8)
    expect(dueLookup([week], [{ startsAt: '2026-11-20T11:00:00Z', bookedBy: { id: 7 } }])(task, 7)).toBe(FRI_8)
    expect(dueLookup([week], [{ startsAt: '2026-11-20T11:00:00Z', bookedBy: { id: 7 } }])(task, 8)).toBe(MON_8)
  })
})
