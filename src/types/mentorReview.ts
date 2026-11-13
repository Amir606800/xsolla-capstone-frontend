/**
 * The weekly mentor review: every student rates the week with their mentor. One review per student and week
 * (a module is a week); it is mandatory, and the LMS stays locked for a student who owes last week's review.
 */

/** What the 1:1 was about. `other` comes with free text. */
export const REVIEW_TOPICS = ['goals', 'homework', 'lecture', 'project', 'career', 'other'] as const
export type ReviewTopic = (typeof REVIEW_TOPICS)[number]

/** Why there was no session, when the student says there was none. */
export const NO_SESSION_REASONS = ['mentor-unavailable', 'student-unavailable', 'not-scheduled', 'other'] as const
export type NoSessionReason = (typeof NO_SESSION_REASONS)[number]

/** The statements rated 1 (strongly disagree) to 5 (strongly agree). */
export const REVIEW_STATEMENTS = ['clarity', 'engagement', 'comfort', 'time'] as const
export type ReviewStatement = (typeof REVIEW_STATEMENTS)[number]

export type Score = 1 | 2 | 3 | 4 | 5

export interface MentorReview {
  /** The week being reviewed (the module's id). */
  moduleId: string
  /** Did the 1:1 session take place this week? */
  hadSession: boolean
  /** Only when there was no session. */
  noSessionReason?: NoSessionReason
  /** Only when there was a session: at least one. */
  topics?: ReviewTopic[]
  /** The text for the `other` topic. */
  otherTopic?: string
  /** Only when there was a session: every statement. */
  ratings?: Record<ReviewStatement, Score>
  /** Overall satisfaction with the mentor's support this week, always asked. */
  overall: Score
  comment?: string
}

/** A week the student has already reviewed. */
export interface ReviewedWeek {
  moduleId: string
  submittedAt: string
}
