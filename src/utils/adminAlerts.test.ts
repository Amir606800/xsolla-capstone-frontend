import { describe, expect, it } from 'vitest'
import type { Broadcast } from '../mocks/broadcasts'
import type { SchoolTeam, SchoolUser } from '../types/admin'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import { attentionCount, buildAlerts } from './adminAlerts'
import type { AlertData } from './adminAlerts'

// Wed 4 Nov 2026, 12:00 (local)
const NOW = new Date(2026, 10, 4, 12, 0)
const at = (day: number, h = 0) => new Date(2026, 10, day, h).toISOString()

const user = (id: number, name: string, roles: SchoolUser['roles'], extra: Partial<SchoolUser> = {}): SchoolUser => ({ id, name, email: `${id}@x.co`, roles, ...extra })
const team = (id: string, mentorId: number | null, studentIds: number[]): SchoolTeam => ({ id, name: `Team ${id}`, mentorId, studentIds })
const week = (n: number, from: number, createdBy?: number): CourseModule => ({
  id: `m${n}`,
  position: n,
  title: `Topic ${n}`,
  opensAt: at(from),
  closesAt: at(from + 6, 23),
  ...(createdBy !== undefined ? { createdBy } : {}),
  items: [],
})
const lecture = (id: string, day: number, over: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: 'Lecture', kind: 'lecture', startsAt: at(day, 10), endsAt: at(day, 12), ...over })

/** A school with nothing wrong. */
const fine = (): AlertData => ({
  modules: [week(6, 2, 902)],
  users: [user(1, 'Sam Student', ['student']), user(901, 'Aysel Mammadova', ['mentor'])],
  teams: [team('1', 901, [1])],
  events: [],
  sent: [],
})

const ids = (d: AlertData) => buildAlerts(d, NOW).map((a) => a.id)

describe('admin notifications', () => {
  it('a school with nothing wrong has nothing to say', () => {
    expect(buildAlerts(fine(), NOW)).toEqual([])
  })

  it('a week that is on or opens soon with no lecturer needs attention, with the way to fix it', () => {
    const d = { ...fine(), modules: [week(6, 2), week(7, 9, 902)] }
    const [a] = buildAlerts(d, NOW)
    expect(a).toMatchObject({ level: 'attention', title: 'Week 6 (Topic 6) has no lecturer', detail: 'It is running now.', to: '/admin/lecturers' })
    const soon = buildAlerts({ ...fine(), modules: [week(7, 9)] }, NOW)[0]
    expect(soon.detail).toBe('It opens Nov 9.')
  })

  it('weeks far ahead without a lecturer are only mentioned, in one line', () => {
    const [a] = buildAlerts({ ...fine(), modules: [week(6, 2, 902), week(9, 40), week(10, 47)] }, NOW)
    expect(a).toMatchObject({ level: 'info', title: '2 weeks still without a lecturer', detail: 'Weeks 9, 10.' })
  })

  it('no teams, teams without a mentor, students not in a team', () => {
    const noTeams = { ...fine(), teams: [] }
    expect(buildAlerts(noTeams, NOW)[0]).toMatchObject({ id: 'no-teams', title: 'There are no teams yet', detail: '1 student waiting.', to: '/admin/teams' })

    const d: AlertData = { ...fine(), users: [...fine().users, user(2, 'Ann Lee', ['student']), user(3, 'Bob Roe', ['student'])], teams: [team('1', null, [1]), team('2', 901, [])] }
    const found = buildAlerts(d, NOW)
    expect(found.find((a) => a.id === 'teams-no-mentor')).toMatchObject({ title: '1 team without a mentor', detail: 'Team 1' })
    expect(found.find((a) => a.id === 'students-no-team')).toMatchObject({ title: '2 students not in a team', detail: 'Ann Lee and Bob Roe' })
  })

  it('students who left the school are not counted as missing a team', () => {
    const d = { ...fine(), users: [...fine().users, user(2, 'Ann Lee', ['student'], { leftAt: at(1) })] }
    expect(ids(d)).not.toContain('students-no-team')
  })

  it('a lecture that starts within 48 hours without a meeting link needs attention; later ones and ones with a link do not', () => {
    const d = {
      ...fine(),
      events: [
        lecture('soon', 5), // tomorrow 10:00
        lecture('linked', 5, { meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
        lecture('later', 9),
        lecture('past', 3),
        lecture('meeting', 5, { kind: 'meeting' }),
      ],
    }
    const found = buildAlerts(d, NOW).filter((a) => a.id.startsWith('no-link'))
    expect(found.map((a) => a.id)).toEqual(['no-link-soon'])
    expect(found[0]).toMatchObject({ level: 'attention', title: 'Lecture on Nov 5 has no meeting link', to: '/admin/calendar' })
  })

  it('a role that ends within a week is flagged: attention in the last 3 days, info before', () => {
    const d = {
      ...fine(),
      users: [
        ...fine().users,
        user(902, 'Elvin Huseynov', ['lecturer', 'mentor'], { roleUntil: { mentor: at(6) } }),
        user(903, 'Rashad Aliyev', ['mentor', 'lecturer'], { roleUntil: { lecturer: at(10) } }),
        user(904, 'Far Away', ['mentor', 'lecturer'], { roleUntil: { lecturer: at(30) } }),
      ],
      teams: [team('1', 901, [1]), team('2', 902, []), team('3', 903, [])],
    }
    const found = buildAlerts(d, NOW)
    expect(found.find((a) => a.id === 'role-ends-902-mentor')).toMatchObject({ level: 'attention', title: 'Elvin Huseynov’s mentor role ends in 2 days', to: '/admin/mentors' })
    expect(found.find((a) => a.id === 'role-ends-903-lecturer')).toMatchObject({ level: 'info', to: '/admin/lecturers' })
    expect(found.find((a) => a.id === 'role-ends-904-lecturer')).toBeUndefined()
  })

  it('lately: students who left, announcements sent in the last week, teams over the usual size, idle mentors', () => {
    const sent: Broadcast[] = [
      { id: '2', message: 'No classes on Friday.', link: '', audience: 'all', sentAt: at(3), sentBy: 'Admin', recipients: 37 },
      { id: '1', message: 'Old news', link: '', audience: 'all', sentAt: new Date(2026, 9, 1).toISOString(), sentBy: 'Admin', recipients: 37 },
    ]
    const d: AlertData = {
      ...fine(),
      sent,
      users: [...fine().users, user(2, 'Ann Lee', ['student'], { leftAt: at(2) }), user(905, 'Idle Mentor', ['mentor'])],
      teams: [team('1', 901, [1, 11, 12, 13, 14, 15])],
    }
    const found = buildAlerts(d, NOW)
    expect(found.every((a) => a.level === 'info')).toBe(true)
    expect(found.map((a) => a.id)).toEqual(['teams-over', 'mentors-no-team', 'left-2', 'sent-2'])
    expect(found.find((a) => a.id === 'sent-2')).toMatchObject({ title: 'You sent “No classes on Friday.”', detail: 'Nov 3 · 37 people' })
  })

  it('things to fix come before things that happened, and only the first are counted', () => {
    const d: AlertData = { ...fine(), modules: [week(6, 2)], users: [...fine().users, user(905, 'Idle Mentor', ['mentor'])] }
    const found = buildAlerts(d, NOW)
    expect(found.map((a) => a.level)).toEqual(['attention', 'info'])
    expect(attentionCount(found)).toBe(1)
  })
})
