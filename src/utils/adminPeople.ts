import type { SchoolTeam } from '../types/admin'
import type { User } from '../types/user'

/** Most students a team should have (the program's teams are 4-5 students). */
export const TEAM_LIMIT = 5

/** user id -> the team they are a student in. */
export function teamByStudent(teams: SchoolTeam[]): Map<number, SchoolTeam> {
  const map = new Map<number, SchoolTeam>()
  for (const t of teams) for (const id of t.studentIds) map.set(id, t)
  return map
}

/** Case-insensitive match on name or e-mail; an empty query matches everyone. */
export function matchesQuery(user: Pick<User, 'name' | 'email'>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
}

/** Team filter value: a team id, everyone, or the students in no team. */
export type TeamFilter = 'all' | 'none' | string

export function inTeamFilter(userId: number, filter: TeamFilter, byStudent: Map<number, SchoolTeam>): boolean {
  if (filter === 'all') return true
  const team = byStudent.get(userId)
  return filter === 'none' ? !team : team?.id === filter
}

// no 0/O or 1/l/I, so a password read out or copied by hand is not mistyped
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** A random password the admin can hand to a new student (they can change it later). */
export function generatePassword(length = 12, random: (n: number) => Uint32Array = (n) => crypto.getRandomValues(new Uint32Array(n))): string {
  return Array.from(random(length), (v) => ALPHABET[v % ALPHABET.length]).join('')
}
