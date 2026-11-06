import { buildMentorTeam, buildMockTeam } from '../mocks/teams'
import type { Team } from '../types/team'
import type { User } from '../types/user'

/**
 * MOCK implementation - the backend has no teams endpoint yet. Expected real shapes:
 *   GET /teams/me          student: their own team -> { id, name, mentor, members[], cohort_size, team_count }
 *   GET /mentors/me/team   mentor: the team they look after (same shape; 403 for anyone who is not a mentor)
 * Every team has one mentor and 4-5 students.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchMyTeam(user: Pick<User, 'id' | 'name' | 'email'>): Promise<Team> {
  await wait()
  return buildMockTeam(user)
}

export async function fetchMentorTeam(user: Pick<User, 'id' | 'name' | 'email'>): Promise<Team> {
  await wait()
  return buildMentorTeam(user)
}
