import { addReview, reviewedWeeks } from '../mocks/mentorReviews'
import type { MentorReview, ReviewedWeek } from '../types/mentorReview'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * Weekly mentor reviews (BACKEND_REQUIREMENTS.md). Real backend when VITE_API_URL is set, the demo store otherwise.
 *   GET  /mentor-reviews/me   the weeks the signed-in student has reviewed -> [{ module_id, submitted_at }]
 *   POST /mentor-reviews      { module_id, had_session, no_session_reason?, topics?, other_topic?, ratings?, overall, comment? }
 * A server that does not have these routes yet answers 404/405: the feature is then switched off (`null`), so nobody
 * is locked out by a review that cannot be saved.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

interface ReviewedDto {
  module_id: number | string
  submitted_at: string
}

const missingRoute = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)

/** The weeks already reviewed, or `null` when the server has no mentor reviews yet. */
export async function fetchReviewedWeeks(studentId: number): Promise<ReviewedWeek[] | null> {
  if (hasBackend()) {
    try {
      const rows = (await authedRequest<ReviewedDto[] | null>('/mentor-reviews/me')) ?? []
      return rows.map((r) => ({ moduleId: String(r.module_id), submittedAt: r.submitted_at }))
    } catch (e) {
      if (missingRoute(e)) return null
      throw e
    }
  }
  await wait()
  return reviewedWeeks(studentId)
}

/** The review as the server takes it. Parts that do not apply are left out, never sent empty. */
export function reviewToApi(r: MentorReview) {
  return {
    module_id: /^\d+$/.test(r.moduleId) ? Number(r.moduleId) : r.moduleId,
    had_session: r.hadSession,
    ...(r.noSessionReason ? { no_session_reason: r.noSessionReason } : {}),
    ...(r.topics ? { topics: r.topics } : {}),
    ...(r.otherTopic ? { other_topic: r.otherTopic } : {}),
    ...(r.ratings ? { ratings: r.ratings } : {}),
    overall: r.overall,
    ...(r.comment ? { comment: r.comment } : {}),
  }
}

/** Sends the review of one week and returns the weeks reviewed so far. `mentorId` is only kept by the demo store. */
export async function submitReview(studentId: number, mentorId: number | undefined, review: MentorReview): Promise<ReviewedWeek[]> {
  if (hasBackend()) {
    try {
      await authedRequest('/mentor-reviews', { method: 'POST', body: reviewToApi(review) })
    } catch (e) {
      // 409 = already sent (e.g. from another tab): that is what we wanted
      if (!(e instanceof ApiError && e.status === 409)) throw e
    }
    return (await fetchReviewedWeeks(studentId)) ?? []
  }
  await wait()
  return addReview(studentId, mentorId, review)
}
