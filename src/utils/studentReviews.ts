import type { StandingLevel } from '../types/standing'
import type { StudentReview } from '../types/studentReview'

/** Which reviews to list: all, one grade, or only those with module feedback. */
export type StudentShow = 'all' | StandingLevel | 'comments'

export interface StudentReviewFilter {
  /** A module id, or 'all'. */
  moduleId: string
  /** A mentor id, or 'all'. */
  mentorId: number | 'all'
  show: StudentShow
  query: string
}

export const ALL_STUDENT_REVIEWS: StudentReviewFilter = { moduleId: 'all', mentorId: 'all', show: 'all', query: '' }

/** The reviews that match, newest first (the latest week first, then by student name). */
export function filterStudentReviews(reviews: StudentReview[], f: StudentReviewFilter): StudentReview[] {
  const q = f.query.trim().toLowerCase()
  return reviews
    .filter((r) => {
      if (f.moduleId !== 'all' && r.moduleId !== f.moduleId) return false
      if (f.mentorId !== 'all' && r.mentorId !== f.mentorId) return false
      if (f.show === 'comments' ? !r.note : f.show !== 'all' && r.level !== f.show) return false
      if (!q) return true
      return [r.studentName, r.mentorName, r.teamName, r.note].some((v) => v?.toLowerCase().includes(q))
    })
    .sort((a, b) => b.gradedAt.localeCompare(a.gradedAt) || b.week - a.week || a.studentName.localeCompare(b.studentName))
}

/** The mentors that have given a grade, by name (for the filter). */
export function mentorsOf(reviews: StudentReview[]): { id: number; name: string }[] {
  const seen = new Map<number, string>()
  for (const r of reviews) if (r.mentorId !== undefined && !seen.has(r.mentorId)) seen.set(r.mentorId, r.mentorName ?? `Mentor #${r.mentorId}`)
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
