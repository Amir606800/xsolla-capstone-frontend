import { describe, expect, it } from 'vitest'
import { buildMentorTeam, buildMockTeam } from './teams'
import { listTeams, listUsers } from './directory'
import { canMentor, hasRole, isStudent } from '../utils/roles'

describe('admin directory mock', () => {
  const users = listUsers()
  const teams = listTeams()

  it('is a cohort of 29 students in 6 teams of 4-5, each with one mentor', () => {
    expect(users.filter(isStudent)).toHaveLength(29)
    expect(teams).toHaveLength(6)
    for (const t of teams) {
      expect(t.studentIds.length).toBeGreaterThanOrEqual(4)
      expect(t.studentIds.length).toBeLessThanOrEqual(5)
      expect(users.find((u) => u.id === t.mentorId && canMentor(u))).toBeDefined()
    }
  })

  it('every student is in exactly one team, and ids are unique', () => {
    const placed = teams.flatMap((t) => t.studentIds)
    expect(new Set(placed).size).toBe(placed.length)
    expect(new Set(placed)).toEqual(new Set(users.filter(isStudent).map((s) => s.id)))
    expect(new Set(users.map((u) => u.id)).size).toBe(users.length)
  })

  it('matches the LMS team mocks: Sam is in Rashad’s Team 3, Aysel has Team 4', () => {
    const t3 = teams.find((t) => t.id === 't3')!
    const lms3 = buildMockTeam({ id: 1, name: 'Sam Student', email: 'student@xsolla.school' })
    expect(t3.mentorId).toBe(lms3.mentor.id)
    expect([...t3.studentIds].sort()).toEqual(lms3.members.map((m) => m.id).sort())
    const t4 = teams.find((t) => t.id === 't4')!
    const lms4 = buildMentorTeam({ id: 901, name: 'Aysel', email: 'mentor@xsolla.school' })
    expect([...t4.studentIds].sort()).toEqual(lms4.members.map((m) => m.id).sort())
  })

  it('has mentors, lecturers (one does both) and the admin', () => {
    expect(users.filter(canMentor)).toHaveLength(6)
    expect(users.filter((u) => hasRole(u, 'lecturer')).map((u) => u.id).sort()).toEqual([900, 902, 907])
    expect(users.filter((u) => hasRole(u, 'admin')).map((u) => u.email)).toEqual(['admin@xsolla.school'])
  })

  it('hands out copies, so changing one does not change the next call', () => {
    users[0].roles.push('admin')
    teams[0].studentIds.length = 0
    expect(listUsers()[0].roles).not.toContain('admin')
    expect(listTeams()[0].studentIds.length).toBeGreaterThan(0)
  })
})
