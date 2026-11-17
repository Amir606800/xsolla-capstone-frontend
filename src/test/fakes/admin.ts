import type { AiSummary, AnalyticsPerson, AnalyticsRole } from '../../types/analytics'
import type { TeamQuizResults } from '../../api/quizResults'
import type { AdminReport, ReportChange, ReportPerson } from '../../types/report'
import { adminLectureReviews } from '../fixtures/adminLectureReviews'
import { adminReviews, missingReviews } from '../fixtures/adminReviews'
import { mockAiSummary, mockLectureExpected, mockMentor, mockOverview, mockPeople, mockStudent } from '../fixtures/analytics'
import { quizAttemptsOf } from '../fixtures/contentEdits'
import { buildMockModules } from '../fixtures/courses'
import { addReport, changeReport, listReports, removeReport } from '../fixtures/reports'
import { allStandings } from '../fixtures/standings'

/**
 * Test fakes of the admin's read-side APIs (reviews, student grades, analytics, reports) and the mentor's quiz results,
 * backed by the fixture school. The tests use these instead of a server (src/test/setup.ts); the app never does.
 */

// ---------- api/adminReviews, api/adminLectureReviews ----------
export const fetchAllReviews = async () => adminReviews()
export const fetchMissingReviews = async (moduleId: string) => missingReviews(moduleId)
export const fetchLectureReviews = async () => adminLectureReviews()

// ---------- api/studentReviews: the fixture grades (the real module puts the names to them) ----------
export function fixtureGrades() {
  const modules = buildMockModules(new Date())
  return allStandings().map((g) => {
    const m = modules.find((x) => x.position === g.week)
    return { ...g, moduleId: m?.id ?? String(g.week), moduleTitle: m?.title }
  })
}

// ---------- api/analytics (lecturers come from the people list, as in the real module) ----------
export const fetchOverview = async () => mockOverview()
export const fetchStudent = async (id: number) => mockStudent(id)
export const fetchMentor = async (id: number) => mockMentor(id)
export const fetchAiSummary = async (role: AnalyticsRole, id: number): Promise<AiSummary> => mockAiSummary(role, id)
export const fetchLectureExpected = async () => mockLectureExpected()
export const fetchStaffPeople = async (
  role: 'students' | 'mentors',
  q: string,
  limit: number,
  offset: number,
): Promise<AnalyticsPerson[]> => {
  const people = await mockPeople(role, q, limit, offset)
  if (role !== 'students') return people
  // as the server does: red 1, yellow 2, green 3, averaged over the graded weeks, .5 rounds up
  const value = { red: 1, yellow: 2, green: 3 } as const
  const levels = ['red', 'yellow', 'green'] as const
  return people.map((p) => {
    const mine = allStandings().filter((g) => g.studentId === p.id)
    if (mine.length === 0) return p
    const avg = mine.reduce((s, g) => s + value[g.level], 0) / mine.length
    return { ...p, gradeAverage: Math.round(avg * 10) / 10, gradeLevel: levels[Math.floor(avg + 0.5) - 1], gradedWeeks: mine.length }
  })
}

// ---------- api/reports ----------
export async function sendReport(subject: string, message: string, reporter?: ReportPerson) {
  const r = addReport(subject, message, reporter)
  return { id: r.id, subject: r.subject, message: r.message, createdAt: r.createdAt }
}
export const fetchReports = async (): Promise<AdminReport[] | null> => listReports()
export const fetchOpenReportCount = async () => listReports().filter((r) => r.status === 'open').length
export const updateReport = async (id: string, change: ReportChange, admin?: ReportPerson) => changeReport(id, change, admin)
export const deleteReport = async (id: string) => removeReport(id)

// ---------- api/quizResults ----------
export async function fetchTeamQuizResults(studentIds: number[]): Promise<TeamQuizResults | null> {
  const out: TeamQuizResults = {}
  for (const id of studentIds) out[id] = quizAttemptsOf(id)
  return out
}
