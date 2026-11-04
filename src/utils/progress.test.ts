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

function task(
  id: string,
  dueInHours: number,
  submission?: Submission,
  maxPoints = 100,
): AssignmentItem {
  return { id, moduleId: 'm', type: 'assignment', title: id, dueAt: hours(dueInHours), maxPoints, submission }
}

const mod = (items: CourseModule['items'], id = 'm', title = 'Mod'): CourseModule => ({
  id,
  position: 1,
  title,
  items,
})

const submitted: Submission = { submittedAt: hours(-1) }
const graded = (grade: number, gradedAt = hours(-1)): Submission => ({
  submittedAt: hours(-2),
  grade,
  gradedAt,
})

describe('moduleProgress', () => {
  it('module without assignments is not started with 0%', () => {
    const p = moduleProgress(mod([{ id: 'r', moduleId: 'm', type: 'resource', title: 'x', kind: 'pdf' }]), NOW)
    expect(p).toMatchObject({ total: 0, percent: 0, status: 'not-started' })
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
    const p = moduleProgress(mod([task('a', -5, graded(90)), task('b', -5, submitted)]), NOW)
    expect(p).toMatchObject({ percent: 100, status: 'submitted' })
  })

  it('all graded -> completed', () => {
    const p = moduleProgress(mod([task('a', -5, graded(90)), task('b', -5, graded(80))]), NOW)
    expect(p.status).toBe('completed')
  })

  it('an unsubmitted task past its deadline -> overdue (wins over other states)', () => {
    const p = moduleProgress(mod([task('a', -5, graded(90)), task('b', -1)]), NOW)
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
    mod([task('a', -5, graded(80)), task('b', -5, graded(60))], 'm1'),
    mod([task('c', 24, submitted), task('d', 48)], 'm2'),
    mod([], 'm3'),
  ]

  it('counts modules, tasks and score', () => {
    expect(overallStats(modules, NOW)).toEqual({
      modulesDone: 1,
      modulesTotal: 3,
      tasksSubmitted: 3,
      tasksTotal: 4,
      scoreEarned: 140,
      scoreMax: 200,
      scorePercent: 70,
    })
  })

  it('score only counts graded work, relative to its own max points', () => {
    const s = overallStats([mod([task('a', -5, graded(40), 50), task('b', 10)])], NOW)
    expect(s).toMatchObject({ scoreEarned: 40, scoreMax: 50, scorePercent: 80 })
  })

  it('handles an empty course without dividing by zero', () => {
    expect(overallStats([], NOW)).toMatchObject({ scorePercent: 0, tasksTotal: 0, modulesTotal: 0 })
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
      mod([task('old', -50, graded(70, hours(-48))), task('new', -5, graded(95, hours(-2)))]),
      mod([task('mid', -20, graded(88, hours(-10))), task('ungraded', 5, submitted)]),
    ]
    const list = recentGrades(modules, 2)
    expect(list.map((e) => e.item.id)).toEqual(['new', 'mid'])
    expect(list[0].grade).toBe(95)
  })
})
