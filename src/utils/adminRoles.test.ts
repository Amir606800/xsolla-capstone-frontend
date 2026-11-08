import { describe, expect, it } from 'vitest'
import { dayInput, daysLeft, endOfDay, mainRoleOf, otherStaffRole, roleBadges, rolesSummary, rolesWithExtra } from './adminRoles'

const NOW = new Date(2026, 10, 7, 12)

describe('admin role helpers', () => {
  it('counts the calendar days left: 0 when it ends today', () => {
    expect(daysLeft(new Date(2026, 10, 7, 23, 59).toISOString(), NOW)).toBe(0)
    expect(daysLeft(new Date(2026, 10, 8, 23, 59).toISOString(), NOW)).toBe(1)
    expect(daysLeft(new Date(2026, 10, 14, 12).toISOString(), NOW)).toBe(7)
    expect(daysLeft(new Date(2026, 10, 1).toISOString(), NOW)).toBe(0)
  })

  it('makes the role pills: plain roles, and the lecturer role with its end', () => {
    expect(roleBadges({ roles: ['mentor'] }, NOW)).toEqual([{ role: 'mentor', label: 'Mentor', main: true }])
    const [, lecturer] = roleBadges({ roles: ['mentor', 'lecturer'], roleUntil: { lecturer: new Date(2026, 11, 1, 23, 59).toISOString() } }, NOW)
    expect(lecturer).toMatchObject({ role: 'lecturer', label: 'Lecturer', endingSoon: false })
    expect(lecturer.detail).toBe('until Dec 1 · 24 days left')
    const [soon] = roleBadges({ roles: ['lecturer'], roleUntil: { lecturer: new Date(2026, 10, 9).toISOString() } }, NOW)
    expect(soon).toMatchObject({ endingSoon: true, detail: 'until Nov 9 · 2 days left' })
    const [today] = roleBadges({ roles: ['lecturer'], roleUntil: { lecturer: new Date(2026, 10, 7, 23, 59).toISOString() } }, NOW)
    expect(today.detail).toBe('until Nov 7 · ends today')
  })

  it('the main role comes first in the pills, the extra one after', () => {
    const pills = roleBadges({ roles: ['mentor', 'lecturer'], mainRole: 'lecturer' }, NOW)
    expect(pills.map((p) => [p.label, p.main])).toEqual([
      ['Lecturer', true],
      ['Mentor', false],
    ])
  })

  it('works out the main role: the server’s, else what is held with no end date', () => {
    expect(mainRoleOf({ roles: ['mentor', 'lecturer'], mainRole: 'lecturer' })).toBe('lecturer')
    expect(mainRoleOf({ roles: ['student'] })).toBe('student')
    expect(mainRoleOf({ roles: ['admin'] })).toBe('admin')
    expect(mainRoleOf({ roles: ['lecturer'] })).toBe('lecturer')
    expect(mainRoleOf({ roles: ['mentor', 'lecturer'], roleUntil: { mentor: '2030-01-01T00:00:00Z' } })).toBe('lecturer')
    expect(mainRoleOf({ roles: ['mentor', 'lecturer'] })).toBe('mentor')
  })

  it('the roles to save always keep the main role; only the other one comes and goes', () => {
    expect(otherStaffRole('mentor')).toBe('lecturer')
    expect(otherStaffRole('lecturer')).toBe('mentor')
    expect(rolesWithExtra('lecturer', { on: false })).toEqual({ roles: ['lecturer'], until: {} })
    expect(rolesWithExtra('lecturer', { on: true, until: null })).toEqual({ roles: ['lecturer', 'mentor'], until: {} })
    expect(rolesWithExtra('mentor', { on: true, until: '2026-12-01T22:59:59.000Z' })).toEqual({
      roles: ['mentor', 'lecturer'],
      until: { lecturer: '2026-12-01T22:59:59.000Z' },
    })
    expect(rolesSummary('lecturer', { on: false })).toBe('Lecturer only.')
    expect(rolesSummary('lecturer', { on: true, until: null })).toBe('Lecturer, and mentor.')
    expect(rolesSummary('mentor', { on: true, until: new Date(2026, 11, 1, 23, 59).toISOString() })).toBe('Mentor, and lecturer until Dec 1.')
  })

  it('a role until a day lasts that whole day', () => {
    expect(endOfDay('2026-12-01')).toBe(new Date(2026, 11, 1, 23, 59, 59).toISOString())
    expect(endOfDay('')).toBeNull()
    expect(dayInput(NOW)).toBe('2026-11-07')
    expect(dayInput(NOW, 30)).toBe('2026-12-07')
  })
})
