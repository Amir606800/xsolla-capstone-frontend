import { describe, expect, it } from 'vitest'
import { buildMockModules } from './courses'
import { moduleProgress, overallStats } from '../utils/progress'

const NOW = new Date('2026-11-04T12:00:00Z')

describe('buildMockModules', () => {
  const modules = buildMockModules(NOW)

  it('builds 12 ordered modules with unique ids', () => {
    expect(modules).toHaveLength(12)
    expect(modules.map((m) => m.position)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
    expect(new Set(modules.map((m) => m.id)).size).toBe(12)
  })

  it('every module has a resource and at least one assignment', () => {
    for (const m of modules) {
      expect(m.items.some((i) => i.type === 'resource')).toBe(true)
      expect(m.items.some((i) => i.type === 'assignment')).toBe(true)
    }
  })

  it('item ids are globally unique and point to their module', () => {
    const items = modules.flatMap((m) => m.items)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    for (const m of modules) for (const i of m.items) expect(i.moduleId).toBe(m.id)
  })

  it('tells a believable story: done, overdue, current, upcoming', () => {
    const status = (i: number) => moduleProgress(modules[i], NOW).status
    expect(status(0)).toBe('completed')
    expect(status(3)).toBe('overdue')
    expect(status(5)).toBe('in-progress')
    expect(status(11)).toBe('not-started')
  })

  it('has graded work so the score is non-zero and never above 100%', () => {
    const { scorePercent } = overallStats(modules, NOW)
    expect(scorePercent).toBeGreaterThan(0)
    expect(scorePercent).toBeLessThanOrEqual(100)
  })
})
