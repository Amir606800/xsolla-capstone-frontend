import type { TeamSubmission } from '../types/review'
import { authedRequest } from './authed'
import { ApiError } from './http'
import { mapSubmission } from './mappers'
import type { ApiContentItem, ApiModule, ApiSubmission } from './types'

/**
 * The mentor's side of the hand-ins on the real backend (backend `8f04f85`: mentors see their own team only):
 *   GET  /modules                                                    the weeks their team's students are enrolled in
 *   GET  /modules/:moduleId/content-items                            the tasks of a week
 *   GET  /modules/:moduleId/content-items/:assignmentId/submissions  the team's hand-ins of one task (every attempt)
 *   POST /submissions/:id/feedback  { feedback }                     the mentor's comment, on the latest attempt
 * Tasks get no grade (only the week does); the comment is shown to the student as `feedback`.
 */

/** Hand-ins of the signed-in mentor's team, one per student and task: the latest attempt, earlier ones as history. */
export async function fetchTeamSubmissions(): Promise<TeamSubmission[]> {
  const modules = (await authedRequest<ApiModule[] | null>('/modules')) ?? []
  const tasks = (
    await Promise.all(
      modules.map(async (m) => {
        const items = (await authedRequest<ApiContentItem[] | null>(`/modules/${m.id}/content-items`)) ?? []
        return items.filter((i) => i.type === 'assignment').map((i) => ({ moduleId: String(m.id), assignmentId: String(i.id) }))
      }),
    )
  ).flat()
  const rosters = await Promise.all(
    tasks.map(({ moduleId, assignmentId }) =>
      authedRequest<ApiSubmission[] | null>(`/modules/${moduleId}/content-items/${assignmentId}/submissions`).then((r) => r ?? []),
    ),
  )
  return rosters.flatMap((rows, i) => latestPerStudent(rows, tasks[i].assignmentId))
}

/** Every attempt of one task -> one entry per student: the newest, with the others (newest first) as its history. */
export function latestPerStudent(rows: ApiSubmission[], assignmentId: string): TeamSubmission[] {
  const byStudent = new Map<number, ApiSubmission[]>()
  for (const row of rows) {
    const id = Number(row.student_id)
    byStudent.set(id, [...(byStudent.get(id) ?? []), row])
  }
  return [...byStudent.entries()].map(([studentId, attempts]) => {
    const [latest, ...older] = [...attempts].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
    const mapped = mapSubmission({ ...latest, history: older.length ? older : null })
    return {
      ...mapped,
      id: String(latest.id),
      assignmentId,
      studentId,
      // the server records when the comment was written in `graded_at`
      ...(latest.feedback && latest.graded_at ? { commentedAt: latest.graded_at } : {}),
    }
  })
}

/** Writes or changes the mentor's comment on a student's latest hand-in of a task, then returns the team's work. */
export async function commentOnSubmission(studentId: number, assignmentId: string, text: string): Promise<TeamSubmission[]> {
  const current = (await fetchTeamSubmissions()).find((s) => s.studentId === studentId && s.assignmentId === assignmentId)
  if (!current?.id) throw new ApiError(404, 'not_found', 'This work is not on the server any more.')
  await authedRequest(`/submissions/${current.id}/feedback`, { method: 'POST', body: { feedback: text.trim() } })
  return fetchTeamSubmissions()
}
