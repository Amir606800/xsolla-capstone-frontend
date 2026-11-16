import { emailError, nameError, passwordError } from '../utils/credentials'
import type { NewTeam, SchoolTeam, SchoolUser, TeamPlan } from '../types/admin'
import type { Role, User } from '../types/user'
import { type UserDto, mapUser } from './auth.http'
import { authedRequest } from './authed'
import { ApiError } from './http'
import * as teamsApi from './teams.http'

/**
 * The admin section's directory of people and teams.
 *  - Users: GET /users?search= (admin, mentor, lecturer).
 *  - Teams: the backend's /teams routes (./teams.http).
 *  - New students: POST /auth/signup (it makes a student account with the chosen password). The session
 *    signup opens for the new student is closed straight away; the admin stays signed in as themselves.
 *  - Changing or removing an account is not in the backend yet. These calls use the shape proposed to it:
 *      PATCH  /users/:id   { name?, email?, active? }   (active: false = left the school; the account is kept)
 *      DELETE /users/:id                                 (for good; for accounts made by mistake)
 *      POST   /users       { email, name, password, roles }   (a staff account, e.g. a new mentor)
 *      PUT    /users/:id/roles  { roles: ["mentor", "lecturer"], expires_at: { "lecturer": "<ISO>" } }
 *                          (a role in expires_at ends by itself at that moment; null or missing = no end)
 *      PUT    /users/:id/password { password }       (the admin sets a new password; sessions end)
 *    and say so plainly while the server does not have them.
 */
/**
 * A user row, plus when they left the school (proposed: `left_at`, set while `active` is false) and
 * the role the account was created with (proposed: `main_role`, it never changes).
 */
type DirectoryDto = UserDto & { left_at?: string | null; active?: boolean; main_role?: string | null }

const MAIN_ROLES: readonly Role[] = ['student', 'mentor', 'lecturer', 'admin']

const toSchoolUser = (d: DirectoryDto): SchoolUser => {
  const main = d.main_role?.trim().toLowerCase() as Role | undefined
  return {
    ...mapUser(d),
    ...(d.left_at ? { leftAt: d.left_at } : {}),
    ...(main && MAIN_ROLES.includes(main) ? { mainRole: main } : {}),
  }
}

export async function fetchUsers(): Promise<SchoolUser[]> {
  const list = await authedRequest<DirectoryDto[]>('/users?search=')
  return list.map(toSchoolUser).sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchTeams(): Promise<SchoolTeam[]> {
  return teamsApi.listTeams()
}

/** A team route the server rejects: say what it is about, in plain words (422 and the like pass through). */
function teamCall<T>(run: () => Promise<T>, what: string): Promise<T> {
  return run().catch((e: unknown) => {
    if (e instanceof ApiError && (e.status === 405 || e.status === 501 || (e.status === 404 && e.code !== 'not_found'))) {
      throw new ApiError(501, 'not_supported', `The server cannot ${what} yet.`)
    }
    throw e
  })
}

export interface NewStudent {
  name: string
  email: string
  password: string
  /** The team to put them in, or null for none yet. */
  teamId: string | null
}

const TAKEN = 'There is already an account with this email.'

/** The name, e-mail and password of a new account must pass the rules in utils/credentials. */
function checkNewAccount(input: { name: string; email: string; password: string }): void {
  const problem = nameError(input.name) || emailError(input.email) || passwordError(input.password, input)
  if (problem) throw new ApiError(400, 'bad_request', problem)
}

/** Creates a student account with the e-mail and password the admin chose, then puts them in a team. */
export async function createStudent(input: NewStudent): Promise<User> {
  checkNewAccount(input)
  let user: User
  try {
    const dto = await authedRequest<UserDto>('/users', {
      method: 'POST',
      body: { email: input.email.trim(), name: input.name.trim(), password: input.password, roles: ['student'] },
    })
    user = mapUser(dto)
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) throw new ApiError(409, 'conflict', TAKEN)
    throw e
  }
  if (input.teamId) await teamsApi.placeStudent(user.id, input.teamId)
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
  try {
    await authedRequest(`/users/${id}`, { method: 'PATCH', body: { name: changes.name.trim(), email: changes.email.trim() } })
  } catch (e) {
    notYet(e, 'change accounts')
  }
  await teamsApi.placeStudent(id, changes.teamId)
}

/** The student left the school (they can no longer sign in, their work is kept), or comes back. */
export async function setStudentLeft(id: number, left: boolean): Promise<void> {
  try {
    await authedRequest(`/users/${id}`, { method: 'PATCH', body: { active: !left } })
  } catch (e) {
    notYet(e, 'mark students as left')
  }
  // the server takes a student who left out of their team
}

/** Deletes an account for good (a student or a staff member). */
export async function deleteAccount(id: number): Promise<void> {
  try {
    await authedRequest<void>(`/users/${id}`, { method: 'DELETE' })
  } catch (e) {
    notYet(e, 'delete accounts')
  }
  // the server frees their team slot (or leaves the team without a mentor)
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
  checkNewAccount(input)
  let user: User
  try {
    const dto = await authedRequest<UserDto>('/users', {
      method: 'POST',
      body: { email: input.email.trim(), name: input.name.trim(), password: input.password, roles: [role] },
    })
    user = mapUser(dto)
  } catch (e) {
    notYet(e, `create ${role} accounts`)
  }
  if (role === 'mentor' && input.teamId) await teamsApi.placeMentor(user.id, input.teamId)
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
  try {
    await authedRequest(`/users/${id}`, { method: 'PATCH', body: { name: changes.name.trim(), email: changes.email.trim() } })
  } catch (e) {
    notYet(e, 'change accounts')
  }
  await teamsApi.placeMentor(id, changes.teamId)
}

/**
 * Sets a new password for someone (the admin hands it over). Their old password stops working and the
 * server should end their sessions on every device.
 *   PUT /users/:id/password  { password }   -> 204
 */
export async function resetPassword(id: number, password: string): Promise<void> {
  const weak = passwordError(password)
  if (weak) throw new ApiError(400, 'bad_request', weak)
  try {
    await authedRequest<void>(`/users/${id}/password`, { method: 'PUT', body: { password } })
  } catch (e) {
    notYet(e, 'reset passwords')
  }
}

/**
 * Sets someone's roles; `until` holds the roles given only for a while and when each ends.
 * The main role must stay, with no end date: only the other staff role is added or taken back.
 */
export async function setUserRoles(id: number, roles: Role[], until: Partial<Record<Role, string>> = {}): Promise<void> {
  if (roles.length === 0) throw new ApiError(400, 'bad_request', 'Keep at least one role.')
  try {
    await authedRequest(`/users/${id}/roles`, { method: 'PUT', body: { roles, expires_at: until } })
  } catch (e) {
    notYet(e, 'change roles')
  }
}

// ---------- teams (the server's /teams routes) ----------

/** Replaces every team with these: random teams the admin has looked at and agreed to (PUT /teams). */
export async function buildTeams(plan: TeamPlan[]): Promise<void> {
  await teamCall(() => teamsApi.replaceTeams(plan), 'make teams')
}

/** Adds one team: a name, optionally a mentor and students without a team (POST /teams). */
export async function createTeam(team: NewTeam): Promise<SchoolTeam> {
  return teamCall(() => teamsApi.createTeam(team), 'add a team')
}

/**
 * Deletes one team; its students and mentor are left without a team (DELETE /teams/:id; a server without the route
 * says so instead of pretending).
 */
export async function removeTeam(teamId: string): Promise<void> {
  await teamCall(() => teamsApi.deleteTeam(teamId), 'delete a single team')
}

/** Removes every team (PUT /teams with no teams). */
export async function removeAllTeams(): Promise<void> {
  await teamCall(() => teamsApi.replaceTeams([]), 'remove teams')
}

/** Puts a student in a team, or takes them out of theirs (null). */
export async function moveStudent(studentId: number, teamId: string | null): Promise<void> {
  await teamCall(() => teamsApi.placeStudent(studentId, teamId), 'change teams')
}

/** Sets a team's mentor (they leave their old team); null leaves the team without one. */
export async function changeTeamMentor(teamId: string, mentorId: number | null): Promise<void> {
  await teamCall(() => teamsApi.setTeamMentor(teamId, mentorId), 'change mentors')
}
