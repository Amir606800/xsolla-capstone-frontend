import { describe, expect, it } from 'vitest'
import { buildMentorTeam, buildMockTeam } from './teams'
import { addUser, deleteUser, listTeams, listUsers, setLeft, setMentorTeam, setRoles, setTeam, updateUser } from './directory'
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

describe('admin changes to the directory', () => {
  it('adds an account with a new id; the e-mail must not be taken (any case)', () => {
    const ann = addUser({ name: '  Ann Lee ', email: 'Ann@Example.com', roles: ['student'] })
    expect(ann).toMatchObject({ name: 'Ann Lee', email: 'ann@example.com', roles: ['student'] })
    expect(ann.id).toBeGreaterThan(2000)
    expect(listUsers().find((u) => u.id === ann.id)).toEqual(ann)
    expect(() => addUser({ name: 'Ann again', email: 'ANN@example.com', roles: ['student'] })).toThrow('There is already an account with this email.')
    expect(() => addUser({ name: 'Sam copy', email: 'student@xsolla.school', roles: ['student'] })).toThrow('already an account')
    const bob = addUser({ name: 'Bob', email: 'bob@example.com', roles: ['student'] })
    expect(bob.id).toBe(ann.id + 1)
  })

  it('moves students between teams, into one, or out of all', () => {
    const ann = addUser({ name: 'Ann', email: 'ann@example.com', roles: ['student'] })
    setTeam(ann.id, 't6')
    expect(listTeams().find((t) => t.id === 't6')!.studentIds).toContain(ann.id)
    // Sam (1) from Team 3 to Team 1
    setTeam(1, 't1')
    expect(listTeams().find((t) => t.id === 't3')!.studentIds).not.toContain(1)
    expect(listTeams().find((t) => t.id === 't1')!.studentIds).toContain(1)
    setTeam(1, null)
    expect(listTeams().some((t) => t.studentIds.includes(1))).toBe(false)
    expect(() => setTeam(1, 't99')).toThrow('does not exist')
  })

  it('corrects a name or e-mail; the e-mail stays unique, its own is fine', () => {
    expect(updateUser(101, { name: ' Leyla Hasanli ', email: 'Leyla@Example.com' })).toMatchObject({ id: 101, name: 'Leyla Hasanli', email: 'leyla@example.com' })
    expect(updateUser(101, { email: 'leyla@example.com' }).email).toBe('leyla@example.com')
    expect(() => updateUser(101, { email: 'student@xsolla.school' })).toThrow('already an account')
    expect(() => updateUser(9999, { name: 'x' })).toThrow('does not exist')
    // still in her team
    expect(listTeams().find((t) => t.id === 't3')!.studentIds).toContain(101)
  })

  it('a student who left keeps the account but leaves the team; coming back has no team', () => {
    const when = new Date(2026, 10, 7, 12)
    expect(setLeft(102, true, when)).toMatchObject({ id: 102, leftAt: when.toISOString() })
    expect(listUsers().find((u) => u.id === 102)!.leftAt).toBe(when.toISOString())
    expect(listTeams().some((t) => t.studentIds.includes(102))).toBe(false)
    // cannot be put in a team while away: the team list keeps them out
    setTeam(102, 't1')
    expect(listTeams().some((t) => t.studentIds.includes(102))).toBe(false)
    expect(setLeft(102, false)).not.toHaveProperty('leftAt')
    expect(listTeams().find((t) => t.id === 't1')!.studentIds).toContain(102)
  })

  it('deletes an account for good', () => {
    deleteUser(103)
    expect(listUsers().some((u) => u.id === 103)).toBe(false)
    expect(listTeams().some((t) => t.studentIds.includes(103))).toBe(false)
    expect(() => deleteUser(103)).toThrow('does not exist')
  })

  it('a lecturer role given until a date is gone once that date has passed', () => {
    const until = '2026-12-01T23:59:59.000Z'
    setRoles(901, ['mentor', 'lecturer'], { lecturer: until })
    const before = new Date('2026-11-20T12:00:00Z')
    expect(listUsers(before).find((u) => u.id === 901)).toMatchObject({ roles: ['mentor', 'lecturer'], roleUntil: { lecturer: until } })
    const after = new Date('2026-12-02T00:00:00Z')
    const aysel = listUsers(after).find((u) => u.id === 901)!
    expect(aysel.roles).toEqual(['mentor'])
    expect(aysel).not.toHaveProperty('roleUntil')
  })

  it('roles: at least one stays; a mentor who loses the role leaves their team without a mentor', () => {
    expect(() => setRoles(901, [])).toThrow('Keep at least one role.')
    setRoles(901, ['lecturer'])
    expect(listUsers().find((u) => u.id === 901)!.roles).toEqual(['lecturer'])
    expect(listTeams().find((t) => t.id === 't4')!.mentorId).toBeNull()
    // Rashad can lose the lecturer role he was seeded with
    setRoles(900, ['mentor'])
    expect(listUsers().find((u) => u.id === 900)!.roles).toEqual(['mentor'])
  })

  it('one mentor per team: giving a team to a mentor replaces its mentor and frees their old team', () => {
    const nil = addUser({ name: 'Nil Ay', email: 'nil@example.com', roles: ['mentor'] })
    setMentorTeam(nil.id, 't3') // Rashad mentored Team 3
    expect(listTeams().find((t) => t.id === 't3')!.mentorId).toBe(nil.id)
    expect(listTeams().some((t) => t.mentorId === 900)).toBe(false)
    setMentorTeam(nil.id, 't1') // moving on frees Team 3
    expect(listTeams().find((t) => t.id === 't1')!.mentorId).toBe(nil.id)
    expect(listTeams().find((t) => t.id === 't3')!.mentorId).toBeNull()
    setMentorTeam(nil.id, null)
    expect(listTeams().some((t) => t.mentorId === nil.id)).toBe(false)
  })

  it('a deleted mentor’s team has no mentor', () => {
    deleteUser(905)
    expect(listTeams().find((t) => t.id === 't5')!.mentorId).toBeNull()
  })

  it('survives broken storage', () => {
    localStorage.setItem('school_directory', '{nope')
    expect(listUsers().filter(isStudent)).toHaveLength(29)
    expect(listTeams()).toHaveLength(6)
  })
})
