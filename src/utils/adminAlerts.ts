import type { Broadcast } from '../mocks/broadcasts'
import type { SchoolTeam, SchoolUser } from '../types/admin'
import type { CalendarEvent } from '../types/calendar'
import type { CourseModule } from '../types/course'
import { isSchoolEvent } from './adminCalendar'
import { daysLeft } from './adminRoles'
import { formatShortDate } from './date'
import { TEAM_LIMIT } from './adminPeople'
import { isStudent } from './roles'

/**
 * What the admin should know about right now, worked out from the school's data (nothing is stored):
 * "attention" items are things to fix, "info" items are things that happened lately.
 */
export interface AdminAlert {
  id: string
  level: 'attention' | 'info'
  title: string
  detail?: string
  /** Where to fix it, and what the link says. */
  to: string
  action: string
}

export interface AlertData {
  modules: CourseModule[]
  users: SchoolUser[]
  teams: SchoolTeam[]
  events: CalendarEvent[]
  /** Announcements the admin sent (newest first). */
  sent: Broadcast[]
}

const DAY = 86_400_000
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
/** "A, B and C"; more than `max` names end with "and 2 more". */
function names(list: string[], max = 3): string {
  if (list.length <= max) return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : (list[0] ?? '')
  return `${list.slice(0, max).join(', ')} and ${list.length - max} more`
}

/** How soon a lecture without a link is worth a warning. */
export const LINK_WARNING_HOURS = 48
/** Role ends and recent happenings are looked at over this many days. */
export const LATELY_DAYS = 7

export function buildAlerts(data: AlertData, now: Date): AdminAlert[] {
  const out: AdminAlert[] = []
  const nowMs = now.getTime()
  const people = data.users.filter((u) => !u.leftAt)
  const students = people.filter(isStudent)

  // ---------- attention ----------

  // weeks without a lecturer: the ones that are on or open soon are urgent, the rest are only mentioned
  const bare = data.modules.filter((m) => m.createdBy === undefined).sort((a, b) => a.position - b.position)
  const soon = (m: CourseModule) => !!m.opensAt && !!m.closesAt && new Date(m.closesAt).getTime() >= nowMs && new Date(m.opensAt).getTime() <= nowMs + 14 * DAY
  for (const m of bare.filter(soon)) {
    const on = new Date(m.opensAt as string).getTime() <= nowMs
    out.push({
      id: `no-lecturer-${m.id}`,
      level: 'attention',
      title: `Week ${m.position} (${m.title}) has no lecturer`,
      detail: on ? 'It is running now.' : `It opens ${formatShortDate(m.opensAt as string)}.`,
      to: '/admin/lecturers',
      action: 'Assign a lecturer',
    })
  }
  const later = bare.filter((m) => !soon(m))
  if (later.length > 0) {
    out.push({
      id: 'no-lecturer-later',
      level: 'info',
      title: `${plural(later.length, 'week')} still without a lecturer`,
      detail: `Week${later.length === 1 ? '' : 's'} ${later.map((m) => m.position).join(', ')}.`,
      to: '/admin/lecturers',
      action: 'Assign lecturers',
    })
  }

  if (students.length > 0 && data.teams.length === 0) {
    out.push({
      id: 'no-teams',
      level: 'attention',
      title: 'There are no teams yet',
      detail: `${plural(students.length, 'student')} waiting.`,
      to: '/admin/teams',
      action: 'Create teams',
    })
  }

  const noMentor = data.teams.filter((t) => t.mentorId === null)
  if (noMentor.length > 0) {
    out.push({
      id: 'teams-no-mentor',
      level: 'attention',
      title: `${plural(noMentor.length, 'team')} without a mentor`,
      detail: names(noMentor.map((t) => t.name)),
      to: '/admin/teams',
      action: 'Pick mentors',
    })
  }

  if (data.teams.length > 0) {
    const placed = new Set(data.teams.flatMap((t) => t.studentIds))
    const loose = students.filter((s) => !placed.has(s.id))
    if (loose.length > 0) {
      out.push({
        id: 'students-no-team',
        level: 'attention',
        title: `${plural(loose.length, 'student')} not in a team`,
        detail: names(loose.map((s) => s.name)),
        to: '/admin/teams',
        action: 'Put them in a team',
      })
    }
  }

  // lectures that start soon and have no meeting link yet
  const unlinked = data.events
    .filter((e) => {
      if (!isSchoolEvent(e) || e.kind !== 'lecture' || e.meetingUrl) return false
      const start = new Date(e.startsAt).getTime()
      return start > nowMs && start <= nowMs + LINK_WARNING_HOURS * 3_600_000
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  for (const e of unlinked) {
    out.push({
      id: `no-link-${e.id}`,
      level: 'attention',
      title: `${e.title} on ${formatShortDate(e.startsAt)} has no meeting link`,
      detail: 'Students cannot join from the LMS until the lecturer adds it.',
      to: '/admin/calendar',
      action: 'Add the link',
    })
  }

  // roles that end by themselves soon
  for (const u of people) {
    for (const [role, until] of Object.entries(u.roleUntil ?? {})) {
      if (!until) continue
      const left = daysLeft(until, now)
      if (new Date(until).getTime() < nowMs || left > LATELY_DAYS) continue
      out.push({
        id: `role-ends-${u.id}-${role}`,
        level: left <= 3 ? 'attention' : 'info',
        title: `${u.name}’s ${role} role ends ${left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`}`,
        detail: `Last day: ${formatShortDate(until)}.`,
        to: role === 'mentor' ? '/admin/mentors' : '/admin/lecturers',
        action: 'Change the roles',
      })
    }
  }

  // ---------- info ----------

  const over = data.teams.filter((t) => t.studentIds.length > TEAM_LIMIT)
  if (over.length > 0) {
    out.push({
      id: 'teams-over',
      level: 'info',
      title: `${plural(over.length, 'team')} with more than ${TEAM_LIMIT} students`,
      detail: names(over.map((t) => `${t.name} (${t.studentIds.length})`)),
      to: '/admin/teams',
      action: 'Open teams',
    })
  }

  if (data.teams.length > 0) {
    const leading = new Set(data.teams.map((t) => t.mentorId).filter((id): id is number => id !== null))
    const idle = people.filter((u) => u.roles.includes('mentor') && !leading.has(u.id))
    if (idle.length > 0) {
      out.push({
        id: 'mentors-no-team',
        level: 'info',
        title: `${plural(idle.length, 'mentor')} without a team`,
        detail: names(idle.map((u) => u.name)),
        to: '/admin/mentors',
        action: 'Open mentors',
      })
    }
  }

  const leftLately = data.users.filter((u) => u.leftAt && nowMs - new Date(u.leftAt).getTime() <= LATELY_DAYS * DAY)
  for (const u of leftLately) {
    out.push({
      id: `left-${u.id}`,
      level: 'info',
      title: `${u.name} left the school`,
      detail: formatShortDate(u.leftAt as string),
      to: '/admin/students',
      action: 'Open students',
    })
  }

  for (const b of data.sent.filter((s) => nowMs - new Date(s.sentAt).getTime() <= LATELY_DAYS * DAY).slice(0, 5)) {
    out.push({
      id: `sent-${b.id}`,
      level: 'info',
      title: `You sent “${b.message.length > 70 ? `${b.message.slice(0, 70)}…` : b.message}”`,
      detail: `${formatShortDate(b.sentAt)} · ${plural(b.recipients, 'person', 'people')}`,
      to: '/admin/announce',
      action: 'Open announcements',
    })
  }

  // things to fix first
  return [...out.filter((a) => a.level === 'attention'), ...out.filter((a) => a.level === 'info')]
}

export const attentionCount = (alerts: AdminAlert[]) => alerts.filter((a) => a.level === 'attention').length
