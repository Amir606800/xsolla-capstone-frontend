import { gradeWeek, type Mentor, type StoredStanding, standingsOf, teamStandings } from '../mocks/standings'
import type { StandingLevel, WeeklyStanding } from '../types/standing'

/**
 * MOCK implementation - the backend has no weekly grades yet. Expected real shapes:
 *   GET /standings/me                          student: own grades [{ week, level, assessed_at, note }]
 *   GET /mentors/me/standings                  mentor: every grade of their team (+ student_id)
 *   PUT /students/:id/standings/:week { level: 'green'|'yellow'|'red', note }   mentor of that student only
 * Rows go through `mapWeeklyStandings`.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { Mentor, StoredStanding }

/** The signed-in student's weekly grades. */
export async function fetchStandings(studentId = 1): Promise<WeeklyStanding[]> {
  await wait()
  return standingsOf(studentId)
}

export async function fetchTeamStandings(mentor: Mentor): Promise<StoredStanding[]> {
  await wait()
  return teamStandings(mentor)
}

/** Gives or changes one student's grade for one week. Returns the team's grades. */
export async function saveWeekGrade(
  mentor: Mentor,
  studentId: number,
  week: number,
  level: StandingLevel,
  note: string,
): Promise<StoredStanding[]> {
  await wait()
  return gradeWeek(mentor, studentId, week, level, note)
}
