import type { Score } from './mentorReview'

/**
 * A student's feedback on one lecture, as the admin reads it (backend docs/lecture_feedback.md, `GET /lecture-feedback`).
 * Only admins see these: lecturers, mentors and other students never do. For the admin pages and nothing else.
 */

export const PACES = ['too_slow', 'just_right', 'too_fast'] as const
export type Pace = (typeof PACES)[number]

export interface LectureLecturer {
  id: number
  name: string
}

export interface AdminLectureReview {
  id: string
  lecture: {
    /** The lecture's event id. */
    eventId: string
    title: string
    startsAt: string
    endsAt: string
    /** The week it belongs to; a lecture without one has no lecturer on the server. */
    moduleId?: string
    moduleTitle?: string
  }
  /** The lecturers of the lecture's week (events have no "created by"); none for a lecture without a week. */
  lecturers: LectureLecturer[]
  studentId: number
  studentName: string
  overall: Score
  clarity: Score
  practice: Score
  confidence: Score
  pace: Pace
  /** What worked well. */
  liked?: string
  /** What was unclear, or could be better. */
  improve?: string
  submittedAt: string
}
