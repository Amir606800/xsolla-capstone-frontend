import type { StandingLevel, WeeklyStanding } from '../types/standing'
import { parseStandingLevel } from '../utils/standing'
import { authedRequest } from './authed'
import { fetchByIds } from './batch'
import { ApiError } from './http'
import { mapModules } from './mappers'
import type { StoredStanding } from '../types/standing'
import type { ApiModule } from './types'

/**
 * Weekly grades on the real backend. A module is one week, and the week's grade of a student is the `grade` of
 * their enrollment in that module:
 *   GET   /modules                                    the weeks the caller is enrolled in (week N = the Nth, in course order)
 *   GET   /modules/:moduleId/enrollments              every enrollment of the week, each with `grade` (red | yellow | green)
 *   PATCH /modules/:moduleId/enrollments/:userId/grade  { grade, feedback }   mentor or admin
 * The module feedback (`feedback`, required with every grade) is the mentor's note on the week. The server may not keep
 * it yet (BACKEND_REQ_WEEK_FEEDBACK.md): it is sent anyway, and read back from the enrollment when the server has it.
 * Without `graded_at` the week's closing date stands in for the date.
 */

interface EnrollmentDto {
  id: number | string
  module_id: number | string
  user_id: number | string
  grade?: string | null
  /** The mentor's module feedback; absent until the server keeps it. */
  feedback?: string | null
  graded_at?: string | null
  /** The user id of whoever gave the grade (a mentor or an admin). */
  graded_by?: number | string | null
  /** Proposed (backend_requirements/BACKEND_REQ_ONE_ON_ONE_DEADLINES.md): the week's tasks handed in late, which made the grade red. */
  late_submissions?: { content_item_id: number | string; title: string; submitted_at?: string; due_at?: string }[] | null
  created_at: string
}

/** The titles of the week's late hand-ins, when the server lists them. */
const lateOf = (e: EnrollmentDto) => {
  const titles = (e.late_submissions ?? []).map((l) => l.title).filter(Boolean)
  return titles.length ? { lateTasks: titles } : {}
}

interface Week {
  moduleId: string
  week: number
  title: string
  /** Shown as "graded on": the server does not record when. */
  date: string
}

/** The weeks in the same order (and so with the same numbers) as the course pages. */
async function weeks(): Promise<Week[]> {
  const rows = (await authedRequest<ApiModule[] | null>('/modules')) ?? []
  return mapModules(rows, {}).map((m) => ({ moduleId: m.id, week: m.position, title: m.title, date: m.closesAt ?? m.createdAt ?? new Date().toISOString() }))
}

/** A week whose enrollments the caller may not read (403) counts as "no grades yet". */
async function enrollments(moduleId: string): Promise<EnrollmentDto[]> {
  try {
    return (await authedRequest<EnrollmentDto[] | null>(`/modules/${moduleId}/enrollments`)) ?? []
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return []
    throw e
  }
}

/** Every week's enrollments in one combined request (a week the caller may not read is left out). */
async function enrollmentsByWeek(list: Week[], one: (moduleId: string) => Promise<EnrollmentDto[] | undefined>) {
  return fetchByIds('enrollments', 'module_ids', list.map((w) => w.moduleId), one)
}

/** Every grade given to these students, week by week. */
async function gradesOf(studentIds: Set<number>): Promise<StoredStanding[]> {
  const list = await weeks()
  const byWeek = await enrollmentsByWeek(list, enrollments)
  const rows = list.map((w) => byWeek[w.moduleId] ?? [])
  const out: StoredStanding[] = []
  list.forEach((w, i) => {
    for (const e of rows[i]) {
      const level = parseStandingLevel(e.grade)
      const studentId = Number(e.user_id)
      if (level && studentIds.has(studentId)) {
        const note = e.feedback?.trim()
        out.push({ week: w.week, level, assessedAt: e.graded_at || w.date, studentId, ...(note ? { note } : {}), ...lateOf(e) })
      }
    }
  })
  return out.sort((a, b) => a.week - b.week || a.studentId - b.studentId)
}

/** The signed-in student's own grades. */
export async function fetchStandings(studentId: number): Promise<WeeklyStanding[]> {
  return (await gradesOf(new Set([studentId]))).map(({ week, level, assessedAt, note, lateTasks }) => ({
    week,
    level,
    assessedAt,
    ...(note ? { note } : {}),
    ...(lateTasks ? { lateTasks } : {}),
  }))
}

/** A grade with the week it is for: what the admin's Student reviews page lists. */
export interface WeekGrade extends StoredStanding {
  moduleId: string
  moduleTitle: string
  /** Whoever gave the grade; the page puts a name to the id. */
  gradedById?: number
}

/**
 * Every grade of every student, week by week (admin). `null` when the server lets this person read none of the weeks'
 * enrollments (so the page can say so instead of showing an empty list); a single week that is refused counts as ungraded.
 */
export async function fetchEveryGrade(): Promise<WeekGrade[] | null> {
  const list = await weeks()
  const byWeek = await enrollmentsByWeek(list, async (moduleId) => {
    try {
      return (await authedRequest<EnrollmentDto[] | null>(`/modules/${moduleId}/enrollments`)) ?? []
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return undefined // refused: left out
      throw e
    }
  })
  // a week left out of the answer was refused
  const refused = list.filter((w) => byWeek[w.moduleId] === undefined).length
  const rows = list.map((w) => byWeek[w.moduleId] ?? [])
  if (list.length > 0 && refused === list.length) return null
  const out: WeekGrade[] = []
  list.forEach((w, i) => {
    for (const e of rows[i]) {
      const level = parseStandingLevel(e.grade)
      if (!level) continue
      const note = e.feedback?.trim()
      out.push({
        week: w.week,
        moduleId: w.moduleId,
        moduleTitle: w.title,
        level,
        assessedAt: e.graded_at || w.date,
        studentId: Number(e.user_id),
        ...(note ? { note } : {}),
        ...(e.graded_by ? { gradedById: Number(e.graded_by) } : {}),
      })
    }
  })
  return out
}

/** The mentor's team: GET /mentors/me/team (404 = no team, so no grades). */
async function teamIds(): Promise<Set<number>> {
  try {
    const team = await authedRequest<{ members?: { id: number | string }[] | null }>('/mentors/me/team')
    return new Set((team.members ?? []).map((m) => Number(m.id)))
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return new Set()
    throw e
  }
}

export async function fetchTeamStandings(): Promise<StoredStanding[]> {
  return gradesOf(await teamIds())
}

/** Gives or changes one student's grade for one week, then returns the team's grades. */
export async function saveWeekGrade(studentId: number, week: number, level: StandingLevel, note: string): Promise<StoredStanding[]> {
  const feedback = note.trim()
  // required with every grade: refuse before anything is sent
  if (!feedback) throw new ApiError(422, 'validation_failed', 'Write the module feedback first: it is required with a week grade.')
  const target = (await weeks()).find((w) => w.week === week)
  if (!target) throw new ApiError(404, 'not_found', `Week ${week} is not on the server.`)
  try {
    await authedRequest(`/modules/${target.moduleId}/enrollments/${studentId}/grade`, {
      method: 'PATCH',
      body: { grade: level, feedback },
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new ApiError(404, 'not_found', 'This student is not enrolled in this week, so it cannot be graded.')
    throw e
  }
  return fetchTeamStandings()
}
