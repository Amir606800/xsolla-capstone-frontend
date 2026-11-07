import type { Role, User } from '../types/user'

/**
 * Who can do what. The app asks these questions instead of checking role names, so a mentor who
 * is given the lecturer role simply gets the lecturer parts added, and loses them again when the
 * role is taken away.
 *
 *   Mentor (one per team)          Lecturer (added by an admin)          Both / every staff member
 *   - My team page and card        - Course content and module editor   - Staff dashboard
 *   - 1:1 times (open, cancel)     - Tasks, materials, quizzes          - Calendar (view)
 *   - Weekly rating (coming)       - Lectures and events on calendar    - "Coming up" card
 *
 * Admins can author content too (they run the course) but are not a team's mentor.
 * The backend must enforce the same rules; these checks only decide what the screen shows.
 */

type Someone = Pick<User, 'roles' | 'roleUntil'> | null | undefined

/** The user holds the role now: it is theirs and, if it was given until a date, that date has not passed. */
export function hasRole(user: Someone, role: Role, now: Date = new Date()): boolean {
  if (!user?.roles.includes(role)) return false
  const until = user.roleUntil?.[role]
  return !until || new Date(until) > now
}

export const isStudent = (user: Someone) => hasRole(user, 'student')
/** Runs the school: works only in the separate admin section (/admin), not in the LMS pages. */
export const isAdmin = (user: Someone) => hasRole(user, 'admin')
/** Looks after one team: team page, 1:1 times, weekly ratings. */
export const canMentor = (user: Someone) => hasRole(user, 'mentor')
/** Writes the course: modules, tasks, materials, quizzes, lectures. */
export const canAuthor = (user: Someone) => hasRole(user, 'lecturer') || hasRole(user, 'admin')
/** Any staff member: gets the staff dashboard instead of the student pages. */
export const isStaff = (user: Someone) => !!user && !isStudent(user) && user.roles.length > 0

const KNOWN: readonly Role[] = ['student', 'mentor', 'lecturer', 'admin']

/**
 * Role names from the backend (or from an older saved session) -> the app's role set.
 * - "teacher" is the backend's current single staff role: it means mentor + lecturer.
 * - Unknown names are dropped; nothing usable left means the least access (student).
 */
export function rolesFrom(raw: unknown): Role[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const out = new Set<Role>()
  for (const r of list) {
    if (typeof r !== 'string') continue
    const name = r.trim().toLowerCase()
    if (name === 'teacher') {
      out.add('mentor')
      out.add('lecturer')
    } else if ((KNOWN as readonly string[]).includes(name)) {
      out.add(name as Role)
    }
  }
  // a student is never staff at the same time
  if (out.size > 1) out.delete('student')
  return out.size > 0 ? KNOWN.filter((r) => out.has(r)) : ['student']
}

/** Accepts a stored or returned user in the new shape ({ roles }) or the old one ({ role }). */
export function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as Partial<User> & { role?: unknown }
  if (typeof u.id !== 'number' && typeof u.id !== 'string') return null
  const roleUntil = untilFrom(u.roleUntil)
  return {
    id: Number(u.id),
    name: String(u.name ?? ''),
    email: String(u.email ?? ''),
    roles: rolesFrom(u.roles ?? u.role),
    ...(roleUntil ? { roleUntil } : {}),
  }
}

/** Keeps only known roles with a real date. */
export function untilFrom(raw: unknown): User['roleUntil'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: NonNullable<User['roleUntil']> = {}
  for (const [role, value] of Object.entries(raw as Record<string, unknown>)) {
    if ((KNOWN as readonly string[]).includes(role) && typeof value === 'string' && !Number.isNaN(Date.parse(value))) out[role as Role] = value
  }
  return Object.keys(out).length ? out : undefined
}

/** Short label for the account, e.g. "Mentor & lecturer". */
export function roleLabel(user: Someone): string {
  if (!user) return ''
  if (hasRole(user, 'admin')) return 'Admin'
  if (canMentor(user) && hasRole(user, 'lecturer')) return 'Mentor & lecturer'
  if (canMentor(user)) return 'Mentor'
  if (hasRole(user, 'lecturer')) return 'Lecturer'
  return 'Student'
}
