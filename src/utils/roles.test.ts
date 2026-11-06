import { describe, expect, it } from 'vitest'
import { canAuthor, canMentor, isStaff, isStudent, normalizeUser, roleLabel, rolesFrom } from './roles'
import type { Role } from '../types/user'

const as = (...roles: Role[]) => ({ roles })

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
