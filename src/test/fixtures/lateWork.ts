import type { Submission } from '../../types/course'
import { studentDeadline } from '../../utils/deadline'
import { isLateHandIn } from './studentDeadlines'
import { listModules } from './contentEdits'
import { listSlots } from './slots'
import { markLate } from './standings'

/**
 * The offline stand-in for what the server does with a hand-in: compare it with the student's own deadline (08:00 on the
 * day of their 1:1 that week, or Monday 08:00) and, when it is late, mark it and turn the student's week grade red.
 * Late work is never refused.
 */
export function checkLateHandIn(
  studentId: number,
  assignmentId: string,
  submission: Submission,
  now: Date = new Date(),
): Submission {
  const module = listModules(now).find((m) => m.items.some((i) => i.id === assignmentId))
  const task = module?.items.find((i) => i.id === assignmentId)
  if (!module?.opensAt || !task) return submission
  const booked = listSlots({ id: studentId, name: '', roles: ['student'] }, now)
    .filter((s) => s.bookedBy?.id === studentId)
    .map((s) => s.startsAt)
  const late = isLateHandIn(submission, studentDeadline(module.opensAt, booked).dueAt)
  if (late) markLate(studentId, module.position, task.title, now)
  return { ...submission, late }
}
