import { describe, expect, it } from 'vitest'
import { dayInput, daysLeft, endOfDay, roleBadges } from './adminRoles'

const NOW = new Date(2026, 10, 7, 12)

describe('admin role helpers', () => {
  it('counts the days left, anything left today being one', () => {
    expect(daysLeft(new Date(2026, 10, 7, 18).toISOString(), NOW)).toBe(1)
    expect(daysLeft(new Date(2026, 10, 14, 12).toISOString(), NOW)).toBe(7)
    expect(daysLeft(new Date(2026, 10, 1).toISOString(), NOW)).toBe(0)
  })

  it('makes the role pills: plain roles, and the lecturer role with its end', () => {
    expect(roleBadges({ roles: ['mentor'] }, NOW)).toEqual([{ role: 'mentor', label: 'Mentor' }])
    const [, lecturer] = roleBadges({ roles: ['mentor', 'lecturer'], roleUntil: { lecturer: new Date(2026, 11, 1, 23, 59).toISOString() } }, NOW)
    expect(lecturer).toMatchObject({ role: 'lecturer', label: 'Lecturer', endingSoon: false })
    expect(lecturer.detail).toMatch(/^until Dec 1 · 25 days left$/)
    const [soon] = roleBadges({ roles: ['lecturer'], roleUntil: { lecturer: new Date(2026, 10, 9).toISOString() } }, NOW)
    expect(soon).toMatchObject({ endingSoon: true, detail: expect.stringMatching(/2 days left$/) })
  })

  it('a role until a day lasts that whole day', () => {
    expect(endOfDay('2026-12-01')).toBe(new Date(2026, 11, 1, 23, 59, 59).toISOString())
    expect(endOfDay('')).toBeNull()
    expect(dayInput(NOW)).toBe('2026-11-07')
    expect(dayInput(NOW, 30)).toBe('2026-12-07')
  })
})
