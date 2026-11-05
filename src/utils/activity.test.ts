import { describe, expect, it } from 'vitest'
import type { CourseModule } from '../types/course'
import { nextAssignment, recentActivity } from './progress'

const now = new Date('2026-03-10T12:00:00Z')
const d = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()

const mod = (over: Partial<CourseModule> = {}): CourseModule => ({
  id: 'm1',
  position: 1,
  title: 'Go Basics',
  opensAt: d(-10),
  closesAt: d(-3),
  items: [],
  ...over,
})

const task = (id: string, due: number, submitted = false) =>
  ({
    id,
    moduleId: 'm1',
    type: 'assignment',
    title: id,
    dueAt: d(due),
    submission: submitted ? { submittedAt: d(-1) } : undefined,
  }) as const

describe('recentActivity', () => {
  it('lists submissions, grades and opened modules, newest first', () => {
    const m = mod({
      items: [
        {
          id: 'a1',
          moduleId: 'm1',
          type: 'assignment',
          title: 'Hello world',
          dueAt: d(-4),
          submission: { submittedAt: d(-5), feedback: 'Nice', gradedAt: d(-2) },
        },
      ],
    })
    const out = recentActivity([m], now, 10)
    expect(out.map((e) => e.id)).toEqual(['graded:a1', 'submitted:a1', 'opened:m1'])
    expect(out[0]).toMatchObject({ kind: 'graded', title: 'Hello world' })
    expect(out[2]).toMatchObject({ kind: 'opened', title: 'Module 1 opened' })
  })

  it('ignores modules that have not opened yet', () => {
    expect(recentActivity([mod({ opensAt: d(3) })], now, 10)).toEqual([])
  })

  it('does not report a submission without a grade as graded', () => {
    const m = mod({ opensAt: undefined, items: [task('a1', 1, true)] })
    expect(recentActivity([m], now, 10).map((e) => e.kind)).toEqual(['submitted'])
  })

  it('respects the limit', () => {
    const modules = [1, 2, 3].map((n) => mod({ id: `m${n}`, position: n, opensAt: d(-n) }))
    expect(recentActivity(modules, now, 2)).toHaveLength(2)
  })
})

describe('nextAssignment', () => {
  it('is the earliest task that is not submitted', () => {
    expect(nextAssignment(mod({ items: [task('late', 5), task('done', 1, true), task('soon', 2)] }))?.id).toBe('soon')
  })

  it('is null when everything is submitted', () => {
    expect(nextAssignment(mod({ items: [task('done', 1, true)] }))).toBeNull()
  })
})
