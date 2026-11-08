import { describe, expect, it } from 'vitest'
import { buildMentorTeam, buildMockTeam } from './teams'
import {
  addTeam,
  addUser,
  clearTeams,
  createTeams,
  deleteTeam,
  deleteUser,
  listTeams,
  listUsers,
  passwordMatches,
  setLeft,
  setMentorTeam,
  setPassword,
  setRoles,
  setTeam,
  setTeamMentor,
  updateUser,
} from './directory'
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

  it('every account has a main role: the one it was created with', () => {
    const main = (id: number) => listUsers().find((u) => u.id === id)!.mainRole
    expect(main(1)).toBe('student')
    expect(main(901)).toBe('mentor') // Aysel
    expect(main(902)).toBe('lecturer') // Elvin
    expect(main(900)).toBe('mentor') // Rashad mentors Team 3 and also lectures
    expect(main(1000)).toBe('admin')
    const added = addUser({ name: 'Nil Ay', email: 'nil@example.com', roles: ['lecturer'] })
    expect(main(added.id)).toBe('lecturer')
    // giving the other role, even with no end date, does not move the main role
    setRoles(added.id, ['lecturer', 'mentor'])
    expect(main(added.id)).toBe('lecturer')
  })

  it('roles: the main role cannot be taken away or end; the extra role can be added and taken back', () => {
    expect(() => setRoles(901, [])).toThrow('Keep at least one role.')
    expect(() => setRoles(901, ['lecturer'])).toThrow('Aysel Mammadova is a mentor: that role cannot be taken away.')
    expect(() => setRoles(902, ['mentor'])).toThrow('Elvin Huseynov is a lecturer: that role cannot be taken away.')
    expect(() => setRoles(901, ['mentor'], { mentor: '2030-01-01T00:00:00Z' })).toThrow('Aysel Mammadova’s main role cannot end.')
    expect(() => setRoles(901, ['mentor', 'admin'])).toThrow('Only the mentor and lecturer roles can be given.')

    // a lecturer can be given the mentor role, for a while, and loses it again
    setRoles(902, ['lecturer', 'mentor'], { mentor: '2030-01-01T00:00:00Z' })
    expect(listUsers().find((u) => u.id === 902)).toMatchObject({ roles: ['lecturer', 'mentor'], roleUntil: { mentor: '2030-01-01T00:00:00Z' } })
    setRoles(902, ['lecturer'])
    expect(listUsers().find((u) => u.id === 902)!.roles).toEqual(['lecturer'])

    // Rashad can lose the lecturer role he was seeded with
    setRoles(900, ['mentor'])
    expect(listUsers().find((u) => u.id === 900)!.roles).toEqual(['mentor'])
  })

  it('a lecturer who mentored for a while leaves their team when the mentor role is taken back', () => {
    setRoles(902, ['lecturer', 'mentor'])
    setMentorTeam(902, 't4')
    expect(listTeams().find((t) => t.id === 't4')!.mentorId).toBe(902)
    setRoles(902, ['lecturer'])
    expect(listTeams().find((t) => t.id === 't4')!.mentorId).toBeNull()
  })

  it('passwords: any works until the admin resets it, then only the new one', () => {
    expect(passwordMatches(901, 'anything')).toBe(true)
    setPassword(901, 'brand-new-pass')
    expect(passwordMatches(901, 'brand-new-pass')).toBe(true)
    expect(passwordMatches(901, 'anything')).toBe(false)
    // only for that account, and the password itself is not stored
    expect(passwordMatches(902, 'anything')).toBe(true)
    expect(localStorage.getItem('school_directory')).not.toContain('brand-new-pass')
    expect(() => setPassword(99999, 'brand-new-pass')).toThrow('This account does not exist')
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

  it('createTeams replaces every team: new names, members and mentors, nobody left in an old team', () => {
    createTeams([
      { mentorId: 901, studentIds: [1, 101] },
      { mentorId: null, studentIds: [102] },
    ])
    const teams = listTeams()
    expect(teams.map((t) => [t.id, t.name, t.mentorId, t.studentIds])).toEqual([
      ['t1', 'Team 1', 901, [1, 101]],
      ['t2', 'Team 2', null, [102]],
    ])
    // students and mentors that were not in the plan are free
    expect(teams.flatMap((t) => t.studentIds)).not.toContain(103)
    expect(teams.some((t) => t.mentorId === 900)).toBe(false)
  })

  it('in teams the admin made, students and mentors can be moved like before', () => {
    createTeams([
      { mentorId: 901, studentIds: [1] },
      { mentorId: 902, studentIds: [] },
    ])
    setTeam(101, 't2')
    setTeam(1, null)
    expect(listTeams().find((t) => t.id === 't2')!.studentIds).toEqual([101])
    expect(listTeams().find((t) => t.id === 't1')!.studentIds).toEqual([])
    expect(() => setTeam(101, 't9')).toThrow('does not exist')
  })

  it('setTeamMentor: a mentor leaves their old team; null leaves the team without one', () => {
    setTeamMentor('t1', 901) // Aysel led Team 4
    expect(listTeams().find((t) => t.id === 't1')!.mentorId).toBe(901)
    expect(listTeams().find((t) => t.id === 't4')!.mentorId).toBeNull()
    setTeamMentor('t1', null)
    expect(listTeams().find((t) => t.id === 't1')!.mentorId).toBeNull()
    expect(() => setTeamMentor('t9', null)).toThrow('does not exist')
  })

  it('clearTeams: no teams at all, and the demo teams do not come back', () => {
    clearTeams()
    expect(listTeams()).toEqual([])
    expect(listUsers().filter(isStudent)).toHaveLength(29)
  })

  it('a student who left is not in the team the admin made for them', () => {
    createTeams([{ mentorId: null, studentIds: [101, 102] }])
    setLeft(101, true)
    expect(listTeams()[0].studentIds).toEqual([102])
  })

  it('survives broken storage', () => {
    localStorage.setItem('school_directory', '{nope')
    expect(listUsers().filter(isStudent)).toHaveLength(29)
    expect(listTeams()).toHaveLength(6)
  })
})

describe('adding and deleting one team', () => {
  const byName = (name: string) => listTeams().find((t) => t.name === name)

  it('adds a team; the six demo teams stay exactly as they were', () => {
    const before = listTeams()
    const made = addTeam({ name: '  Team   7 ', mentorId: null, studentIds: [] })
    expect(made).toEqual({ id: 't7', name: 'Team 7', mentorId: null, studentIds: [] })
    expect(listTeams().slice(0, 6)).toEqual(before)
    expect(listTeams()).toHaveLength(7)
  })

  it('a new team takes its students from wherever they were, and its mentor from their old team', () => {
    setTeam(121, null) // Ali has no team
    addTeam({ name: 'Rockets', mentorId: 903, studentIds: [121, 122] }) // Farid mentored Team 1, Banu was in it
    expect(byName('Rockets')).toMatchObject({ mentorId: 903, studentIds: [121, 122] })
    expect(byName('Team 1')).toMatchObject({ mentorId: null })
    expect(byName('Team 1')!.studentIds).not.toContain(122)
  })

  it('names must be new and not empty', () => {
    expect(() => addTeam({ name: 'team 3', mentorId: null, studentIds: [] })).toThrow('There is already a team called team 3.')
    expect(() => addTeam({ name: '   ', mentorId: null, studentIds: [] })).toThrow('Give the team a name.')
  })

  it('deleting a team leaves its students and mentor without one; the other teams stay', () => {
    const others = listTeams().filter((t) => t.id !== 't3')
    deleteTeam('t3')
    expect(listTeams().map((t) => t.name)).toEqual(['Team 1', 'Team 2', 'Team 4', 'Team 5', 'Team 6'])
    expect(listTeams()).toEqual(others)
    const placed = new Set(listTeams().flatMap((t) => t.studentIds))
    for (const id of [1, 101, 102, 103, 104]) expect(placed.has(id)).toBe(false)
    expect(listTeams().some((t) => t.mentorId === 900)).toBe(false)
    expect(() => deleteTeam('t3')).toThrow('This team does not exist')
  })

  it('a new id is never one in use, even after a delete', () => {
    deleteTeam('t2')
    expect(addTeam({ name: 'Team 7', mentorId: null, studentIds: [] }).id).toBe('t7')
    expect(addTeam({ name: 'Team 8', mentorId: null, studentIds: [] }).id).toBe('t8')
  })

  it('deleting the last team leaves no teams; a team can be added after random teams were made', () => {
    for (const t of listTeams()) deleteTeam(t.id)
    expect(listTeams()).toEqual([])
    createTeams([{ mentorId: 901, studentIds: [1, 101] }])
    addTeam({ name: 'Team 2', mentorId: null, studentIds: [102] })
    expect(listTeams().map((t) => [t.name, t.studentIds])).toEqual([
      ['Team 1', [1, 101]],
      ['Team 2', [102]],
    ])
  })
})
