import type { Role, User } from './user'

/**
 * An account as the admin sees it.
 *  - `leftAt` is set once a student has left the school (the account is kept).
 *  - `mainRole` is the role the account was created with (a mentor is a mentor, a lecturer a lecturer).
 *    It never changes and never ends; an admin can only add the other staff role on top, and take that back.
 */
export type SchoolUser = User & { leftAt?: string; mainRole?: Role }

/**
 * The admin's view of a team: who mentors it and which students are in it (by user id).
 * A cohort is split into teams of 4-5 students with one mentor each.
 */
export interface SchoolTeam {
  id: string
  name: string
  /** null while the team has no mentor yet */
  mentorId: number | null
  studentIds: number[]
}
