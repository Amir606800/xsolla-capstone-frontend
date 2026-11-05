import { describe, expect, it } from 'vitest'
import type { AssignmentItem, CourseModule } from '../types/course'
import { assignmentStatus, assignmentsOf, moduleWindow, resourcesOf } from './progress'

const NOW = new Date('2026-11-04T12:00:00Z')
const h = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString()

const task = (id: string, dueIn: number, submission?: AssignmentItem['submission']): AssignmentItem => ({
  id,
  moduleId: 'm',
  type: 'assignment',
  title: id,
  dueAt: h(dueIn),
  submission,
})

describe('assignmentStatus', () => {
  it('open before the deadline', () => {
    expect(assignmentStatus(task('a', 5), NOW)).toBe('open')
  })
  it('overdue after the deadline without a submission', () => {
    expect(assignmentStatus(task('a', -5), NOW)).toBe('overdue')
  })
  it('submitted wins over overdue (late work is still submitted)', () => {
    expect(assignmentStatus(task('a', -5, { submittedAt: h(-1) }), NOW)).toBe('submitted')
  })
  it('graded once the lecturer has graded it', () => {
    expect(assignmentStatus(task('a', -5, { submittedAt: h(-3), feedback: 'ok', gradedAt: h(-1) }), NOW)).toBe('graded')
  })
})

describe('moduleWindow', () => {
  const base: CourseModule = {
    id: 'm',
    position: 1,
    title: 'T',
    items: [task('early', 10), task('late', 100)],
  }

  it('uses explicit module dates when present', () => {
    expect(moduleWindow({ ...base, opensAt: h(-5), closesAt: h(50) })).toEqual({ opensAt: h(-5), dueAt: h(50) })
  })

  it('falls back to the latest assignment deadline', () => {
    expect(moduleWindow(base)).toEqual({ opensAt: undefined, dueAt: h(100) })
  })

  it('has no due date for a module without assignments', () => {
    expect(moduleWindow({ ...base, items: [] }).dueAt).toBeUndefined()
  })
})

describe('item filters', () => {
  const items: CourseModule['items'] = [
    { id: 'r', moduleId: 'm', type: 'resource', title: 'r', kind: 'pdf' },
    { id: 'q', moduleId: 'm', type: 'quiz', title: 'q' },
    task('a', 5),
  ]
  const m: CourseModule = { id: 'm', position: 1, title: 'T', items }

  it('splits resources and assignments, ignoring quizzes', () => {
    expect(resourcesOf(m).map((i) => i.id)).toEqual(['r'])
    expect(assignmentsOf(m).map((i) => i.id)).toEqual(['a'])
  })
})
