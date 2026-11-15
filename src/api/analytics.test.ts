import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { fetchMentor, fetchOverview, fetchPeople, fetchStudent } from './analytics.http'
import { saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { method: string; path: string; url: string }
let calls: Call[]

type Route = { status: number; body?: unknown }

async function backend(routes: Record<string, Route>) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      calls.push({ method: init.method ?? 'GET', path: path.split('?')[0], url })
      const r = routes[`${init.method ?? 'GET'} ${path.split('?')[0]}`] ?? { status: 404, body: { error: 'not_found', message: 'missing', status: 404 } }
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
            { module_id: 4, module_title: 'Week 4', opens_at: WEEK.opens_at, score_total: 0, possible_total: 0, accuracy: null, attempt_count: 1 },
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
    await backend({ 'GET /analytics/overview': { status: 403, body: { error: 'forbidden', message: 'Admin only', status: 403 } } })
    await expect(fetchOverview()).rejects.toMatchObject({ status: 403, message: 'Admin only' })
  })
})
