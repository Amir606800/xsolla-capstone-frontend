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
