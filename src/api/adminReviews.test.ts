import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { fetchAllReviews, fetchMissingReviews, mapAdminReview } from './adminReviews'
import type { AdminReviewDto } from './adminReviews'
import { saveTokens } from './session'

const BASE = 'https://api.test'

const dto = (over: Partial<AdminReviewDto> = {}): AdminReviewDto => ({
  id: 7,
  module_id: 4,
  module_title: 'Go Basics',
  student: { id: 12, name: 'Sam Student', email: 'sam@example.com' },
  mentor: { id: 900, name: 'Rashad A.', email: 'rashad@example.com' },
  team: { id: 3, name: 'Team 3' },
  had_session: true,
  topics: ['goals', 'other'],
  other_topic: 'CV review',
  ratings: { clarity: 5, engagement: 4, comfort: 5, time: 3 },
  overall: 4,
  comment: 'More code reviews please',
  submitted_at: '2026-11-15T10:12:00Z',
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

describe('mapAdminReview', () => {
  it('maps a server row to the page’s review (ids as text, camelCase)', () => {
    expect(mapAdminReview(dto())).toEqual({
      id: '7',
      moduleId: '4',
      moduleTitle: 'Go Basics',
      studentId: 12,
      studentName: 'Sam Student',
      mentorId: 900,
      mentorName: 'Rashad A.',
      teamName: 'Team 3',
      hadSession: true,
      topics: ['goals', 'other'],
      otherTopic: 'CV review',
      ratings: { clarity: 5, engagement: 4, comfort: 5, time: 3 },
      overall: 4,
      comment: 'More code reviews please',
      submittedAt: '2026-11-15T10:12:00Z',
    })
  })

  it('a review without a session has a reason, and no ratings or topics', () => {
    const r = mapAdminReview(dto({ had_session: false, no_session_reason: 'not-scheduled', topics: null, other_topic: null, ratings: null, comment: null, team: null }))!
    expect(r.hadSession).toBe(false)
    expect(r.noSessionReason).toBe('not-scheduled')
    expect(r.topics).toEqual([])
    expect(r.ratings).toEqual({})
    expect(r).not.toHaveProperty('comment')
    expect(r).not.toHaveProperty('teamName')
  })

  it('ignores a topic, a reason or a rating the page does not know, so the server can add options later', () => {
    const r = mapAdminReview(dto({ topics: ['goals', 'sports'], ratings: { clarity: 9, engagement: 4, mood: 5 } }))!
    expect(r.topics).toEqual(['goals'])
    expect(r.ratings).toEqual({ engagement: 4 })
    expect(mapAdminReview(dto({ had_session: false, no_session_reason: 'weather' }))).not.toHaveProperty('noSessionReason')
  })

  it('drops a row with no usable overall score', () => {
    expect(mapAdminReview(dto({ overall: 0 }))).toBeNull()
    expect(mapAdminReview(dto({ overall: 3.5 }))).toBeNull()
  })
})

describe('fetchAllReviews', () => {
  it('reads GET /mentor-reviews (every filter is done in the page, so none is sent)', async () => {
    await backend({ 'GET /mentor-reviews': { status: 200, body: [dto(), dto({ id: 8, overall: 0 })] } })
    const rows = await fetchAllReviews()
    expect(rows?.map((r) => r.id)).toEqual(['7'])
  })

  it('an empty list (or null) is no reviews, not an error', async () => {
    await backend({ 'GET /mentor-reviews': { status: 200, body: null } })
    expect(await fetchAllReviews()).toEqual([])
  })

  it('a server without the route answers null, so the page can say so', async () => {
    await backend({})
    expect(await fetchAllReviews()).toBeNull()
  })

  it('403 and other failures are errors', async () => {
    await backend({ 'GET /mentor-reviews': { status: 403, body: { error: 'forbidden', message: 'admins only' } } })
    await expect(fetchAllReviews()).rejects.toThrow()
  })
})

describe('fetchMissingReviews', () => {
  const row = { student: { id: 32, name: 'Bek', email: 'bek@example.com' }, team: { id: 3, name: 'Team A' }, mentor: { id: 7, name: 'Mira', email: 'mira@example.com' } }

  it('asks GET /mentor-reviews/missing for one week and maps the students', async () => {
    await backend({ 'GET /mentor-reviews/missing?module_id=4': { status: 200, body: [row] } })
    expect(await fetchMissingReviews('4')).toEqual([{ studentId: 32, studentName: 'Bek', mentorId: 7, mentorName: 'Mira', teamName: 'Team A' }])
  })

  it('nobody missing is an empty list', async () => {
    await backend({ 'GET /mentor-reviews/missing?module_id=4': { status: 200, body: null } })
    expect(await fetchMissingReviews('4')).toEqual([])
  })

  it('a server that has no such route, or does not know the week (404), answers null', async () => {
    await backend({})
    expect(await fetchMissingReviews('4')).toBeNull()
  })

  it('other failures are errors', async () => {
    await backend({ 'GET /mentor-reviews/missing?module_id=4': { status: 500, body: { error: 'server_error', message: 'boom' } } })
    await expect(fetchMissingReviews('4')).rejects.toThrow()
  })
})
