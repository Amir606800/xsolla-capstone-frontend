import type { AdminLectureReview, LectureLecturer, Pace } from '../../types/lectureReview'
import { PACES } from '../../types/lectureReview'
import type { Score } from '../../types/mentorReview'
import { lecturersOf } from '../../utils/content'
import { isStudent } from '../../utils/roles'
import { listEvents, listModules } from './contentEdits'
import { listUsers } from './directory'
import { listFeedback } from './lectureFeedback'

/**
 * Demo lecture reviews for the admin's Lecture reviews page (offline mode only; a real server sends its own). Every
 * student answers about three lectures in four that are over, with scores that differ by lecturer so the grouping has
 * something to show. A lecture is tied to the lecturers of its week, as the server does. It is worked out from the
 * calendar, the weeks and a fixed seed, so it is the same on every visit; what a student sends in the demo is added.
 */

/** A small deterministic generator: the same seed always gives the same row of numbers. */
function random(seed: number) {
  let s = (Math.abs(seed) * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const LIKED = [
  'The live coding made it click.',
  'Clear examples and a calm pace.',
  'I liked the exercises at the end.',
  'Good answers to questions from the room.',
]
const IMPROVE = [
  'A bit slower on the new part, please.',
  'More time for the exercises.',
  'The second half was hard to follow.',
  'Share the slides before the lecture.',
]

const clamp = (n: number): Score => Math.min(5, Math.max(1, Math.round(n))) as Score

/** Every demo review of the lectures that are over, plus what students sent in this browser. */
export function adminLectureReviews(now: Date = new Date()): AdminLectureReview[] {
  const users = listUsers(now)
  const names = new Map(users.map((u) => [u.id, u.name]))
  const students = users.filter((u) => isStudent(u) && !u.leftAt)
  const modules = listModules(now)
  const lectures = listEvents(now)
    .filter((e) => e.kind === 'lecture' && !e.source && new Date(e.endsAt) < now)
    .map((e) => {
      // a lecture without a week goes with the week it happens in
      const module =
        modules.find((m) => m.id === e.moduleId) ??
        modules.find((m) => m.opensAt && m.closesAt && e.startsAt >= m.opensAt && e.startsAt <= m.closesAt)
      const lecturers: LectureLecturer[] = lecturersOf(module).flatMap((id) =>
        names.has(id) ? [{ id, name: names.get(id) as string }] : [],
      )
      return { event: e, module, lecturers }
    })

  const out = new Map<string, AdminLectureReview>()
  for (const { event, module, lecturers } of lectures) {
    const lecture = {
      eventId: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      ...(module ? { moduleId: module.id, moduleTitle: module.title } : {}),
    }
    // each lecturer has a lean (-1 .. +1) so some are rated higher than others
    const lean = lecturers.length ? lecturers.reduce((n, l) => n + ((l.id * 37) % 5) / 2 - 1, 0) / lecturers.length : 0
    for (const student of students) {
      const next = random(student.id * 131 + new Date(event.startsAt).getTime() / 3600000)
      if (next() < 0.25) continue
      const base = 3.8 + lean * 0.9 + (next() - 0.5) * 2
      const pace: Pace = PACES[next() < 0.2 ? 0 : next() < 0.62 ? 1 : 2]
      const liked = next() > 0.6 ? LIKED[Math.floor(next() * LIKED.length)] : undefined
      const improve = next() > 0.65 ? IMPROVE[Math.floor(next() * IMPROVE.length)] : undefined
      out.set(`${student.id}:${event.id}@${event.startsAt}`, {
        id: `demo-${student.id}-${event.id}-${event.startsAt}`,
        lecture,
        lecturers,
        studentId: student.id,
        studentName: student.name,
        overall: clamp(base),
        clarity: clamp(base + (next() - 0.5) * 1.4),
        practice: clamp(base + (next() - 0.5) * 1.4),
        confidence: clamp(base - 0.4 + (next() - 0.5) * 1.6),
        pace,
        ...(liked ? { liked } : {}),
        ...(improve ? { improve } : {}),
        submittedAt: new Date(new Date(event.endsAt).getTime() + Math.round(next() * 40 * 3600 * 1000)).toISOString(),
      })
    }
  }

  // what a student sent in this browser replaces the made-up one for the same lecture
  for (const sent of listFeedback()) {
    const found = lectures.find((l) => l.event.id === sent.eventId && l.event.startsAt === sent.startsAt)
    const a = sent.answers
    const student = users.find((u) => u.id === sent.studentId)
    if (!found || !student) continue
    const sc = (v: unknown, fallback: Score) => (typeof v === 'number' ? clamp(v) : fallback)
    const liked = typeof a.liked === 'string' ? a.liked : undefined
    const improve = typeof a.improve === 'string' ? a.improve : undefined
    out.set(`${sent.studentId}:${sent.eventId}@${sent.startsAt}`, {
      id: `stored-${sent.studentId}-${sent.eventId}-${sent.startsAt}`,
      lecture: {
        eventId: found.event.id,
        title: found.event.title,
        startsAt: found.event.startsAt,
        endsAt: found.event.endsAt,
        ...(found.module ? { moduleId: found.module.id, moduleTitle: found.module.title } : {}),
      },
      lecturers: found.lecturers,
      studentId: sent.studentId,
      studentName: student.name,
      overall: sc(a.overall, 3),
      clarity: sc(a.clarity, 3),
      practice: sc(a.practice, 3),
      confidence: sc(a.confidence, 3),
      pace: PACES.find((p) => p === a.pace) ?? 'just_right',
      ...(liked ? { liked } : {}),
      ...(improve ? { improve } : {}),
      submittedAt: sent.submittedAt,
    })
  }
  return [...out.values()]
}
