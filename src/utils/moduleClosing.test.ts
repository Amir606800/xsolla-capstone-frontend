import { describe, expect, it } from 'vitest'
import type { CourseModule } from '../types/course'
import { isModuleLocked, orderByOpening } from './progress'

const NOW = new Date('2026-11-20T12:00:00Z')
const mod = (extra: Partial<CourseModule> = {}): CourseModule => ({ id: 'm', position: 1, title: 'W', items: [], ...extra })

describe('a module that has closed', () => {
  it('is only locked before it opens: after it closes it can still be read (and handed in to, late)', () => {
    expect(isModuleLocked(mod({ opensAt: '2026-11-25T00:00:00Z', closesAt: '2026-12-01T00:00:00Z' }), NOW)).toBe(true)
    expect(isModuleLocked(mod({ opensAt: '2026-11-02T00:00:00Z', closesAt: '2026-11-08T00:00:00Z' }), NOW)).toBe(false)
  })
})

describe('orderByOpening', () => {
  it('puts the module that opens first first, whatever order they are given in', () => {
    const list = [{ id: 'a', opensAt: '2026-11-16T00:00:00Z' }, { id: 'b', opensAt: '2026-11-02T00:00:00Z' }, { id: 'c' }]
    expect(orderByOpening(list).map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })
})
