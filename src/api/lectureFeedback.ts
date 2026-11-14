import { addFeedback, pendingLectures } from '../mocks/lectureFeedback'
import type { FormQuestion, LectureAnswers, PendingLecture } from '../types/lectureFeedback'
import { cleanAnswers, LECTURE_FORM, SENT_ALREADY } from '../utils/lectureFeedback'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * Lecture feedback (backend docs/lecture_feedback.md). Real backend when VITE_API_URL is set, the demo store otherwise.
 *   GET  /lecture-feedback/form      the questions, in order (any signed-in user)
 *   GET  /lecture-feedback/pending   the lectures whose form is open for the student and not yet sent (students only)
 *   POST /lecture-feedback           { event_id, overall, clarity, practice, pace, confidence, liked?, improve? }
 * Students only: a server without the routes (404/405/501), or an account that is not only a student (403), means
 * "no feedback to give", so the page shows nothing instead of an error.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

interface QuestionDto {
  id: string
  type: string
  label: string
  required?: boolean
  min_label?: string
  max_label?: string
  options?: { value: string; label: string }[]
  max_length?: number
}

interface PendingDto {
  event_id: number | string
  title: string
  starts_at: string
  ends_at: string
  module_id?: number | string | null
  module_title?: string | null
  closes_at: string
}

const notThere = (e: unknown) =>
  e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501 || e.status === 403)

/** One server question. A kind of question the page cannot draw is left out (the server then decides if it was needed). */
export function mapQuestion(q: QuestionDto): FormQuestion | null {
  const base = { id: q.id, label: q.label, required: !!q.required }
  if (q.type === 'scale')
    return {
      ...base,
      type: 'scale',
      ...(q.min_label ? { minLabel: q.min_label } : {}),
      ...(q.max_label ? { maxLabel: q.max_label } : {}),
    }
  if (q.type === 'choice' && q.options?.length) return { ...base, type: 'choice', options: q.options }
  if (q.type === 'text') return { ...base, type: 'text', maxLength: q.max_length ?? 1000 }
  return null
}

export const mapPending = (p: PendingDto): PendingLecture => ({
  eventId: String(p.event_id),
  title: p.title,
  startsAt: p.starts_at,
  endsAt: p.ends_at,
  ...(p.module_id != null ? { moduleId: String(p.module_id) } : {}),
  ...(p.module_title ? { moduleTitle: p.module_title } : {}),
  closesAt: p.closes_at,
})

/** The questions: the server's, or the built-in copy when it cannot send them. */
export async function fetchLectureForm(): Promise<FormQuestion[]> {
  if (hasBackend()) {
    try {
      const questions = (await authedRequest<QuestionDto[] | null>('/lecture-feedback/form')) ?? []
      const form = questions.map(mapQuestion).filter((q): q is FormQuestion => q !== null)
      return form.length > 0 ? form : LECTURE_FORM
    } catch {
      return LECTURE_FORM
    }
  }
  return LECTURE_FORM
}

/** The lectures to rate now, or `null` when this server or account has no lecture feedback. */
export async function fetchPendingLectures(studentId: number): Promise<PendingLecture[] | null> {
  if (hasBackend()) {
    try {
      const rows = (await authedRequest<PendingDto[] | null>('/lecture-feedback/pending')) ?? []
      return rows.map(mapPending)
    } catch (e) {
      if (notThere(e)) return null
      throw e
    }
  }
  await wait()
  return pendingLectures(studentId)
}

/**
 * Sends the form of one lecture. Resolves when it is stored, and also when the server says it was already sent (409,
 * e.g. from another tab): that is what the student wanted. Other failures reject with the server's own message.
 */
export async function sendLectureFeedback(
  studentId: number,
  eventId: string,
  form: FormQuestion[],
  answers: LectureAnswers,
): Promise<void> {
  const body = cleanAnswers(form, answers)
  if (hasBackend()) {
    try {
      await authedRequest('/lecture-feedback', {
        method: 'POST',
        body: {
          event_id: /^\d+$/.test(eventId) ? Number(eventId) : eventId,
          ...body,
        },
      })
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) throw e
    }
    return
  }
  await wait()
  try {
    addFeedback(studentId, eventId, body)
  } catch (e) {
    if (e instanceof Error && e.message === SENT_ALREADY) return
    throw e
  }
}
