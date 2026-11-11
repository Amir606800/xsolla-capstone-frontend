import { describe, expect, it } from 'vitest'
import type { CourseModule } from '../types/course'
import { DATES_NOT_KEPT, datesNotKept } from './moduleDates'

const saved = (extra: Partial<CourseModule> = {}): CourseModule => ({ id: '4', position: 1, title: 'Go', items: [], ...extra })

describe('datesNotKept', () => {
  it('warns when dates were sent but the saved week has none (the server ignores fields it does not know)', () => {
    expect(datesNotKept({ opensAt: '2026-11-02T00:00:00.000Z' }, saved())).toBe(DATES_NOT_KEPT)
    expect(datesNotKept({ closesAt: '2026-11-08T23:59:00.000Z' }, saved({ opensAt: '2026-11-02T00:00:00Z' }))).toBe(DATES_NOT_KEPT)
  })

  it('is quiet when the dates came back, in any format for the same moment', () => {
    expect(datesNotKept({ opensAt: '2026-11-02T00:00:00.000Z' }, saved({ opensAt: '2026-11-02T00:00:00Z' }))).toBeUndefined()
  })

  it('is quiet when no dates were asked for (only the title changed)', () => {
    expect(datesNotKept({ title: 'Go' }, saved())).toBeUndefined()
    expect(datesNotKept({ opensAt: '' }, saved())).toBeUndefined()
  })
})
