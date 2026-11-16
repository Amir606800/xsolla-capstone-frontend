import type { QuizAttempt } from '../types/course'

/** Each student's quiz attempts, by quiz id: `results[studentId][quizId]`. */
export type TeamQuizResults = Record<number, Record<string, QuizAttempt>>

/**
 * MENTOR: how the students of the team did on the quizzes. The server has no route that shows a mentor their students'
 * attempts yet (BACKEND_REQ_MENTOR_QUIZ_RESULTS.md), so this resolves to `null` and the grading page says quiz results
 * are not available.
 */
export async function fetchTeamQuizResults(studentIds: number[]): Promise<TeamQuizResults | null> {
  void studentIds
  return null
}
