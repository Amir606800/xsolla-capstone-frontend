import { describe, expect, it } from 'vitest'
import { buildMockModules } from '../mocks/courses'
import type { AssignmentItem, CourseModule } from '../types/course'
import { collectTasks, countTasks, filterTasks, isTaskFilter, sortTasks } from './tasks'

const now = new Date('2026-03-10T12:00:00Z')
const d = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()

function task(id: string, dueIn: number, submission?: AssignmentItem['submission']): AssignmentItem {
  return { id, moduleId: 'm1', type: 'assignment', title: id, dueAt: d(dueIn), submission }
}

const mod = (id: string, position: number, items: AssignmentItem[]): CourseModule => ({
  id,
  position,
  title: `Module ${position}`,
  items: items.map((i) => ({ ...i, moduleId: id })),
})

const modules = [
  mod('m1', 1, [
    task('graded-old', -20, { submittedAt: d(-21), gradedAt: d(-19) }),
    task('graded-new', -10, { submittedAt: d(-11), gradedAt: d(-9) }),
    task('missed', -5),
  ]),
  mod('m2', 2, [task('waiting', 1, { submittedAt: d(-1) }), task('soon', 2), task('later', 6)]),
]

describe('collectTasks', () => {
  it('lists every assignment with its module and status', () => {
    const all = collectTasks(modules, now)
    expect(all).toHaveLength(6)
    expect(all.find((e) => e.assignment.id === 'missed')).toMatchObject({ status: 'overdue' })
    expect(all.find((e) => e.assignment.id === 'soon')).toMatchObject({ status: 'open' })
    expect(all.find((e) => e.assignment.id === 'waiting')).toMatchObject({ status: 'submitted' })
    expect(all.find((e) => e.assignment.id === 'graded-new')).toMatchObject({ status: 'graded' })
    expect(all.find((e) => e.assignment.id === 'soon')?.module.id).toBe('m2')
  })

  it('ignores items that are not assignments', () => {
    const m = mod('m1', 1, [task('a', 1)])
    m.items.push({ id: 'r', moduleId: 'm1', type: 'resource', kind: 'pdf', title: 'Slides' })
    expect(collectTasks([m], now)).toHaveLength(1)
  })
})

describe('sortTasks', () => {
  it('puts overdue first, then open by soonest deadline, then finished work newest first', () => {
    const ids = sortTasks(collectTasks(modules, now)).map((e) => e.assignment.id)
    expect(ids).toEqual(['missed', 'soon', 'later', 'waiting', 'graded-new', 'graded-old'])
  })

  it('does not change the list it is given', () => {
    const list = collectTasks(modules, now)
    const copy = [...list]
    sortTasks(list)
    expect(list).toEqual(copy)
  })
})

describe('filterTasks', () => {
  const all = collectTasks(modules, now)
  const ids = (f: Parameters<typeof filterTasks>[1], m: string | null = null) =>
    filterTasks(all, f, m).map((e) => e.assignment.id)

  it('"all" keeps everything', () => expect(ids('all')).toHaveLength(6))
  it('"todo" is open work that is not yet due', () => expect(ids('todo').sort()).toEqual(['later', 'soon']))
  it('"overdue"', () => expect(ids('overdue')).toEqual(['missed']))
  it('"submitted" is work waiting for a grade', () => expect(ids('submitted')).toEqual(['waiting']))
  it('"graded"', () => expect(ids('graded').sort()).toEqual(['graded-new', 'graded-old']))

  it('narrows to one module, combined with the status', () => {
    expect(ids('all', 'm2').sort()).toEqual(['later', 'soon', 'waiting'])
    expect(ids('overdue', 'm2')).toEqual([])
  })
})

describe('countTasks', () => {
  const all = collectTasks(modules, now)

  it('counts each filter', () => {
    expect(countTasks(all, null)).toEqual({ all: 6, todo: 2, overdue: 1, submitted: 1, graded: 2 })
  })

  it('counts only the chosen module', () => {
    expect(countTasks(all, 'm2')).toEqual({ all: 3, todo: 2, overdue: 0, submitted: 1, graded: 0 })
  })

  it('the counts add up', () => {
    const c = countTasks(all, null)
    expect(c.todo + c.overdue + c.submitted + c.graded).toBe(c.all)
  })
})

describe('isTaskFilter', () => {
  it('accepts the known filters only', () => {
    expect(isTaskFilter('overdue')).toBe(true)
    expect(isTaskFilter('nope')).toBe(false)
    expect(isTaskFilter(null)).toBe(false)
  })
})

describe('with the mock course', () => {
  it('has work in every state, so every filter has something to show', () => {
    const c = countTasks(collectTasks(buildMockModules(new Date()).slice(0, 6), new Date()), null)
    expect(c.todo).toBeGreaterThan(0)
    expect(c.overdue).toBeGreaterThan(0)
    expect(c.submitted).toBeGreaterThan(0)
    expect(c.graded).toBeGreaterThan(0)
  })
})
