import { ApiError } from '../../api/http'
import type { MentorChanges, NewMentor, NewStudent, StudentChanges } from '../../api/directory'
import type { NewTeam, SchoolTeam, SchoolUser, TeamPlan } from '../../types/admin'
import type { Role, User } from '../../types/user'
import { emailError, nameError, passwordError } from '../../utils/credentials'
import {
  addTeam,
  addUser,
  clearTeams,
  createTeams,
  deleteTeam,
  deleteUser,
  listTeams,
  listUsers,
  setLeft,
  setMentorTeam,
  setPassword,
  setRoles,
  setTeam,
  setTeamMentor,
  updateUser,
} from '../fixtures/directory'

/**
 * Test fake of api/directory: the people and teams of the fixture school, kept in localStorage. The same input checks as
 * the real module, so the forms' error messages can be tested.
 */
function checkNewAccount(input: { name: string; email: string; password: string }): void {
  const problem = nameError(input.name) || emailError(input.email) || passwordError(input.password, input)
  if (problem) throw new ApiError(400, 'bad_request', problem)
}

export const fetchUsers = async (): Promise<SchoolUser[]> => listUsers()
export const fetchTeams = async (): Promise<SchoolTeam[]> => listTeams()

export async function createStudent(input: NewStudent): Promise<User> {
  checkNewAccount(input)
  const user = addUser({ name: input.name, email: input.email, roles: ['student'] })
  if (input.teamId) setTeam(user.id, input.teamId)
  return user
}

export async function updateStudent(id: number, changes: StudentChanges): Promise<void> {
  updateUser(id, { name: changes.name, email: changes.email })
  setTeam(id, changes.teamId)
}

export const setStudentLeft = async (id: number, left: boolean): Promise<void> => void setLeft(id, left)
export const deleteAccount = async (id: number): Promise<void> => deleteUser(id)
export const deleteStudent = deleteAccount

export async function createStaff(input: NewMentor, role: 'mentor' | 'lecturer'): Promise<User> {
  checkNewAccount(input)
  const user = addUser({ name: input.name, email: input.email, roles: [role] })
  if (role === 'mentor' && input.teamId) setMentorTeam(user.id, input.teamId)
  return user
}
export const createMentor = (input: NewMentor) => createStaff(input, 'mentor')

export async function updateMentor(id: number, changes: MentorChanges): Promise<void> {
  updateUser(id, { name: changes.name, email: changes.email })
  setMentorTeam(id, changes.teamId)
}

export async function resetPassword(id: number, password: string): Promise<void> {
  const weak = passwordError(password)
  if (weak) throw new ApiError(400, 'bad_request', weak)
  setPassword(id, password)
}

export async function setUserRoles(id: number, roles: Role[], until: Partial<Record<Role, string>> = {}): Promise<void> {
  if (roles.length === 0) throw new ApiError(400, 'bad_request', 'Keep at least one role.')
  setRoles(id, roles, until)
}

export const buildTeams = async (plan: TeamPlan[]): Promise<void> => createTeams(plan)
export const createTeam = async (team: NewTeam): Promise<SchoolTeam> => addTeam(team)
export const removeTeam = async (teamId: string): Promise<void> => deleteTeam(teamId)
export const removeAllTeams = async (): Promise<void> => clearTeams()
export const moveStudent = async (studentId: number, teamId: string | null): Promise<void> => setTeam(studentId, teamId)
export const changeTeamMentor = async (teamId: string, mentorId: number | null): Promise<void> => setTeamMentor(teamId, mentorId)
