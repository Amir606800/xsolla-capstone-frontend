import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { fetchAiSummary, fetchLectureExpected, fetchMentor, fetchOverview, fetchPeople, fetchStudent } from './analytics.http'
import { saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { method: string; path: string; url: string; body?: unknown }
let calls: Call[]

type Route = { status: number; body?: unknown }

async function backend(routes: Record<string, Route>) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      calls.push({
        method: init.method ?? 'GET',
        path: path.split('?')[0],
        url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      })
      const r = routes[`${init.method ?? 'GET'} ${path.split('?')[0]}`] ?? {
        status: 404,
        body: { error: 'not_found', message: 'missing', status: 404 },
      }
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const WEEK = {
  module_id: 4,
  module_title: 'Week 4 · React',
  opens_at: '2026-09-20T20:00:00Z',
  green_count: 3,
  yellow_count: 1,
  red_count: 1,
  total_count: 5,
}

const overviewBody = {
  period: { from: '2026-09-01', to: '2026-11-14' },
  generated_at: '2026-11-14T17:00:00Z',
  weeks: [WEEK],
}

describe('analytics HTTP contract', () => {
  it('loads the overview with the chosen dates and maps the server names', async () => {
    await backend({ 'GET /analytics/overview': { status: 200, body: overviewBody } })
    const report = await fetchOverview('2026-09-01', '2026-11-14')
    expect(report.period).toEqual({ from: '2026-09-01', to: '2026-11-14' })
    expect(report.generatedAt).toBe('2026-11-14T17:00:00Z')
    expect(report.weeks[0]).toEqual({
      moduleId: 4,
      moduleTitle: 'Week 4 · React',
      opensAt: '2026-09-20T20:00:00Z',
      green: 3,
      yellow: 1,
      red: 1,
      total: 5,
    })
    expect(calls[0].url).toBe(`${BASE}/analytics/overview?from=2026-09-01&to=2026-11-14`)
  })

  it('omits empty dates so the backend applies its default period', async () => {
    await backend({ 'GET /analytics/overview': { status: 200, body: { ...overviewBody, weeks: [] } } })
    await fetchOverview('', '')
    expect(calls[0].url).toBe(`${BASE}/analytics/overview`)
  })

  it('pages the student selector on the server', async () => {
    await backend({ 'GET /analytics/students': { status: 200, body: [{ id: 7, name: 'Anna', email: 'anna@x.az' }] } })
    const rows = await fetchPeople('students', 'Ann', 20, 40)
    expect(rows).toEqual([{ id: 7, name: 'Anna', email: 'anna@x.az' }])
    expect(calls[0].url).toBe(`${BASE}/analytics/students?q=Ann&limit=20&offset=40`)
  })

  it("reads each student's average week grade and the level it rounds to", async () => {
    await backend({
      'GET /analytics/students': {
        status: 200,
        body: [
          { id: 7, name: 'Anna', grade_average: 2.7, grade_level: 'green', graded_weeks: 6 },
          { id: 8, name: 'Bek' },
          { id: 9, name: 'Cem', grade_average: 2, grade_level: 'purple', graded_weeks: 1 },
        ],
      },
    })
    expect(await fetchPeople('students', '', 20, 0)).toEqual([
      { id: 7, name: 'Anna', gradeAverage: 2.7, gradeLevel: 'green', gradedWeeks: 6 },
      { id: 8, name: 'Bek' },
      { id: 9, name: 'Cem' },
    ])
  })

  it('maps an unknown student or mentor to null', async () => {
    await backend({})
    expect(await fetchStudent(999)).toBeNull()
    expect(await fetchMentor(999)).toBeNull()
  })

  it('maps a student report and keeps a null accuracy', async () => {
    await backend({
      'GET /analytics/students/7': {
        status: 200,
        body: {
          student: { id: 7, name: 'Anna' },
          period: { from: '2026-09-01', to: '2026-11-14' },
          generated_at: '2026-11-14T17:00:00Z',
          assignment_status: { on_time_count: 4, late_count: 1, missing_count: 2, eligible_count: 7 },
          quiz_accuracy_by_module: [
            {
              module_id: 4,
              module_title: 'Week 4',
              opens_at: WEEK.opens_at,
              score_total: 0,
              possible_total: 0,
              accuracy: null,
              attempt_count: 1,
            },
          ],
        },
      },
    })
    const report = await fetchStudent(7)
    expect(report?.status).toEqual({ onTime: 4, late: 1, missing: 2, eligible: 7 })
    expect(report?.quizzes[0].accuracy).toBeNull()
  })

  it('always shows the four feedback dimensions, even when the server leaves one out', async () => {
    await backend({
      'GET /analytics/mentors/9': {
        status: 200,
        body: {
          mentor: { id: 9, name: 'Mira' },
          period: { from: '2026-09-01', to: '2026-11-14' },
          generated_at: '2026-11-14T17:00:00Z',
          feedback_by_dimension: [{ dimension: 'clarity', average: 4.44, count: 5 }],
          student_standing_by_week: [WEEK],
          standing_attribution: 'current_roster',
        },
      },
    })
    const report = await fetchMentor(9)
    expect(report?.feedback.map((f) => f.dimension)).toEqual(['clarity', 'engagement', 'comfort', 'time'])
    expect(report?.feedback[0]).toEqual({ dimension: 'clarity', average: 4.44, count: 5 })
    expect(report?.feedback[3]).toEqual({ dimension: 'time', average: null, count: 0 })
    expect(report?.attribution).toBe('current_roster')
  })

  it('lets authorization and server errors through to the page', async () => {
    await backend({
      'GET /analytics/overview': { status: 403, body: { error: 'forbidden', message: 'Admin only', status: 403 } },
    })
    await expect(fetchOverview()).rejects.toMatchObject({ status: 403, message: 'Admin only' })
  })
})

describe('AI summary HTTP contract', () => {
  const summaryBody = {
    summary: 'Students describe the mentor as clear.\n\nSessions sometimes run out of time.',
    source_count: 5,
    generated_at: '2026-11-16T08:30:00Z',
    cached: true,
    period: { from: '2026-09-01', to: '2026-11-16' },
  }

  it('asks for the period on screen and maps the answer; Regenerate sends force_refresh', async () => {
    await backend({ 'POST /analytics/mentors/7/ai-summary': { status: 200, body: summaryBody } })
    const s = await fetchAiSummary('mentors', 7, { from: '2026-09-01', to: '2026-11-16' })
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/analytics/mentors/7/ai-summary',
      body: { from: '2026-09-01', to: '2026-11-16', force_refresh: false },
    })
    expect(s).toEqual({
      summary: 'Students describe the mentor as clear.\n\nSessions sometimes run out of time.',
      sourceCount: 5,
      generatedAt: '2026-11-16T08:30:00Z',
      cached: true,
      period: { from: '2026-09-01', to: '2026-11-16' },
    })
    await fetchAiSummary('mentors', 7, { force: true })
    expect(calls[1].body).toEqual({ force_refresh: true })
  })

  it('nothing to summarise is a normal answer, and the AI being off is an error for the card', async () => {
    await backend({
      'POST /analytics/students/10/ai-summary': {
        status: 200,
        body: {
          ...summaryBody,
          summary: 'There is not enough feedback yet.',
          source_count: 0,
          generated_at: null,
          cached: false,
        },
      },
      'POST /analytics/students/11/ai-summary': {
        status: 503,
        body: { error: 'service_unavailable', message: 'the AI summary service is unavailable', status: 503 },
      },
    })
    expect(await fetchAiSummary('students', 10)).toMatchObject({ sourceCount: 0, generatedAt: null })
    await expect(fetchAiSummary('students', 11)).rejects.toMatchObject({ status: 503 })
  })

  it("the lecture summary gives each lecture's expected answers, keyed like the reviews; no route = unknown", async () => {
    await backend({
      'GET /lecture-feedback/summary': {
        status: 200,
        body: [
          { lecture: { event_id: 41, starts_at: '2026-11-12T15:00:00Z' }, responses: 14, expected: 18 },
          { lecture: { event_id: 42, starts_at: '2026-11-13T15:00:00Z' }, responses: 0, expected: null },
        ],
      },
    })
    expect(await fetchLectureExpected()).toEqual({ '41@2026-11-12T15:00:00Z': 18 })
    await backend({})
    expect(await fetchLectureExpected()).toEqual({})
  })
})
