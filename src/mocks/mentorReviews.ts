import type { CourseModule } from '../types/course'
import type { MentorReview, ReviewedWeek } from '../types/mentorReview'
import { listModules } from './contentEdits'

/**
 * Demo store of the weekly mentor reviews (localStorage). So the demo is usable out of the box, every demo student
 * counts as having reviewed all the weeks that have started. To see the feature, set the flag in the browser console:
 *   localStorage.setItem('mentor_review_demo', 'locked')    last week's review is missing: the LMS is locked
 *   localStorage.setItem('mentor_review_demo', 'reminder')  this week's review is open, as on a weekend
 * Sending the review clears the situation; remove `mentor_reviews` to start again.
 * With a real back-end the flag still works: the weeks are then the server's (`modules` below) and the review is kept
 * in the browser only, for trying the screens before the server has the routes.
 */
const KEY = 'mentor_reviews'
const FLAG = 'mentor_review_demo'

type Stored = MentorReview & { studentId: number; mentorId?: number; submittedAt: string }

function load(): Stored[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as Stored[]) : []
  } catch {
    return []
  }
}

export function demoMode(): 'locked' | 'reminder' | null {
  try {
    const v = localStorage.getItem(FLAG)
    return v === 'locked' || v === 'reminder' ? v : null
  } catch {
    return null
  }
}

/** The weeks this student has reviewed: what they sent, plus the demo's "already done" weeks. */
export function reviewedWeeks(studentId: number, now: Date = new Date(), modules: CourseModule[] = listModules(now)): ReviewedWeek[] {
  const sent = load().filter((r) => r.studentId === studentId)
  const out: ReviewedWeek[] = sent.map((r) => ({ moduleId: r.moduleId, submittedAt: r.submittedAt }))
  const started = modules.filter((m) => m.opensAt && new Date(m.opensAt) <= now)
  const finished = started.filter((m) => m.closesAt && new Date(m.closesAt) < now).sort((a, b) => (b.closesAt as string).localeCompare(a.closesAt as string))
  const running = started.find((m) => !m.closesAt || new Date(m.closesAt) >= now)
  const mode = demoMode()
  const missing = mode === 'locked' ? finished[0]?.id : mode === 'reminder' ? running?.id : undefined
  for (const m of started) {
    if (m.id === missing || out.some((r) => r.moduleId === m.id)) continue
    out.push({ moduleId: m.id, submittedAt: m.closesAt ?? now.toISOString() })
  }
  return out
}

export function addReview(
  studentId: number,
  mentorId: number | undefined,
  review: MentorReview,
  now: Date = new Date(),
  modules: CourseModule[] = listModules(now),
): ReviewedWeek[] {
  const rest = load().filter((r) => !(r.studentId === studentId && r.moduleId === review.moduleId))
  localStorage.setItem(KEY, JSON.stringify([...rest, { ...review, studentId, mentorId, submittedAt: now.toISOString() }]))
  return reviewedWeeks(studentId, now, modules)
}

/** Every stored review (for tests, and later the admin's analytics). */
export const listReviews = (): Stored[] => load()
