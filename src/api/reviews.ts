import { comment, type Grader, teamSubmissions } from '../mocks/submissions'
import type { TeamSubmission } from '../types/review'
import { hasBackend } from './http'
import * as http from './reviews.http'

/**
 * The mentor's side of the task hand-ins: the real backend (./reviews.http) when VITE_API_URL is set, the demo store
 * otherwise. Tasks get no grade (only the week does, see ./standings): the mentor reads the work and may comment.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { Grader }

export async function fetchTeamSubmissions(mentor: Grader): Promise<TeamSubmission[]> {
  if (hasBackend()) return http.fetchTeamSubmissions()
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
  if (hasBackend()) return http.commentOnSubmission(studentId, assignmentId, text)
  await wait()
  return comment(mentor, studentId, assignmentId, text)
}
