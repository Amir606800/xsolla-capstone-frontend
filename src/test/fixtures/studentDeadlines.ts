import type { AssignmentItem, CourseModule, Submission } from '../../types/course'
import { studentDeadline } from '../../utils/deadline'

/**
 * The offline stand-in for the backend's deadlines: the server works out every student's deadline and late flag
 * (backend docs/one_on_one_deadlines.md); the app only shows them. Tests that play the server use these.
 */

/** Handed in after the deadline. */
export function isLateHandIn(submission: Pick<Submission, 'submittedAt'> | undefined, dueAt: string | undefined): boolean {
  return !!submission && !!dueAt && new Date(submission.submittedAt).getTime() > new Date(dueAt).getTime()
}

/**
 * The course as the server sends it to a student: every task carries the student's own deadline and every hand-in says whether it was
 * late. What the server already worked out (`dueFrom`, `late`) is kept; the rest is worked out here from the week and
 * the student's booked 1:1s. A week without an opening date has no deadline.
 */
export function withStudentDeadlines(modules: CourseModule[], booked: string[]): CourseModule[] {
  return modules.map((m) => {
    if (!m.items.some((i) => i.type === 'assignment')) return m
    const own = m.opensAt ? studentDeadline(m.opensAt, booked) : null
    return {
      ...m,
      items: m.items.map((i) => {
        if (i.type !== 'assignment') return i
        const due = i.dueFrom ? { dueAt: i.dueAt, dueFrom: i.dueFrom } : own
        const next: AssignmentItem = { ...i, dueAt: due?.dueAt, dueFrom: due?.dueFrom }
        if (!due) delete next.dueAt
        if (!due?.dueFrom) delete next.dueFrom
        if (next.submission && next.submission.late === undefined)
          next.submission = { ...next.submission, late: isLateHandIn(next.submission, next.dueAt) }
        return next
      }),
    }
  })
}

