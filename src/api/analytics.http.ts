import type {
  AiSummary,
  AnalyticsPeriod,
  AnalyticsPerson,
  AnalyticsRole,
  AnalyticsWeek,
  AssignmentStatus,
  FeedbackDimension,
  FeedbackDimensionKey,
  MentorReport,
  OverviewReport,
  QuizAccuracy,
  StudentReport,
} from '../types/analytics'
import { authedRequest } from './authed'
import { ApiError } from './http'
import { parseStandingLevel } from '../utils/standing'

/**
 * The backend's admin-only analytics routes (docs/analytics.md):
 *   GET /analytics/overview?from=&to=
 *   GET /analytics/students?q=&limit=&offset=        active students, id/name/email
 *   GET /analytics/students/{id}?from=&to=
 *   GET /analytics/mentors?q=&limit=&offset=
 *   GET /analytics/mentors/{id}?from=&to=
 * `from`/`to` are inclusive school dates; omit them for the backend's default (last 12 weeks). Unknown people are a
 * 404, which the detail loaders turn into `null` so the page can show a not-found state.
 */
interface PeriodDto {
  from: string
  to: string
}

interface WeekDto {
  module_id: number
  module_title: string
  opens_at: string
  green_count: number
  yellow_count: number
  red_count: number
  total_count: number
}

interface PersonDto {
  id: number
  name: string
  email?: string
  /** Students: the average of their week grades and the level it rounds to (absent until a week is graded). */
  grade_average?: number | null
  grade_level?: string | null
  graded_weeks?: number | null
}

interface OverviewDto {
  period: PeriodDto
  generated_at: string
  weeks: WeekDto[]
}

interface StatusDto {
  on_time_count: number
  late_count: number
  missing_count: number
  eligible_count: number
}

interface QuizDto {
  module_id: number
  module_title: string
  opens_at: string
  score_total: number
  possible_total: number
  accuracy: number | null
  attempt_count: number
}

interface StudentDto {
  student: PersonDto
  period: PeriodDto
  generated_at: string
  assignment_status: StatusDto
  quiz_accuracy_by_module: QuizDto[]
}

interface FeedbackDto {
  dimension: string
  average: number | null
  count: number
}

interface MentorDto {
  mentor: PersonDto
  period: PeriodDto
  generated_at: string
  feedback_by_dimension: FeedbackDto[]
  student_standing_by_week: WeekDto[]
  standing_attribution: string
}

const DIMENSIONS: FeedbackDimensionKey[] = ['clarity', 'engagement', 'comfort', 'time']

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const period = (d: PeriodDto): AnalyticsPeriod => ({ from: d.from, to: d.to })

export const mapWeek = (d: WeekDto): AnalyticsWeek => ({
  moduleId: d.module_id,
  moduleTitle: d.module_title,
  opensAt: d.opens_at,
  green: d.green_count,
  yellow: d.yellow_count,
  red: d.red_count,
  total: d.total_count,
})

const mapPerson = (d: PersonDto): AnalyticsPerson => {
  const level = parseStandingLevel(d.grade_level)
  return {
    id: d.id,
    name: d.name,
    ...(d.email ? { email: d.email } : {}),
    ...(level && d.grade_average != null
      ? { gradeAverage: d.grade_average, gradeLevel: level, ...(d.graded_weeks ? { gradedWeeks: d.graded_weeks } : {}) }
      : {}),
  }
}

const mapStatus = (d: StatusDto): AssignmentStatus => ({
  onTime: d.on_time_count,
  late: d.late_count,
  missing: d.missing_count,
  eligible: d.eligible_count,
})

const mapQuiz = (d: QuizDto): QuizAccuracy => ({
  moduleId: d.module_id,
  moduleTitle: d.module_title,
  opensAt: d.opens_at,
  scoreTotal: d.score_total,
  possibleTotal: d.possible_total,
  accuracy: d.accuracy,
  attemptCount: d.attempt_count,
})

const mapFeedback = (dimension: FeedbackDimensionKey, average: number | null, count: number): FeedbackDimension => ({
  dimension,
  average,
  count,
})

export async function fetchOverview(from?: string, to?: string): Promise<OverviewReport> {
  const d = await authedRequest<OverviewDto>(`/analytics/overview${query({ from, to })}`)
  return { period: period(d.period), generatedAt: d.generated_at, weeks: (d.weeks ?? []).map(mapWeek) }
}

export async function fetchPeople(
  role: 'students' | 'mentors',
  q: string,
  limit: number,
  offset: number,
): Promise<AnalyticsPerson[]> {
  const rows = await authedRequest<PersonDto[] | null>(`/analytics/${role}${query({ q, limit, offset })}`)
  return (rows ?? []).map(mapPerson)
}

export async function fetchStudent(id: number, from?: string, to?: string): Promise<StudentReport | null> {
  try {
    const d = await authedRequest<StudentDto>(`/analytics/students/${id}${query({ from, to })}`)
    return {
      student: mapPerson(d.student),
      period: period(d.period),
      generatedAt: d.generated_at,
      status: mapStatus(d.assignment_status),
      quizzes: (d.quiz_accuracy_by_module ?? []).map(mapQuiz),
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

/** How long the page waits for a summary (the server gives up on the AI after 30 seconds per call; a proxy often cuts at a minute). */
export const SUMMARY_TIMEOUT_MS = 60_000

interface SummaryDto {
  summary: string
  source_count?: number
  generated_at?: string | null
  cached?: boolean
  period: PeriodDto
}

/**
 * POST /analytics/{students|mentors}/{id}/ai-summary {from?, to?, force_refresh}: the server reads the feedback, asks
 * the model (or its cache) and sends back plain text. `lecturers` uses the same shape on a route the backend does not
 * have yet (POST /analytics/lecturers/{id}/ai-summary over the lecture feedback); until it does that call is a 404.
 */
export async function fetchAiSummary(
  role: AnalyticsRole,
  id: number,
  { from, to, force = false }: { from?: string; to?: string; force?: boolean } = {},
): Promise<AiSummary> {
  const body = { ...(from ? { from } : {}), ...(to ? { to } : {}), force_refresh: force }
  // writing it can be slow, but never endless: after SUMMARY_TIMEOUT_MS the page says so and offers to try again
  const d = await authedRequest<SummaryDto>(`/analytics/${role}/${id}/ai-summary`, { method: 'POST', body, timeoutMs: SUMMARY_TIMEOUT_MS })
  return {
    summary: (d.summary ?? '').trim(),
    sourceCount: d.source_count ?? 0,
    generatedAt: d.generated_at ?? null,
    cached: !!d.cached,
    period: period(d.period),
  }
}

interface LectureSummaryDto {
  lecture: { event_id: number | string; starts_at: string }
  expected?: number | null
}

/**
 * How many students could answer each lecture's form (GET /lecture-feedback/summary, admin), keyed like `lectureKey`.
 * Optional: a server without the route gives `{}` and the page leaves the response rate out.
 */
export async function fetchLectureExpected(): Promise<Record<string, number>> {
  try {
    const rows = (await authedRequest<LectureSummaryDto[] | null>('/lecture-feedback/summary')) ?? []
    const out: Record<string, number> = {}
    for (const r of rows) if (typeof r.expected === 'number') out[`${r.lecture.event_id}@${r.lecture.starts_at}`] = r.expected
    return out
  } catch (e) {
    if (e instanceof ApiError && [403, 404, 405, 501].includes(e.status)) return {}
    throw e
  }
}

export async function fetchMentor(id: number, from?: string, to?: string): Promise<MentorReport | null> {
  try {
    const d = await authedRequest<MentorDto>(`/analytics/mentors/${id}${query({ from, to })}`)
    // The server always sends all four dimensions; a missing one is still shown, with no responses.
    const byKey = new Map((d.feedback_by_dimension ?? []).map((f) => [f.dimension, f]))
    return {
      mentor: mapPerson(d.mentor),
      period: period(d.period),
      generatedAt: d.generated_at,
      feedback: DIMENSIONS.map((key) => {
        const row = byKey.get(key)
        return mapFeedback(key, row?.average ?? null, row?.count ?? 0)
      }),
      weeks: (d.student_standing_by_week ?? []).map(mapWeek),
      attribution: d.standing_attribution,
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}
