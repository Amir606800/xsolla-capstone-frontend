import type { SchoolTeam } from '../types/admin'
import { authedRequest } from './authed'

/**
 * The admin's team calls on the real backend (API_CONTRACT.md "Teams", admin only):
 *   GET    /teams                              all teams
 *   PUT    /teams                { teams: [{ mentor_id, student_ids }] }   replaces every team (names Team 1..n); [] = none
 *   POST   /teams                { name, mentor_id?, student_ids? }        adds ONE team
 *   POST   /teams/:id/students   { student_ids }                           adds students (never moves them: 422 if in another team)
 *   DELETE /teams/:id/students/:studentId                                  takes one student out
 *   PUT    /teams/:id/mentor     { mentor_id | null }                      sets the mentor (they leave a team they led)
 *   DELETE /teams/:id                                                      (proposed, the server has no such route yet)
 */

interface TeamDto {
  id: number | string
  name: string
  mentor_id: number | string | null
  student_ids: (number | string)[] | null
}

const mapTeam = (t: TeamDto): SchoolTeam => ({
  id: String(t.id),
  name: t.name,
  mentorId: t.mentor_id === null || t.mentor_id === undefined ? null : Number(t.mentor_id),
  studentIds: (t.student_ids ?? []).map(Number),
})

/** Teams in the order they were made (the server numbers them Team 1..n). */
export async function listTeams(): Promise<SchoolTeam[]> {
  const rows = await authedRequest<TeamDto[] | null>('/teams')
  return (rows ?? []).map(mapTeam).sort((a, b) => Number(a.id) - Number(b.id))
}

export async function replaceTeams(plan: { mentorId: number | null; studentIds: number[] }[]): Promise<SchoolTeam[]> {
  const rows = await authedRequest<TeamDto[] | null>('/teams', {
    method: 'PUT',
    body: { teams: plan.map((t) => ({ mentor_id: t.mentorId, student_ids: t.studentIds })) },
  })
  return (rows ?? []).map(mapTeam)
}

/**
 * One new team. The mentor is set in a second call: the server takes a mentor off the team they led
 * before when they are set with `PUT /teams/:id/mentor`, which the create call does not promise.
 */
export async function createTeam(team: { name: string; mentorId: number | null; studentIds: number[] }): Promise<SchoolTeam> {
  const made = mapTeam(
    await authedRequest<TeamDto>('/teams', { method: 'POST', body: { name: team.name.trim(), student_ids: team.studentIds } }),
  )
  if (team.mentorId === null) return made
  await setTeamMentor(made.id, team.mentorId)
  return { ...made, mentorId: team.mentorId }
}

export async function deleteTeam(teamId: string): Promise<void> {
  await authedRequest<void>(`/teams/${teamId}`, { method: 'DELETE' })
}

export async function addStudent(teamId: string, studentId: number): Promise<void> {
  await authedRequest<void>(`/teams/${teamId}/students`, { method: 'POST', body: { student_ids: [studentId] } })
}

export async function removeStudent(teamId: string, studentId: number): Promise<void> {
  await authedRequest<void>(`/teams/${teamId}/students/${studentId}`, { method: 'DELETE' })
}

export async function setTeamMentor(teamId: string, mentorId: number | null): Promise<void> {
  await authedRequest<void>(`/teams/${teamId}/mentor`, { method: 'PUT', body: { mentor_id: mentorId } })
}

/** Puts a student in a team or in none: out of the team they are in, then into the new one. */
export async function placeStudent(studentId: number, teamId: string | null): Promise<void> {
  const from = (await listTeams()).find((t) => t.studentIds.includes(studentId))
  if (from?.id === teamId) return
  if (from) await removeStudent(from.id, studentId)
  if (teamId !== null) await addStudent(teamId, studentId)
}

/** Makes someone the mentor of a team, or of none: the team they lead is left without one. */
export async function placeMentor(mentorId: number, teamId: string | null): Promise<void> {
  const led = (await listTeams()).find((t) => t.mentorId === mentorId)
  if (led?.id === teamId) return
  if (teamId !== null) await setTeamMentor(teamId, mentorId)
  else if (led) await setTeamMentor(led.id, null)
}
