import type { Role, User } from '../types/user'
import { formatShortDate } from './date'

const DAY = 86_400_000
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Calendar days from today to the day of `iso`: 0 when it ends today (never below 0). */
export function daysLeft(iso: string, now: Date): number {
  return Math.max(0, Math.round((midnight(new Date(iso)) - midnight(now)) / DAY))
}

export const ROLE_NAMES: Record<Role, string> = { student: 'Student', mentor: 'Mentor', lecturer: 'Lecturer', admin: 'Admin' }

/** The two staff roles: an account is created as one of them and can be given the other on top. */
export type StaffRole = 'mentor' | 'lecturer'
export const otherStaffRole = (role: StaffRole): StaffRole => (role === 'mentor' ? 'lecturer' : 'mentor')
export const isStaffRole = (role: Role | undefined): role is StaffRole => role === 'mentor' || role === 'lecturer'

type WithMain = Pick<User, 'roles' | 'roleUntil'> & { mainRole?: Role }

/**
 * The role the account was created with. It comes from the server (`main_role`); for an account
 * without one it is worked out from the roles: a student is a student, an admin an admin, and a
 * staff member is what they hold with no end date (mentor first: every staff member used to start as one).
 */
export function mainRoleOf(user: WithMain): Role {
  if (user.mainRole) return user.mainRole
  if (user.roles.includes('student')) return 'student'
  if (user.roles.includes('admin')) return 'admin'
  const lasting = (['mentor', 'lecturer'] as const).filter((r) => user.roles.includes(r) && !user.roleUntil?.[r])
  return lasting[0] ?? user.roles[0] ?? 'student'
}

export interface RoleBadge {
  role: Role
  label: string
  /** The role the account was created with (it cannot be changed). */
  main: boolean
  /** For a role given until a date: "until Dec 1 · 24 days left". */
  detail?: string
  /** Ends within a week. */
  endingSoon?: boolean
}

/** The staff roles someone holds now, for the role pills: the main role first, then the extra one. */
export function roleBadges(user: WithMain, now: Date): RoleBadge[] {
  const main = mainRoleOf(user)
  return (['mentor', 'lecturer', 'admin'] as const)
    .filter((r) => user.roles.includes(r))
    .sort((a, b) => Number(b === main) - Number(a === main))
    .map((role) => {
      const until = user.roleUntil?.[role]
      const base = { role, label: ROLE_NAMES[role], main: role === main }
      if (!until) return base
      const left = daysLeft(until, now)
      return {
        ...base,
        detail: `until ${formatShortDate(until)} · ${left === 0 ? 'ends today' : left === 1 ? '1 day left' : `${left} days left`}`,
        endingSoon: left <= 7,
      }
    })
}

/**
 * The roles to save when the extra role changes: the main role always stays (with no end date); the
 * extra role is off, until the end of a day, or with no end date.
 */
export function rolesWithExtra(
  main: StaffRole,
  extra: { on: false } | { on: true; until: string | null },
): { roles: Role[]; until: Partial<Record<Role, string>> } {
  if (!extra.on) return { roles: [main], until: {} }
  const other = otherStaffRole(main)
  return { roles: [main, other], until: extra.until ? { [other]: extra.until } : {} }
}

/** "Lecturer, and mentor until Dec 1." for the message after the roles were saved. */
export function rolesSummary(main: StaffRole, extra: { on: false } | { on: true; until: string | null }): string {
  const first = ROLE_NAMES[main]
  if (!extra.on) return `${first} only.`
  const other = ROLE_NAMES[otherStaffRole(main)].toLowerCase()
  return `${first}, and ${other}${extra.until ? ` until ${formatShortDate(extra.until)}` : ''}.`
}

/** The end of the given local day ("yyyy-mm-dd"), as ISO: a role "until Dec 1" lasts all of Dec 1. */
export function endOfDay(date: string): string | null {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

/** "yyyy-mm-dd" for the local day `days` after `now`. */
export function dayInput(now: Date, days = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
