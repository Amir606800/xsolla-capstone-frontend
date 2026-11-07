import { describe, expect, it } from 'vitest'
import type { SchoolTeam } from '../types/admin'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import type { Role, User } from '../types/user'
import { type OverviewData, overviewTiles } from './adminOverview'

const NOW = new Date('2026-11-07T12:00:00Z')
const ok = <T,>(value: T) => ({ ok: true as const, value })
const failed = { ok: false as const }

const u = (id: number, ...roles: Role[]): User => ({ id, name: `U${id}`, email: `u${id}@x.co`, roles })
const users = [u(1, 'student'), u(2, 'student'), u(3, 'student'), u(10, 'mentor'), u(11, 'mentor', 'lecturer'), u(12, 'lecturer'), u(99, 'admin')]
const teams: SchoolTeam[] = [
  { id: 't1', name: 'Team 1', mentorId: 10, studentIds: [1, 2] },
  { id: 't2', name: 'Team 2', mentorId: 11, studentIds: [] },
]
const event = (id: string, kind: CalendarEvent['kind'], startsAt: string, endsAt = startsAt): CalendarEvent => ({
  id,
  title: `Event ${id}`,
  kind,
  startsAt,
  endsAt,
})
const modules = [
  {
    id: 'm1',
    items: [{ type: 'assignment' }, { type: 'assignment' }, { type: 'resource' }, { type: 'quiz' }],
  },
  { id: 'm2', items: [{ type: 'resource' }] },
] as unknown as CourseModule[]

const all = (over: Partial<OverviewData> = {}): OverviewData => ({
  modules: ok(modules),
  users: ok(users),
  teams: ok(teams),
  events: ok([]),
  ...over,
})
const tile = (data: OverviewData, key: string, opts = {}) => overviewTiles(data, NOW, opts).find((t) => t.key === key)!

describe('overviewTiles', () => {
  it('has one tile per section, in sidebar order (no notifications count)', () => {
    expect(overviewTiles(all(), NOW).map((t) => t.key)).toEqual(['modules', 'calendar', 'students', 'mentors', 'lecturers', 'teams'])
  })

  it('counts modules and what is in them', () => {
    expect(tile(all(), 'modules')).toEqual({ key: 'modules', value: 2, hint: '2 tasks · 2 resources · 1 quiz' })
  })

  it('counts people by role: a mentor who lectures counts in both, admins in neither', () => {
    expect(tile(all(), 'students')).toMatchObject({ value: 3, hint: '1 not in a team' })
    expect(tile(all(), 'mentors')).toMatchObject({ value: 2, hint: '1 also lectures' })
    expect(tile(all(), 'lecturers')).toMatchObject({ value: 2, hint: '1 also mentors' })
  })

  it('students who left the school are not counted', () => {
    const withLeaver = [...users, { ...u(4, 'student'), leftAt: '2026-11-01T00:00:00Z' }]
    expect(tile(all({ users: ok(withLeaver) }), 'students')).toMatchObject({ value: 3, hint: '1 not in a team' })
  })

  it('says when every student is in a team', () => {
    const placed = [{ ...teams[0], studentIds: [1, 2, 3] }]
    expect(tile(all({ teams: ok(placed) }), 'students').hint).toBe('All are in a team')
  })

  it('describes the teams: sizes, missing mentors, none yet, demo data', () => {
    expect(tile(all(), 'teams')).toMatchObject({ value: 2, hint: '0–2 students each' })
    const noMentor = [...teams, { id: 't3', name: 'Team 3', mentorId: null, studentIds: [3] }]
    expect(tile(all({ teams: ok(noMentor) }), 'teams').hint).toBe('1 without a mentor')
    expect(tile(all({ teams: ok([]) }), 'teams')).toMatchObject({ value: 0, hint: 'No teams yet' })
    expect(tile(all(), 'teams', { demoTeams: true }).hint).toBe('Demo data: the backend has no teams yet')
  })

  it('counts upcoming school events only: not past ones, deadlines or 1:1 times', () => {
    const events = [
      event('past', 'lecture', '2026-11-01T10:00:00Z'),
      event('now', 'meeting', '2026-11-07T11:00:00Z', '2026-11-07T13:00:00Z'), // still going on
      event('later', 'lecture', '2026-11-10T10:00:00Z'),
      event('trip', 'off-campus', '2026-11-12T08:00:00Z'),
      event('due', 'deadline', '2026-11-09T20:00:00Z'),
      event('slot', 'availability', '2026-11-08T10:00:00Z'),
    ]
    const t = tile(all({ events: ok(events) }), 'calendar')
    expect(t.value).toBe(3)
    expect(t.hint).toMatch(/^Next: Event now, /)
    expect(tile(all(), 'calendar')).toMatchObject({ value: 0, hint: 'Nothing planned' })
  })

  it('a source that failed shows no number, and the others still work', () => {
    const tiles = overviewTiles(all({ users: failed, events: failed }), NOW)
    const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]))
    for (const k of ['students', 'mentors', 'lecturers', 'calendar']) expect(byKey[k]).toMatchObject({ value: null, hint: 'Could not load' })
    expect(byKey.modules.value).toBe(2)
    expect(byKey.teams.value).toBe(2)
  })
})
