import { gradeWeek, type Mentor, type StoredStanding, standingsOf, teamStandings } from '../mocks/standings'
import type { StandingLevel, WeeklyStanding } from '../types/standing'
import { hasBackend } from './http'
import * as http from './standings.http'

/**
 * Weekly green / yellow / red grades: the real backend's enrollment grades (./standings.http) when VITE_API_URL is
 * set, the demo store otherwise. The server keeps no note (see capabilities.gradeNotesKept).
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { Mentor, StoredStanding }

/** The signed-in student's weekly grades. */
export async function fetchStandings(studentId = 1): Promise<WeeklyStanding[]> {
  if (hasBackend()) return http.fetchStandings(studentId)
  await wait()
  return standingsOf(studentId)
}

export async function fetchTeamStandings(mentor: Mentor): Promise<StoredStanding[]> {
  if (hasBackend()) return http.fetchTeamStandings()
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
  if (hasBackend()) return http.saveWeekGrade(studentId, week, level)
  await wait()
  return gradeWeek(mentor, studentId, week, level, note)
}
