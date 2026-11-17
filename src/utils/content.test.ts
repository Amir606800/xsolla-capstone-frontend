import { describe, expect, it } from 'vitest'
import { buildMockModules } from '../test/fixtures/courses'
import type { CourseModule } from '../types/course'
import { contentCounts, contentGaps, modulePhase, nextDueTasks, quizzesOf, tasksOf } from './content'

const NOW = new Date(2026, 10, 4, 12, 0)
const modules = buildMockModules(NOW)
const m = (id: string) => modules.find((x) => x.id === id)!

describe('modulePhase', () => {
  it('finished, running now and upcoming', () => {
    expect(modulePhase(m('m1'), NOW)).toBe('done')
    expect(modulePhase(m('m6'), NOW)).toBe('running')
    expect(modulePhase(m('m7'), NOW)).toBe('upcoming')
  })
  it('a module without dates counts as running', () => {
    expect(modulePhase({ ...m('m1'), opensAt: undefined, closesAt: undefined }, NOW)).toBe('running')
  })
})

describe('contentCounts / lists', () => {
  it('counts each kind', () => {
    expect(contentCounts(m('m6'))).toEqual({ materials: 2, tasks: 2, quizzes: 0 })
  })
  it('lists the tasks and quizzes', () => {
    expect(tasksOf(m('m3')).length).toBeGreaterThan(0)
    expect(quizzesOf(m('m3'))).toEqual([])
  })
})

describe('contentGaps', () => {
  it('the demo course is complete', () => {
    expect(contentGaps(modules, NOW)).toEqual([])
  })

  it('flags missing tasks, materials and dates', () => {
    const m7 = m('m7')
    const empty: CourseModule = { ...m7, items: [] }
    expect(contentGaps([empty], NOW).map((g) => g.text)).toEqual(['No materials yet', 'No tasks yet'])
    expect(contentGaps([{ ...m7, opensAt: undefined }], NOW).map((g) => g.text)).toContain('Has no start or end date')
  })

  it('leaves finished modules alone', () => {
    expect(contentGaps([{ ...m('m1'), items: [] }], NOW)).toEqual([])
  })
})

describe('nextDueTasks', () => {
  it("lists the next deadlines across all modules: each week's Friday 08:00, or its Monday once Friday has passed", () => {
    const due = nextDueTasks(modules, NOW, 4)
    expect(due).toHaveLength(4)
    expect(due.every((d) => new Date(d.dueAt) > NOW)).toBe(true)
    expect(due.map((d) => d.dueAt)).toEqual([...due.map((d) => d.dueAt)].sort())
    expect(due.every((d) => new Date(d.dueAt).getUTCHours() === 4)).toBe(true) // 08:00 in Baku
    expect(due.some((d) => d.module.id === 'm7')).toBe(true)
  })
})
