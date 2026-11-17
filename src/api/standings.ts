import type { Mentor, StandingLevel, StoredStanding, WeeklyStanding } from '../types/standing'
import * as http from './standings.http'

/**
 * Weekly green / yellow / red grades: the backend's enrollment grades (./standings.http). The week grade comes with the
 * mentor's module feedback (required). The mentor argument says who grades (the server knows it from the session).
 */
export type { Mentor, StoredStanding }

/** The signed-in student's weekly grades. */
export async function fetchStandings(studentId: number): Promise<WeeklyStanding[]> {
  return http.fetchStandings(studentId)
}

export async function fetchTeamStandings(mentor: Mentor): Promise<StoredStanding[]> {
  void mentor
  return http.fetchTeamStandings()
}

/** Gives or changes one student's grade for one week. Returns the team's grades. */
export async function saveWeekGrade(
  mentor: Mentor,
  studentId: number,
  week: number,
  level: StandingLevel,
  note: string,
): Promise<StoredStanding[]> {
  void mentor
  return http.saveWeekGrade(studentId, week, level, note)
}
