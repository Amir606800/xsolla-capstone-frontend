import { PACES } from '../types/lectureReview'
import type { AdminLectureReview, Pace } from '../types/lectureReview'
import type { Score } from '../types/mentorReview'
import { authedRequest } from './authed'
import { ApiError } from './http'

/**
 * Every lecture feedback, for the admin's Lecture reviews page (backend docs/lecture_feedback.md, admin only).
 *   GET /lecture-feedback   every form with all answers, the lecture, and the lecturers of the lecture's week
 * The page filters, averages and groups them itself, so no filter is sent. (`GET /lecture-feedback/summary` has the same
 * numbers per lecture plus how many students were expected; the page does not use it yet.) A server without the route
 * answers 404/405/501: `null`, and the page says so.
 */
interface PersonDto {
  id: number
  name: string
  email?: string
}

export interface LectureFeedbackDto {
  id: number | string
  lecture: {
    event_id: number | string
    title: string
    starts_at: string
    ends_at: string
    module_id?: number | string | null
    module_title?: string | null
  }
  /** `[]` for a lecture without a week. */
  lecturers?: PersonDto[] | null
  student: PersonDto
  overall: number
  clarity: number
  practice: number
  pace: string
  confidence: number
  liked?: string | null
  improve?: string | null
  submitted_at: string
}

const missingRoute = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)
const score = (n: unknown): Score | undefined => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Score) : undefined)

/** One server row as the page uses it. A row with a score or pace the page does not know is dropped (it cannot be averaged). */
export function mapLectureReview(d: LectureFeedbackDto): AdminLectureReview | null {
  const overall = score(d.overall)
  const clarity = score(d.clarity)
  const practice = score(d.practice)
  const confidence = score(d.confidence)
  const pace = PACES.find((p) => p === d.pace) as Pace | undefined
  if (overall === undefined || clarity === undefined || practice === undefined || confidence === undefined || pace === undefined) return null
  const liked = d.liked?.trim()
  const improve = d.improve?.trim()
  return {
    id: String(d.id),
    lecture: {
      eventId: String(d.lecture.event_id),
      title: d.lecture.title,
      startsAt: d.lecture.starts_at,
      endsAt: d.lecture.ends_at,
      ...(d.lecture.module_id != null ? { moduleId: String(d.lecture.module_id) } : {}),
      ...(d.lecture.module_title ? { moduleTitle: d.lecture.module_title } : {}),
    },
    lecturers: (d.lecturers ?? []).map((l) => ({ id: l.id, name: l.name })),
    studentId: d.student.id,
    studentName: d.student.name,
    overall,
    clarity,
    practice,
    confidence,
    pace,
    ...(liked ? { liked } : {}),
    ...(improve ? { improve } : {}),
    submittedAt: d.submitted_at,
  }
}

/** All the lecture reviews, or `null` when the server has no such route yet. */
export async function fetchLectureReviews(): Promise<AdminLectureReview[] | null> {
  try {
    const rows = (await authedRequest<LectureFeedbackDto[] | null>('/lecture-feedback')) ?? []
    return rows.map(mapLectureReview).filter((r): r is AdminLectureReview => r !== null)
  } catch (e) {
    if (missingRoute(e)) return null
    throw e
  }
}
