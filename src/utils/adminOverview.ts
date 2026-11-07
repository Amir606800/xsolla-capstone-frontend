import type { AdminSectionKey } from '../config/adminNav'
import type { SchoolTeam } from '../types/admin'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import type { User } from '../types/user'
import { canMentor, hasRole, isStudent } from './roles'
import { formatShortDate } from './date'

/** One data source of the overview: loaded, or failed (the tile then says so). */
export type Loaded<T> = { ok: true; value: T } | { ok: false }

export interface OverviewData {
  modules: Loaded<CourseModule[]>
  users: Loaded<User[]>
  teams: Loaded<SchoolTeam[]>
  events: Loaded<CalendarEvent[]>
}

export interface OverviewTile {
  key: AdminSectionKey
  /** null when its data could not be loaded */
  value: number | null
  hint: string
}

const FAILED = 'Could not load'
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Events the admin manages on the calendar: not task deadlines or 1:1 times. */
const SCHOOL_EVENTS: readonly CalendarEvent['kind'][] = ['lecture', 'meeting', 'off-campus']

/** The overview's count tiles, in sidebar order. */
export function overviewTiles(data: OverviewData, now: Date, opts: { demoTeams?: boolean } = {}): OverviewTile[] {
  const { modules, users, teams, events } = data
  const people = users.ok ? users.value : []
  const students = people.filter(isStudent)
  const mentors = people.filter(canMentor)
  const lecturers = people.filter((u) => hasRole(u, 'lecturer'))
  const both = mentors.filter((u) => hasRole(u, 'lecturer')).length

  const tiles: OverviewTile[] = []

  if (modules.ok) {
    const items = modules.value.flatMap((m) => m.items)
    const count = (type: string) => items.filter((i) => i.type === type).length
    tiles.push({
      key: 'modules',
      value: modules.value.length,
      hint: `${plural(count('assignment'), 'task')} · ${plural(count('resource'), 'resource')} · ${plural(count('quiz'), 'quiz', 'quizzes')}`,
    })
  } else tiles.push({ key: 'modules', value: null, hint: FAILED })

  if (events.ok) {
    const upcoming = events.value
      .filter((e) => SCHOOL_EVENTS.includes(e.kind) && new Date(e.endsAt) >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const next = upcoming[0]
    tiles.push({
      key: 'calendar',
      value: upcoming.length,
      hint: next ? `Next: ${next.title}, ${formatShortDate(next.startsAt)}` : 'Nothing planned',
    })
  } else tiles.push({ key: 'calendar', value: null, hint: FAILED })

  if (users.ok) {
    let studentHint = 'Accounts with the student role'
    if (teams.ok) {
      const placed = new Set(teams.value.flatMap((t) => t.studentIds))
      const outside = students.filter((s) => !placed.has(s.id)).length
      studentHint = outside > 0 ? `${outside} not in a team` : 'All are in a team'
    }
    tiles.push({ key: 'students', value: students.length, hint: studentHint })
    tiles.push({ key: 'mentors', value: mentors.length, hint: both > 0 ? `${both} also ${both === 1 ? 'lectures' : 'lecture'}` : 'Mentors only' })
    tiles.push({ key: 'lecturers', value: lecturers.length, hint: both > 0 ? `${both} also ${both === 1 ? 'mentors' : 'mentor'}` : 'Lecturers only' })
  } else {
    for (const key of ['students', 'mentors', 'lecturers'] as const) tiles.push({ key, value: null, hint: FAILED })
  }

  if (teams.ok) {
    const list = teams.value
    const noMentor = list.filter((t) => t.mentorId === null).length
    const sizes = list.map((t) => t.studentIds.length)
    let hint = 'No teams yet'
    if (opts.demoTeams) hint = 'Demo data: the backend has no teams yet'
    else if (noMentor > 0) hint = `${noMentor} without a mentor`
    else if (list.length > 0) {
      const min = Math.min(...sizes)
      const max = Math.max(...sizes)
      hint = `${min === max ? min : `${min}–${max}`} students each`
    }
    tiles.push({ key: 'teams', value: list.length, hint })
  } else tiles.push({ key: 'teams', value: null, hint: FAILED })

  return tiles
}
