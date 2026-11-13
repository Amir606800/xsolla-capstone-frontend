import { quizAttemptsOf } from '../mocks/contentEdits'
import type { QuizAttempt } from '../types/course'
import { hasBackend } from './http'

/** Each student's quiz attempts, by quiz id: `results[studentId][quizId]`. */
export type TeamQuizResults = Record<number, Record<string, QuizAttempt>>

/**
 * MENTOR: how the students of the team did on the quizzes. The server has no route that shows a mentor their students'
 * attempts yet (backend_requirements/BACKEND_REQ_MENTOR_QUIZ_RESULTS.md), so with a backend this resolves to `null` and the
 * grading page says quiz results are not available. Offline it reads the demo store.
 */
export async function fetchTeamQuizResults(studentIds: number[]): Promise<TeamQuizResults | null> {
  if (hasBackend()) return null
  const out: TeamQuizResults = {}
  for (const id of studentIds) out[id] = quizAttemptsOf(id)
  return out
}
