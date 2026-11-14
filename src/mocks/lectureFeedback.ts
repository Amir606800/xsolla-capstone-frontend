import type { LectureAnswers, PendingLecture } from '../types/lectureFeedback'
import { isFeedbackOpen, OPEN_FOR_MS, SENT_ALREADY } from '../utils/lectureFeedback'
import { listEvents } from './contentEdits'

/**
 * Demo store of the lecture feedback (localStorage; offline demo only, a real server keeps its own). The lectures are
 * the demo calendar's, and the form is open under the server's rule: from 10 minutes before a lecture ends until 7 days
 * after. What a student sends is kept per student, so a lecture is asked about once.
 */
const KEY = 'lecture_feedback'

interface Sent {
  studentId: number
  eventId: string
  /** The demo calendar's ids are relative to today (lec-0 is this week's Monday), so a lecture is told apart by its start too. */
  startsAt: string
  answers: LectureAnswers
  submittedAt: string
}

function load(): Sent[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as Sent[]) : []
  } catch {
    return []
  }
}

/** The lectures whose form is open for this student and not yet sent, newest first. */
export function pendingLectures(studentId: number, now: Date = new Date()): PendingLecture[] {
  const sent = new Set(
    load()
      .filter((s) => s.studentId === studentId)
      .map((s) => `${s.eventId}@${s.startsAt}`),
  )
  return listEvents(now)
    .filter((e) => e.kind === 'lecture' && !e.source && !sent.has(`${e.id}@${e.startsAt}`) && isFeedbackOpen(e, now))
    .map((e) => ({
      eventId: e.id,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      ...(e.moduleId ? { moduleId: e.moduleId } : {}),
      closesAt: new Date(new Date(e.endsAt).getTime() + OPEN_FOR_MS).toISOString(),
    }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

/** Keeps one student's form for one lecture; a second one for the same lecture is refused, like the server's 409. */
export function addFeedback(studentId: number, eventId: string, answers: LectureAnswers, now: Date = new Date()): void {
  const lecture = listEvents(now).find((e) => e.id === eventId && e.kind === 'lecture')
  if (!lecture) throw new Error('Lecture not found.')
  const all = load()
  // checked before the window, like the server: a second send is always "already sent"
  if (all.some((s) => s.studentId === studentId && s.eventId === eventId && s.startsAt === lecture.startsAt))
    throw new Error(SENT_ALREADY)
  if (!isFeedbackOpen(lecture, now)) throw new Error('Feedback for this lecture is not open.')
  localStorage.setItem(
    KEY,
    JSON.stringify([...all, { studentId, eventId, startsAt: lecture.startsAt, answers, submittedAt: now.toISOString() }]),
  )
}

/** Every stored form (for tests). */
export const listFeedback = (): Sent[] => load()
