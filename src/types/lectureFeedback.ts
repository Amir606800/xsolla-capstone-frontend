/**
 * Lecture feedback: after each lecture a student fills a short form about it (backend docs/lecture_feedback.md).
 * One form per student and lecture; only admins read the answers. The form is drawn from the server's question list.
 */

interface QuestionBase {
  /** Also the field of the answer in `POST /lecture-feedback`. */
  id: string
  label: string
  required: boolean
}

/** A 1-5 answer; the ends are named ("Very unclear" ... "Very clear"). */
export interface ScaleQuestion extends QuestionBase {
  type: 'scale'
  minLabel?: string
  maxLabel?: string
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice'
  options: { value: string; label: string }[]
}

export interface TextQuestion extends QuestionBase {
  type: 'text'
  maxLength: number
}

export type FormQuestion = ScaleQuestion | ChoiceQuestion | TextQuestion

/** What the student filled in, by question id. A text answer may be left out. */
export type LectureAnswers = Record<string, number | string | undefined>

/** A lecture whose form is open for the student and not yet sent. */
export interface PendingLecture {
  /** The lecture's event id. */
  eventId: string
  title: string
  startsAt: string
  endsAt: string
  /** The week (module) it belongs to; a lecture without a week is for every student. */
  moduleId?: string
  moduleTitle?: string
  /** The form stays open until this moment. */
  closesAt: string
}
