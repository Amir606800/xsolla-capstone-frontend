import { describe, expect, it } from 'vitest'
import type { AssignmentItem, CourseModule, Submission } from '../types/course'
import {
  moduleProgress,
  nextDeadline,
  overallStats,
  recentGrades,
  upcomingDeadlines,
} from './progress'

const NOW = new Date('2026-11-04T12:00:00Z')
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString()

function task(id: string, dueInHours: number, submission?: Submission): AssignmentItem {
  return { id, moduleId: 'm', type: 'assignment', title: id, dueAt: hours(dueInHours), submission }
}

const mod = (items: CourseModule['items'], id = 'm', title = 'Mod'): CourseModule => ({
  id,
  position: 1,
  title,
  items,
})

const submitted: Submission = { submittedAt: hours(-1) }
const graded = (gradedAt = hours(-1)): Submission => ({
  submittedAt: hours(-2),
  feedback: 'ok',
  gradedAt,
})

describe('moduleProgress', () => {
  it('an open module without assignments (a lecture week) counts as done by itself', () => {
    const p = moduleProgress(mod([{ id: 'r', moduleId: 'm', type: 'resource', title: 'x', kind: 'pdf' }]), NOW)
    expect(p).toMatchObject({ total: 0, percent: 100, status: 'completed', noTasks: true })
  })

  it('a module without assignments that has not opened yet is not done', () => {
    const later = { ...mod([]), opensAt: hours(24), closesAt: hours(200) }
    expect(moduleProgress(later, NOW)).toMatchObject({ percent: 0, status: 'not-started', noTasks: false })
  })

  it('ignores quizzes and resources in the counts', () => {
    const p = moduleProgress(
      mod([
        { id: 'q', moduleId: 'm', type: 'quiz', title: 'quiz' },
        task('a', 24),
      ]),
      NOW,
    )
    expect(p.total).toBe(1)
  })

  it('nothing submitted -> not-started', () => {
    expect(moduleProgress(mod([task('a', 24), task('b', 48)]), NOW).status).toBe('not-started')
  })

  it('partly submitted -> in-progress with rounded percent', () => {
    const p = moduleProgress(mod([task('a', 24, submitted), task('b', 48), task('c', 72)]), NOW)
    expect(p).toMatchObject({ submitted: 1, total: 3, percent: 33, status: 'in-progress' })
  })

  it('all submitted but not all graded -> submitted', () => {
    const p = moduleProgress(mod([task('a', -5, graded()), task('b', -5, submitted)]), NOW)
    expect(p).toMatchObject({ percent: 100, status: 'submitted' })
  })

  it('all graded -> completed', () => {
    const p = moduleProgress(mod([task('a', -5, graded()), task('b', -5, graded())]), NOW)
    expect(p.status).toBe('completed')
  })

  it('an unsubmitted task past its deadline -> overdue (wins over other states)', () => {
    const p = moduleProgress(mod([task('a', -5, graded()), task('b', -1)]), NOW)
    expect(p.status).toBe('overdue')
  })

  it('a submitted late task is not overdue', () => {
    expect(moduleProgress(mod([task('a', -10, submitted)]), NOW).status).toBe('submitted')
  })
})

describe('nextDeadline', () => {
  it('returns null when everything is submitted', () => {
    expect(nextDeadline(mod([task('a', 10, submitted)]), NOW)).toBeNull()
  })

  it('picks the earliest unsubmitted deadline', () => {
    const d = nextDeadline(mod([task('late', 100), task('soon', 30), task('done', 5, submitted)]), NOW)
    expect(d?.dueAt).toBe(hours(30))
  })

  it('flags deadlines within 48h (and overdue) as urgent', () => {
    expect(nextDeadline(mod([task('a', 47)]), NOW)?.urgent).toBe(true)
    expect(nextDeadline(mod([task('a', 49)]), NOW)?.urgent).toBe(false)
    expect(nextDeadline(mod([task('a', -3)]), NOW)?.urgent).toBe(true)
  })
})

describe('overallStats', () => {
  const modules = [
    mod([task('a', -5, graded()), task('b', -5, graded())], 'm1'),
    mod([task('c', 24, submitted), task('d', 48)], 'm2'),
    mod([], 'm3'),
  ]

  it('counts modules and tasks', () => {
    expect(overallStats(modules, NOW)).toEqual({
      modulesDone: 2, // m1, and m3 with nothing to hand in
      modulesTotal: 3,
      tasksSubmitted: 3,
      tasksTotal: 4,
    })
  })

  it('handles an empty course without dividing by zero', () => {
    expect(overallStats([], NOW)).toEqual({ modulesDone: 0, modulesTotal: 0, tasksSubmitted: 0, tasksTotal: 0 })
  })
})

describe('upcomingDeadlines', () => {
  const modules = [
    mod([task('far', 200), task('overdue', -10), task('done', 5, submitted)], 'm1', 'One'),
    mod([task('soon', 20)], 'm2', 'Two'),
  ]

  it('lists unsubmitted tasks soonest first, overdue flagged', () => {
    const list = upcomingDeadlines(modules, NOW, 10)
    expect(list.map((e) => e.item.id)).toEqual(['overdue', 'soon', 'far'])
    expect(list[0].overdue).toBe(true)
    expect(list[1]).toMatchObject({ overdue: false, moduleTitle: 'Two' })
  })

  it('respects the limit', () => {
    expect(upcomingDeadlines(modules, NOW, 2)).toHaveLength(2)
  })
})

describe('recentGrades', () => {
  it('returns graded work, newest grading first, limited', () => {
    const modules = [
      mod([task('old', -50, graded(hours(-48))), task('new', -5, graded(hours(-2)))]),
      mod([task('mid', -20, graded(hours(-10))), task('ungraded', 5, submitted)]),
    ]
    const list = recentGrades(modules, 2)
    expect(list.map((e) => e.item.id)).toEqual(['new', 'mid'])
    expect(list[0].gradedAt).toBe(hours(-2))
  })
})
