import { PACES } from '../types/lectureReview'
import type { AdminLectureReview, Pace } from '../types/lectureReview'
import { average } from './reviewAnalytics'

/** An overall score at or below this is "low": worth a look. Same as for the mentor reviews. */
export const LOW_LECTURE_SCORE = 2

export const PACE_LABEL: Record<Pace, string> = { too_slow: 'Too slow', just_right: 'Just right', too_fast: 'Too fast' }

/** The scores asked about a lecture, with the word each is shown under. */
export const LECTURE_SCORES = [
  { key: 'overall', label: 'Overall' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'practice', label: 'Practice' },
  { key: 'confidence', label: 'Confidence' },
] as const
export type LectureScoreKey = (typeof LECTURE_SCORES)[number]['key']

export type LectureShow = 'all' | 'low' | 'comments'

export interface LectureFilter {
  /** A week (module id), 'none' for lectures with no week, or 'all'. */
  moduleId: string
  /** A lecturer's user id, 'none' for lectures with no lecturer, or 'all'. */
  lecturer: number | 'none' | 'all'
  /** One lecture (see `lectureKey`), or 'all'. */
  lecture: string
  /** Matches the student, the lecture, the lecturers and the comments. */
  query: string
  show: LectureShow
}

export const ALL_LECTURE_REVIEWS: LectureFilter = { moduleId: 'all', lecturer: 'all', lecture: 'all', query: '', show: 'all' }

/** One lecture. Event ids are the server's; the start is added so two lectures never share a key. */
export const lectureKey = (r: Pick<AdminLectureReview, 'lecture'>) => `${r.lecture.eventId}@${r.lecture.startsAt}`

const comments = (r: AdminLectureReview) => [r.liked, r.improve].filter((t): t is string => !!t)

/** The reviews that pass the filter, newest first. */
export function filterLectureReviews(reviews: AdminLectureReview[], f: LectureFilter): AdminLectureReview[] {
  const q = f.query.trim().toLowerCase()
  return reviews
    .filter((r) => {
      if (f.lecturer === 'none' ? r.lecturers.length > 0 : f.lecturer !== 'all' && !r.lecturers.some((l) => l.id === f.lecturer)) return false
      if (f.moduleId === 'none' ? r.lecture.moduleId !== undefined : f.moduleId !== 'all' && r.lecture.moduleId !== f.moduleId) return false
      if (f.lecture !== 'all' && lectureKey(r) !== f.lecture) return false
      if (f.show === 'low' && r.overall > LOW_LECTURE_SCORE) return false
      if (f.show === 'comments' && comments(r).length === 0) return false
      if (!q) return true
      return [r.studentName, r.lecture.title, r.lecture.moduleTitle, ...r.lecturers.map((l) => l.name), ...comments(r)].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.studentName.localeCompare(b.studentName))
}

export interface LectureSummary {
  reviews: number
  /** How many different lectures the reviews are about. */
  lectures: number
  scores: Record<LectureScoreKey, number | null>
  pace: Record<Pace, number>
  /** The share of reviews that said the pace was just right; null with no reviews. */
  justRight: number | null
  low: number
  withComments: number
}

export function summariseLectures(rows: AdminLectureReview[]): LectureSummary {
  const scores = {} as Record<LectureScoreKey, number | null>
  for (const { key } of LECTURE_SCORES) scores[key] = average(rows.map((r) => r[key]))
  const pace = Object.fromEntries(PACES.map((p) => [p, rows.filter((r) => r.pace === p).length])) as Record<Pace, number>
  return {
    reviews: rows.length,
    lectures: new Set(rows.map(lectureKey)).size,
    scores,
    pace,
    justRight: rows.length ? pace.just_right / rows.length : null,
    low: rows.filter((r) => r.overall <= LOW_LECTURE_SCORE).length,
    withComments: rows.filter((r) => comments(r).length > 0).length,
  }
}

export interface LecturerGroup extends LectureSummary {
  /** The lecturer's user id; null for the group of lectures that have no lecturer. */
  lecturerId: number | null
  name: string
}

export const NO_LECTURER = 'No lecturer assigned'

/**
 * The reviews grouped by lecturer, A-Z, with the lectures that have no lecturer last. A lecture taught by several
 * lecturers counts for each of them (the server ties a lecture to the lecturers of its week, not to one person).
 */
export function byLecturer(rows: AdminLectureReview[]): LecturerGroup[] {
  const groups = new Map<number | null, { name: string; rows: AdminLectureReview[] }>()
  const add = (id: number | null, name: string, r: AdminLectureReview) => groups.set(id, { name, rows: [...(groups.get(id)?.rows ?? []), r] })
  for (const r of rows) {
    if (r.lecturers.length === 0) add(null, NO_LECTURER, r)
    for (const l of r.lecturers) add(l.id, l.name, r)
  }
  return [...groups.entries()]
    .map(([lecturerId, g]) => ({ lecturerId, name: g.name, ...summariseLectures(g.rows) }))
    .sort((a, b) => (a.lecturerId === null ? 1 : b.lecturerId === null ? -1 : a.name.localeCompare(b.name)))
}

/** The lectures that were reviewed, newest first, for the lecture filter. */
export function lecturesOf(rows: AdminLectureReview[]): { key: string; title: string; startsAt: string }[] {
  const seen = new Map<string, { key: string; title: string; startsAt: string }>()
  for (const r of rows) seen.set(lectureKey(r), { key: lectureKey(r), title: r.lecture.title, startsAt: r.lecture.startsAt })
  return [...seen.values()].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}
