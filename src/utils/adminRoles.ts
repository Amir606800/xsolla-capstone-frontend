import type { Role, User } from '../types/user'
import { formatShortDate } from './date'

const DAY = 86_400_000
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Calendar days from today to the day of `iso`: 0 when it ends today (never below 0). */
export function daysLeft(iso: string, now: Date): number {
  return Math.max(0, Math.round((midnight(new Date(iso)) - midnight(now)) / DAY))
}

export interface RoleBadge {
  role: Role
  label: string
  /** For a role given until a date: "until Dec 1 · 24 days left". */
  detail?: string
  /** Ends within a week. */
  endingSoon?: boolean
}

const NAMES: Record<Role, string> = { student: 'Student', mentor: 'Mentor', lecturer: 'Lecturer', admin: 'Admin' }

/** The staff roles someone holds now, for the role pills. */
export function roleBadges(user: Pick<User, 'roles' | 'roleUntil'>, now: Date): RoleBadge[] {
  return (['mentor', 'lecturer', 'admin'] as const)
    .filter((r) => user.roles.includes(r))
    .map((role) => {
      const until = user.roleUntil?.[role]
      if (!until) return { role, label: NAMES[role] }
      const left = daysLeft(until, now)
      return {
        role,
        label: NAMES[role],
        detail: `until ${formatShortDate(until)} · ${left === 0 ? 'ends today' : left === 1 ? '1 day left' : `${left} days left`}`,
        endingSoon: left <= 7,
      }
    })
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
