import type { Grader, TeamSubmission } from '../types/review'
import * as http from './reviews.http'

/**
 * The mentor's side of the task hand-ins (./reviews.http). Tasks get no grade (only the week does, see ./standings): the
 * mentor reads the work and may comment. The mentor argument says who comments (the server knows it from the session).
 */
export type { Grader }

export async function fetchTeamSubmissions(mentor: Grader): Promise<TeamSubmission[]> {
  void mentor
  return http.fetchTeamSubmissions()
}

/** Writes or changes the mentor's comment on a student's work. Returns the updated list. */
export async function commentOnSubmission(
  mentor: Grader,
  studentId: number,
  assignmentId: string,
  text: string,
): Promise<TeamSubmission[]> {
  void mentor
  return http.commentOnSubmission(studentId, assignmentId, text)
}
