import { buildMentorTeam, buildMockTeam } from '../mocks/teams'
import type { Person, Team } from '../types/team'
import type { User } from '../types/user'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * The signed-in user's own team (the admin's team calls are in ./teams.http):
 *   GET /teams/me          student: their team -> { id, name, mentor?, members[], cohort_size, team_count }; 404 = no team
 *   GET /mentors/me/team   mentor: the team they look after (same shape); 404 = no team
 * Offline, the demo store builds one.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

interface PersonDto {
  id: number | string
  name: string
  email: string
  avatar_url?: string | null
}

export interface TeamDetailDto {
  id: number | string
  name: string
  /** Left out (or null) while the team has no mentor. */
  mentor?: PersonDto | null
  members?: PersonDto[] | null
  cohort_size?: number
  team_count?: number
}

const person = (p: PersonDto): Person => ({ id: Number(p.id), name: p.name, email: p.email, ...(p.avatar_url ? { avatarUrl: p.avatar_url } : {}) })

export function mapTeamDetail(t: TeamDetailDto): Team {
  const members = (t.members ?? []).map(person)
  return {
    id: String(t.id),
    name: t.name,
    ...(t.mentor ? { mentor: person(t.mentor) } : {}),
    members,
    cohortSize: t.cohort_size ?? members.length,
    teamCount: t.team_count ?? 1,
  }
}

/** One of the "my team" routes; 404 means the user is in no team (null), not an error. */
async function myTeam(path: string): Promise<Team | null> {
  try {
    return mapTeamDetail(await authedRequest<TeamDetailDto>(path))
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export async function fetchMyTeam(user: Pick<User, 'id' | 'name' | 'email'>): Promise<Team | null> {
  if (hasBackend()) return myTeam('/teams/me')
  await wait()
  return buildMockTeam(user)
}

export async function fetchMentorTeam(user: Pick<User, 'id' | 'name' | 'email'>): Promise<Team | null> {
  if (hasBackend()) return myTeam('/mentors/me/team')
  await wait()
  return buildMentorTeam(user)
}
