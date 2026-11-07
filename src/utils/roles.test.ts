import { describe, expect, it } from 'vitest'
import { canAuthor, canMentor, hasRole, isAdmin, isStaff, isStudent, normalizeUser, roleLabel, rolesFrom, untilFrom } from './roles'
import type { Role } from '../types/user'

const as = (...roles: Role[]) => ({ roles })

describe('roles given for a while', () => {
  const now = new Date('2026-11-07T12:00:00Z')
  const temp = (until: string) => ({ roles: ['mentor', 'lecturer'] as Role[], roleUntil: { lecturer: until } })

  it('count until their end, then stop counting by themselves', () => {
    expect(hasRole(temp('2026-12-01T00:00:00Z'), 'lecturer', now)).toBe(true)
    expect(hasRole(temp('2026-11-07T11:59:59Z'), 'lecturer', now)).toBe(false)
    // the role without an end date is unaffected
    expect(hasRole(temp('2026-11-01T00:00:00Z'), 'mentor', now)).toBe(true)
  })

  it('an expired lecturer role takes away the lecturer abilities', () => {
    const expired = temp('2020-01-01T00:00:00Z')
    expect([canMentor(expired), canAuthor(expired)]).toEqual([true, false])
    expect(roleLabel(expired)).toBe('Mentor')
    expect(roleLabel(temp('2999-01-01T00:00:00Z'))).toBe('Mentor & lecturer')
  })

  it('keeps the end dates of a stored or returned user, and only real ones', () => {
    expect(normalizeUser({ id: 1, name: 'R', email: 'r@x', roles: ['mentor', 'lecturer'], roleUntil: { lecturer: '2026-12-01T00:00:00Z' } })).toMatchObject({
      roleUntil: { lecturer: '2026-12-01T00:00:00Z' },
    })
    expect(untilFrom({ lecturer: 'soon', wizard: '2026-12-01T00:00:00Z', mentor: null })).toBeUndefined()
    expect(normalizeUser({ id: 1, name: 'R', email: 'r@x', roles: ['mentor'] })).not.toHaveProperty('roleUntil')
  })
})

describe('abilities', () => {
  it('a mentor looks after a team but does not write the course', () => {
    const u = as('mentor')
    expect([canMentor(u), canAuthor(u), isStaff(u), isStudent(u)]).toEqual([true, false, true, false])
  })

  it('a lecturer writes the course but has no team', () => {
    const u = as('lecturer')
    expect([canMentor(u), canAuthor(u), isStaff(u)]).toEqual([false, true, true])
  })

  it('a mentor given the lecturer role can do both; taking it away removes only the lecturer part', () => {
    const both = as('mentor', 'lecturer')
    expect([canMentor(both), canAuthor(both)]).toEqual([true, true])
    const back = as('mentor')
    expect([canMentor(back), canAuthor(back)]).toEqual([true, false])
  })

  it('an admin can write the course but is no team mentor', () => {
    expect([canAuthor(as('admin')), canMentor(as('admin'))]).toEqual([true, false])
  })

  it('only the admin role opens the admin section', () => {
    expect([isAdmin(as('admin')), isAdmin(as('mentor', 'lecturer')), isAdmin(as('student')), isAdmin(null)]).toEqual([
      true,
      false,
      false,
      false,
    ])
  })

  it('students are not staff, and nobody signed in can do nothing', () => {
    expect([isStaff(as('student')), isStudent(as('student'))]).toEqual([false, true])
    expect([isStaff(null), canMentor(undefined), canAuthor(null)]).toEqual([false, false, false])
  })
})

describe('rolesFrom', () => {
  it('reads a list or a single name, any case', () => {
    expect(rolesFrom(['Mentor', 'LECTURER'])).toEqual(['mentor', 'lecturer'])
    expect(rolesFrom('admin')).toEqual(['admin'])
  })

  it('treats the backend "teacher" as mentor + lecturer', () => {
    expect(rolesFrom('teacher')).toEqual(['mentor', 'lecturer'])
  })

  it('drops unknown names and falls back to the least access', () => {
    expect(rolesFrom(['root', 'mentor'])).toEqual(['mentor'])
    expect(rolesFrom('superuser')).toEqual(['student'])
    expect(rolesFrom(undefined)).toEqual(['student'])
  })

  it('never makes someone a student and staff at once', () => {
    expect(rolesFrom(['student', 'mentor'])).toEqual(['mentor'])
  })
})

describe('normalizeUser', () => {
  it('upgrades a saved session that still has a single role', () => {
    expect(normalizeUser({ id: 900, name: 'R', email: 'r@x', role: 'teacher' })).toEqual({
      id: 900,
      name: 'R',
      email: 'r@x',
      roles: ['mentor', 'lecturer'],
    })
  })

  it('keeps the new shape and rejects junk', () => {
    expect(normalizeUser({ id: 1, name: 'S', email: 's@x', roles: ['student'] })?.roles).toEqual(['student'])
    expect(normalizeUser(null)).toBeNull()
    expect(normalizeUser({ name: 'no id' })).toBeNull()
  })
})

it('labels the account', () => {
  expect(roleLabel(as('mentor', 'lecturer'))).toBe('Mentor & lecturer')
  expect(roleLabel(as('mentor'))).toBe('Mentor')
  expect(roleLabel(as('lecturer'))).toBe('Lecturer')
  expect(roleLabel(as('student'))).toBe('Student')
})
