import { buildMockStandings } from '../mocks/standings'
import type { WeeklyStanding } from '../types/standing'

/**
 * MOCK implementation - the backend has no standings endpoint yet.
 * Expected real shape: GET /standings/me -> [{ week, level: 'green'|'yellow'|'red', assessed_at, note }]
 * (the signed-in student's weekly ratings from their mentor), run through `mapWeeklyStandings`.
 * A mentor sets one with PUT /students/:id/standings/:week { level, note }.
 */
const MOCK_LATENCY_MS = 300

export async function fetchStandings(): Promise<WeeklyStanding[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return buildMockStandings()
}
