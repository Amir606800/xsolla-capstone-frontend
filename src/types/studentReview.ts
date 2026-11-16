import type { StandingLevel } from './standing'

/**
 * What a mentor says about one student for one week: the green / yellow / red grade and the module feedback that comes with
 * it. This is the admin's view of every mentor's grades, in one list (a student only ever sees their own; a mentor, their team's).
 */
export interface StudentReview {
  id: string
  /** The week the grade is for (the module's id); a module is a week. */
  moduleId: string
  /** The week's number (1-12), as the course numbers it. */
  week: number
  moduleTitle?: string
  studentId: number
  studentName: string
  /** The mentor who graded, or (when the server does not say) the mentor of the student's team. */
  mentorId?: number
  mentorName?: string
  teamName?: string
  level: StandingLevel
  /** The mentor's module feedback. Missing when the mentor wrote none, or when the server does not keep it yet. */
  note?: string
  /** When it was given (the week's closing date when the server does not say). */
  gradedAt: string
}
