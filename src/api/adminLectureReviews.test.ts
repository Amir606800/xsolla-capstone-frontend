import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { fetchLectureReviews, mapLectureReview } from './adminLectureReviews'
import type { LectureFeedbackDto } from './adminLectureReviews'
import { saveTokens } from './session'

// the real module: these tests check its HTTP calls (test/setup.ts fakes it for everything else)
vi.unmock('./adminLectureReviews')

const BASE = 'https://api.test'

const dto = (over: Partial<LectureFeedbackDto> = {}): LectureFeedbackDto => ({
  id: 7,
  lecture: {
    event_id: 41,
    title: 'Goroutines',
    starts_at: '2026-11-12T15:00:00Z',
    ends_at: '2026-11-12T17:00:00Z',
    module_id: 3,
    module_title: 'Week 3: Concurrency',
  },
  lecturers: [{ id: 20, name: 'Leyla', email: 'leyla@example.com' }],
  student: { id: 31, name: 'Anna', email: 'anna@example.com' },
  overall: 4,
  clarity: 5,
  practice: 3,
  pace: 'too_fast',
  confidence: 2,
  liked: 'The live coding',
  improve: 'A bit slower please',
  submitted_at: '2026-11-12T17:30:00Z',
  ...over,
})

async function backend(routes: Record<string, { status: number; body?: unknown }>) {
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const r = routes[`${init.method ?? 'GET'} ${url.replace(BASE, '')}`]
      return r ? new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status }) : new Response('404 page not found', { status: 404 })
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

describe('mapLectureReview', () => {
  it('maps a server row (ids as text, camelCase, the lecture and its lecturers)', () => {
    expect(mapLectureReview(dto())).toEqual({
      id: '7',
      lecture: {
        eventId: '41',
        title: 'Goroutines',
        startsAt: '2026-11-12T15:00:00Z',
        endsAt: '2026-11-12T17:00:00Z',
        moduleId: '3',
        moduleTitle: 'Week 3: Concurrency',
      },
      lecturers: [{ id: 20, name: 'Leyla' }],
      studentId: 31,
      studentName: 'Anna',
      overall: 4,
      clarity: 5,
      practice: 3,
      confidence: 2,
      pace: 'too_fast',
      liked: 'The live coding',
      improve: 'A bit slower please',
      submittedAt: '2026-11-12T17:30:00Z',
    })
  })

  it('a lecture without a week has no lecturers and no module; empty comments are left out', () => {
    const r = mapLectureReview(
      dto({ lecture: { event_id: 50, title: 'Intro', starts_at: 'a', ends_at: 'b', module_id: null, module_title: null }, lecturers: null, liked: '  ', improve: null }),
    )!
    expect(r.lecturers).toEqual([])
    expect(r.lecture).not.toHaveProperty('moduleId')
    expect(r).not.toHaveProperty('liked')
    expect(r).not.toHaveProperty('improve')
  })

  it('drops a row it cannot average: a score outside 1-5, a fraction, or a pace it does not know', () => {
    expect(mapLectureReview(dto({ overall: 0 }))).toBeNull()
    expect(mapLectureReview(dto({ clarity: 6 }))).toBeNull()
    expect(mapLectureReview(dto({ practice: 3.5 }))).toBeNull()
    expect(mapLectureReview(dto({ pace: 'sideways' }))).toBeNull()
  })
})

describe('fetchLectureReviews', () => {
  it('reads GET /lecture-feedback (no filter is sent: the page does that)', async () => {
    await backend({ 'GET /lecture-feedback': { status: 200, body: [dto(), dto({ id: 8, overall: 0 })] } })
    expect((await fetchLectureReviews())?.map((r) => r.id)).toEqual(['7'])
  })

  it('an empty list (or null) is no reviews, not an error', async () => {
    await backend({ 'GET /lecture-feedback': { status: 200, body: null } })
    expect(await fetchLectureReviews()).toEqual([])
  })

  it('a server without the route answers null, so the page can say so', async () => {
    await backend({})
    expect(await fetchLectureReviews()).toBeNull()
  })

  it('403 and other failures are errors', async () => {
    await backend({ 'GET /lecture-feedback': { status: 403, body: { error: 'forbidden', message: 'admins only' } } })
    await expect(fetchLectureReviews()).rejects.toThrow()
  })
})
