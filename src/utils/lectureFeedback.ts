import type { CourseModule } from '../types/course'
import type { FormQuestion, LectureAnswers, PendingLecture } from '../types/lectureFeedback'

/** The form opens this long before the lecture ends (so it can be filled in class) and closes this long after (the server's rule). */
export const OPENS_BEFORE_END_MS = 10 * 60_000
export const OPEN_FOR_MS = 7 * 24 * 3_600_000

/** The form as the server has it (backend docs/lecture_feedback.md). Used when the server cannot send it, and in the demo. */
export const LECTURE_FORM: FormQuestion[] = [
  {
    id: 'overall',
    type: 'scale',
    required: true,
    label: 'How would you rate this lecture overall?',
    minLabel: 'Very bad',
    maxLabel: 'Very good',
  },
  {
    id: 'clarity',
    type: 'scale',
    required: true,
    label: 'How clear were the explanations?',
    minLabel: 'Very unclear',
    maxLabel: 'Very clear',
  },
  {
    id: 'practice',
    type: 'scale',
    required: true,
    label: 'How useful were the examples, live coding and exercises?',
    minLabel: 'Not useful',
    maxLabel: 'Very useful',
  },
  {
    id: 'pace',
    type: 'choice',
    required: true,
    label: 'How was the pace of the lecture?',
    options: [
      { value: 'too_slow', label: 'Too slow' },
      { value: 'just_right', label: 'Just right' },
      { value: 'too_fast', label: 'Too fast' },
    ],
  },
  {
    id: 'confidence',
    type: 'scale',
    required: true,
    label: 'How confident do you feel about this topic now, including your ability to complete the home task?',
    minLabel: 'Not confident at all',
    maxLabel: 'Very confident',
  },
  {
    id: 'liked',
    type: 'text',
    required: false,
    maxLength: 1000,
    label: 'What worked well? What should the lecturer keep doing?',
  },
  {
    id: 'improve',
    type: 'text',
    required: false,
    maxLength: 1000,
    label: 'What was unclear, or what could be improved?',
  },
]

/** Is the form of a lecture open at `now`? From 10 minutes before it ends until 7 days after. */
export function isFeedbackOpen(lecture: { endsAt: string }, now: Date): boolean {
  const end = new Date(lecture.endsAt).getTime()
  return now.getTime() >= end - OPENS_BEFORE_END_MS && now.getTime() < end + OPEN_FOR_MS
}

/**
 * The open lectures that belong on one module's page: the ones of that week, and those with no week that start while
 * the week runs (the server gives those to every student; they are shown with the week they happen in).
 */
export function lecturesOfModule(
  lectures: PendingLecture[],
  module: Pick<CourseModule, 'id' | 'opensAt' | 'closesAt'>,
): PendingLecture[] {
  return lectures
    .filter((l) => {
      if (l.moduleId !== undefined) return l.moduleId === module.id
      if (!module.opensAt || !module.closesAt) return false
      return l.startsAt >= module.opensAt && l.startsAt <= module.closesAt
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

/** The problems with a filled-in form, by question id; none when it can be sent. */
export function validateAnswers(form: FormQuestion[], answers: LectureAnswers): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const q of form) {
    const v = answers[q.id]
    if (q.type === 'text') {
      if (typeof v === 'string' && v.trim().length > q.maxLength) errors[q.id] = `Keep it under ${q.maxLength} characters.`
    } else if (q.required && (v === undefined || v === '')) {
      errors[q.id] = q.type === 'scale' ? 'Choose a rating.' : 'Choose one.'
    }
  }
  return errors
}

/** The answers as the server takes them: trimmed text, and no empty text at all. */
export function cleanAnswers(form: FormQuestion[], answers: LectureAnswers): LectureAnswers {
  const out: LectureAnswers = {}
  for (const q of form) {
    const v = answers[q.id]
    if (v === undefined) continue
    if (typeof v === 'string') {
      const t = v.trim()
      if (t) out[q.id] = t
    } else out[q.id] = v
  }
  return out
}

/** The demo store's (and the server's 409) answer to a second form for the same lecture. */
export const SENT_ALREADY = 'You have already sent feedback for this lecture.'
