import type { User } from '../types/user'
import { hasRole, isAdmin, isStudent } from './roles'

/** Who an announcement goes to. */
export type Audience = 'all' | 'students' | 'mentors' | 'lecturers'

export const AUDIENCES: Audience[] = ['all', 'students', 'mentors', 'lecturers']

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'Everyone',
  students: 'Students',
  mentors: 'Mentors',
  lecturers: 'Lecturers',
}

/** Longest announcement (the backend limit is the same). */
export const MAX_MESSAGE = 500

/** Pages an announcement can point to (the same route works for everyone who may open it). */
export const LINK_CHOICES: { value: string; label: string }[] = [
  { value: '', label: 'No link' },
  { value: '/calendar', label: 'Calendar' },
  { value: '/office-tour', label: 'Office tour' },
]

type Someone = Pick<User, 'roles' | 'roleUntil'>

/** Admins are not part of the school's "everyone": they do not use the LMS pages the bell is in. */
export function inAudience(user: Someone, audience: Audience, now: Date = new Date()): boolean {
  if (isAdmin(user)) return false
  switch (audience) {
    case 'all':
      return true
    case 'students':
      return isStudent(user)
    case 'mentors':
      return hasRole(user, 'mentor', now)
    case 'lecturers':
      return hasRole(user, 'lecturer', now)
  }
}

/** How many of these people each audience reaches. */
export function audienceCounts(users: Array<Someone & { leftAt?: string }>, now: Date = new Date()): Record<Audience, number> {
  const active = users.filter((u) => !u.leftAt)
  return Object.fromEntries(AUDIENCES.map((a) => [a, active.filter((u) => inAudience(u, a, now)).length])) as Record<Audience, number>
}

export const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`
