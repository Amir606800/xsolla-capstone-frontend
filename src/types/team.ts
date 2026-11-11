/** A person on the team page: a student or the mentor. */
export interface Person {
  id: number
  name: string
  email: string
}

/**
 * The student's own team. A cohort (28-30 students) is split into teams of 4-5 students,
 * and every team has exactly one mentor.
 */
export interface Team {
  id: string
  name: string
  /** Missing while the admin has not given the team a mentor. */
  mentor?: Person
  /** The students in the team, including the signed-in student. */
  members: Person[]
  /** Everyone in the cohort and how many teams it is split into (for the note at the bottom). */
  cohortSize: number
  teamCount: number
}
