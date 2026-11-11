import { comment, type Grader, teamSubmissions } from '../mocks/submissions'
import type { TeamSubmission } from '../types/review'
import { ApiError, hasBackend } from './http'

/**
 * MOCK implementation - the mentor's side of the task submissions. Tasks get no grade (only the
 * week does, see ./standings): the mentor reads the work and may comment. Closest real calls in
 * API_CONTRACT.md:
 *   GET  /courses/:courseId/content-items/:assignmentId/submissions   roster of one task
 *   POST /submissions/:id/grade { grade, feedback }
 * To settle with the backend: a comment-only call without `grade` (e.g. PUT /submissions/:id/comment
 * { comment }), allowed for the mentor of the student's team, and one call for the team's work.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { Grader }

export async function fetchTeamSubmissions(mentor: Grader): Promise<TeamSubmission[]> {
  // the server does not let a mentor read the hand-ins yet (capabilities.mentorSeesTeamWork): never show demo work instead
  if (hasBackend()) return []
  await wait()
  return teamSubmissions(mentor)
}

/** Writes or changes the mentor's comment on a student's work. Returns the updated list. */
export async function commentOnSubmission(
  mentor: Grader,
  studentId: number,
  assignmentId: string,
  text: string,
): Promise<TeamSubmission[]> {
  if (hasBackend()) throw new ApiError(501, 'not_supported', 'The server cannot take mentor comments yet.')
  await wait()
  return comment(mentor, studentId, assignmentId, text)
}
