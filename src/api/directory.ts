import { listTeams, listUsers } from '../mocks/directory'
import type { SchoolTeam } from '../types/admin'
import type { User } from '../types/user'
import { type UserDto, mapUser } from './auth.http'
import { authedRequest } from './authed'
import { hasBackend } from './http'

/**
 * The admin section's directory of people and teams.
 *  - Users: GET /users?search= (API_CONTRACT.md, admin only) with a backend, the offline mock otherwise.
 *    The backend does not serve that route yet, so with a backend this fails until it does.
 *  - Teams: the backend has no teams yet, so they always come from the mock (like the LMS team pages).
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchUsers(): Promise<User[]> {
  if (hasBackend()) {
    const list = await authedRequest<UserDto[]>('/users?search=')
    return list.map(mapUser).sort((a, b) => a.name.localeCompare(b.name))
  }
  await wait()
  return listUsers()
}

/** Always the mock: see above. */
export async function fetchTeams(): Promise<SchoolTeam[]> {
  await wait()
  return listTeams()
}

/** True while teams come from the mock even though a backend is configured (the admin is told so). */
export const teamsAreDemoData = () => hasBackend()
