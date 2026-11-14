import { adminReviews, missingReviews } from '../mocks/adminReviews'
import { NO_SESSION_REASONS, REVIEW_STATEMENTS, REVIEW_TOPICS } from '../types/mentorReview'
import type { AdminReview, MissingReview, NoSessionReason, ReviewStatement, ReviewTopic, Score } from '../types/mentorReview'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * The admin's Mentor reviews page (backend docs/mentor_reviews.md, "Reading the reviews", admin only).
 *   GET /mentor-reviews                      every review with every answer; the page filters and averages them itself
 *   GET /mentor-reviews/missing?module_id=   the students who have not sent that week's review
 * (`GET /mentor-reviews/summary` exists too; the page works the same numbers out from the list, so it is not called.)
 * A server without a route answers 404/405/501: the page then says so (`null`) instead of showing an error.
 * With no backend at all the demo reviews are shown.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

interface PersonDto {
  id: number
  name: string
  email?: string
}

export interface AdminReviewDto {
  id: number | string
  module_id: number | string
  module_title?: string | null
  student: PersonDto
  mentor: PersonDto
  /** null when the team was deleted */
  team?: { id: number; name: string } | null
  had_session: boolean
  no_session_reason?: string | null
  topics?: string[] | null
  other_topic?: string | null
  /** null for a week without a session */
  ratings?: Partial<Record<string, number | null>> | null
  overall: number
  comment?: string | null
  submitted_at: string
}

export interface MissingReviewDto {
  student: PersonDto
  team?: { id: number; name: string } | null
  mentor: PersonDto
}

const missingRoute = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)

const score = (n: unknown): Score | undefined => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Score) : undefined)

/** One server row as the page uses it. A value the page does not know (a new topic, say) is ignored; a row with no usable overall score is dropped. */
export function mapAdminReview(d: AdminReviewDto): AdminReview | null {
  const overall = score(d.overall)
  if (overall === undefined) return null
  const ratings: Partial<Record<ReviewStatement, Score>> = {}
  for (const s of REVIEW_STATEMENTS) {
    const v = score(d.ratings?.[s])
    if (v !== undefined) ratings[s] = v
  }
  const reason = NO_SESSION_REASONS.find((r) => r === d.no_session_reason) as NoSessionReason | undefined
  const topics = (d.topics ?? []).filter((t): t is ReviewTopic => (REVIEW_TOPICS as readonly string[]).includes(t))
  return {
    id: String(d.id),
    moduleId: String(d.module_id),
    ...(d.module_title ? { moduleTitle: d.module_title } : {}),
    studentId: d.student.id,
    studentName: d.student.name,
    mentorId: d.mentor.id,
    mentorName: d.mentor.name,
    ...(d.team ? { teamName: d.team.name } : {}),
    hadSession: !!d.had_session,
    ...(!d.had_session && reason ? { noSessionReason: reason } : {}),
    topics,
    ...(d.other_topic ? { otherTopic: d.other_topic } : {}),
    ratings,
    overall,
    ...(d.comment ? { comment: d.comment } : {}),
    submittedAt: d.submitted_at,
  }
}

export const mapMissingReview = (d: MissingReviewDto): MissingReview => ({
  studentId: d.student.id,
  studentName: d.student.name,
  mentorId: d.mentor.id,
  mentorName: d.mentor.name,
  ...(d.team ? { teamName: d.team.name } : {}),
})

/** All the reviews, or `null` when the server has no such route yet. */
export async function fetchAllReviews(): Promise<AdminReview[] | null> {
  if (hasBackend()) {
    try {
      const rows = (await authedRequest<AdminReviewDto[] | null>('/mentor-reviews')) ?? []
      return rows.map(mapAdminReview).filter((r): r is AdminReview => r !== null)
    } catch (e) {
      if (missingRoute(e)) return null
      throw e
    }
  }
  await wait()
  return adminReviews()
}

/**
 * The students who still owe the review of one week, or `null` when the server cannot say (no such route, or it does
 * not know the week). The page leaves that part out then: it is an extra, not the page.
 */
export async function fetchMissingReviews(moduleId: string): Promise<MissingReview[] | null> {
  if (hasBackend()) {
    try {
      const rows = (await authedRequest<MissingReviewDto[] | null>(`/mentor-reviews/missing?module_id=${encodeURIComponent(moduleId)}`)) ?? []
      return rows.map(mapMissingReview)
    } catch (e) {
      if (missingRoute(e)) return null
      throw e
    }
  }
  await wait()
  return missingReviews(moduleId)
}
