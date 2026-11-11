import type { Submission } from './course'

/**
 * One student's work on one task, as their mentor sees it. Tasks are not graded (only the week
 * is): the mentor reads the work and may leave a comment, which the student sees as `feedback`.
 */
export interface TeamSubmission extends Submission {
  /** The server's id of this hand-in (the latest attempt); the demo store has none. */
  id?: string
  assignmentId: string
  studentId: number
  /** When the mentor last wrote or changed their comment. */
  commentedAt?: string
  commentedBy?: { id: number; name: string }
}
