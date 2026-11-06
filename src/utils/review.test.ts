import { describe, expect, it } from 'vitest'
import type { AssignmentItem, CourseModule } from '../types/course'
import type { TeamSubmission } from '../types/review'
import type { StandingLevel, WeeklyStanding } from '../types/standing'
import {
  defaultWeek,
  gradesDue,
  gradeWarning,
  handedIn,
  indexStandings,
  indexSubmissions,
  newWork,
  taskRows,
  ungradedCount,
  weekPhase,
  workRow,
} from './review'

const NOW = new Date(2026, 10, 10, 12)
const task = (id: string, due: string): AssignmentItem => ({ id, moduleId: id.split('-')[0], type: 'assignment', title: id, dueAt: due })
const week = (id: string, position: number, tasks: AssignmentItem[], open: [string, string]): CourseModule => ({
  id,
  position,
  title: id,
  items: tasks,
  opensAt: open[0],
  closesAt: open[1],
})
const ann = { id: 1, name: 'Ann', email: 'a@x' }
const bob = { id: 2, name: 'Bob', email: 'b@x' }
const sub = (assignmentId: string, studentId: number, patch: Partial<TeamSubmission> = {}): TeamSubmission => ({
  assignmentId,
  studentId,
  submittedAt: '2026-11-05T10:00:00.000Z',
  ...patch,
})

const t1 = task('w1-a1', '2026-11-06T18:00:00.000Z')
const t2 = task('w2-a1', '2026-11-20T18:00:00.000Z')
const w1 = week('w1', 1, [t1], ['2026-11-02T00:00:00.000Z', '2026-11-08T23:59:00.000Z']) // finished
const w2 = week('w2', 2, [t2], ['2026-11-09T00:00:00.000Z', '2026-11-15T23:59:00.000Z']) // running
const w3 = week('w3', 3, [], ['2026-11-16T00:00:00.000Z', '2026-11-22T23:59:00.000Z']) // upcoming

describe('tasks: no grade, only work and comments', () => {
  it('new, commented, missing after the deadline, not yet before it', () => {
    const idx = indexSubmissions([sub('w1-a1', 1), sub('w2-a1', 1, { feedback: 'ok' })])
    expect(workRow(t1, ann, idx, NOW).status).toBe('new')
    expect(workRow(t2, ann, idx, NOW).status).toBe('commented')
    expect(workRow(t1, bob, idx, NOW).status).toBe('missing')
    expect(workRow(t2, bob, idx, NOW).status).toBe('not-yet')
  })

  it('flags late work, and lists new work first', () => {
    const idx = indexSubmissions([sub('w1-a1', 2, { submittedAt: '2026-11-06T19:00:00.000Z' })])
    const rows = taskRows(t1, [ann, bob], idx, NOW)
    expect(rows.map((r) => [r.student.name, r.status, r.late])).toEqual([
      ['Bob', 'new', true],
      ['Ann', 'missing', false],
    ])
  })

  it('counts hand-ins per student and new work across weeks', () => {
    const list = [sub('w1-a1', 1), sub('w2-a1', 2, { feedback: 'seen' })]
    expect(handedIn(w1, ann, indexSubmissions(list))).toEqual({ done: 1, total: 1 })
    expect(newWork([w1, w2], [ann, bob], list, NOW).map((w) => w.student.name)).toEqual(['Ann'])
  })
})

describe('week grades', () => {
  const graded = (studentId: number, w: number, level: StandingLevel = 'green') => ({ studentId, week: w, level, assessedAt: '' })

  it('knows which weeks are finished, running or not started', () => {
    expect([weekPhase(w1, NOW), weekPhase(w2, NOW), weekPhase(w3, NOW)]).toEqual(['finished', 'running', 'upcoming'])
  })

  it('owes a grade for every student of every finished week without one', () => {
    const idx = indexStandings([graded(1, 1)])
    expect(gradesDue([w2, w1, w3], [ann, bob], idx, NOW).map((d) => [d.student.name, d.module.id])).toEqual([['Bob', 'w1']])
    expect(ungradedCount(w2, [ann, bob], idx, NOW)).toBe(2)
    expect(ungradedCount(w3, [ann, bob], idx, NOW)).toBe(0) // not started: nothing to grade
  })

  it('opens on the oldest week with grades to give, otherwise the running week', () => {
    expect(defaultWeek([w2, w1], [ann], indexStandings([]), NOW)?.id).toBe('w1')
    expect(defaultWeek([w1, w2], [ann], indexStandings([graded(1, 1)]), NOW)?.id).toBe('w2')
  })

  describe('rule warnings', () => {
    const weeks = (...levels: StandingLevel[]): WeeklyStanding[] => levels.map((level, i) => ({ week: i + 1, level, assessedAt: '' }))

    it('a 4th yellow week in a row counts as red', () => {
      expect(gradeWarning(weeks('yellow', 'yellow', 'yellow'), 4, 'yellow')).toMatch(/4th yellow week in a row/)
    })

    it('warns one week before that', () => {
      expect(gradeWarning(weeks('yellow', 'yellow'), 3, 'yellow')).toMatch(/One more counts as red/)
    })

    it('a 2nd red week in a row means removal', () => {
      expect(gradeWarning(weeks('green', 'red'), 3, 'red')).toMatch(/removed/)
    })

    it('nothing to say otherwise, and later weeks do not count', () => {
      expect(gradeWarning(weeks('green', 'yellow'), 3, 'green')).toBeNull()
      expect(gradeWarning(weeks('red', 'red', 'red'), 1, 'green')).toBeNull()
    })
  })
})
