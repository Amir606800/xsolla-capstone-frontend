import type { TeamPlan } from '../mocks/directory'
import { addUser, clearTeams, createTeams, deleteUser, listTeams, listUsers, setLeft, setMentorTeam, setRoles, setTeam, setTeamMentor, updateUser } from '../mocks/directory'
import type { SchoolTeam, SchoolUser } from '../types/admin'
import type { Role, User } from '../types/user'
import { type UserDto, mapUser } from './auth.http'
import { authedRequest } from './authed'
import { ApiError, apiRequest, hasBackend } from './http'

/**
 * The admin section's directory of people and teams.
 *  - Users: GET /users?search= (API_CONTRACT.md, admin only) with a backend, the offline mock otherwise.
 *    The backend does not serve that route yet, so with a backend this fails until it does.
 *  - Teams: the backend has no teams yet, so they always come from the mock (like the LMS team pages).
 *  - New students: POST /auth/signup (it makes a student account with the chosen password). The session
 *    signup opens for the new student is closed straight away; the admin stays signed in as themselves.
 *  - Changing or removing an account is not in the backend yet. These calls use the shape proposed to it:
 *      PATCH  /users/:id   { name?, email?, active? }   (active: false = left the school; the account is kept)
 *      DELETE /users/:id                                 (for good; for accounts made by mistake)
 *      POST   /users       { email, name, password, roles }   (a staff account, e.g. a new mentor)
 *      PUT    /users/:id/roles  { roles: ["mentor", "lecturer"], expires_at: { "lecturer": "<ISO>" } }
 *                          (a role in expires_at ends by itself at that moment; null or missing = no end)
 *    and say so plainly while the server does not have them.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

/** A user row, plus when they left the school (proposed: `left_at`, set while `active` is false). */
type DirectoryDto = UserDto & { left_at?: string | null; active?: boolean }

const toSchoolUser = (d: DirectoryDto): SchoolUser => ({ ...mapUser(d), ...(d.left_at ? { leftAt: d.left_at } : {}) })

export async function fetchUsers(): Promise<SchoolUser[]> {
  if (hasBackend()) {
    const list = await authedRequest<DirectoryDto[]>('/users?search=')
    return list.map(toSchoolUser).sort((a, b) => a.name.localeCompare(b.name))
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

export interface NewStudent {
  name: string
  email: string
  password: string
  /** The team to put them in, or null for none yet. */
  teamId: string | null
}

interface SignupResponse {
  access_token: string
  refresh_token: string
  user: UserDto
}

const TAKEN = 'There is already an account with this email.'

/** Creates a student account with the e-mail and password the admin chose, then puts them in a team. */
export async function createStudent(input: NewStudent): Promise<User> {
  let user: User
  if (hasBackend()) {
    let res: SignupResponse
    try {
      // not apiRequest's session helpers: the admin's own tokens must stay as they are
      res = await apiRequest<SignupResponse>('/auth/signup', {
        method: 'POST',
        body: { email: input.email.trim(), name: input.name.trim(), password: input.password },
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) throw new ApiError(409, 'conflict', TAKEN)
      throw e
    }
    // close the session signup opened for the new student (best effort)
    apiRequest<void>('/auth/logout', { method: 'POST', body: { refresh_token: res.refresh_token }, token: res.access_token }).catch(() => undefined)
    user = mapUser(res.user)
  } else {
    await wait()
    user = addUser({ name: input.name, email: input.email, roles: ['student'] })
  }
  // teams are not in the backend yet: always the mock
  if (input.teamId) setTeam(user.id, input.teamId)
  return user
}

/** A route the backend does not have yet answers 404/405: say what is missing instead. */
function notYet(e: unknown, what: string): never {
  if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)) {
    throw new ApiError(501, 'not_supported', `The server cannot ${what} yet.`)
  }
  if (e instanceof ApiError && e.status === 409) throw new ApiError(409, 'conflict', TAKEN)
  throw e
}

export interface StudentChanges {
  name: string
  email: string
  teamId: string | null
}

/** Corrects a student's name / e-mail and moves them to another team (or none). */
export async function updateStudent(id: number, changes: StudentChanges): Promise<void> {
  if (hasBackend()) {
    try {
      await authedRequest(`/users/${id}`, { method: 'PATCH', body: { name: changes.name.trim(), email: changes.email.trim() } })
    } catch (e) {
      notYet(e, 'change accounts')
    }
  } else {
    await wait()
    updateUser(id, { name: changes.name, email: changes.email })
  }
  setTeam(id, changes.teamId)
}

/** The student left the school (they can no longer sign in, their work is kept), or comes back. */
export async function setStudentLeft(id: number, left: boolean): Promise<void> {
  if (hasBackend()) {
    try {
      await authedRequest(`/users/${id}`, { method: 'PATCH', body: { active: !left } })
    } catch (e) {
      notYet(e, 'mark students as left')
    }
    if (left) setTeam(id, null)
    return
  }
  await wait()
  setLeft(id, left)
}

/** Deletes an account for good (a student or a staff member). */
export async function deleteAccount(id: number): Promise<void> {
  if (hasBackend()) {
    try {
      await authedRequest<void>(`/users/${id}`, { method: 'DELETE' })
    } catch (e) {
      notYet(e, 'delete accounts')
    }
    // teams are demo data: take them out of it too
    setTeam(id, null)
    setMentorTeam(id, null)
    return
  }
  await wait()
  deleteUser(id)
}
export const deleteStudent = deleteAccount

export interface NewMentor {
  name: string
  email: string
  password: string
  /** The team they will mentor, or null for none yet. */
  teamId: string | null
}

/** A new staff account with the given role, the chosen password, and (mentors only) the team they mentor. */
export async function createStaff(input: NewMentor, role: 'mentor' | 'lecturer'): Promise<User> {
  let user: User
  if (hasBackend()) {
    try {
      const dto = await authedRequest<UserDto>('/users', {
        method: 'POST',
        body: { email: input.email.trim(), name: input.name.trim(), password: input.password, roles: [role] },
      })
      user = mapUser(dto)
    } catch (e) {
      notYet(e, `create ${role} accounts`)
    }
  } else {
    await wait()
    user = addUser({ name: input.name, email: input.email, roles: [role] })
  }
  if (role === 'mentor' && input.teamId) setMentorTeam(user.id, input.teamId)
  return user
}

export const createMentor = (input: NewMentor) => createStaff(input, 'mentor')

export interface MentorChanges {
  name: string
  email: string
  teamId: string | null
}

/** Corrects a mentor's name / e-mail and sets the team they mentor (or none). */
export async function updateMentor(id: number, changes: MentorChanges): Promise<void> {
  if (hasBackend()) {
    try {
      await authedRequest(`/users/${id}`, { method: 'PATCH', body: { name: changes.name.trim(), email: changes.email.trim() } })
    } catch (e) {
      notYet(e, 'change accounts')
    }
  } else {
    await wait()
    updateUser(id, { name: changes.name, email: changes.email })
  }
  setMentorTeam(id, changes.teamId)
}

/** Sets someone's roles; `until` holds the roles given only for a while and when each ends. */
export async function setUserRoles(id: number, roles: Role[], until: Partial<Record<Role, string>> = {}): Promise<void> {
  if (roles.length === 0) throw new ApiError(400, 'bad_request', 'Keep at least one role.')
  if (hasBackend()) {
    try {
      await authedRequest(`/users/${id}/roles`, { method: 'PUT', body: { roles, expires_at: until } })
    } catch (e) {
      notYet(e, 'change roles')
    }
    return
  }
  await wait()
  setRoles(id, roles, until)
}

// ---------- teams (not in the backend yet: always the demo store) ----------

/** Replaces every team with these: random teams the admin has looked at and agreed to. */
export async function buildTeams(plan: TeamPlan[]): Promise<void> {
  await wait()
  createTeams(plan)
}

/** Removes every team. */
export async function removeAllTeams(): Promise<void> {
  await wait()
  clearTeams()
}

/** Puts a student in a team, or takes them out of theirs (null). */
export async function moveStudent(studentId: number, teamId: string | null): Promise<void> {
  await wait()
  setTeam(studentId, teamId)
}

/** Sets a team's mentor (they leave their old team); null leaves the team without one. */
export async function changeTeamMentor(teamId: string, mentorId: number | null): Promise<void> {
  await wait()
  setTeamMentor(teamId, mentorId)
}
