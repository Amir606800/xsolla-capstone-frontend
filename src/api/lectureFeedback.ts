import type { FormQuestion, LectureAnswers, PendingLecture } from '../types/lectureFeedback'
import { cleanAnswers, LECTURE_FORM } from '../utils/lectureFeedback'
import { authedRequest } from './authed'
import { ApiError } from './http'

/**
 * Lecture feedback (backend docs/lecture_feedback.md).
 *   GET  /lecture-feedback/form      { questions: [...] } in order, plus the open window (any signed-in user)
 *   GET  /lecture-feedback/pending   the lectures whose form is open for the student and not yet sent (students only)
 *   POST /lecture-feedback           { event_id, overall, clarity, practice, pace, confidence, liked?, improve? }
 * Students only: a server without the routes (404/405/501), or an account that is not only a student (403), means
 * "no feedback to give", so the page shows nothing instead of an error.
 */
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

interface FormDto {
  questions?: QuestionDto[] | null
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
  try {
    // the server sends { questions: [...], opens_minutes_before_end, open_days_after_end }; a plain list works too
    const res = await authedRequest<FormDto | QuestionDto[] | null>('/lecture-feedback/form')
    const questions = (Array.isArray(res) ? res : res?.questions) ?? []
    const form = questions.map(mapQuestion).filter((q): q is FormQuestion => q !== null)
    return form.length > 0 ? form : LECTURE_FORM
  } catch {
    return LECTURE_FORM
  }
}

/** The lectures to rate now, or `null` when this server or account has no lecture feedback. */
export async function fetchPendingLectures(studentId: number): Promise<PendingLecture[] | null> {
  void studentId // the server knows the student from the session
  try {
    const rows = (await authedRequest<PendingDto[] | null>('/lecture-feedback/pending')) ?? []
    return rows.map(mapPending)
  } catch (e) {
    if (notThere(e)) return null
    throw e
  }
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
  void studentId
  const body = cleanAnswers(form, answers)
  try {
    await authedRequest('/lecture-feedback', {
      method: 'POST',
      body: { event_id: /^\d+$/.test(eventId) ? Number(eventId) : eventId, ...body },
    })
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 409)) throw e
  }
}
