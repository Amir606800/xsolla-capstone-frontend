import { describe, expect, it } from 'vitest'
import type { SchoolTeam } from '../types/admin'
import { passwordProblems } from './credentials'
import { generatePassword, inTeamFilter, matchesQuery, teamByStudent } from './adminPeople'

const teams: SchoolTeam[] = [
  { id: 't1', name: 'Team 1', mentorId: 10, studentIds: [1, 2] },
  { id: 't2', name: 'Team 2', mentorId: 11, studentIds: [3] },
]

describe('admin people helpers', () => {
  it('finds each student’s team', () => {
    const map = teamByStudent(teams)
    expect(map.get(1)?.id).toBe('t1')
    expect(map.get(3)?.id).toBe('t2')
    expect(map.get(99)).toBeUndefined()
  })

  it('searches name and e-mail, ignoring case and spaces around', () => {
    const ann = { name: 'Ann Lee', email: 'ann.lee@example.com' }
    expect(matchesQuery(ann, '')).toBe(true)
    expect(matchesQuery(ann, '  LEE ')).toBe(true)
    expect(matchesQuery(ann, 'example.com')).toBe(true)
    expect(matchesQuery(ann, 'bob')).toBe(false)
  })

  it('filters by team, or the students in no team', () => {
    const map = teamByStudent(teams)
    expect(inTeamFilter(1, 'all', map)).toBe(true)
    expect(inTeamFilter(1, 't1', map)).toBe(true)
    expect(inTeamFilter(1, 't2', map)).toBe(false)
    expect(inTeamFilter(99, 'none', map)).toBe(true)
    expect(inTeamFilter(1, 'none', map)).toBe(false)
  })

  it('generates passwords without look-alike characters', () => {
    const pw = generatePassword()
    expect(pw).toHaveLength(12)
    expect(pw).not.toMatch(/[0O1lI]/)
    expect(generatePassword(16)).toHaveLength(16)
    expect(generatePassword(4, () => new Uint32Array([0, 1, 2, 3]))).toBe('abcd')
  })

  it('a generated password always passes the password rules, also for the person it is for', () => {
    const owner = { name: 'Leyla Hasanova', email: 'leyla.hasanova@example.com' }
    for (let i = 0; i < 200; i++) expect(passwordProblems(generatePassword(12, undefined, owner), owner)).toEqual([])
  })

  it('a draw that breaks a rule is drawn again', () => {
    // first draw: lowercase only; second draw: a good mix
    const draws = [Array.from({ length: 12 }, (_, i) => i), [0, 1, 2, 3, 24, 25, 26, 48, 49, 50, 4, 27]]
    const random = () => new Uint32Array(draws.shift() ?? [])
    const pw = generatePassword(12, random)
    expect(pw).toBe('abcdABC234eD')
    expect(passwordProblems(pw)).toEqual([])
  })
})
