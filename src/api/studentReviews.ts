import { buildMockModules } from '../mocks/courses'
import { allStandings } from '../mocks/standings'
import type { StudentReview } from '../types/studentReview'
import { fetchTeams, fetchUsers } from './directory'
import { hasBackend } from './http'
import * as http from './standings.http'

/**
 * Every mentor's grade of every student, for the admin's Student reviews page. On the real backend a grade is the `grade`
 * (and `feedback`) of a student's enrollment in a week's module, so this reads every week's enrollments
 * (GET /modules/:id/enrollments) and puts names to the ids from the people and teams lists. `null` = the server lets
 * this person read none of them. Offline, the demo grades are listed.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

interface Grade {
  studentId: number
  week: number
  moduleId: string
  moduleTitle?: string
  level: StudentReview['level']
  assessedAt: string
  note?: string
  gradedBy?: { id: number; name: string }
}

export async function fetchStudentReviews(): Promise<StudentReview[] | null> {
  let grades: Grade[] | null
  if (hasBackend()) grades = await http.fetchEveryGrade()
  else {
    await wait()
    const modules = buildMockModules(new Date())
    grades = allStandings().map((g) => {
      const m = modules.find((x) => x.position === g.week)
      return { ...g, moduleId: m?.id ?? String(g.week), moduleTitle: m?.title }
    })
  }
  if (grades === null) return null

  // names are optional: a list that cannot be loaded leaves "Student #7" instead of failing the page
  const [users, teams] = await Promise.all([fetchUsers().catch(() => []), fetchTeams().catch(() => [])])
  const nameOf = new Map(users.map((u) => [u.id, u.name]))
  const teamOf = new Map(teams.flatMap((t) => t.studentIds.map((id) => [id, t] as const)))

  return grades.map((g): StudentReview => {
    const team = teamOf.get(g.studentId)
    const mentorId = g.gradedBy?.id ?? team?.mentorId ?? undefined
    const mentorName = g.gradedBy?.name ?? (mentorId === undefined ? undefined : nameOf.get(mentorId))
    return {
      id: `${g.studentId}:${g.moduleId}`,
      moduleId: g.moduleId,
      week: g.week,
      ...(g.moduleTitle ? { moduleTitle: g.moduleTitle } : {}),
      studentId: g.studentId,
      studentName: nameOf.get(g.studentId) ?? `Student #${g.studentId}`,
      ...(mentorId === undefined ? {} : { mentorId }),
      ...(mentorName ? { mentorName } : {}),
      ...(team ? { teamName: team.name } : {}),
      level: g.level,
      ...(g.note ? { note: g.note } : {}),
      gradedAt: g.assessedAt,
    }
  })
}
