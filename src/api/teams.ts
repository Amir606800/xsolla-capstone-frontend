import { buildMockTeam } from '../mocks/teams'
import type { Team } from '../types/team'
import type { User } from '../types/user'

/**
 * MOCK implementation - the backend has no teams endpoint yet.
 * Expected real shape: GET /teams/me -> { id, name, mentor, members[], cohort_size, team_count }
 * (the signed-in student's own team; every team has one mentor and 4-5 students).
 */
const MOCK_LATENCY_MS = 300

export async function fetchMyTeam(user: Pick<User, 'id' | 'name' | 'email'>): Promise<Team> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return buildMockTeam(user)
}
